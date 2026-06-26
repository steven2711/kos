/** `kos compile <vaultPath>` — validate + analyse, write reports, refresh tasks. */
import { compileVault, CompilerResult } from "../core/compiler.js";
import { writeMetaFile, todayISO } from "../core/io.js";
import {
  renderCompilerReport,
  renderKnowledgeScore,
} from "../reports/compiler-report.js";
import {
  loadTasks,
  saveTasks,
  mergeTasks,
  renderTaskQueue,
  renderOpenTaskQueue,
  isoNow,
} from "../tasks/task-store.js";
import { KosTask } from "../tasks/task-model.js";

export interface CompileOutput {
  result: CompilerResult;
  tasks: KosTask[];
}

/**
 * Compile the vault, reconcile derived tasks into the store, and write the
 * three report files. Returns the result + persisted tasks (reused by `run`).
 */
export async function compileAndPersist(
  vaultPath: string,
  opts: { quiet?: boolean } = {},
): Promise<CompileOutput> {
  const result = await compileVault(vaultPath);

  const now = isoNow();
  const existing = await loadTasks(vaultPath);
  const tasks = mergeTasks(existing, result.tasks, now);
  await saveTasks(vaultPath, tasks);

  const day = todayISO();
  await writeMetaFile(
    vaultPath,
    "Compiler Report.md",
    renderCompilerReport(result, day),
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

  if (!opts.quiet) {
    console.log(
      `Compiled ${result.docCount} docs — score ${result.score}/100, ` +
        `${result.errors.length} error(s), ${result.warnings.length} warning(s).`,
    );
    console.log(
      `Tasks: ${tasks.length} total (${tasks.length - existing.length} new). ` +
        `Wrote Compiler Report.md, Knowledge Score.md, Open Task Queue.md.`,
    );
  }

  return { result, tasks };
}

export async function runCompileCommand(vaultPath: string): Promise<number> {
  const { result } = await compileAndPersist(vaultPath);
  return result.errors.length > 0 ? 1 : 0;
}
