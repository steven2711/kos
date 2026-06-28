/**
 * Pure renderer for a knowledge-proposal document (`11 Proposals/<id> - <title>.md`).
 *
 * This lives in `core/` (a pure leaf) so the Promotion command may import it and
 * tests can render proposals without a filesystem. It is deterministic and
 * SDK-free: the same input produces the same markdown, byte for byte.
 *
 * The output satisfies the deterministic compiler for `type: knowledge_proposal`:
 *  - valid frontmatter (FM-*) with the proposal lifecycle `status` (FM-004 is
 *    type-aware) and the provenance keys PROV-001 requires (`claim`,
 *    `target_document`, `supporting_documents`),
 *  - the proposal section anatomy (SEC-001 for proposals),
 *  - at least five resolving wikilinks (LNK-001/LNK-003), padded from documents
 *    that always exist in a promotion-enabled vault (`Proposals Map`, `Home`).
 *
 * A proposal is *evidence assembled for a decision*, never canonical knowledge in
 * its own right: "knowledge is reviewed, then promoted — never silently rewritten."
 */

export interface ProposalDocumentInput {
  /** Stable proposal id, `P-NNN`. */
  id: string;
  /** Proposal title (also the H1 and the basis for the file name). */
  title: string;
  /** `YYYY-MM-DD` creation date. */
  created: string;
  /** `YYYY-MM-DD` last-updated date (>= created). */
  updated: string;
  owner?: string;
  tags?: string[];
  /** The single claim the proposal asks the founder to promote. */
  claim: string;
  /** Wikilink/relPath of the canonical document the claim would be added to. */
  targetDocument: string;
  /** Wikilinks/relPaths of the documents supporting the claim. */
  supportingDocuments?: string[];
  /** External sources (URLs/titles) backing the claim. */
  supportingSources?: string[];
  /** Source research documents (wikilinks/relPaths) the claim draws on. */
  sourceResearch?: string[];
  /** Task ids this proposal was created from. */
  createdFromTasks?: string[];
  /** The channel/worker that produced the proposal (provenance). */
  createdByWorker?: string;
  confidence?: "low" | "medium" | "high";
  /** Where the underlying recommendation originated. */
  origin?: string;
  /** The body of the proposed change (what would be appended to the target). */
  proposedChange?: string;
  /** A short statement of the impact of promoting the claim. */
  impact?: string;
  openQuestions?: string[];
  related?: string[];
  /** Wikilink targets for `## Related Documents` (padded to >= 5 total links). */
  relatedDocuments?: string[];
}

/** Mirrors the compiler's LNK-001 minimum (kept local to avoid a core cycle). */
const MIN_BODY_LINKS = 5;

/** Always-present documents used to pad the link minimum in any KOS vault. */
const LINK_PADDING_POOL = ["Proposals Map", "Home"] as const;

/** A YAML flow sequence of quoted strings. */
function yamlList(items: string[]): string {
  return JSON.stringify(items);
}

/** Strip surrounding `[[ ]]` (and any alias) from a wikilink-ish string. */
export function linkTarget(value: string): string {
  const inner = value.match(/\[\[([^\]]+?)\]\]/)?.[1] ?? value;
  const first = inner.replace(/\\\|/g, "|").split("|")[0] ?? "";
  return first.trim();
}

/** Wrap a target as a wikilink, idempotently (`Foo` and `[[Foo]]` → `[[Foo]]`). */
export function asWikilink(value: string): string {
  return `[[${linkTarget(value)}]]`;
}

/** Filesystem-safe `<id> - <title>.md` (collapses unsafe characters). */
export function proposalFileName(id: string, title: string): string {
  const safe = title
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${id} - ${safe}.md`;
}

/** Next stable proposal id `P-NNN` given existing ids (any form ignored). */
export function nextProposalId(existingIds: string[]): string {
  let max = 0;
  for (const id of existingIds) {
    const digits = id.match(/^P-(\d+)$/)?.[1];
    if (digits !== undefined) max = Math.max(max, parseInt(digits, 10));
  }
  return `P-${String(max + 1).padStart(3, "0")}`;
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

function bulletLinks(targets: string[], fallback: string): string {
  return targets.length > 0
    ? targets.map((t) => `- ${asWikilink(t)}`).join("\n")
    : `- ${fallback}`;
}

function bulletList(items: string[], fallback: string): string {
  return items.length > 0 ? items.map((x) => `- ${x}`).join("\n") : `- ${fallback}`;
}

/** Render a complete, validator-passing knowledge-proposal document. */
export function renderProposalDocument(input: ProposalDocumentInput): string {
  const owner = input.owner ?? "promotion-engine";
  const tags = input.tags ?? ["knowledge_proposal"];
  const related = input.related ?? [];
  const supporting =
    input.supportingDocuments && input.supportingDocuments.length > 0
      ? input.supportingDocuments
      : [input.targetDocument];
  const sources = input.supportingSources ?? [];
  const sourceResearch = input.sourceResearch ?? [];

  const linkTargets = ensureMinimumLinks([
    linkTarget(input.targetDocument),
    ...supporting.map(linkTarget),
    ...sourceResearch.map(linkTarget),
    ...(input.relatedDocuments ?? []),
    "Proposals Map",
    "Home",
  ]);
  const relatedBullets = linkTargets.map((t) => `- [[${t}]]`).join("\n");

  const fm = [
    "type: knowledge_proposal",
    "status: review",
    `created: ${input.created}`,
    `updated: ${input.updated}`,
    `owner: ${owner}`,
    `tags: ${yamlList(tags)}`,
    `parents: ${yamlList(["[[Proposals Map]]"])}`,
    "children: []",
    `related: ${yamlList(related)}`,
    `proposal_id: ${input.id}`,
    `claim: ${JSON.stringify(input.claim)}`,
    `target_document: ${JSON.stringify(asWikilink(input.targetDocument))}`,
    `supporting_documents: ${yamlList(supporting.map(asWikilink))}`,
    `supporting_sources: ${yamlList(sources)}`,
    `source_research: ${yamlList(sourceResearch.map(asWikilink))}`,
    `created_from_tasks: ${yamlList(input.createdFromTasks ?? [])}`,
    `created_by_worker: ${input.createdByWorker ?? "promotion-engine"}`,
    `confidence: ${input.confidence ?? "medium"}`,
    `origin: ${input.origin ?? "semantic"}`,
  ].join("\n");

  return `---
${fm}
---

# ${input.title}

A proposal to promote researched evidence into canonical knowledge. This document is a *proposal for review*, not canonical knowledge — nothing is merged until the founder approves it via \`kos promote\`. See [[Proposals Map]].

## Purpose

Ask the founder to decide whether the claim below should become company truth in [[${linkTarget(input.targetDocument)}]].

## Proposed Change

${input.proposedChange ?? input.claim}

## Target Document

${asWikilink(input.targetDocument)} — the approved change is appended here, provenance-tagged. The Promotion Engine never silently rewrites the target.

## Supporting Evidence

${bulletLinks(supporting, "No supporting documents were cited.")}

## Source Research

${bulletLinks(sourceResearch, "No source research documents were cited; see Supporting Evidence.")}

## Impact

${input.impact ?? "Promoting this claim updates canonical knowledge. Review the cited evidence and the target document before approving."}

## Open Questions

${bulletList(input.openQuestions ?? [], "What remains uncertain about this claim, and does the evidence fully support it?")}

## Reviewer Notes

_Founder notes recorded during review appear here._

## Decision

_Pending founder review (approve / reject / request changes)._

## Related Documents

${relatedBullets}
`;
}

/** Render the `11 Proposals/Proposals Map.md` navigation document. */
export function renderProposalsMap(created: string, updated: string): string {
  const fm = [
    "type: moc",
    "status: draft",
    `created: ${created}`,
    `updated: ${updated}`,
    "owner: promotion-engine",
    `tags: ${yamlList(["moc", "proposals"])}`,
    `parents: ${yamlList(["[[Home]]"])}`,
    "children: []",
    "related: []",
  ].join("\n");

  return `---
${fm}
---

# Proposals Map

Pending and historical knowledge proposals live under \`11 Proposals/\`. Each is a
founder-reviewed proposal to promote researched evidence into canonical knowledge.
See [[Home]]. This map is regenerated context; the machine state is each proposal's
\`status\` frontmatter and \`90 Meta/Promotion Report.md\`.
`;
}
