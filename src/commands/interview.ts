/**
 * Founder-interview handling for the controlled loop.
 *
 * When `kos run` selects a `founder_interview` task, the orchestrator routes it
 * here instead of to the Claude worker: the Interviewer gathers human answers,
 * we save them as an Inbox capture, and we refresh the two `90 Meta/`
 * projections. The Agent SDK is never involved, so the AI cannot answer a
 * founder question. The return shape matches the worker's so the run loop's
 * kernel-guard and re-validation steps apply unchanged.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { INBOX_FOLDER } from "../core/vault.js";
import { parseFile } from "../core/frontmatter.js";
import { writeMetaFile, todayISO, timestampSlug, pathExists } from "../core/io.js";
import { loadTasks } from "../tasks/task-store.js";
import { type KosTask } from "../tasks/task-model.js";
import {
  renderInterviewDoc,
  renderFounderQuestions,
  renderInterviewLog,
  type InterviewLogEntry,
} from "../reports/interview-report.js";
import { type Interviewer } from "../workers/interviewer.js";
import { type WorkerResult } from "../workers/claude.js";

const INTERVIEWS_SUBDIR = "Interviews";

/** Vault-relative folder where interview captures live. */
function interviewsDir(): string {
  return `${INBOX_FOLDER}/${INTERVIEWS_SUBDIR}`;
}

/**
 * A non-colliding interview filename. Two interviews completing in the same
 * minute share the `YYYY-MM-DD-HHMM` slug, so disambiguate with a suffix rather
 * than silently overwriting the earlier capture.
 */
async function uniqueInterviewFile(
  dir: string,
  slug: string,
): Promise<string> {
  let candidate = `Interview-${slug}.md`;
  let n = 2;
  while (await pathExists(path.join(dir, candidate))) {
    candidate = `Interview-${slug}-${n}.md`;
    n += 1;
  }
  return candidate;
}

/** Normalise a frontmatter date value to a YYYY-MM-DD string (best effort). */
function dateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return value.trim();
  return "";
}

/** First markdown heading in a body, used as the interview log title. */
function firstHeading(body: string): string {
  const m = body.match(/^#{1,6}\s+(.*\S)\s*$/m);
  return m?.[1]?.trim() ?? "";
}

/**
 * Scan `00 Inbox/Interviews/` and read each capture's frontmatter/title.
 * Returns an empty list when the folder does not exist yet.
 */
export async function collectInterviewEntries(
  vaultPath: string,
): Promise<InterviewLogEntry[]> {
  const dir = path.join(vaultPath, interviewsDir());
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  const entries: InterviewLogEntry[] = [];
  for (const name of names) {
    if (!name.toLowerCase().endsWith(".md")) continue;
    const raw = await fs.readFile(path.join(dir, name), "utf8");
    const parsed = parseFile(raw);
    entries.push({
      fileName: name,
      created: dateString(parsed.data.created),
      title: firstHeading(parsed.content) || name.replace(/\.md$/i, ""),
    });
  }
  return entries;
}

/** Refresh `Founder Questions.md` and `Interview Log.md` from current state. */
export async function writeInterviewProjections(
  vaultPath: string,
  tasks: KosTask[],
  day: string,
): Promise<void> {
  await writeMetaFile(
    vaultPath,
    "Founder Questions.md",
    renderFounderQuestions(tasks, day),
  );
  const entries = await collectInterviewEntries(vaultPath);
  await writeMetaFile(
    vaultPath,
    "Interview Log.md",
    renderInterviewLog(entries, day),
  );
}

/**
 * Run one founder-interview task: collect answers, save the capture, and refresh
 * the interview projections. Returns a worker-shaped result for the run loop.
 */
export async function runFounderInterview(
  vaultPath: string,
  task: KosTask,
  interviewer: Interviewer,
  clock?: () => Date,
): Promise<WorkerResult> {
  const questions = task.questions ?? [];
  const answers = await interviewer.collect(questions);

  const day = todayISO();
  const dir = path.join(vaultPath, interviewsDir());
  await fs.mkdir(dir, { recursive: true });
  const fileName = await uniqueInterviewFile(dir, timestampSlug(clock));
  const rel = `${interviewsDir()}/${fileName}`;
  await fs.writeFile(
    path.join(dir, fileName),
    renderInterviewDoc({ task, questions, answers, now: day }),
    "utf8",
  );

  const tasks = await loadTasks(vaultPath);
  await writeInterviewProjections(vaultPath, tasks, day);

  return {
    success: true,
    finalText: `Saved founder interview for ${task.id} to ${rel} (${answers.length} answer(s)).`,
  };
}
