import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { runRunCommand } from "../commands/run.js";
import { loadTasks, saveTasks } from "../tasks/task-store.js";
import {
  type Worker,
  type WorkerRequest,
  type WorkerResult,
  MockWorker,
} from "../workers/claude.js";
import {
  makeTempVault,
  removeTempVault,
  writeVaultFile,
} from "./support/tmp-vault.js";
import { kosTask } from "./support/builders.js";
import { silenceLoopNarration } from "./support/silence-console.js";

silenceLoopNarration();

/**
 * A worker that edits a Kernel file — the forbidden action the run loop's
 * before/after snapshot exists to catch. This is a boundary fake (it stands in
 * for the SDK worker), not a mock of any owned logic.
 */
class KernelMutatingWorker implements Worker {
  readonly name = "kernel-mutator";
  async runTask(req: WorkerRequest): Promise<WorkerResult> {
    await fs.writeFile(
      path.join(req.vaultPath, "01 Kernel/Constitution.md"),
      "# Constitution\n\nmutated by a rogue worker\n",
      "utf8",
    );
    return { success: true, finalText: "edited the kernel" };
  }
}

/** A worker that reports success but writes a doc that worsens validation. */
class RegressingWorker implements Worker {
  readonly name = "regressor";
  async runTask(req: WorkerRequest): Promise<WorkerResult> {
    await writeVaultFile(
      req.vaultPath,
      "04 Domain/Regression.md",
      "# Bad\n\nLinks nowhere except [[A Document That Does Not Exist]].\n",
    );
    return { success: true, finalText: "added a broken document" };
  }
}

describe("run loop guards", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await makeTempVault("kos-run-");
    await writeVaultFile(dir, "Home.md", "# Home\n\nstub\n");
    await writeVaultFile(dir, "01 Kernel/Constitution.md", "# Constitution\n\nv1\n");
  });
  afterEach(async () => {
    await removeTempVault(dir);
  });

  it("fails the task and aborts when a worker edits the Kernel", async () => {
    const code = await runRunCommand(dir, {
      maxIterations: 1,
      worker: new KernelMutatingWorker(),
    });
    expect(code).toBe(1);

    const tasks = await loadTasks(dir);
    expect(tasks.some((t) => t.status === "failed")).toBe(true);
    expect(tasks.some((t) => t.status === "complete")).toBe(false);
  });

  it("fails the task when validation regresses, without aborting the run", async () => {
    const code = await runRunCommand(dir, {
      maxIterations: 1,
      worker: new RegressingWorker(),
    });
    expect(code).toBe(0);

    const tasks = await loadTasks(dir);
    expect(tasks.some((t) => t.status === "failed")).toBe(true);
    expect(tasks.some((t) => t.status === "complete")).toBe(false);
  });

  it("resumes stranded tasks on re-run: failed and in_progress are re-opened", async () => {
    // Simulate a previous run that left two tasks stranded — one that failed
    // (e.g. max-turns) and one interrupted mid-flight (Ctrl+C). Early createdAt +
    // critical priority makes the failed one sort ahead of any planner-generated
    // work, so the single iteration runs it.
    await saveTasks(dir, [
      kosTask({
        id: "T-100",
        type: "concept_extraction",
        status: "failed",
        priority: "critical",
        attempts: 1,
        goal: "extract concepts",
        createdAt: "2000-01-01T00:00:00.000Z",
      }),
      kosTask({
        id: "T-101",
        type: "domain_modeling",
        status: "in_progress",
        goal: "model the domain",
        createdAt: "2000-01-01T00:00:00.000Z",
      }),
    ]);

    const code = await runRunCommand(dir, {
      maxIterations: 1,
      worker: new MockWorker(),
    });
    expect(code).toBe(0);

    const tasks = await loadTasks(dir);
    const byId = (id: string): (typeof tasks)[number] | undefined =>
      tasks.find((t) => t.id === id);
    // The previously-failed task was reclaimed → open → executed → complete.
    expect(byId("T-100")?.status).toBe("complete");
    // The interrupted task was reclaimed to open (not run this single iteration).
    expect(byId("T-101")?.status).toBe("open");
  });
});
