/**
 * Frontmatter parsing and validation (rules FM-001..FM-006, TPL-001/002).
 *
 * The schema is the canonical contract from `01 Kernel/Frontmatter Specification.md`:
 *   type, status, created, updated, owner, tags, parents, children, related
 * plus the optional `template` marker for files in `01 Kernel/Templates/`.
 */
import matter from "gray-matter";
import { z } from "zod";
import { CompilerIssue, issue } from "./issues.js";

export const ALLOWED_TYPES = [
  "concept",
  "vision",
  "specification",
  "adr",
  "research",
  "experiment",
  "question",
  "meeting",
  "reference",
  "guide",
  "moc",
] as const;

export const ALLOWED_STATUSES = [
  "draft",
  "review",
  "accepted",
  "canonical",
  "deprecated",
  "archived",
] as const;

export const REQUIRED_KEYS = [
  "type",
  "status",
  "created",
  "updated",
  "owner",
  "tags",
  "parents",
  "children",
  "related",
] as const;

export type DocType = (typeof ALLOWED_TYPES)[number];
export type DocStatus = (typeof ALLOWED_STATUSES)[number];

export interface Frontmatter {
  type?: string;
  status?: string;
  created?: string;
  updated?: string;
  owner?: string;
  tags?: unknown;
  parents?: unknown;
  children?: unknown;
  related?: unknown;
  template?: boolean;
  [key: string]: unknown;
}

export interface ParsedFile {
  /** The raw frontmatter object (may be empty if none present). */
  data: Frontmatter;
  /** Whether a frontmatter block was actually present. */
  hasFrontmatter: boolean;
  /** The body content after the frontmatter. */
  content: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normalise a frontmatter date value to a canonical `YYYY-MM-DD` string.
 * YAML parses bare dates into JS `Date` objects, so both forms must be handled.
 * Returns null when the value cannot be interpreted as a calendar date.
 */
export function normalizeDate(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    return DATE_RE.test(value.trim()) ? value.trim() : null;
  }
  return null;
}

/** Parse a raw markdown string into frontmatter + body. */
export function parseFile(raw: string): ParsedFile {
  const hasFrontmatter = /^﻿?---\r?\n/.test(raw);
  const parsed = matter(raw);
  return {
    data: (parsed.data ?? {}) as Frontmatter,
    hasFrontmatter,
    content: parsed.content ?? "",
  };
}

/** Zod schema for a fully-valid (non-template) document's frontmatter. */
export const FrontmatterSchema = z.object({
  type: z.enum(ALLOWED_TYPES),
  status: z.enum(ALLOWED_STATUSES),
  created: z.string().regex(DATE_RE),
  updated: z.string().regex(DATE_RE),
  owner: z.string().min(1),
  tags: z.array(z.string()),
  parents: z.array(z.string()),
  children: z.array(z.string()),
  related: z.array(z.string()),
  template: z.boolean().optional(),
});

export interface FrontmatterCheckOptions {
  /** Vault-relative path, used in issue messages. */
  path: string;
  /** True if this file is a template (`template: true`). */
  isTemplate: boolean;
  /** True if the file sits inside `01 Kernel/Templates/`. */
  inTemplatesFolder: boolean;
}

/**
 * Validate a parsed file's frontmatter against the Kernel schema.
 * Returns a (possibly empty) list of issues.
 */
export function checkFrontmatter(
  parsed: ParsedFile,
  opts: FrontmatterCheckOptions,
): CompilerIssue[] {
  const issues: CompilerIssue[] = [];
  const { path } = opts;
  const fm = parsed.data;

  // FM-001 — block exists and parsed as YAML.
  if (!parsed.hasFrontmatter || Object.keys(fm).length === 0) {
    issues.push(issue("FM-001", "ERROR", "missing frontmatter", path));
    return issues; // nothing further to check
  }

  // FM-002 — all required keys present.
  const missing = REQUIRED_KEYS.filter((k) => !(k in fm));
  if (missing.length > 0) {
    issues.push(
      issue(
        "FM-002",
        "ERROR",
        `missing required frontmatter keys: ${missing.join(", ")}`,
        path,
      ),
    );
  }

  // FM-003 — type allowed.
  if (fm.type !== undefined && !ALLOWED_TYPES.includes(fm.type as DocType)) {
    issues.push(
      issue("FM-003", "ERROR", `invalid type "${fm.type}"`, path),
    );
  }

  // FM-004 — status allowed.
  if (
    fm.status !== undefined &&
    !ALLOWED_STATUSES.includes(fm.status as DocStatus)
  ) {
    issues.push(
      issue("FM-004", "ERROR", `invalid status "${fm.status}"`, path),
    );
  }

  // FM-005 — valid dates; updated >= created.
  const createdStr = "created" in fm ? normalizeDate(fm.created) : null;
  const updatedStr = "updated" in fm ? normalizeDate(fm.updated) : null;
  for (const [key, norm] of [
    ["created", createdStr],
    ["updated", updatedStr],
  ] as const) {
    if (key in fm && norm === null) {
      issues.push(
        issue("FM-005", "ERROR", `${key} is not a valid YYYY-MM-DD date`, path),
      );
    }
  }
  if (createdStr && updatedStr && updatedStr < createdStr) {
    issues.push(
      issue("FM-005", "ERROR", "updated is earlier than created", path),
    );
  }

  // FM-006 — owner non-empty.
  if (fm.owner !== undefined && String(fm.owner).trim() === "") {
    issues.push(issue("FM-006", "ERROR", "owner is empty", path));
  }

  // TPL-001 / TPL-002 — template marker discipline.
  if (fm.template === true) {
    if (!opts.inTemplatesFolder) {
      issues.push(
        issue(
          "TPL-001",
          "ERROR",
          "template: true file lives outside 01 Kernel/Templates/",
          path,
        ),
      );
    }
    if (fm.status !== "draft") {
      issues.push(
        issue(
          "TPL-001",
          "ERROR",
          `template must be status: draft (found "${fm.status}")`,
          path,
        ),
      );
    }
  } else if (opts.inTemplatesFolder) {
    // A file in the Templates folder that does not carry the marker.
    issues.push(
      issue(
        "TPL-002",
        "WARNING",
        "file in 01 Kernel/Templates/ is missing the template: true marker",
        path,
      ),
    );
  }

  return issues;
}
