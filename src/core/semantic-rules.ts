/**
 * The semantic-review contract — pure, deterministic, SDK-free.
 *
 * The deterministic Compiler validates *facts*. The LLM Semantic Reviewer
 * (`src/workers/semantic-reviewer.ts`) reviews *reasoning* and emits **advisory**
 * findings only. This module is the contract both sides share without touching
 * the Agent SDK:
 *
 *  - the finding taxonomy + Zod schema that validates whatever the model returns
 *    (garbage in → a safe, empty review, never a thrown exception);
 *  - `SEMANTIC_CHECKS`, the catalogue of things the reviewer is asked to look for;
 *  - `buildReviewContext`, a bounded, deterministic serialisation of the vault
 *    (plus the Compiler's objective analysis) that the reviewer reasons over.
 *
 * It lives in `core/` so the Planner can map findings to optional work and the
 * command layer can build the context, all without importing `workers/`.
 */
import { z } from "zod";
import { type VaultDoc } from "./vault.js";
import { type VaultAnalysis } from "./compiler.js";

/** How a finding is classified. Only the model's *reasoning*, never a fact. */
export const SEMANTIC_FINDING_CLASSES = [
  "suggestion",
  "observation",
  "possible_contradiction",
  "recommendation",
] as const;
export type SemanticFindingClass = (typeof SEMANTIC_FINDING_CLASSES)[number];

/** The reviewer's self-reported confidence. */
export const SEMANTIC_CONFIDENCES = ["low", "medium", "high"] as const;
export type SemanticConfidence = (typeof SEMANTIC_CONFIDENCES)[number];

export interface SemanticFinding {
  class: SemanticFindingClass;
  confidence: SemanticConfidence;
  /** One-line summary of the finding. */
  title: string;
  /** Why it matters — the reasoning behind the finding (required). */
  reasoning: string;
  /** Vault-relative paths of the documents the finding is about (required). */
  supportingDocuments: string[];
  /** What the reviewer suggests doing about it. */
  recommendedAction: string;
}

export interface SemanticReview {
  findings: SemanticFinding[];
  /** Optional free-text note from the reviewer (e.g. why it returned nothing). */
  note?: string | undefined;
}

/**
 * Validates the model's output at the boundary. Anything that does not match is
 * rejected (the reviewer then falls back to an empty advisory review) so a
 * malformed LLM response can never corrupt the pipeline.
 */
export const SemanticFindingSchema = z.object({
  class: z.enum(SEMANTIC_FINDING_CLASSES),
  confidence: z.enum(SEMANTIC_CONFIDENCES),
  title: z.string().min(1),
  reasoning: z.string().min(1),
  supportingDocuments: z.array(z.string()),
  recommendedAction: z.string().min(1),
});

export const SemanticReviewSchema = z.object({
  findings: z.array(SemanticFindingSchema),
  note: z.string().optional(),
});

/** One semantic check the reviewer is asked to apply. */
export interface SemanticCheck {
  id: string;
  title: string;
  description: string;
}

/**
 * The catalogue of reasoning-level checks. This documents intent *and* is
 * embedded into the review context so the model applies a consistent rubric.
 */
export const SEMANTIC_CHECKS: readonly SemanticCheck[] = [
  {
    id: "vision-roadmap-drift",
    title: "Vision / product / roadmap drift",
    description:
      "Does the roadmap and product actually pursue the stated vision, or have they drifted apart?",
  },
  {
    id: "architecture-vs-mvp",
    title: "Architecture complexity vs MVP scope",
    description:
      "Is the proposed architecture heavier than the product scope justifies (e.g. event sourcing for a CRUD MVP)?",
  },
  {
    id: "business-model-inconsistency",
    title: "Business model inconsistency",
    description:
      "Do the business model, pricing, and target audience cohere with the product and vision?",
  },
  {
    id: "unsupported-assumptions",
    title: "Unsupported assumptions",
    description:
      "Are key assumptions asserted without evidence, research, or a linked rationale?",
  },
  {
    id: "unclear-differentiation",
    title: "Unclear differentiation",
    description:
      "Is it clear how this differs from alternatives, or is the differentiation vague?",
  },
  {
    id: "duplicate-concepts-by-meaning",
    title: "Duplicate concepts by meaning",
    description:
      "Do two documents describe the same concept under different names (semantic, not textual, duplication)?",
  },
  {
    id: "weak-product-strategy",
    title: "Weak product strategy",
    description:
      "Is the product strategy coherent and prioritised, or a loose list of features?",
  },
  {
    id: "missing-founder-intent",
    title: "Missing founder intent",
    description:
      "Is a decision being implied that only the founder can make? Prefer a founder interview over an assumption.",
  },
];

/** Cap how much of each document body is serialised, to bound the prompt. */
const MAX_LEAD_CHARS = 400;
const MAX_HEADINGS = 12;

/** All `#`-level headings in a markdown body, in order (capped). */
function headings(body: string): string[] {
  const out: string[] = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^(#{1,6})\s+(.*\S)\s*$/);
    const text = m?.[2];
    if (text !== undefined) out.push(text.trim());
    if (out.length >= MAX_HEADINGS) break;
  }
  return out;
}

/** First non-heading, non-empty paragraph of a body (truncated). */
function leadParagraph(body: string): string {
  for (const block of body.split(/\n\s*\n/)) {
    const text = block.trim();
    if (text === "" || text.startsWith("#")) continue;
    const flat = text.replace(/\s+/g, " ");
    return flat.length > MAX_LEAD_CHARS
      ? `${flat.slice(0, MAX_LEAD_CHARS)}…`
      : flat;
  }
  return "";
}

/** A field's string value, or "?" when absent — keeps the context terse. */
function fm(value: unknown): string {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : "?";
}

/** One compact block describing a single document for the reviewer. */
function describeDoc(doc: VaultDoc): string {
  const hs = headings(doc.parsed.content);
  const lead = leadParagraph(doc.parsed.content);
  const lines = [
    `### ${doc.relPath}`,
    `type: ${fm(doc.parsed.data.type)} | status: ${fm(doc.parsed.data.status)}`,
  ];
  if (hs.length > 0) lines.push(`sections: ${hs.join(", ")}`);
  if (lead !== "") lines.push(lead);
  return lines.join("\n");
}

/**
 * Build the deterministic, bounded context the reviewer reasons over: the
 * Compiler's objective analysis, the rubric of checks, and a compact per-document
 * summary of every authored (non-template, non-capture, non-readme) document.
 * Pure: same vault → same context string.
 */
export function buildReviewContext(
  docs: VaultDoc[],
  analysis: VaultAnalysis,
): string {
  const reviewable = docs
    .filter((d) => !d.isReadme && !d.isTemplate && !d.isCapture && !d.inKernel)
    .sort((a, b) => a.relPath.localeCompare(b.relPath));

  const checks = SEMANTIC_CHECKS.map(
    (c) => `- ${c.title}: ${c.description}`,
  ).join("\n");

  const missing =
    analysis.missingLayers.length === 0
      ? "(every knowledge layer has at least one document)"
      : analysis.missingLayers.join(", ");

  const openQs =
    analysis.openQuestions.length === 0
      ? "(none recorded)"
      : analysis.openQuestions
          .slice(0, 25)
          .map((q) => `- ${q.text} (${q.path})`)
          .join("\n");

  const docBlocks =
    reviewable.length === 0
      ? "(no authored documents yet)"
      : reviewable.map(describeDoc).join("\n\n");

  return `# KOS Semantic Review — Context

You are reviewing the reasoning across a Knowledge Operating System vault. The
deterministic compiler has already checked the facts below; review the *reasoning*.

## Objective analysis (from the deterministic compiler)

- Knowledge layers covered: ${analysis.coverage.covered}/${analysis.coverage.total}
- Missing knowledge layers: ${missing}
- Orphan documents: ${analysis.orphans.length}
- Broken links: ${analysis.brokenLinks.length}

### Open questions already recorded in the vault

${openQs}

## Checks to apply

${checks}

## Documents (${reviewable.length})

${docBlocks}
`;
}
