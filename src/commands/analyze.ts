/**
 * `kos analyze <vaultPath>` — the LLM Semantic Reviewer stage.
 *
 * This is the second, advisory analysis stage, kept deliberately separate from
 * the deterministic `compile`/`run` path (which stay pure and offline-testable).
 * It compiles the vault for objective context, asks the Semantic Reviewer to
 * review the *reasoning*, writes `90 Meta/Semantic Report.md`, and feeds the
 * findings to the Planner as **optional** low-priority work. Semantic findings
 * never fail the build: this command always exits 0.
 */
import { loadVault } from "../core/vault.js";
import { compileDocs } from "../core/compiler.js";
import { buildReviewContext, type SemanticReview } from "../core/semantic-rules.js";
import { writeMetaFile, todayISO } from "../core/io.js";
import { renderSemanticReport } from "../reports/semantic-report.js";
import { deriveSemanticTasks, inferDependencies } from "../planner/planner.js";
import {
  loadTasks,
  saveTasks,
  mergeTasks,
  isoNow,
} from "../tasks/task-store.js";
import { type KosTask } from "../tasks/task-model.js";
import {
  type SemanticReviewer,
  selectSemanticReviewer,
} from "../workers/semantic-reviewer.js";

export interface AnalyzeOptions {
  /** Injectable reviewer (tests pass `MockSemanticReviewer`). */
  reviewer?: SemanticReviewer;
  quiet?: boolean;
  /** Skip writing the report file (used by callers that only want the review). */
  noReport?: boolean;
  /** Merge derived advisory tasks into the store (default true). */
  persistTasks?: boolean;
}

export interface AnalyzeOutput {
  review: SemanticReview;
  tasks: KosTask[];
}

/**
 * Run the semantic review: compile for context → review → write report → feed
 * the planner with optional work. Pure inputs except the injected reviewer; the
 * deterministic compile is unchanged.
 */
export async function analyzeVault(
  vaultPath: string,
  opts: AnalyzeOptions = {},
): Promise<AnalyzeOutput> {
  const reviewer = opts.reviewer ?? selectSemanticReviewer();

  const docs = await loadVault(vaultPath);
  const { analysis } = compileDocs(docs);
  const context = buildReviewContext(docs, analysis);
  const review = await reviewer.review({ context, vaultPath });

  const day = todayISO();
  if (opts.noReport !== true) {
    await writeMetaFile(
      vaultPath,
      "Semantic Report.md",
      renderSemanticReport(review, day),
    );
  }

  let tasks = await loadTasks(vaultPath);
  let added = 0;
  if (opts.persistTasks !== false) {
    const before = tasks.length;
    const derived = deriveSemanticTasks(review);
    tasks = inferDependencies(mergeTasks(tasks, derived, isoNow()));
    await saveTasks(vaultPath, tasks);
    added = tasks.length - before;
  }

  if (opts.quiet !== true) {
    console.log(
      `Semantic review (${reviewer.name}): ${review.findings.length} finding(s). ` +
        `Wrote Semantic Report.md; ${added} advisory task(s) added.`,
    );
  }

  return { review, tasks };
}

export async function runAnalyzeCommand(vaultPath: string): Promise<number> {
  await analyzeVault(vaultPath);
  // Semantic findings are advisory: this stage never fails the build.
  return 0;
}
