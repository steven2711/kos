import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { runResearch, runResearchCommand } from "../commands/research.js";
import {
  MockResearchWorker,
  type ResearchWorker,
  type ResearchRequest,
  type ResearchResult,
} from "../workers/research-worker.js";
import { loadTasks, saveTasks, mergeTasks } from "../tasks/task-store.js";
import { kosTask, markdownDoc } from "./support/builders.js";
import {
  makeTempVault,
  removeTempVault,
  writeVaultFile,
} from "./support/tmp-vault.js";
import { silenceLoopNarration } from "./support/silence-console.js";

silenceLoopNarration();

const CLOCK = (): Date => new Date("2026-06-27T00:00:00.000Z");

/** A rogue worker that writes outside 07 Research/ — the boundary guard must catch it. */
class CanonicalMutatingWorker implements ResearchWorker {
  readonly name = "rogue";
  async runResearchTask(req: ResearchRequest): Promise<ResearchResult> {
    await fs.mkdir(path.join(req.vaultPath, "04 Domain"), { recursive: true });
    await fs.writeFile(
      path.join(req.vaultPath, "04 Domain", "Rogue.md"),
      "# Rogue\n\nwritten where research may not write\n",
      "utf8",
    );
    return { success: true, finalText: "wrote a canonical doc", proposedTasks: [] };
  }
}

let dir: string;
beforeEach(async () => {
  dir = await makeTempVault("kos-research-");
  await writeVaultFile(dir, "Home.md", markdownDoc({ title: "Home" }));
  await writeVaultFile(
    dir,
    "07 Research/Research Map.md",
    markdownDoc({ type: "moc", title: "Research Map" }),
  );
  await writeVaultFile(
    dir,
    "01 Kernel/Constitution.md",
    "# Constitution\n\nv1 — sacred\n",
  );
});
afterEach(async () => {
  await removeTempVault(dir);
});

describe("kos research", () => {
  it("runs a one-off query: writes a cited doc, completes, and touches nothing canonical", async () => {
    const kernelBefore = await fs.readFile(
      path.join(dir, "01 Kernel", "Constitution.md"),
      "utf8",
    );

    const outcome = await runResearch(dir, {
      query: "competitors for collaborative AI storytelling",
      worker: new MockResearchWorker(),
      clock: CLOCK,
      quiet: true,
    });

    // The task ran and passed under the write-boundary guard.
    expect(outcome.boundaryViolations).toEqual([]);
    expect(outcome.passed).toBe(true);

    // A research document was created under 07 Research/.
    expect(outcome.createdDocs.some((p) => p.startsWith("07 Research/"))).toBe(true);
    const files = await fs.readdir(path.join(dir, "07 Research"));
    expect(files.some((f) => f.startsWith("2026-06-27 - Research"))).toBe(true);

    // The task is persisted complete, and the worker's follow-up is persisted.
    const tasks = await loadTasks(dir);
    expect(tasks.find((t) => t.type === "research")?.status).toBe("complete");
    expect(
      tasks.some((t) => t.origin === "research" && t.type === "founder_interview"),
    ).toBe(true);

    // The Research Report was written.
    const report = await fs.readFile(
      path.join(dir, "90 Meta", "Research Report.md"),
      "utf8",
    );
    expect(report).toContain("# Research Report");

    // No canonical doc was created and the Kernel is byte-for-byte unchanged.
    await expect(fs.readdir(path.join(dir, "04 Domain"))).rejects.toThrow();
    const kernelAfter = await fs.readFile(
      path.join(dir, "01 Kernel", "Constitution.md"),
      "utf8",
    );
    expect(kernelAfter).toBe(kernelBefore);
  });

  it("fails the task and flags a violation when the worker writes outside 07 Research/", async () => {
    const outcome = await runResearch(dir, {
      query: "anything",
      worker: new CanonicalMutatingWorker(),
      clock: CLOCK,
      quiet: true,
    });

    expect(outcome.boundaryViolations.length).toBeGreaterThan(0);
    expect(outcome.passed).toBe(false);
    const tasks = await loadTasks(dir);
    expect(tasks.find((t) => t.type === "research")?.status).toBe("failed");
  });

  it("with no query, selects the highest-priority open research task", async () => {
    let tasks = await loadTasks(dir);
    tasks = mergeTasks(
      tasks,
      [
        kosTask({
          type: "competitor_research",
          origin: "semantic",
          priority: "low",
          goal: "Research the competitor landscape",
        }),
      ],
      "2026-06-27T00:00:00.000Z",
    );
    await saveTasks(dir, tasks);

    const outcome = await runResearch(dir, {
      worker: new MockResearchWorker(),
      clock: CLOCK,
      quiet: true,
    });

    expect(outcome.task?.type).toBe("competitor_research");
    expect(outcome.task?.status).toBe("complete");
  });

  it("the CLI command runs in mock mode and returns exit code 0", async () => {
    const prev = process.env["KOS_RESEARCH_WORKER"];
    process.env["KOS_RESEARCH_WORKER"] = "mock";
    try {
      const code = await runResearchCommand(dir, "competitors");
      expect(code).toBe(0);
      const tasks = await loadTasks(dir);
      expect(tasks.find((t) => t.type === "research")?.status).toBe("complete");
    } finally {
      if (prev === undefined) delete process.env["KOS_RESEARCH_WORKER"];
      else process.env["KOS_RESEARCH_WORKER"] = prev;
    }
  });
});
