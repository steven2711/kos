import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { runRunCommand } from "../commands/run.js";
import { loadTasks } from "../tasks/task-store.js";
import {
  type Worker,
  type WorkerRequest,
  type WorkerResult,
} from "../workers/claude.js";
import {
  makeTempVault,
  removeTempVault,
  writeVaultFile,
} from "./support/tmp-vault.js";
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
});
