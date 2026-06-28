/**
 * Pure renderer for a research document (`07 Research/<date> - <topic>.md`).
 *
 * This lives in `core/` (a pure leaf) so the Research Worker in `workers/` may
 * import it — `workers/` may not import `reports/`. It is deterministic and
 * SDK-free: given the same input it produces the same markdown, byte for byte.
 *
 * The output is shaped to satisfy the deterministic compiler:
 *  - valid `type: research` frontmatter (FM-*),
 *  - the kernel `Research.md` template's section anatomy plus a `Sources`
 *    section (SEC-001 — including the research-specific `Sources` requirement),
 *  - at least five resolving wikilinks (LNK-001/LNK-003), padded from a pool of
 *    documents that always exist in a KOS vault (`Research Map`, `Home`).
 *
 * "Research is evidence, not truth": every claim should trace to a `## Sources`
 * entry, and the document never asserts canonical knowledge.
 */

/** A single cited source captured in the `## Sources` section. */
export interface ResearchSource {
  title: string;
  url: string;
  publisher: string;
  /** Access date, `YYYY-MM-DD`. */
  accessed: string;
  /** One-line note on why the source is relevant. */
  relevance: string;
}

export interface ResearchDocumentInput {
  /** Document title (also the H1 and the basis for the file name). */
  title: string;
  /** The research question/query that prompted the document. */
  query: string;
  /** `YYYY-MM-DD` creation date. */
  created: string;
  /** `YYYY-MM-DD` last-updated date (>= created). */
  updated: string;
  owner?: string;
  tags?: string[];
  /** Frontmatter parents; defaults to `["[[Research Map]]"]`. */
  parents?: string[];
  /** Frontmatter related links. */
  related?: string[];
  /** Cited sources (at least one expected; an empty list is flagged in-body). */
  sources: ResearchSource[];
  hypotheses?: string[];
  method?: string;
  summary?: string;
  findings?: string[];
  conclusion?: string;
  openQuestions?: string[];
  /** Wikilink targets for `## Related Documents` (padded to >= 5 total links). */
  relatedDocuments?: string[];
}

/** Mirrors the compiler's LNK-001 minimum (kept local to avoid a core cycle). */
const MIN_BODY_LINKS = 5;

/** Always-present documents used to pad the link minimum in any KOS vault. */
const LINK_PADDING_POOL = ["Research Map", "Home"] as const;

/** A YAML flow sequence of quoted strings, e.g. `["[[A]]", "[[B]]"]`. */
function yamlList(items: string[]): string {
  return JSON.stringify(items);
}

/** Filesystem-safe `YYYY-MM-DD - <topic>.md` (collapses unsafe characters). */
export function researchFileName(date: string, title: string): string {
  const safe = title
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${date} - ${safe}.md`;
}

/** Ensure the body has at least five wikilinks, padding from the safe pool. */
function ensureMinimumLinks(links: string[]): string[] {
  const out = [...links];
  let i = 0;
  while (out.length < MIN_BODY_LINKS) {
    out.push(LINK_PADDING_POOL[i % LINK_PADDING_POOL.length] ?? "Home");
    i++;
  }
  return out;
}

function renderSource(s: ResearchSource): string {
  return `- ${s.title} — ${s.url} — ${s.publisher} — accessed ${s.accessed} — ${s.relevance}`;
}

function bulletList(items: string[], fallback: string): string {
  return items.length > 0 ? items.map((x) => `- ${x}`).join("\n") : `- ${fallback}`;
}

/** Render a complete, validator-passing research document. */
export function renderResearchDocument(input: ResearchDocumentInput): string {
  const owner = input.owner ?? "research-worker";
  const tags = input.tags ?? ["research"];
  const parents = input.parents ?? ["[[Research Map]]"];
  const related = input.related ?? [];

  const linkTargets = ensureMinimumLinks(
    input.relatedDocuments ?? ["Research Map", "Home"],
  );
  const relatedBullets = linkTargets.map((t) => `- [[${t}]]`).join("\n");

  const sources =
    input.sources.length > 0
      ? input.sources.map(renderSource).join("\n")
      : "- No sources could be accessed for this query — see Open Questions; a follow-up task has been proposed.";

  const fm = [
    "type: research",
    "status: draft",
    `created: ${input.created}`,
    `updated: ${input.updated}`,
    `owner: ${owner}`,
    `tags: ${yamlList(tags)}`,
    `parents: ${yamlList(parents)}`,
    "children: []",
    `related: ${yamlList(related)}`,
  ].join("\n");

  return `---
${fm}
---

# ${input.title}

Evidence gathered for the research question below. This is research, not canonical knowledge — it is not promoted into the [[Research Map]] layer's accepted concepts without an explicit decision.

## Purpose

Capture external evidence relevant to: "${input.query}". See [[Research Map]].

## Context

This document was produced to answer an open research need. It gathers and cites sources; it does not assert canonical truth or edit any canonical document.

## Hypotheses

${bulletList(input.hypotheses ?? [], "What we expect to find, stated so it can be refuted by the evidence below.")}

## Method

${input.method ?? "Reviewed public documentation, articles, and competitor material; summarised findings and recorded every source under Sources."}

## Findings

${input.summary !== undefined ? `${input.summary}\n\n` : ""}${bulletList(input.findings ?? [], "Key finding, each traceable to a source under Sources.")}

## Sources

${sources}

## Conclusion

${input.conclusion ?? "A summary of what the evidence supports, and what remains uncertain. Implications are advisory only."}

## Open Questions

${bulletList(input.openQuestions ?? [], "What remains unresolved and may require a follow-up research task or founder input?")}

## Related Documents

${relatedBullets}
`;
}
