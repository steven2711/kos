/**
 * `kos promote <vaultPath>` — the Knowledge Promotion Engine.
 *
 * Promotion is the sanctioned bridge from researched *evidence* to canonical
 * *truth*. It is the only place an AI-assisted process may edit a canonical
 * document — and even then only after the founder approves a proposal, and only
 * as a deterministic, provenance-tagged append (never a silent rewrite).
 *
 * Per proposal under review the command: presents it to the founder, and on
 * approval snapshots the vault, appends the change to the explicit target,
 * re-validates, and **rolls back** on any boundary violation or validation
 * regression — marking the proposal `merged` only after validation passes. The
 * Kernel and research evidence are never touched.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  loadVault,
  snapshotFolders,
  folderChanges,
  CANONICAL_FOLDERS,
  PROPOSALS_FOLDER,
  type VaultDoc,
} from "../core/vault.js";
import { resolutionKey } from "../core/wikilinks.js";
import { validateVault } from "./validate.js";
import { writeMetaFile } from "../core/io.js";
import {
  loadTasks,
  saveTasks,
  updateTask,
  renderOpenTaskQueue,
  renderTaskQueue,
  isoNow,
} from "../tasks/task-store.js";
import { type KosTask, isPromotionType } from "../tasks/task-model.js";
import {
  renderProposalDocument,
  renderProposalsMap,
  proposalFileName,
  nextProposalId,
  linkTarget,
} from "../core/proposal-document.js";
import {
  AppendMergeStrategy,
  type MergeStrategy,
} from "../core/merge-strategy.js";
import {
  type PromotionReviewer,
  type PromotionDecision,
  selectPromotionReviewer,
} from "../workers/promotion-reviewer.js";
import {
  renderPromotionReport,
  type ProposalSummary,
} from "../reports/promotion-report.js";

const ALL_FOLDERS = [...CANONICAL_FOLDERS, "01 Kernel", "07 Research", PROPOSALS_FOLDER] as const;

export interface PromoteOptions {
  /** Review only this proposal id (`P-NNN`). */
  proposalId?: string;
  /** Force a decision for every proposal (non-interactive/CI); skips the reviewer. */
  decision?: PromotionDecision;
  /** Injectable reviewer (tests pass `MockPromotionReviewer`). */
  reviewer?: PromotionReviewer;
  /** Injectable merge strategy (defaults to deterministic append). */
  strategy?: MergeStrategy;
  /** Injectable clock for deterministic dates in tests. */
  clock?: () => Date;
  quiet?: boolean;
}

export interface PromotionOutcome {
  /** Number of proposals presented for a decision. */
  reviewed: number;
  /** Canonical document relPaths an approved proposal was merged into. */
  mergedDocs: string[];
  /** Proposal ids that were rejected. */
  rejected: string[];
  /** Proposal ids for which changes were requested. */
  changesRequested: string[];
  /** Boundary/illegal-target refusals (a non-empty list = hard fail). */
  violations: string[];
  /** Proposal ids rolled back due to a post-merge validation regression. */
  rollbacks: string[];
  /** Final proposal summaries (for the report). */
  proposals: ProposalSummary[];
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** First H1 in a markdown body. */
function h1(content: string): string | undefined {
  return content.match(/^#\s+(.+)$/m)?.[1]?.trim();
}

/** Extract a `## Section` body (up to the next heading), trimmed. */
function extractSection(content: string, heading: string): string {
  const re = new RegExp(`^#{1,6}\\s+${escapeRe(heading)}\\b`, "i");
  const lines = content.split("\n");
  const out: string[] = [];
  let capturing = false;
  for (const line of lines) {
    if (/^#{1,6}\s+/.test(line)) {
      if (capturing) break;
      if (re.test(line)) capturing = true;
      continue;
    }
    if (capturing) out.push(line);
  }
  return out.join("\n").trim();
}

const FM_RE = /^(﻿?---\r?\n[\s\S]*?\r?\n---\r?\n)([\s\S]*)$/;

/** Surgically set frontmatter fields, leaving the rest byte-for-byte. */
function editFrontmatter(raw: string, edits: Record<string, string>): string {
  const m = FM_RE.exec(raw);
  if (!m) return raw;
  let fm = m[1] ?? "";
  for (const [k, v] of Object.entries(edits)) {
    const re = new RegExp(`^${escapeRe(k)}:.*$`, "m");
    if (re.test(fm)) fm = fm.replace(re, `${k}: ${v}`);
  }
  return `${fm}${m[2] ?? ""}`;
}

/** A parsed view of one proposal document. */
interface ProposalView {
  relPath: string;
  absPath: string;
  raw: string;
  id: string;
  title: string;
  status: string;
  targetDocument: string;
  supportingDocuments: string[];
  sourceResearch: string[];
  createdFromTasks: string[];
  purpose: string;
  proposedChange: string;
  impact: string;
}

function toProposalView(doc: VaultDoc): ProposalView {
  const d = doc.parsed.data;
  const content = doc.parsed.content;
  const id =
    str(d["proposal_id"]) ?? doc.basename.match(/^(P-\d+)/)?.[1] ?? doc.basename;
  const claim = str(d["claim"]);
  return {
    relPath: doc.relPath,
    absPath: doc.absPath,
    raw: doc.raw,
    id,
    title: h1(content) ?? claim ?? doc.basename,
    status: str(d.status) ?? "review",
    targetDocument: str(d["target_document"]) ?? "",
    supportingDocuments: strArray(d["supporting_documents"]),
    sourceResearch: strArray(d["source_research"]),
    createdFromTasks: strArray(d["created_from_tasks"]),
    purpose: extractSection(content, "Purpose"),
    proposedChange: extractSection(content, "Proposed Change") || (claim ?? ""),
    impact: extractSection(content, "Impact"),
  };
}

function isProposalDoc(doc: VaultDoc): boolean {
  return doc.parsed.data.type === "knowledge_proposal";
}

/** Resolve a target document (by basename or relPath) against the vault. */
function findTargetDoc(docs: VaultDoc[], targetDocument: string): VaultDoc | null {
  const inner = linkTarget(targetDocument);
  if (inner === "") return null;
  const key = resolutionKey(inner);
  const lowerRel = inner.toLowerCase();
  return (
    docs.find((d) => d.relPath.toLowerCase() === lowerRel) ??
    docs.find((d) => d.basename.toLowerCase() === key) ??
    null
  );
}

function isCanonicalTarget(doc: VaultDoc): boolean {
  return (CANONICAL_FOLDERS as readonly string[]).includes(doc.topFolder);
}

/** Restore changed files from a snapshot (deleting files absent at snapshot). */
async function restoreFiles(
  vaultPath: string,
  snapshot: Map<string, string>,
  changed: string[],
): Promise<void> {
  for (const entry of changed) {
    const rel = entry.replace(/ \(deleted\)$/, "");
    const abs = path.join(vaultPath, rel);
    const content = snapshot.get(rel);
    if (content === undefined) {
      await fs.rm(abs, { force: true });
    } else {
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content, "utf8");
    }
  }
}

function dayOf(clock?: () => Date): string {
  return (clock ? clock() : new Date()).toISOString().slice(0, 10);
}

async function refreshQueues(vaultPath: string, tasks: KosTask[]): Promise<void> {
  const day = dayOf();
  await writeMetaFile(vaultPath, "Open Task Queue.md", renderOpenTaskQueue(tasks, day));
  await writeMetaFile(vaultPath, "Task Queue.md", renderTaskQueue(tasks, day));
}

/** Ensure `11 Proposals/Proposals Map.md` exists so proposal links resolve. */
async function ensureProposalsMap(vaultPath: string, day: string): Promise<void> {
  const abs = path.join(vaultPath, PROPOSALS_FOLDER, "Proposals Map.md");
  try {
    await fs.access(abs);
  } catch {
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, renderProposalsMap(day, day), "utf8");
  }
}

/**
 * Materialise proposal documents for any open promotion task that lacks one,
 * marking those tasks `in_progress`. Returns the (possibly updated) task list.
 */
async function materializeProposals(
  vaultPath: string,
  tasks: KosTask[],
  docs: VaultDoc[],
  day: string,
  log: (m: string) => void,
): Promise<KosTask[]> {
  const proposalDocs = docs.filter(isProposalDoc).map(toProposalView);
  const materializedTaskIds = new Set(
    proposalDocs.flatMap((p) => p.createdFromTasks),
  );
  const existingIds = proposalDocs.map((p) => p.id);

  let result = tasks;
  for (const task of tasks) {
    if (!isPromotionType(task.type)) continue;
    if (task.status !== "open" && task.status !== "in_progress") continue;
    if (materializedTaskIds.has(task.id)) continue;

    const target = task.targetDocument;
    if (target === undefined || findTargetDoc(docs, target) === null) {
      log(
        `Skipping ${task.id}: target document ${target ?? "(none)"} does not resolve; cannot propose a promotion into a non-existent doc.`,
      );
      continue;
    }

    const id = nextProposalId(existingIds);
    existingIds.push(id);
    const title = task.claim ?? task.goal;
    const md = renderProposalDocument({
      id,
      title,
      created: day,
      updated: day,
      claim: task.claim ?? task.goal,
      targetDocument: target,
      ...(task.supportingDocuments !== undefined
        ? { supportingDocuments: task.supportingDocuments }
        : {}),
      ...(task.supportingSources !== undefined
        ? { supportingSources: task.supportingSources }
        : {}),
      createdFromTasks: [task.id],
      createdByWorker: "promotion-engine",
      ...(task.confidence !== undefined ? { confidence: task.confidence } : {}),
      ...(task.origin !== undefined ? { origin: task.origin } : {}),
    });
    const abs = path.join(vaultPath, PROPOSALS_FOLDER, proposalFileName(id, title));
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, md, "utf8");
    materializedTaskIds.add(task.id);
    result = updateTask(result, task.id, { status: "in_progress" }, isoNow());
    log(`Materialised proposal ${id} for ${task.id} → ${target}.`);
  }
  return result;
}

/**
 * Run the promotion workflow: materialise proposals, review each pending one,
 * merge approved changes under the snapshot/validate/rollback guard, and write
 * the Promotion Report. Pure inputs except the injected reviewer/strategy.
 */
export async function runPromotion(
  vaultPath: string,
  opts: PromoteOptions = {},
): Promise<PromotionOutcome> {
  const reviewer = opts.reviewer ?? selectPromotionReviewer();
  const strategy = opts.strategy ?? new AppendMergeStrategy();
  const day = dayOf(opts.clock);
  const log = (m: string): void => {
    if (opts.quiet !== true) console.log(m);
  };

  const outcome: PromotionOutcome = {
    reviewed: 0,
    mergedDocs: [],
    rejected: [],
    changesRequested: [],
    violations: [],
    rollbacks: [],
    proposals: [],
  };

  await ensureProposalsMap(vaultPath, day);

  // Materialise proposal docs from open promotion tasks.
  let tasks = await loadTasks(vaultPath);
  let docs = await loadVault(vaultPath);
  tasks = await materializeProposals(vaultPath, tasks, docs, day, log);
  await saveTasks(vaultPath, tasks);

  // Baseline error count (after materialisation), to detect a merge regression.
  const baseline = await validateVault(vaultPath, { quiet: true, noReport: true });
  const baselineErrors = baseline.errors.length;

  // Discover pending proposals.
  docs = await loadVault(vaultPath);
  const pending = docs
    .filter(isProposalDoc)
    .map(toProposalView)
    .filter((p) => p.status === "review")
    .filter((p) => opts.proposalId === undefined || p.id === opts.proposalId)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  if (pending.length === 0) {
    log("No proposals to review.");
  }

  for (const prop of pending) {
    outcome.reviewed += 1;
    const response =
      opts.decision !== undefined
        ? { decision: opts.decision }
        : await reviewer.review({
            id: prop.id,
            title: prop.title,
            purpose: prop.purpose,
            proposedChange: prop.proposedChange,
            target: prop.targetDocument,
            evidence: [...prop.supportingDocuments, ...prop.sourceResearch],
            impact: prop.impact,
          });

    if (response.decision === "approve") {
      await approve(vaultPath, prop, strategy, day, baselineErrors, outcome, log);
    } else if (response.decision === "reject") {
      await fs.writeFile(
        prop.absPath,
        editFrontmatter(
          setDecision(prop.raw, `Rejected on ${day}.`, response.note),
          { status: "rejected", updated: day },
        ),
        "utf8",
      );
      outcome.rejected.push(prop.id);
      log(`Proposal ${prop.id} rejected.`);
    } else {
      await fs.writeFile(
        prop.absPath,
        editFrontmatter(
          setDecision(prop.raw, `Changes requested on ${day}.`, response.note),
          { status: "draft", updated: day },
        ),
        "utf8",
      );
      outcome.changesRequested.push(prop.id);
      log(`Proposal ${prop.id}: changes requested.`);
    }
  }

  // Reconcile each proposal's source tasks with the decision recorded in `outcome`.
  tasks = reconcileTasks(tasks, pending, outcome);

  await saveTasks(vaultPath, tasks);
  await refreshQueues(vaultPath, tasks);

  // Final proposal summaries for the report.
  const finalDocs = await loadVault(vaultPath);
  outcome.proposals = finalDocs.filter(isProposalDoc).map((d) => {
    const v = toProposalView(d);
    return {
      id: v.id,
      title: v.title,
      status: v.status,
      target: linkTarget(v.targetDocument),
      relPath: v.relPath,
    };
  });

  await writeMetaFile(
    vaultPath,
    "Promotion Report.md",
    renderPromotionReport({
      proposals: outcome.proposals,
      tasks,
      mergedDocs: outcome.mergedDocs,
      now: day,
    }),
  );

  return outcome;
}

/** Append/replace the proposal's Decision section (and a Reviewer Note). */
function setDecision(raw: string, decision: string, note?: string): string {
  let out = raw.replace(
    /_Pending founder review \(approve \/ reject \/ request changes\)\._/,
    decision,
  );
  if (note !== undefined && note.trim() !== "") {
    out = out.replace(
      /_Founder notes recorded during review appear here\._/,
      `- ${note.trim()}`,
    );
  }
  return out;
}

/** Set the status of every task a proposal was created from. */
function setProposalTasks(
  tasks: KosTask[],
  prop: ProposalView,
  status: KosTask["status"],
): KosTask[] {
  let result = tasks;
  for (const id of prop.createdFromTasks) {
    result = updateTask(result, id, { status }, isoNow());
  }
  return result;
}

/**
 * Reconcile each reviewed proposal's source tasks with the recorded decision:
 * merged → complete, rejected → failed, changes requested → open. Proposals that
 * were refused (boundary/illegal target) or rolled back keep their tasks
 * actionable so they can be revisited.
 */
function reconcileTasks(
  tasks: KosTask[],
  pending: ProposalView[],
  outcome: PromotionOutcome,
): KosTask[] {
  let result = tasks;
  for (const prop of pending) {
    if (outcome.rejected.includes(prop.id)) {
      result = setProposalTasks(result, prop, "failed");
    } else if (outcome.changesRequested.includes(prop.id)) {
      result = setProposalTasks(result, prop, "open");
    } else if (
      outcome.violations.some((v) => v.startsWith(prop.id)) ||
      outcome.rollbacks.includes(prop.id)
    ) {
      result = setProposalTasks(result, prop, "open");
    } else {
      // Approved and merged.
      result = setProposalTasks(result, prop, "complete");
    }
  }
  return result;
}

/** Approve one proposal: merge under the snapshot/validate/rollback guard. */
async function approve(
  vaultPath: string,
  prop: ProposalView,
  strategy: MergeStrategy,
  day: string,
  baselineErrors: number,
  outcome: PromotionOutcome,
  log: (m: string) => void,
): Promise<void> {
  const docs = await loadVault(vaultPath);
  const targetDoc = findTargetDoc(docs, prop.targetDocument);
  if (targetDoc === null) {
    outcome.violations.push(`${prop.id}: target ${prop.targetDocument} not found`);
    log(`Proposal ${prop.id} refused — target not found.`);
    return;
  }
  if (targetDoc.inKernel) {
    outcome.violations.push(`${prop.id}: KERNEL target ${targetDoc.relPath} refused`);
    console.error(
      `KERNEL VIOLATION — proposal ${prop.id} targets ${targetDoc.relPath}; the Kernel is immutable. Refused.`,
    );
    return;
  }
  if (!isCanonicalTarget(targetDoc)) {
    outcome.violations.push(
      `${prop.id}: non-canonical target ${targetDoc.relPath} refused`,
    );
    console.error(
      `CANONICAL VIOLATION — proposal ${prop.id} targets ${targetDoc.relPath}, which is not a canonical layer. Refused.`,
    );
    return;
  }

  const snapshot = await snapshotFolders(vaultPath, ALL_FOLDERS);
  const proposalLink = prop.relPath.replace(/\.md$/i, "");
  const { mergedRaw } = strategy.merge({
    targetRaw: targetDoc.raw,
    targetRelPath: targetDoc.relPath,
    proposal: {
      id: prop.id,
      title: prop.title,
      body: prop.proposedChange,
      evidenceLinks: [...prop.supportingDocuments, ...prop.sourceResearch],
      proposalLink,
    },
    now: day,
  });
  await fs.writeFile(targetDoc.absPath, mergedRaw, "utf8");

  // Write-boundary guard: only the explicit target may have changed.
  const changed = await folderChanges(vaultPath, snapshot, ALL_FOLDERS);
  const illegal = changed.filter(
    (c) => c.replace(/ \(deleted\)$/, "") !== targetDoc.relPath,
  );
  if (illegal.length > 0) {
    await restoreFiles(vaultPath, snapshot, changed);
    outcome.violations.push(`${prop.id}: write boundary violated (${illegal.join(", ")})`);
    console.error(
      `BOUNDARY VIOLATION — merging ${prop.id} changed files outside the target: ${illegal.join(", ")}. Rolled back.`,
    );
    return;
  }

  // Re-validate; roll back on any regression.
  const after = await validateVault(vaultPath, { quiet: true, noReport: true });
  if (after.errors.length > baselineErrors) {
    await restoreFiles(vaultPath, snapshot, changed);
    outcome.rollbacks.push(prop.id);
    console.error(
      `Proposal ${prop.id} rolled back — merge introduced validation errors (${after.errors.length} > baseline ${baselineErrors}). Target restored.`,
    );
    return;
  }

  // Success: mark the proposal merged (only now that validation holds).
  await fs.writeFile(
    prop.absPath,
    editFrontmatter(setDecision(prop.raw, `Approved and merged on ${day}.`), {
      status: "merged",
      updated: day,
    }),
    "utf8",
  );
  outcome.mergedDocs.push(targetDoc.relPath);
  log(`Proposal ${prop.id} approved and merged into ${targetDoc.relPath}.`);
}

/** CLI entry: returns the process exit code. */
export async function runPromoteCommand(
  vaultPath: string,
  opts: PromoteOptions = {},
): Promise<number> {
  const outcome = await runPromotion(vaultPath, opts);
  return outcome.violations.length > 0 || outcome.rollbacks.length > 0 ? 1 : 0;
}
