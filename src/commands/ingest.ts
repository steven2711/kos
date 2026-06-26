/** `kos ingest <vaultPath> <inputFile>` — capture input + seed the task queue. */
import { promises as fs } from "node:fs";
import path from "node:path";
import { INBOX_FOLDER } from "../core/vault.js";
import { writeMetaFile, todayISO, pathExists } from "../core/io.js";
import { renderIngestionReport } from "../reports/compiler-report.js";
import { seedIngestTasks } from "../tasks/task-generator.js";
import {
  loadTasks,
  saveTasks,
  mergeTasks,
  renderTaskQueue,
  isoNow,
} from "../tasks/task-store.js";

/** Find a non-colliding destination name inside 00 Inbox. */
async function uniqueInboxPath(
  vaultPath: string,
  baseName: string,
): Promise<string> {
  const dir = path.join(vaultPath, INBOX_FOLDER);
  const ext = path.extname(baseName);
  const stem = path.basename(baseName, ext);
  let candidate = baseName;
  let n = 1;
  while (await pathExists(path.join(dir, candidate))) {
    candidate = `${stem}-${n}${ext}`;
    n += 1;
  }
  return candidate;
}

export async function runIngestCommand(
  vaultPath: string,
  inputFile: string,
): Promise<number> {
  if (!(await pathExists(inputFile))) {
    console.error(`Input file not found: ${inputFile}`);
    return 1;
  }

  const inboxDir = path.join(vaultPath, INBOX_FOLDER);
  await fs.mkdir(inboxDir, { recursive: true });

  const destName = await uniqueInboxPath(vaultPath, path.basename(inputFile));
  const inboxRel = `${INBOX_FOLDER}/${destName}`;
  await fs.copyFile(inputFile, path.join(inboxDir, destName));

  // Seed the six initial tasks (idempotent via merge dedupe).
  const now = isoNow();
  const existing = await loadTasks(vaultPath);
  const seeds = seedIngestTasks(inboxRel);
  const tasks = mergeTasks(existing, seeds, now);
  await saveTasks(vaultPath, tasks);

  const newCount = tasks.length - existing.length;
  await writeMetaFile(
    vaultPath,
    "Ingestion Report.md",
    renderIngestionReport({
      inputFile,
      inboxRel,
      taskCount: newCount,
      now: todayISO(),
    }),
  );
  await writeMetaFile(
    vaultPath,
    "Task Queue.md",
    renderTaskQueue(tasks, todayISO()),
  );

  console.log(`Ingested ${inputFile} -> ${inboxRel}`);
  console.log(
    `Seeded ${newCount} new task(s) (${tasks.length} total). Wrote 90 Meta/Ingestion Report.md and 90 Meta/Task Queue.md`,
  );
  return 0;
}
