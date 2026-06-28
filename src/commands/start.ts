/**
 * `kos start <vaultPath>` — the one-command pipeline.
 *
 * A deterministic *conductor* over the existing subsystems: it seeds tasks from
 * every doc in `00 Inbox/`, runs the controlled build loop to natural completion
 * (the loop drains all ready tasks and pauses only for founder questions),
 * runs the advisory semantic review, then prints a status with the single next
 * step. It adds no new authority: the build loop's bounded-task execution,
 * re-validation, and Kernel guard are unchanged, and the two human gates stay
 * human — founder interviews pause inside the loop, and promotion remains the
 * separate, explicit `kos promote`.
 */
import { collectInboxDocs } from "../core/vault.js";
import { compileVault } from "../core/compiler.js";
import { type ScoreBreakdown } from "../core/scoring.js";
import {
  loadTasks,
  saveTasks,
  mergeTasks,
  isoNow,
} from "../tasks/task-store.js";
import { type KosTask, isPromotionType } from "../tasks/task-model.js";
import { seedIngestTasks, inferDependencies } from "../planner/planner.js";
import { selectNextTask } from "../scheduler/scheduler.js";
import { runRunCommand } from "./run.js";
import { analyzeVault } from "./analyze.js";
import { type Worker } from "../workers/claude.js";
import { type Interviewer } from "../workers/interviewer.js";
import { type SemanticReviewer } from "../workers/semantic-reviewer.js";

/** Backstop so an unexpected loop can never run unbounded; see plan decision. */
const SAFETY_CAP = 50;

export interface StartOptions {
  /** Build-loop cap (default: run to completion within SAFETY_CAP). */
  maxIterations?: number;
  /** Run the semantic review after the build (default true). */
  analyze?: boolean;
  /** Injectable boundaries for tests; default to the env-selected ones. */
  worker?: Worker;
  interviewer?: Interviewer;
  reviewer?: SemanticReviewer;
  quiet?: boolean;
}

export interface StartSummaryInput {
  score: ScoreBreakdown;
  docCount: number;
  tasks: KosTask[];
  missingLayers: string[];
}

function isOpen(t: KosTask): boolean {
  return t.status === "open" || t.status === "in_progress";
}

/** The single, deterministic "what to do next" line for the summary. */
function nextStep(tasks: KosTask[]): string {
  const open = tasks.filter(isOpen);
  const interview = open.find((t) => t.type === "founder_interview");
  if (interview) {
    return "Answer the founder questions in 90 Meta/Founder Questions.md, then re-run `kos start .`.";
  }
  const proposals = open.filter((t) => isPromotionType(t.type));
  if (proposals.length > 0) {
    return `Review ${proposals.length} knowledge proposal(s): run \`kos promote .\`.`;
  }
  const next = selectNextTask(tasks);
  if (next) {
    return `Continue building: re-run \`kos start .\` (next up — ${next.id} ${next.type}).`;
  }
  if (open.length > 0) {
    return "Remaining work is blocked on dependencies; see 90 Meta/Execution Plan.md.";
  }
  return "Knowledge base is up to date — nothing left to build.";
}

/** Pure, vault-free render of the closing status. */
export function renderStartSummary(input: StartSummaryInput): string {
  const { score, docCount, tasks, missingLayers } = input;
  const complete = tasks.filter((t) => t.status === "complete").length;
  const open = tasks.filter(isOpen).length;
  const missing =
    missingLayers.length === 0
      ? "every knowledge layer has a document"
      : `missing layers — ${missingLayers.join(", ")}`;
  return [
    "",
    "── kos start: done ──",
    `Knowledge score: ${score.score}/100  (quality ${score.quality}, coverage ${score.coverage}% — ${score.layersCovered}/${score.layersTotal} layers)`,
    `Documents: ${docCount}  |  Tasks: ${complete} complete, ${open} open`,
    `Coverage: ${missing}`,
    `Next: ${nextStep(tasks)}`,
  ].join("\n");
}

/**
 * Run the whole pipeline: seed from the inbox → build to completion → semantic
 * review → summary. Returns the build loop's exit code (1 on a Kernel
 * violation, else 0; an empty inbox with no open work is a clean 0).
 */
export async function runStartCommand(
  vaultPath: string,
  opts: StartOptions = {},
): Promise<number> {
  const log = (m: string): void => {
    if (opts.quiet !== true) console.log(m);
  };

  // 1. Seed tasks from every doc dropped into 00 Inbox/.
  const docs = await collectInboxDocs(vaultPath);
  const existing = await loadTasks(vaultPath);
  if (docs.length === 0 && existing.filter(isOpen).length === 0) {
    log(
      "No input found. Drop markdown files into 00 Inbox/, then re-run `kos start`.",
    );
    return 0;
  }
  if (docs.length > 0) {
    const seeded = inferDependencies(
      mergeTasks(existing, seedIngestTasks(docs), isoNow()),
    );
    await saveTasks(vaultPath, seeded);
    log(
      `Seeded from ${docs.length} inbox doc(s): ${seeded.length - existing.length} new task(s) (${seeded.length} total).`,
    );
  }

  // 2. Build to completion (the loop self-terminates when no task is ready).
  const code = await runRunCommand(vaultPath, {
    maxIterations: opts.maxIterations ?? SAFETY_CAP,
    ...(opts.worker ? { worker: opts.worker } : {}),
    ...(opts.interviewer ? { interviewer: opts.interviewer } : {}),
  });
  if (code !== 0) return code; // Kernel violation, etc. — surface it, skip the rest.

  // 3. Advisory semantic review (never fails the build).
  if (opts.analyze !== false) {
    await analyzeVault(vaultPath, {
      quiet: true,
      ...(opts.reviewer ? { reviewer: opts.reviewer } : {}),
    });
  }

  // 4. Plain-English summary with the single next step.
  const result = await compileVault(vaultPath);
  const tasks = await loadTasks(vaultPath);
  log(
    renderStartSummary({
      score: result.scoreBreakdown,
      docCount: result.docCount,
      tasks,
      missingLayers: result.analysis.missingLayers,
    }),
  );
  return 0;
}
