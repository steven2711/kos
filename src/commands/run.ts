/**
 * `kos run <vaultPath> --max-iterations N` — the controlled loop.
 *
 * The compiler owns the loop: it compiles, selects exactly one task, dispatches
 * it to Claude, then re-validates and judges the result. Claude never decides
 * when the project is done and never free-loops. The Kernel is guarded by a
 * before/after content snapshot — any change to `01 Kernel/` fails the task.
 */
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { snapshotKernel, kernelChanges } from "../core/vault.js";
import { compileAndPersist } from "./compile.js";
import { validateVault } from "./validate.js";
import {
  loadTasks,
  saveTasks,
  selectNextTask,
  updateTask,
  renderOpenTaskQueue,
  renderTaskQueue,
  isoNow,
} from "../tasks/task-store.js";
import { writeMetaFile, todayISO } from "../core/io.js";
import { KosTask } from "../tasks/task-model.js";
import { Agent, AgentRequest, selectAgent } from "../agents/claude.js";

const ALLOWED_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep"];
const MAX_TURNS = 12;
const MODEL = "claude-opus-4-8";

async function loadPromptTemplate(): Promise<string> {
  const url = new URL("../agents/prompts/documentation-task.md", import.meta.url);
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
  agent?: Agent; // injectable for tests
}

export async function runRunCommand(
  vaultPath: string,
  opts: RunOptions,
): Promise<number> {
  const agent = opts.agent ?? selectAgent();
  const template = await loadPromptTemplate();
  console.log(
    `Starting controlled run: up to ${opts.maxIterations} iteration(s), agent=${agent.name}.`,
  );

  for (let i = 1; i <= opts.maxIterations; i++) {
    console.log(`\n── Iteration ${i}/${opts.maxIterations} ──`);

    // 1. Compile (refreshes tasks + baseline error count).
    const { result } = await compileAndPersist(vaultPath, { quiet: true });
    const baselineErrors = result.errors.length;

    // 2. Select exactly one actionable task.
    let tasks = await loadTasks(vaultPath);
    const task = selectNextTask(tasks);
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

    // 4. Dispatch exactly one task to the agent.
    const req: AgentRequest = {
      vaultPath,
      systemPrompt:
        "You are a careful KOS documentation contributor. Do only the assigned task. Never edit 01 Kernel/.",
      prompt: renderPrompt(template, task),
      allowedTools: ALLOWED_TOOLS,
      maxTurns: MAX_TURNS,
      model: MODEL,
      task,
    };
    const agentResult = await agent.runTask(req);
    if (agentResult.finalText) {
      console.log(`Agent: ${agentResult.finalText.split("\n")[0].slice(0, 200)}`);
    }

    // 5. Kernel guard.
    const changed = await kernelChanges(vaultPath, kernelBefore);
    if (changed.length > 0) {
      now = isoNow();
      tasks = updateTask(tasks, task.id, { status: "failed" }, now);
      await saveTasks(vaultPath, tasks);
      await refreshQueues(vaultPath, tasks);
      console.error(
        `KERNEL VIOLATION — the agent modified ${changed.length} Kernel file(s): ${changed.join(", ")}. Task ${task.id} failed; stopping.`,
      );
      return 1;
    }

    // 6. Re-validate and judge.
    const after = await validateVault(vaultPath, { quiet: true, noReport: true });
    const passed =
      agentResult.success && after.errors.length <= baselineErrors;
    now = isoNow();
    tasks = updateTask(
      tasks,
      task.id,
      { status: passed ? "complete" : "failed" },
      now,
    );
    await saveTasks(vaultPath, tasks);
    await refreshQueues(vaultPath, tasks);

    if (passed) {
      console.log(
        `Task ${task.id} complete — validation holds (${after.errors.length} error(s), baseline ${baselineErrors}).`,
      );
    } else {
      const why = !agentResult.success
        ? agentResult.error ?? "agent did not report success"
        : `validation regressed to ${after.errors.length} error(s) (baseline ${baselineErrors})`;
      console.error(`Task ${task.id} failed — ${why}.`);
    }
  }

  // Final compile so reports reflect the end state.
  await compileAndPersist(vaultPath, { quiet: true });
  console.log("\nRun finished.");
  return 0;
}
