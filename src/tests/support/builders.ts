/**
 * Shared test builders (factories).
 *
 * Construct domain objects with sensible, *valid* defaults and override only the
 * field under test. This keeps tests focused on the behaviour they assert and
 * avoids the giant-inline-fixture / copy-paste duplication the testing
 * philosophy warns against. See `TESTING_PHILOSOPHY.md`.
 *
 * Builders use the REAL `parseFile()` to populate `VaultDoc.parsed`, so graph
 * and compiler unit tests exercise production parsing — no mocks of owned code.
 */
import { type KosTask, type TaskSpec } from "../../tasks/task-model.js";
import { type VaultDoc } from "../../core/vault.js";
import {
  type SemanticFinding,
  type SemanticReview,
} from "../../core/semantic-rules.js";
import { parseFile } from "../../core/frontmatter.js";

/** A fixed calendar date so frontmatter/date assertions stay deterministic. */
export const FIXED_DATE = "2026-06-25";
/** A fixed ISO timestamp for task createdAt/updatedAt. */
export const FIXED_TIMESTAMP = "2026-06-25T00:00:00.000Z";

/** A `TaskSpec` (pre-id/timestamp) with valid defaults. */
export function taskSpec(over: Partial<TaskSpec> = {}): TaskSpec {
  return {
    type: "domain_modeling",
    status: "open",
    priority: "medium",
    goal: "model something",
    inputs: [],
    expectedOutputs: [],
    acceptanceCriteria: [],
    dependencies: [],
    ...over,
  };
}

/** A fully-materialised `KosTask` with a stable id and fixed timestamps. */
export function kosTask(over: Partial<KosTask> = {}): KosTask {
  return {
    ...taskSpec(),
    id: "T-001",
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
    ...over,
  };
}

/** A `SemanticFinding` with valid defaults (a medium-confidence observation). */
export function semanticFinding(
  over: Partial<SemanticFinding> = {},
): SemanticFinding {
  return {
    class: "observation",
    confidence: "medium",
    title: "A finding",
    reasoning: "Because the documents appear to disagree.",
    supportingDocuments: ["02 Vision/Vision.md"],
    recommendedAction: "Review the cited documents.",
    ...over,
  };
}

/** A `SemanticReview` wrapping the given findings (defaults to one finding). */
export function semanticReview(findings?: SemanticFinding[]): SemanticReview {
  return { findings: findings ?? [semanticFinding()] };
}

export interface MarkdownDocOptions {
  type?: string;
  status?: string;
  owner?: string;
  created?: string;
  updated?: string;
  tags?: string[];
  /** Frontmatter `parents`, raw entries e.g. `"[[Domain Map]]"`. */
  parents?: string[];
  children?: string[];
  related?: string[];
  /** Body wikilink targets, rendered as `Related Documents` bullets. */
  links?: string[];
  /** Heading shown as the document title. */
  title?: string;
  /** Include the canonical Purpose/Context/Related Documents/Open Questions set. */
  sections?: boolean;
  /** Mark the document a template (`template: true`). */
  template?: boolean;
  /** Replace the entire body (frontmatter still generated). */
  body?: string;
}

/** A YAML flow sequence of quoted strings, e.g. `["[[A]]", "[[B]]"]`. */
function yamlList(items: string[]): string {
  return JSON.stringify(items);
}

/** Build a raw markdown document string with valid frontmatter. */
export function markdownDoc(opts: MarkdownDocOptions = {}): string {
  const title = opts.title ?? "Doc";
  const links = opts.links ?? [];
  const linkBullets = links.map((l) => `- [[${l}]]`).join("\n");
  const inlineLinks = links.map((l) => `[[${l}]]`).join(" ");

  let body: string;
  if (opts.body !== undefined) {
    body = opts.body;
  } else if (opts.sections === false) {
    body = `# ${title}\n\nNo required sections here.\n\n${linkBullets}`;
  } else {
    body = `# ${title}

## Purpose

Purpose text linking ${inlineLinks}.

## Context

Context.

## Related Documents

${linkBullets}

## Open Questions

- A question?`;
  }

  const fm = [
    `type: ${opts.type ?? "concept"}`,
    `status: ${opts.status ?? "canonical"}`,
    `created: ${opts.created ?? FIXED_DATE}`,
    `updated: ${opts.updated ?? FIXED_DATE}`,
    `owner: ${opts.owner ?? "founder"}`,
    `tags: ${yamlList(opts.tags ?? ["t"])}`,
    `parents: ${yamlList(opts.parents ?? [])}`,
    `children: ${yamlList(opts.children ?? [])}`,
    `related: ${yamlList(opts.related ?? [])}`,
    ...(opts.template === true ? ["template: true"] : []),
  ].join("\n");

  return `---\n${fm}\n---\n\n${body}\n`;
}

export interface VaultDocOptions extends MarkdownDocOptions {
  /** Vault-relative path, e.g. `"04 Domain/Knowledge Graph.md"`. */
  relPath: string;
  /** Provide the raw markdown directly instead of generating it. */
  raw?: string;
}

/**
 * Assemble an in-memory `VaultDoc` — classification derived honestly from the
 * relative path, frontmatter parsed by the real `parseFile()`. Mirrors the
 * production `buildDoc()` so graph/compiler tests need no filesystem.
 */
export function vaultDoc(opts: VaultDocOptions): VaultDoc {
  const relPath = opts.relPath;
  const raw = opts.raw ?? markdownDoc({ title: deriveTitle(relPath), ...opts });
  const parsed = parseFile(raw);

  const fileName = relPath.split("/").pop() ?? relPath;
  const basename = fileName.replace(/\.md$/i, "");
  const segments = relPath.split("/");
  const topFolder = segments.length > 1 ? segments[0] ?? "" : "";
  const inTemplatesFolder = relPath.startsWith("01 Kernel/Templates/");

  return {
    absPath: `/virtual/${relPath}`,
    relPath,
    fileName,
    basename,
    topFolder,
    raw,
    parsed,
    isReadme: relPath === "README.md",
    isHome: relPath === "Home.md",
    isTemplate: parsed.data.template === true,
    inTemplatesFolder,
    inKernel: topFolder === "01 Kernel",
    isNavigation: fileName === "_index.md" || parsed.data.type === "moc",
    isCapture: topFolder === "00 Inbox" && fileName !== "_index.md",
  };
}

function deriveTitle(relPath: string): string {
  const fileName = relPath.split("/").pop() ?? relPath;
  return fileName.replace(/\.md$/i, "");
}
