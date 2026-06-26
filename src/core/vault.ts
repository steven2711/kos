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
import { parseFile, ParsedFile } from "./frontmatter.js";

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
  "90 Meta",
  "99 Archive",
] as const;

/** Root-level markdown files that are genuine vault documents. */
export const ROOT_DOCS = ["Home.md", "README.md"] as const;

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
export const TEMPLATES_FOLDER = "01 Kernel/Templates";
export const INBOX_FOLDER = "00 Inbox";
export const META_FOLDER = "90 Meta";

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
  const topFolder = segments.length > 1 ? segments[0] : "";
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
  for (const doc of docs) {
    if (!KNOWLEDGE_LAYERS.includes(doc.topFolder as any)) continue;
    if (doc.isNavigation || doc.isTemplate) continue;
    if (doc.fileName === "_index.md") continue;
    perLayer[doc.topFolder] = true;
  }
  const covered = Object.values(perLayer).filter(Boolean).length;
  return { covered, total: KNOWLEDGE_LAYERS.length, perLayer };
}

/** Read every Kernel file's content keyed by relative path (for the run guard). */
export async function snapshotKernel(
  vaultPath: string,
): Promise<Map<string, string>> {
  const root = path.resolve(vaultPath);
  const entries = await fg(`${fg.escapePath(KERNEL_FOLDER)}/**/*`, {
    cwd: root,
    onlyFiles: true,
    dot: false,
  });
  const snap = new Map<string, string>();
  for (const rel of entries) {
    const content = await fs.readFile(path.join(root, rel), "utf8");
    snap.set(rel.split(path.sep).join("/"), content);
  }
  return snap;
}

/** Return the relative paths of Kernel files that changed vs a snapshot. */
export async function kernelChanges(
  vaultPath: string,
  before: Map<string, string>,
): Promise<string[]> {
  const after = await snapshotKernel(vaultPath);
  const changed: string[] = [];
  for (const [rel, content] of after) {
    if (before.get(rel) !== content) changed.push(rel);
  }
  for (const rel of before.keys()) {
    if (!after.has(rel)) changed.push(`${rel} (deleted)`);
  }
  return changed;
}
