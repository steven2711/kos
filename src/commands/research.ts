/**
 * `kos research <vaultPath> [query]` — the controlled Research stage.
 *
 * Research acquires *external evidence* and records it under `07 Research/`. It
 * is deliberately separate from `kos run`: research tasks are executed only here
 * (and `kos run` skips them), so web/API cost stays intentional and the generic
 * documentation worker never touches a research task.
 *
 * With a `query`, this creates and runs a one-off research task. Without one, it
 * picks the highest-priority open research task. Either way it snapshots every
 * protected folder before/after the worker — any change outside `07 Research/`
 * (the Kernel or any canonical layer) fails the task. The worker may propose
 * follow-up tasks; this command persists them. Research never blocks the build.
 */
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  snapshotFolders,
  folderChanges,
  PROTECTED_RESEARCH_FOLDERS,
  RESEARCH_FOLDER,
} from "../core/vault.js";
import { validateVault } from "./validate.js";
import { writeMetaFile, todayISO } from "../core/io.js";
import {
  loadTasks,
  saveTasks,
  mergeTasks,
  updateTask,
  renderOpenTaskQueue,
  renderTaskQueue,
  isoNow,
} from "../tasks/task-store.js";
import { selectNextTask } from "../scheduler/scheduler.js";
import { inferDependencies } from "../planner/planner.js";
import { type KosTask, type TaskSpec, isResearchType } from "../tasks/task-model.js";
import {
  type ResearchWorker,
  type ResearchResult,
  selectResearchWorker,
} from "../workers/research-worker.js";
import { renderResearchReport } from "../reports/research-report.js";

export interface ResearchOptions {
  /** One-off research query (`kos research . "<query>"`). */
  query?: string;
  /** Injectable worker (tests pass `MockResearchWorker`). */
  worker?: ResearchWorker;
  /** Injectable clock for deterministic dates in tests. */
  clock?: () => Date;
  quiet?: boolean;
}

export interface ResearchOutcome {
  /** The task that ran, or null when there was no research task to run. */
  task: KosTask | null;
  result: ResearchResult | null;
  /** Vault-relative paths of research docs created/updated this run. */
  createdDocs: string[];
  passed: boolean;
  /** Protected-folder paths the worker changed (a non-empty list = hard fail). */
  boundaryViolations: string[];
}

async function loadResearchPrompt(): Promise<string> {
  const url = new URL("../workers/prompts/research-task.md", import.meta.url);
  return fs.readFile(fileURLToPath(url), "utf8");
}

function renderResearchPrompt(task: KosTask, query: string): string {
  const lines = [
    `Research query: ${query}`,
    task.sourceHints && task.sourceHints.length > 0
      ? `Source hints: ${task.sourceHints.join(", ")}`
      : "",
    task.expectedResearchOutput !== undefined
      ? `Expected output: ${task.expectedResearchOutput}`
      : "",
    "Acceptance criteria:",
    ...(task.acceptanceCriteria.length > 0
      ? task.acceptanceCriteria.map((c) => `- ${c}`)
      : ["- Produce a cited research document"]),
    "Write exactly one research document under 07 Research/ and cite every claim in ## Sources.",
  ];
  return lines.filter((l) => l !== "").join("\n");
}

async function refreshQueues(vaultPath: string, tasks: KosTask[]): Promise<void> {
  const day = todayISO();
  await writeMetaFile(vaultPath, "Open Task Queue.md", renderOpenTaskQueue(tasks, day));
  await writeMetaFile(vaultPath, "Task Queue.md", renderTaskQueue(tasks, day));
}

/** Build the one-off research task spec for an explicit query. */
function oneOffResearchSpec(query: string): TaskSpec {
  return {
    type: "research",
    status: "open",
    priority: "medium",
    goal: `Research: ${query}`,
    inputs: [],
    expectedOutputs: ["A cited research document under 07 Research/"],
    acceptanceCriteria: [
      "The research document cites at least one source",
      "No new validation errors introduced",
    ],
    dependencies: [],
    origin: "research",
    researchQuery: query,
  };
}

/**
 * Run one research task: select (or create) it, execute the worker under the
 * write-boundary guard, re-validate, persist any follow-ups, and write the
 * Research Report. Pure inputs except the injected worker.
 */
export async function runResearch(
  vaultPath: string,
  opts: ResearchOptions = {},
): Promise<ResearchOutcome> {
  const worker = opts.worker ?? selectResearchWorker();
  const empty: ResearchOutcome = {
    task: null,
    result: null,
    createdDocs: [],
    passed: false,
    boundaryViolations: [],
  };

  // Baseline error count, so we can detect a validation regression.
  const baseline = await validateVault(vaultPath, { quiet: true, noReport: true });
  const baselineErrors = baseline.errors.length;

  let tasks = await loadTasks(vaultPath);

  // Select the task: a one-off from the query, or the next open research task.
  let task: KosTask | null;
  if (opts.query !== undefined) {
    const goal = `Research: ${opts.query}`;
    tasks = mergeTasks(tasks, [oneOffResearchSpec(opts.query)], isoNow());
    await saveTasks(vaultPath, tasks);
    task = tasks.find((t) => t.type === "research" && t.goal === goal) ?? null;
  } else {
    task = selectNextTask(tasks, (t) => isResearchType(t.type));
  }

  if (task === null) {
    if (opts.quiet !== true) console.log("No open research tasks. Nothing to do.");
    return empty;
  }
  const selected: KosTask = task;
  if (opts.quiet !== true) {
    console.log(
      `Selected ${selected.id} [${selected.priority}] ${selected.type}: ${selected.goal}`,
    );
  }

  // Mark in_progress; snapshot the protected folders and the research folder.
  tasks = updateTask(tasks, selected.id, { status: "in_progress" }, isoNow());
  await saveTasks(vaultPath, tasks);
  const protectedBefore = await snapshotFolders(vaultPath, PROTECTED_RESEARCH_FOLDERS);
  const researchBefore = await snapshotFolders(vaultPath, [RESEARCH_FOLDER]);

  // Execute exactly one research task.
  const query = selected.researchQuery ?? opts.query ?? selected.goal;
  const systemPrompt = await loadResearchPrompt();
  const result = await worker.runResearchTask({
    vaultPath,
    task: selected,
    systemPrompt,
    prompt: renderResearchPrompt(selected, query),
    query,
    ...(opts.clock !== undefined ? { clock: opts.clock } : {}),
  });
  if (result.finalText && opts.quiet !== true) {
    const firstLine = result.finalText.split("\n")[0] ?? "";
    console.log(`Research worker: ${firstLine.slice(0, 200)}`);
  }

  // Write-boundary guard: nothing outside 07 Research/ may have changed.
  const boundaryViolations = await folderChanges(
    vaultPath,
    protectedBefore,
    PROTECTED_RESEARCH_FOLDERS,
  );
  const boundaryClean = boundaryViolations.length === 0;
  const createdDocs = (
    await folderChanges(vaultPath, researchBefore, [RESEARCH_FOLDER])
  ).filter((p) => p.endsWith(".md"));

  // Re-validate and judge.
  const after = await validateVault(vaultPath, { quiet: true, noReport: true });
  const passed =
    result.success && boundaryClean && after.errors.length <= baselineErrors;

  if (!boundaryClean) {
    const label = boundaryViolations.some((p) => p.startsWith("01 Kernel/"))
      ? "KERNEL VIOLATION"
      : "CANONICAL VIOLATION";
    console.error(
      `${label} — the research worker changed ${boundaryViolations.length} protected file(s): ${boundaryViolations.join(", ")}. Task ${selected.id} failed.`,
    );
  }

  // Finalise status and persist any follow-up tasks (only when the worker ran
  // cleanly — a boundary violation discards its proposals).
  tasks = updateTask(
    tasks,
    selected.id,
    { status: passed ? "complete" : "failed" },
    isoNow(),
  );
  if (result.success && boundaryClean && result.proposedTasks.length > 0) {
    tasks = inferDependencies(mergeTasks(tasks, result.proposedTasks, isoNow()));
  }
  await saveTasks(vaultPath, tasks);
  await refreshQueues(vaultPath, tasks);

  await writeMetaFile(
    vaultPath,
    "Research Report.md",
    renderResearchReport({ tasks, createdDocs, now: todayISO() }),
  );

  if (opts.quiet !== true) {
    if (passed) {
      console.log(
        `Task ${selected.id} complete — ${createdDocs.length} research doc(s); validation holds (${after.errors.length} error(s), baseline ${baselineErrors}).`,
      );
    } else if (boundaryClean) {
      const why = !result.success
        ? result.error ?? "worker did not report success"
        : `validation regressed to ${after.errors.length} error(s) (baseline ${baselineErrors})`;
      console.error(`Task ${selected.id} failed — ${why}.`);
    }
  }

  const updated = tasks.find((t) => t.id === selected.id) ?? selected;
  return { task: updated, result, createdDocs, passed, boundaryViolations };
}

/** CLI entry: returns the process exit code. */
export async function runResearchCommand(
  vaultPath: string,
  query?: string,
): Promise<number> {
  const outcome = await runResearch(
    vaultPath,
    query !== undefined ? { query } : {},
  );
  if (outcome.task === null) return 0;
  // Hard failures (boundary violation or worker error) are non-zero; a soft
  // validation regression fails the task but not the command.
  if (outcome.boundaryViolations.length > 0) return 1;
  if (outcome.result !== null && !outcome.result.success) return 1;
  return 0;
}
