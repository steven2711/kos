---
type: guide
status: canonical
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [kernel, linking, graph, governance]
parents: ["[[Constitution]]"]
children: []
related: ["[[Frontmatter Specification]]", "[[Knowledge Modeling Guide]]", "[[Naming Standards]]", "[[Quality Gates]]"]
---

# Linking Standards

The rules that keep the vault a connected graph instead of a pile of pages. There are no orphans (Constitution, Article IV).

## Purpose

Guarantee that every document is reachable, that relationships are explicit, and that the graph stays navigable as the vault grows.

## Context

Linking is expressed in two coordinated places: structurally in frontmatter (`parents`, `children`, `related` — see [[Frontmatter Specification]]) and narratively in the body's Relationships and Related Documents sections. The relationship *vocabulary* (`contains`, `depends_on`, etc.) is defined in the [[Knowledge Modeling Guide]].

## The rules

1. **Minimum five meaningful links.** Every document contains at least five internal `[[wikilinks]]` to genuinely related documents. Navigation chrome (e.g. a link to `Home`) does not count toward the five.
2. **Meaningful, not decorative.** A link must reflect a real relationship a reader would want to follow. Padding with irrelevant links is a violation.
3. **Required body sections.** Every document includes these sections (see [[Writing Style Guide]]):
   - `# Purpose`
   - `# Context`
   - `# Relationships` (or `# Related Concepts` / `# Parent Concepts` / `# Child Concepts` for concept documents)
   - `# Open Questions`
   - `# Related Documents`
4. **Bidirectional intent.** When you link A → B, ask whether B should link back. Update the other document's `related`/`children` when the backlink is meaningful.
5. **No orphans.** A document with no inbound links is an orphan and is flagged by the [[Validation|knowledge compiler]]. Add it to a Map of Content or link it from a parent.
6. **Link, don't restate.** Reference a concept by link; never re-explain it (Constitution, Article II; see [[AI Contributor Guide]]).
7. **Maps curate, they don't dump.** A Map of Content links the important documents in its area with context, not every file mechanically.

## Concept documents: the four link sections

Concept documents in `04 Domain` use a richer set so the graph relationship is explicit:

- `# Related Concepts` → `related_to`
- `# Parent Concepts` → broader (`parents`, `contains` from the parent's view)
- `# Child Concepts` → narrower (`children`)
- `# Open Questions`
- `# References`

See `01 Kernel/Templates/Concept.md`.

## Backlinks and MOCs

- Obsidian generates backlinks automatically; still, declare meaningful relationships in frontmatter so they survive export and feed validation.
- Every significant document earns a curated entry in the relevant Map of Content (e.g. [[Domain Map]], [[Decision Map]]).

## Open Questions

- Should the five-link minimum scale with document length (e.g. one link per ~200 words)? Tracked as a future [[Question|question]].

## Related Documents

- [[Constitution]]
- [[Frontmatter Specification]]
- [[Knowledge Modeling Guide]]
- [[Naming Standards]]
- [[Quality Gates]]
- [[Writing Style Guide]]
