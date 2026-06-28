import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  MockResearchWorker,
  parseProposedTasks,
  type ResearchRequest,
} from "../workers/research-worker.js";
import { loadVault } from "../core/vault.js";
import { compileDocs } from "../core/compiler.js";
import { kosTask, markdownDoc } from "./support/builders.js";
import {
  makeTempVault,
  removeTempVault,
  writeVaultFile,
} from "./support/tmp-vault.js";

const CLOCK = (): Date => new Date("2026-06-27T12:00:00.000Z");

function request(dir: string): ResearchRequest {
  return {
    vaultPath: dir,
    task: kosTask({ id: "T-001", type: "research", origin: "research" }),
    systemPrompt: "ignored by the mock",
    prompt: "ignored by the mock",
    query: "competitors for collaborative AI storytelling",
    clock: CLOCK,
  };
}

let dir: string;
beforeEach(async () => {
  dir = await makeTempVault("kos-research-worker-");
  // Targets so the document's wikilinks resolve when compiled.
  await writeVaultFile(dir, "Home.md", markdownDoc({ title: "Home" }));
  await writeVaultFile(
    dir,
    "07 Research/Research Map.md",
    markdownDoc({ type: "moc", title: "Research Map" }),
  );
});
afterEach(async () => {
  await removeTempVault(dir);
});

describe("MockResearchWorker", () => {
  it("writes a deterministic, validator-passing research document offline", async () => {
    const worker = new MockResearchWorker();
    const result = await worker.runResearchTask(request(dir));

    expect(result.success).toBe(true);
    const rel = "07 Research/2026-06-27 - Research T-001.md";
    const written = await fs.readFile(path.join(dir, rel), "utf8");
    expect(written).toContain("type: research");
    expect(written).toContain("## Sources");

    // The written document passes the compiler with no errors of its own.
    const docs = await loadVault(dir);
    const errors = compileDocs(docs).errors.filter((e) => e.path === rel);
    expect(errors).toEqual([]);
  });

  it("is deterministic under a fixed clock (same content across runs)", async () => {
    const worker = new MockResearchWorker();
    const rel = path.join(dir, "07 Research", "2026-06-27 - Research T-001.md");
    await worker.runResearchTask(request(dir));
    const first = await fs.readFile(rel, "utf8");
    await worker.runResearchTask(request(dir));
    const second = await fs.readFile(rel, "utf8");
    expect(second).toBe(first);
  });

  it("proposes a founder-interview follow-up tagged origin research", async () => {
    const result = await new MockResearchWorker().runResearchTask(request(dir));
    expect(result.proposedTasks).toHaveLength(1);
    expect(result.proposedTasks[0]?.type).toBe("founder_interview");
    expect(result.proposedTasks[0]?.origin).toBe("research");
    expect((result.proposedTasks[0]?.questions ?? []).length).toBeGreaterThan(0);
  });
});

describe("parseProposedTasks", () => {
  it("extracts proposals from a fenced JSON block and defaults priority/origin", () => {
    const text =
      'Done.\n```json\n{"proposedTasks":[{"type":"founder_interview","goal":"ask the founder"}]}\n```';
    const specs = parseProposedTasks(text);
    expect(specs).toHaveLength(1);
    expect(specs[0]?.type).toBe("founder_interview");
    expect(specs[0]?.priority).toBe("low");
    expect(specs[0]?.origin).toBe("research");
  });

  it("returns no tasks for unparsable output", () => {
    expect(parseProposedTasks("no json here")).toEqual([]);
  });

  it("returns no tasks when a proposal has an unknown type", () => {
    expect(
      parseProposedTasks('{"proposedTasks":[{"type":"mystery","goal":"x"}]}'),
    ).toEqual([]);
  });
});
