import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { analyzeVault } from "../commands/analyze.js";
import { loadTasks } from "../tasks/task-store.js";
import { snapshotKernel } from "../core/vault.js";
import { MockSemanticReviewer } from "../workers/semantic-reviewer.js";
import { markdownDoc } from "./support/builders.js";
import {
  makeTempVault,
  removeTempVault,
  writeVaultFile,
} from "./support/tmp-vault.js";

let dir: string;
beforeEach(async () => {
  dir = await makeTempVault("kos-analyze-");
  await writeVaultFile(dir, "Home.md", "# Home\n\nstub\n");
  await writeVaultFile(dir, "01 Kernel/Constitution.md", "# Constitution\n\nv1\n");
  await writeVaultFile(
    dir,
    "02 Vision/Vision.md",
    markdownDoc({ type: "vision", title: "Vision", links: ["Home"] }),
  );
});
afterEach(async () => {
  await removeTempVault(dir);
});

describe("kos analyze", () => {
  it("writes the Semantic Report and feeds advisory tasks to the planner", async () => {
    const kernelBefore = await snapshotKernel(dir);
    const visionBefore = await fs.readFile(
      path.join(dir, "02 Vision", "Vision.md"),
      "utf8",
    );

    const { review, tasks } = await analyzeVault(dir, {
      reviewer: new MockSemanticReviewer(),
      quiet: true,
    });

    // The report is written and reflects the review.
    const report = await fs.readFile(
      path.join(dir, "90 Meta", "Semantic Report.md"),
      "utf8",
    );
    expect(report).toContain("# Semantic Report");
    expect(report).toContain("Advisory only");
    expect(review.findings.length).toBeGreaterThan(0);

    // Findings became optional work: every semantic task is low-priority advisory.
    const semantic = tasks.filter((t) => t.origin === "semantic");
    expect(semantic.length).toBeGreaterThan(0);
    for (const t of semantic) expect(t.priority).toBe("low");
    // The contradiction is asked of the founder, never assumed.
    expect(semantic.some((t) => t.type === "founder_interview")).toBe(true);

    // Persisted to the store.
    const persisted = await loadTasks(dir);
    expect(persisted.filter((t) => t.origin === "semantic").length).toBe(
      semantic.length,
    );

    // The reviewer mutated no documents and never touched the Kernel.
    const visionAfter = await fs.readFile(
      path.join(dir, "02 Vision", "Vision.md"),
      "utf8",
    );
    expect(visionAfter).toBe(visionBefore);
    await expect(fs.readdir(path.join(dir, "04 Domain"))).rejects.toThrow();
    const kernelAfter = await snapshotKernel(dir);
    expect([...kernelAfter.entries()]).toEqual([...kernelBefore.entries()]);
  });

  it("does not promote suggestions or low-confidence findings to tasks", async () => {
    // A reviewer that only emits advisory-only findings creates no tasks.
    const reviewer = {
      name: "suggest-only",
      review: () =>
        Promise.resolve({
          findings: [
            {
              class: "suggestion" as const,
              confidence: "high" as const,
              title: "Soft idea",
              reasoning: "Just a thought.",
              supportingDocuments: ["02 Vision/Vision.md"],
              recommendedAction: "Maybe consider it.",
            },
          ],
        }),
    };

    const { tasks } = await analyzeVault(dir, { reviewer, quiet: true });
    expect(tasks.filter((t) => t.origin === "semantic")).toHaveLength(0);
    // The report is still written (advisory findings are surfaced, not actioned).
    const report = await fs.readFile(
      path.join(dir, "90 Meta", "Semantic Report.md"),
      "utf8",
    );
    expect(report).toContain("Soft idea");
  });
});
