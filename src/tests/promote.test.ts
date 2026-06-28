import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { runPromoteCommand } from "../commands/promote.js";
import { loadTasks, saveTasks } from "../tasks/task-store.js";
import { proposalTask, markdownDoc } from "./support/builders.js";
import {
  makeTempVault,
  removeTempVault,
  writeVaultFile,
} from "./support/tmp-vault.js";
import { silenceLoopNarration } from "./support/silence-console.js";

silenceLoopNarration();

const CLOCK = (): Date => new Date("2026-06-27T00:00:00.000Z");
const TARGET_REL = "04 Domain/Pricing.md";
const KERNEL_REL = "01 Kernel/Constitution.md";

/** Seed a knowledge_proposal task and return the on-disk task. */
async function seedProposalTask(dir: string, over = {}): Promise<void> {
  await saveTasks(dir, [
    proposalTask({
      id: "T-001",
      goal: "Propose promoting usage-based pricing",
      claim: "Usage-based pricing beats per-seat pricing",
      targetDocument: "[[Pricing]]",
      supportingDocuments: ["[[Pricing]]"],
      ...over,
    }),
  ]);
}

/** Read the single materialised proposal document (not the Map). */
async function readProposal(dir: string): Promise<string> {
  const files = await fs.readdir(path.join(dir, "11 Proposals"));
  const name = files.find((f) => f.startsWith("P-"));
  if (name === undefined) throw new Error("no proposal document was materialised");
  return fs.readFile(path.join(dir, "11 Proposals", name), "utf8");
}

let dir: string;
let pricingBefore: string;
beforeEach(async () => {
  dir = await makeTempVault("kos-promote-");
  await writeVaultFile(dir, "Home.md", markdownDoc({ title: "Home" }));
  await writeVaultFile(
    dir,
    TARGET_REL,
    markdownDoc({
      type: "concept",
      title: "Pricing",
      links: ["Home", "Home", "Home", "Home", "Home"],
    }),
  );
  await writeVaultFile(dir, KERNEL_REL, "# Constitution\n\nv1 — sacred\n");
  pricingBefore = await fs.readFile(path.join(dir, TARGET_REL), "utf8");
});
afterEach(async () => {
  await removeTempVault(dir);
});

describe("kos promote", () => {
  it("approves a proposal: appends a provenance block, marks it merged, leaves the Kernel untouched", async () => {
    const kernelBefore = await fs.readFile(path.join(dir, KERNEL_REL), "utf8");
    await seedProposalTask(dir);

    const code = await runPromoteCommand(dir, {
      decision: "approve",
      clock: CLOCK,
      quiet: true,
    });
    expect(code).toBe(0);

    // The approved change was appended to the target, with provenance.
    const pricing = await fs.readFile(path.join(dir, TARGET_REL), "utf8");
    expect(pricing).toContain("## Promoted Knowledge:");
    expect(pricing).toContain("founder-approved");
    expect(pricing).toContain("# Pricing"); // original content preserved

    // The proposal is merged and its source task is complete.
    expect(await readProposal(dir)).toContain("status: merged");
    const tasks = await loadTasks(dir);
    expect(tasks.find((t) => t.type === "knowledge_proposal")?.status).toBe("complete");

    // The report was written and the Kernel is byte-for-byte unchanged.
    const report = await fs.readFile(
      path.join(dir, "90 Meta", "Promotion Report.md"),
      "utf8",
    );
    expect(report).toContain("# Promotion Report");
    expect(await fs.readFile(path.join(dir, KERNEL_REL), "utf8")).toBe(kernelBefore);
  });

  it("rejects a proposal: the target is untouched and the task fails", async () => {
    await seedProposalTask(dir);

    const code = await runPromoteCommand(dir, {
      decision: "reject",
      clock: CLOCK,
      quiet: true,
    });
    expect(code).toBe(0); // a rejection is a clean outcome, not a failure

    expect(await fs.readFile(path.join(dir, TARGET_REL), "utf8")).toBe(pricingBefore);
    expect(await readProposal(dir)).toContain("status: rejected");
    const tasks = await loadTasks(dir);
    expect(tasks.find((t) => t.type === "knowledge_proposal")?.status).toBe("failed");
  });

  it("rolls back a merge that would break validation, restoring the target", async () => {
    // The proposal cites an unresolvable document; merging it would add an
    // LNK-003 error to the target, so the merge must roll back.
    await seedProposalTask(dir, { supportingDocuments: ["[[Ghost]]"] });

    const code = await runPromoteCommand(dir, {
      decision: "approve",
      clock: CLOCK,
      quiet: true,
    });
    expect(code).toBe(1); // a rollback is a hard failure

    // The target is restored byte-for-byte and the proposal is not merged.
    expect(await fs.readFile(path.join(dir, TARGET_REL), "utf8")).toBe(pricingBefore);
    expect(await readProposal(dir)).toContain("status: review");
  });

  it("refuses to merge into the Kernel and records a violation", async () => {
    const kernelBefore = await fs.readFile(path.join(dir, KERNEL_REL), "utf8");
    await seedProposalTask(dir, {
      goal: "Propose editing the Constitution",
      claim: "The Constitution should change",
      targetDocument: "[[Constitution]]",
      supportingDocuments: ["[[Pricing]]"],
    });

    const code = await runPromoteCommand(dir, {
      decision: "approve",
      clock: CLOCK,
      quiet: true,
    });
    expect(code).toBe(1); // a boundary violation is a hard failure

    expect(await fs.readFile(path.join(dir, KERNEL_REL), "utf8")).toBe(kernelBefore);
    expect(await readProposal(dir)).toContain("status: review"); // never merged
  });
});
