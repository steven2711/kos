/**
 * `kos run <vaultPath> --max-iterations N` — the controlled loop.
 *
 * The orchestrator wires the subsystems: the Planner refreshes the task graph
 * (via `compileAndPersist`), the Scheduler selects exactly one task, the Worker
 * executes it, and the read-only Compiler re-validates and judges the result.
 * Claude never decides when the project is done and never free-loops. The Kernel
 * is guarded by a before/after content snapshot — any change to `01 Kernel/`
 * fails the task.
 */
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { snapshotKernel, kernelChanges } from "../core/vault.js";
import { compileAndPersist } from "./compile.js";
import { validateVault } from "./validate.js";
import {
  loadTasks,
  saveTasks,
  updateTask,
  reclaimStuckTasks,
  renderOpenTaskQueue,
  renderTaskQueue,
  isoNow,
} from "../tasks/task-store.js";
import { loadEnv } from "../config/env.js";
import { selectNextTask } from "../scheduler/scheduler.js";
import { writeMetaFile, todayISO } from "../core/io.js";
import { type KosTask, isResearchType, isPromotionType } from "../tasks/task-model.js";
import {
  type Worker,
  type WorkerRequest,
  type WorkerResult,
  selectWorker,
} from "../workers/claude.js";
import { type Interviewer, selectInterviewer } from "../workers/interviewer.js";
import { runFounderInterview } from "./interview.js";

const ALLOWED_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep"];
const MODEL = "claude-opus-4-8";

async function loadPromptTemplate(): Promise<string> {
  const url = new URL("../workers/prompts/documentation-task.md", import.meta.url);
  return fs.readFile(fileURLToPath(url), "utf8");
}

function renderPrompt(template: string, task: KosTask): string {
  const criteria = task.acceptanceCriteria.map((c) => `  - ${c}`).join("\n");
  return template
    .replace("{{TYPE}}", task.type)
    .replace("{{GOAL}}", task.goal)
    .replace("{{INPUTS}}", task.inputs.join(", ") || "(none)")
    .replace("{{OUTPUTS}}", task.expectedOutputs.join(", ") || "(none)")
    .replace("{{CRITERIA}}", criteria || "  - (none)");
}

async function refreshQueues(vaultPath: string, tasks: KosTask[]): Promise<void> {
  const day = todayISO();
  await writeMetaFile(vaultPath, "Open Task Queue.md", renderOpenTaskQueue(tasks, day));
  await writeMetaFile(vaultPath, "Task Queue.md", renderTaskQueue(tasks, day));
}

export interface RunOptions {
  maxIterations: number;
  /** Per-task agent turn budget; defaults to KOS_MAX_TURNS (env). */
  maxTurns?: number;
  worker?: Worker; // injectable for tests
  interviewer?: Interviewer; // injectable for tests
}

export async function runRunCommand(
  vaultPath: string,
  opts: RunOptions,
): Promise<number> {
  const worker = opts.worker ?? selectWorker();
  const interviewer = opts.interviewer ?? selectInterviewer();
  const maxTurns = opts.maxTurns ?? loadEnv().KOS_MAX_TURNS;
  const template = await loadPromptTemplate();
  console.log(
    `Starting controlled run: up to ${opts.maxIterations} iteration(s), worker=${worker.name}, interviewer=${interviewer.name}.`,
  );

  // Resume any work stranded by a previous interrupted/failed run: re-open
  // in_progress (Ctrl+C) and failed (e.g. max-turns) tasks so the loop retries.
  const { tasks: reclaimedTasks, reclaimed } = reclaimStuckTasks(
    await loadTasks(vaultPath),
    isoNow(),
  );
  if (reclaimed > 0) {
    await saveTasks(vaultPath, reclaimedTasks);
    console.log(`Resumed ${reclaimed} stranded task(s) from a previous run.`);
  }

  for (let i = 1; i <= opts.maxIterations; i++) {
    console.log(`\n── Iteration ${i}/${opts.maxIterations} ──`);

    // 1. Compile (refreshes tasks + baseline error count).
    const { result } = await compileAndPersist(vaultPath, { quiet: true });
    const baselineErrors = result.errors.length;

    // 2. Select exactly one actionable task. Research and promotion tasks are
    //    excluded — research is executed by `kos research`, and proposals are
    //    reviewed by the founder via `kos promote`; never the generic worker.
    let tasks = await loadTasks(vaultPath);
    const task = selectNextTask(
      tasks,
      (t) => !isResearchType(t.type) && !isPromotionType(t.type),
    );
    if (!task) {
      console.log("No actionable open tasks. Stopping.");
      break;
    }
    console.log(`Selected ${task.id} [${task.priority}] ${task.type}: ${task.goal}`);

    // 3. Mark in_progress + snapshot the Kernel.
    let now = isoNow();
    tasks = updateTask(tasks, task.id, { status: "in_progress" }, now);
    await saveTasks(vaultPath, tasks);
    const kernelBefore = await snapshotKernel(vaultPath);

    // 4. Dispatch exactly one task. Founder interviews pause for human input
    //    (never the SDK); every other task goes to the worker.
    let workerResult: WorkerResult;
    if (task.type === "founder_interview") {
      workerResult = await runFounderInterview(vaultPath, task, interviewer);
    } else {
      const req: WorkerRequest = {
        vaultPath,
        systemPrompt:
          "You are a careful KOS documentation contributor. Do only the assigned task. Never edit 01 Kernel/.",
        prompt: renderPrompt(template, task),
        allowedTools: ALLOWED_TOOLS,
        maxTurns,
        model: MODEL,
        task,
        onProgress: (line) => console.log(`  ${line}`),
      };
      workerResult = await worker.runTask(req);
    }
    if (workerResult.finalText) {
      const firstLine = workerResult.finalText.split("\n")[0] ?? "";
      console.log(`Worker: ${firstLine.slice(0, 200)}`);
    }

    // 5. Kernel guard.
    const changed = await kernelChanges(vaultPath, kernelBefore);
    if (changed.length > 0) {
      now = isoNow();
      tasks = updateTask(tasks, task.id, { status: "failed" }, now);
      await saveTasks(vaultPath, tasks);
      await refreshQueues(vaultPath, tasks);
      console.error(
        `KERNEL VIOLATION — the worker modified ${changed.length} Kernel file(s): ${changed.join(", ")}. Task ${task.id} failed; stopping.`,
      );
      return 1;
    }

    // 6. Re-validate and judge.
    const after = await validateVault(vaultPath, { quiet: true, noReport: true });
    const passed =
      workerResult.success && after.errors.length <= baselineErrors;
    now = isoNow();
    tasks = updateTask(
      tasks,
      task.id,
      passed
        ? { status: "complete" }
        : { status: "failed", attempts: (task.attempts ?? 0) + 1 },
      now,
    );
    await saveTasks(vaultPath, tasks);
    await refreshQueues(vaultPath, tasks);

    if (passed) {
      console.log(
        `Task ${task.id} complete — validation holds (${after.errors.length} error(s), baseline ${baselineErrors}).`,
      );
    } else {
      const why = !workerResult.success
        ? workerResult.error ?? "worker did not report success"
        : `validation regressed to ${after.errors.length} error(s) (baseline ${baselineErrors})`;
      console.error(`Task ${task.id} failed — ${why}.`);
    }
  }

  // Final compile so reports reflect the end state.
  await compileAndPersist(vaultPath, { quiet: true });
  console.log("\nRun finished.");
  return 0;
}
