/**
 * Vault discovery and document model.
 *
 * The CLI lives *alongside* the vault at the same root, so scanning is scoped
 * to the known vault folders plus the two root documents (Home.md, README.md).
 * Project files (src/, node_modules/, dist/, package.json, etc.) are never
 * treated as vault documents.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import { parseFile, type ParsedFile } from "./frontmatter.js";

/** Top-level vault folders, in order. */
export const VAULT_FOLDERS = [
  "00 Inbox",
  "01 Kernel",
  "02 Vision",
  "03 Product",
  "04 Domain",
  "05 Architecture",
  "06 Decisions",
  "07 Research",
  "08 Business",
  "09 Roadmap",
  "10 Operations",
  "11 Proposals",
  "90 Meta",
  "99 Archive",
] as const;

/** Root-level markdown files that are genuine vault documents. */
const ROOT_DOCS = ["Home.md", "README.md"] as const;

/** The eight "knowledge layer" folders used for coverage scoring. */
export const KNOWLEDGE_LAYERS = [
  "02 Vision",
  "03 Product",
  "04 Domain",
  "05 Architecture",
  "06 Decisions",
  "07 Research",
  "08 Business",
  "09 Roadmap",
] as const;

export const KERNEL_FOLDER = "01 Kernel";
const TEMPLATES_FOLDER = "01 Kernel/Templates";
export const INBOX_FOLDER = "00 Inbox";
export const META_FOLDER = "90 Meta";
export const RESEARCH_FOLDER = "07 Research";
export const PROPOSALS_FOLDER = "11 Proposals";

/**
 * The canonical knowledge layers — "company truth". These are the only folders
 * the Promotion Engine may append an approved proposal into. Note `07 Research/`
 * is deliberately excluded: research is immutable historical evidence, never a
 * promotion target; and `01 Kernel/` is excluded — it is never mutated.
 */
export const CANONICAL_FOLDERS = [
  "02 Vision",
  "03 Product",
  "04 Domain",
  "05 Architecture",
  "06 Decisions",
  "08 Business",
  "09 Roadmap",
  "10 Operations",
] as const;

/**
 * Folders the Research Worker must never touch. It may write only `07 Research/`
 * and `90 Meta/`; every other vault folder (Kernel + all canonical layers + the
 * Inbox + Archive) is snapshotted before/after a research task and any change
 * fails the task. This is the *real* write-boundary enforcement — SDK
 * `allowedTools` cannot be path-scoped reliably.
 */
export const PROTECTED_RESEARCH_FOLDERS = VAULT_FOLDERS.filter(
  (f) => f !== RESEARCH_FOLDER && f !== META_FOLDER,
);

/**
 * Files the CLI generates inside `90 Meta/`. They are tool output, not authored
 * vault knowledge, so document discovery skips them — the compiler must not
 * grade its own reports.
 */
export const GENERATED_META_FILES = new Set([
  "Validation Report.md",
  "Compiler Report.md",
  "Knowledge Score.md",
  "Ingestion Report.md",
  "Task Queue.md",
  "Open Task Queue.md",
  "Task Graph.md",
  "Execution Plan.md",
  "Founder Questions.md",
  "Interview Log.md",
  "Semantic Report.md",
  "Research Report.md",
  "Promotion Report.md",
]);

export interface VaultDoc {
  /** Absolute path on disk. */
  absPath: string;
  /** Vault-relative path with forward slashes, e.g. "04 Domain/Knowledge Graph.md". */
  relPath: string;
  /** File name with extension. */
  fileName: string;
  /** File name without extension — the wikilink resolution name. */
  basename: string;
  /** Top-level folder, or "" for a root document. */
  topFolder: string;
  /** Raw file contents. */
  raw: string;
  /** Parsed frontmatter + body. */
  parsed: ParsedFile;
  isReadme: boolean;
  isHome: boolean;
  isTemplate: boolean;
  inTemplatesFolder: boolean;
  inKernel: boolean;
  /** True for `_index.md` and `type: moc` navigation docs. */
  isNavigation: boolean;
  /** True for raw captures in `00 Inbox/` (anything but its `_index.md`). */
  isCapture: boolean;
}

/** Discover and load every vault document. */
export async function loadVault(vaultPath: string): Promise<VaultDoc[]> {
  const root = path.resolve(vaultPath);
  const patterns = [
    ...VAULT_FOLDERS.map((f) => `${fg.escapePath(f)}/**/*.md`),
    ...ROOT_DOCS,
  ];
  const entries = await fg(patterns, {
    cwd: root,
    onlyFiles: true,
    dot: false,
    caseSensitiveMatch: false,
  });

  const docs: VaultDoc[] = [];
  for (const rel of entries.sort()) {
    const relPath = rel.split(path.sep).join("/");
    const fileName = relPath.split("/").pop() ?? relPath;
    // Skip the CLI's own generated reports/queues living in 90 Meta.
    if (relPath.startsWith(`${META_FOLDER}/`) && GENERATED_META_FILES.has(fileName)) {
      continue;
    }
    const absPath = path.join(root, rel);
    const raw = await fs.readFile(absPath, "utf8");
    const parsed = parseFile(raw);
    docs.push(buildDoc(rel, absPath, raw, parsed));
  }
  return docs;
}

/**
 * Vault-relative paths of the authored input docs sitting in `00 Inbox/`:
 * top-level `*.md` only, excluding the `Interviews/` capture subfolder and
 * `_index.md`. Sorted for determinism; `[]` when the folder is absent. This is
 * the drop zone `kos start` seeds tasks from.
 */
export async function collectInboxDocs(vaultPath: string): Promise<string[]> {
  const root = path.resolve(vaultPath);
  const entries = await fg(`${fg.escapePath(INBOX_FOLDER)}/*.md`, {
    cwd: root,
    onlyFiles: true,
    dot: false,
    caseSensitiveMatch: false,
  });
  return entries
    .map((rel) => rel.split(path.sep).join("/"))
    .filter((rel) => (rel.split("/").pop() ?? rel).toLowerCase() !== "_index.md")
    .sort();
}

function buildDoc(
  rel: string,
  absPath: string,
  raw: string,
  parsed: ParsedFile,
): VaultDoc {
  const relPath = rel.split(path.sep).join("/");
  const fileName = relPath.split("/").pop() ?? relPath;
  const basename = fileName.replace(/\.md$/i, "");
  const segments = relPath.split("/");
  const topFolder = segments.length > 1 ? segments[0] ?? "" : "";
  const isTemplate = parsed.data.template === true;
  const inTemplatesFolder = relPath.startsWith(`${TEMPLATES_FOLDER}/`);
  const isNavigation =
    fileName === "_index.md" || parsed.data.type === "moc";

  return {
    absPath,
    relPath,
    fileName,
    basename,
    topFolder,
    raw,
    parsed,
    isReadme: relPath === "README.md",
    isHome: relPath === "Home.md",
    isTemplate,
    inTemplatesFolder,
    inKernel: topFolder === KERNEL_FOLDER,
    isNavigation,
    isCapture: topFolder === INBOX_FOLDER && fileName !== "_index.md",
  };
}

/** All basenames in the vault, for wikilink resolution. */
export function vaultBasenames(docs: VaultDoc[]): string[] {
  return docs.map((d) => d.basename);
}

/**
 * Count how many knowledge layers contain at least one "real" document —
 * a typed doc that is not a folder index, not a Map (moc), and not a template.
 */
export function knowledgeLayerCoverage(docs: VaultDoc[]): {
  covered: number;
  total: number;
  perLayer: Record<string, boolean>;
} {
  const perLayer: Record<string, boolean> = {};
  for (const layer of KNOWLEDGE_LAYERS) perLayer[layer] = false;
  const layers: readonly string[] = KNOWLEDGE_LAYERS;
  for (const doc of docs) {
    if (!layers.includes(doc.topFolder)) continue;
    if (doc.isNavigation || doc.isTemplate) continue;
    if (doc.fileName === "_index.md") continue;
    perLayer[doc.topFolder] = true;
  }
  const covered = Object.values(perLayer).filter(Boolean).length;
  return { covered, total: KNOWLEDGE_LAYERS.length, perLayer };
}

/**
 * Read the content of every file under the given folders, keyed by relative
 * path. The basis for the before/after write-boundary guards (Kernel and
 * Research).
 */
export async function snapshotFolders(
  vaultPath: string,
  folders: readonly string[],
): Promise<Map<string, string>> {
  const root = path.resolve(vaultPath);
  const patterns = folders.map((f) => `${fg.escapePath(f)}/**/*`);
  const entries = await fg(patterns, { cwd: root, onlyFiles: true, dot: false });
  const snap = new Map<string, string>();
  for (const rel of entries) {
    const content = await fs.readFile(path.join(root, rel), "utf8");
    snap.set(rel.split(path.sep).join("/"), content);
  }
  return snap;
}

/** Return the relative paths under `folders` that changed vs a snapshot. */
export async function folderChanges(
  vaultPath: string,
  before: Map<string, string>,
  folders: readonly string[],
): Promise<string[]> {
  const after = await snapshotFolders(vaultPath, folders);
  const changed: string[] = [];
  for (const [rel, content] of after) {
    if (before.get(rel) !== content) changed.push(rel);
  }
  for (const rel of before.keys()) {
    if (!after.has(rel)) changed.push(`${rel} (deleted)`);
  }
  return changed;
}

/** Read every Kernel file's content keyed by relative path (for the run guard). */
export async function snapshotKernel(
  vaultPath: string,
): Promise<Map<string, string>> {
  return snapshotFolders(vaultPath, [KERNEL_FOLDER]);
}

/** Return the relative paths of Kernel files that changed vs a snapshot. */
export async function kernelChanges(
  vaultPath: string,
  before: Map<string, string>,
): Promise<string[]> {
  return folderChanges(vaultPath, before, [KERNEL_FOLDER]);
}
