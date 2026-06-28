/** `kos compile <vaultPath>` — validate + analyse, plan tasks, write reports. */
import { compileVault, type CompilerResult } from "../core/compiler.js";
import { writeMetaFile, todayISO } from "../core/io.js";
import {
  renderCompilerReport,
  renderKnowledgeScore,
  renderTaskGraph,
  renderExecutionPlan,
} from "../reports/compiler-report.js";
import {
  loadTasks,
  saveTasks,
  mergeTasks,
  renderTaskQueue,
  renderOpenTaskQueue,
  isoNow,
} from "../tasks/task-store.js";
import {
  deriveCompilerTasks,
  inferDependencies,
  buildTaskGraph,
} from "../planner/planner.js";
import { executionPlan } from "../scheduler/scheduler.js";
import { type KosTask } from "../tasks/task-model.js";
import { writeInterviewProjections } from "./interview.js";

export interface CompileOutput {
  result: CompilerResult;
  tasks: KosTask[];
}

/**
 * Compile the vault (read-only), let the Planner derive + wire tasks into the
 * store, then write the report files (validation/score/queues + the Task Graph
 * and Execution Plan). Returns the result + persisted tasks (reused by `run`).
 */
export async function compileAndPersist(
  vaultPath: string,
  opts: { quiet?: boolean } = {},
): Promise<CompileOutput> {
  const result = await compileVault(vaultPath);

  // Planner: derive candidate work from the compiler's analysis, merge into the
  // store, and infer dependencies to construct the task graph.
  const now = isoNow();
  const existing = await loadTasks(vaultPath);
  const derived = deriveCompilerTasks(result.analysis);
  const tasks = inferDependencies(mergeTasks(existing, derived, now));
  await saveTasks(vaultPath, tasks);

  const day = todayISO();
  const graph = buildTaskGraph(tasks);
  const plan = executionPlan(tasks);

  await writeMetaFile(
    vaultPath,
    "Compiler Report.md",
    renderCompilerReport(result, tasks, day),
  );
  await writeMetaFile(
    vaultPath,
    "Knowledge Score.md",
    renderKnowledgeScore(result, day),
  );
  await writeMetaFile(
    vaultPath,
    "Open Task Queue.md",
    renderOpenTaskQueue(tasks, day),
  );
  // Keep the full queue projection fresh too.
  await writeMetaFile(vaultPath, "Task Queue.md", renderTaskQueue(tasks, day));
  // Planner/Scheduler views of the same tasks.
  await writeMetaFile(vaultPath, "Task Graph.md", renderTaskGraph(graph, day));
  await writeMetaFile(
    vaultPath,
    "Execution Plan.md",
    renderExecutionPlan(plan, day),
  );
  // Founder-interview projections: pending questions + captured interview log.
  await writeInterviewProjections(vaultPath, tasks, day);

  if (opts.quiet !== true) {
    console.log(
      `Compiled ${result.docCount} docs — score ${result.score}/100, ` +
        `${result.errors.length} error(s), ${result.warnings.length} warning(s).`,
    );
    console.log(
      `Tasks: ${tasks.length} total (${tasks.length - existing.length} new). ` +
        `Wrote Compiler Report.md, Knowledge Score.md, Open Task Queue.md, ` +
        `Task Graph.md, Execution Plan.md.`,
    );
  }

  return { result, tasks };
}

export async function runCompileCommand(vaultPath: string): Promise<number> {
  const { result } = await compileAndPersist(vaultPath);
  return result.errors.length > 0 ? 1 : 0;
}
