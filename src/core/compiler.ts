/**
 * The knowledge compiler: read-only, deterministic checks over the vault, plus a
 * coverage score and an analysis of what knowledge is missing.
 *
 * This is the v0.5 realisation of `90 Meta/Validation.md`. The compiler does NOT
 * generate tasks or schedule work — it only reports. The Planner
 * (`src/planner/planner.ts`) consumes this analysis to produce candidate work.
 */
import {
  type VaultDoc,
  loadVault,
  knowledgeLayerCoverage,
  KNOWLEDGE_LAYERS,
} from "./vault.js";
import { checkFrontmatter } from "./frontmatter.js";
import { resolves } from "./wikilinks.js";
import { buildGraph, inboundCount, type KnowledgeGraph } from "./graph.js";
import { type CompilerIssue, issue, bySeverity } from "./issues.js";
import { computeScore, type ScoreBreakdown } from "./scoring.js";

/** Sections every authored (non-template, non-capture) document must contain. */
const REQUIRED_SECTIONS = [
  "Purpose",
  "Context",
  "Open Questions",
  "Related Documents",
] as const;

/**
 * ADRs follow a type-specific anatomy (Decision Framework) rather than the
 * generic section set — they record a decision, not an evolving concept.
 */
const ADR_REQUIRED_SECTIONS = [
  "Purpose",
  "Problem",
  "Decision",
  "Consequences",
  "Status",
  "Related Documents",
] as const;

/**
 * Research documents add a `Sources` section to the generic set: evidence must
 * cite where it came from ("research is evidence, not truth"). This deterministically
 * enforces the v0.8 "research docs include at least one source" requirement at the
 * section level. Templates (`template:true`) and `type:moc` docs are exempt from
 * SEC-001, so the kernel Research template and Research Map are unaffected.
 */
const RESEARCH_REQUIRED_SECTIONS = [
  ...REQUIRED_SECTIONS,
  "Sources",
] as const;

function requiredSectionsFor(type: unknown): readonly string[] {
  if (type === "adr") return ADR_REQUIRED_SECTIONS;
  if (type === "research") return RESEARCH_REQUIRED_SECTIONS;
  return REQUIRED_SECTIONS;
}

/** Headings that satisfy the "Relationships" requirement (or its variants). */
const RELATIONSHIP_HEADINGS = [
  "Relationships",
  "Related Concepts",
  "Parent Concepts",
  "Child Concepts",
  "Related Documents",
];

const MIN_LINKS = 5;

export interface VaultAnalysis {
  missingLayers: string[];
  /** Open questions scraped from `## Open Questions` sections, with source. */
  openQuestions: { text: string; path: string }[];
  brokenLinks: { path: string; target: string; line: number }[];
  orphans: string[];
  coverage: { covered: number; total: number; perLayer: Record<string, boolean> };
}

export interface CompilerResult {
  score: number;
  scoreBreakdown: ScoreBreakdown;
  errors: CompilerIssue[];
  warnings: CompilerIssue[];
  suggestions: CompilerIssue[];
  analysis: VaultAnalysis;
  docCount: number;
}

function hasHeading(body: string, name: string): boolean {
  const re = new RegExp(`^#{1,6}\\s+${escapeRe(name)}\\b`, "im");
  return re.test(body);
}

function hasAnyHeading(body: string, names: string[]): boolean {
  return names.some((n) => hasHeading(body, n));
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Validate one document, appending issues. Honours the exemption model. */
function checkDocument(
  doc: VaultDoc,
  graph: KnowledgeGraph,
): CompilerIssue[] {
  const issues: CompilerIssue[] = [];
  const p = doc.relPath;

  // README is intentionally frontmatter-less and is not a typed document.
  if (doc.isReadme) return issues;
  // Raw Inbox captures are exempt from authored-document checks.
  if (doc.isCapture) return issues;

  // --- Frontmatter (FM-*, TPL-*) ---
  issues.push(
    ...checkFrontmatter(doc.parsed, {
      path: p,
      isTemplate: doc.isTemplate,
      inTemplatesFolder: doc.inTemplatesFolder,
    }),
  );

  const body = doc.parsed.content;
  const links = graph.links.get(p);

  // --- Links resolve (LNK-003) — applies to templates too. ---
  if (links) {
    for (const l of links.bodyLinks) {
      if (!resolves(l.target, graph.index)) {
        issues.push(
          issue("LNK-003", "ERROR", `unresolved wikilink [[${l.target}]]`, p, l.line),
        );
      }
    }
  }

  // Templates are exempt from content-shape checks (SEC-001, LNK-001/002).
  if (doc.isTemplate) return issues;

  // --- Required sections (SEC-001), type-aware ---
  for (const section of requiredSectionsFor(doc.parsed.data.type)) {
    if (!hasHeading(body, section)) {
      issues.push(
        issue("SEC-001", "ERROR", `missing required section "${section}"`, p),
      );
    }
  }
  // Relationships satisfied by a Relationships/concept-variant/Related Documents
  // heading, or by non-empty frontmatter relationship fields.
  const fmRels =
    arrLen(doc.parsed.data.parents) +
    arrLen(doc.parsed.data.children) +
    arrLen(doc.parsed.data.related);
  if (!hasAnyHeading(body, RELATIONSHIP_HEADINGS) && fmRels === 0) {
    issues.push(
      issue(
        "SEC-001",
        "WARNING",
        "no relationships expressed (no Relationships section and empty parents/children/related)",
        p,
      ),
    );
  }

  // --- Five-link minimum (LNK-001) ---
  const linkCount = links ? links.bodyLinks.length : 0;
  if (linkCount < MIN_LINKS) {
    issues.push(
      issue(
        "LNK-001",
        "ERROR",
        `only ${linkCount} wikilink(s); at least ${MIN_LINKS} required`,
        p,
      ),
    );
  }

  // --- Orphan (LNK-002) — Home is exempt. ---
  if (!doc.isHome && inboundCount(graph, doc) === 0) {
    issues.push(issue("LNK-002", "WARNING", "orphan document (no inbound links)", p));
  }

  return issues;
}

function arrLen(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

/** Scrape `## Open Questions` bullet lines across the vault. */
function scrapeOpenQuestions(docs: VaultDoc[]): { text: string; path: string }[] {
  const out: { text: string; path: string }[] = [];
  for (const doc of docs) {
    if (doc.isReadme || doc.isTemplate || doc.isCapture) continue;
    const lines = doc.parsed.content.split("\n");
    let inSection = false;
    for (const line of lines) {
      const heading = line.match(/^#{1,6}\s+(.*\S)\s*$/);
      if (heading) {
        const headingText = heading[1];
        inSection =
          headingText !== undefined && /^open questions$/i.test(headingText.trim());
        continue;
      }
      if (!inSection) continue;
      const bullet = line.match(/^\s*[-*]\s+(.*\S)/);
      const bulletText = bullet?.[1];
      if (bulletText !== undefined) {
        out.push({ text: bulletText.trim(), path: doc.relPath });
      }
    }
  }
  return out;
}

/** Run the full compile over already-loaded docs. */
export function compileDocs(docs: VaultDoc[]): CompilerResult {
  const graph = buildGraph(docs);
  const allIssues: CompilerIssue[] = [];
  for (const doc of docs) {
    allIssues.push(...checkDocument(doc, graph));
  }

  const errors = bySeverity(allIssues, "ERROR");
  const warnings = bySeverity(allIssues, "WARNING");
  const suggestions = bySeverity(allIssues, "INFO");

  const coverage = knowledgeLayerCoverage(docs);
  const missingLayers = KNOWLEDGE_LAYERS.filter((l) => coverage.perLayer[l] !== true);
  const openQuestions = scrapeOpenQuestions(docs);
  const brokenLinks = errors
    .filter((e) => e.ruleId === "LNK-003")
    .map((e) => ({
      path: e.path ?? "",
      target: (e.message.match(/\[\[(.+?)\]\]/)?.[1]) ?? "",
      line: e.line ?? 0,
    }));
  const orphans = warnings
    .filter((w) => w.ruleId === "LNK-002")
    .map((w) => w.path ?? "");

  const analysis: VaultAnalysis = {
    missingLayers,
    openQuestions,
    brokenLinks,
    orphans,
    coverage,
  };

  const scoreBreakdown = computeScore({
    errors: errors.length,
    warnings: warnings.length,
    layersCovered: coverage.covered,
    layersTotal: coverage.total,
  });

  return {
    score: scoreBreakdown.score,
    scoreBreakdown,
    errors,
    warnings,
    suggestions,
    analysis,
    docCount: docs.length,
  };
}

/** Convenience: load a vault from disk and compile it. */
export async function compileVault(vaultPath: string): Promise<CompilerResult> {
  const docs = await loadVault(vaultPath);
  return compileDocs(docs);
}
