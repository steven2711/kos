---
type: guide
status: canonical
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [kernel, modeling, knowledge-graph, concepts]
parents: ["[[Constitution]]"]
children: ["[[Linking Standards]]", "[[Decision Framework]]"]
related: ["[[Repository Blueprint]]", "[[Glossary]]", "[[Terminology]]", "[[Document Lifecycle]]"]
---

# Knowledge Modeling Guide

How raw thinking becomes structured knowledge. This guide answers the questions that decide the shape of the vault: *when is something a concept, a decision, research, or a question — and how do they connect?*

## Purpose

Prevent the two failure modes of a knowledge base: (1) the same idea modeled many times under different names, and (2) ideas that exist but are unreachable because nothing links to them. Good modeling makes the [[Validation|knowledge compiler]] tractable later.

## Context

Modeling sits between capture and canon. Input arrives in `00 Inbox` (see [[Repository Blueprint]]). Modeling decides what kind of document it should become, whether it already exists, and how it joins the graph. The vocabulary used here is defined in [[Glossary]] and constrained by [[Terminology]].

## When does something become a... ?

- **Concept** — a durable, reusable *idea, entity, or definition* that other documents will reference. Lives in `04 Domain`. If you find yourself re-explaining the same thing in two documents, it is a concept; extract it.
- **Decision** — a choice the team has made, with alternatives that were not chosen and reasoning that should outlive memory. Lives in `06 Decisions` as an `adr`. See [[Decision Framework]].
- **Research** — an open investigation: something we are actively trying to learn. Lives in `07 Research`.
- **Question** — a specific unknown, stated as a first-class object so it cannot vanish into prose. Lives in `07 Research`. A question evolves into research, a decision, or an implementation.
- **Specification** — a concrete description of what a product surface or system component should do. Lives in `03 Product` or `05 Architecture`.

When two of these are tangled in one note, split them. A document has exactly **one** `type` (see [[Frontmatter Specification]]).

## The one-canonical-document rule

Each concept has exactly one home document. Before creating, search. If a near-match exists:

1. **Extend** it if your idea is a facet of the existing concept.
2. **Link** to it if your idea merely references it.
3. **Merge-propose** if you discover two homes for the same concept (see [[AI Contributor Guide]]).
4. **Create** only if the concept is genuinely new — and justify why in the document's Context section.

## The knowledge graph

Every concept belongs to a graph. Relationships are expressed both in prose (the Relationships section) and structurally (frontmatter `parents`, `children`, `related`). The canonical relationship vocabulary:

| Relationship | Meaning | Example |
| --- | --- | --- |
| `contains` | A is composed of B | *Vault* contains *Kernel* |
| `depends_on` | A requires B to function | *Validation* depends_on *Frontmatter Specification* |
| `extends` | A specializes or builds on B | *ADR* extends *Decision* |
| `implements` | A realizes B concretely | *Specification* implements *Concept* |
| `references` | A points to B for context | *Research* references *Concept* |
| `supersedes` | A replaces B | *ADR-0007* supersedes *ADR-0003* |
| `related_to` | A and B are associated | *Glossary* related_to *Terminology* |

Use the most specific relationship that is true. `related_to` is the fallback, not the default. Missing relationships should be inferred and added over time — a standing job for AI contributors.

## Promotion path (capture → canon)

```
00 Inbox  →  classify type  →  search for existing home  →  model & link  →  set status  →  place in canonical folder
```

Nothing reaches a canonical folder without being modeled and linked first (Constitution, Article VIII).

## Open Questions

- Should `process` and `rule` be distinct document types, or are they specializations of `concept` and `specification`? Tracked as a future [[Question|question]].

## Related Documents

- [[Constitution]]
- [[Repository Blueprint]]
- [[Linking Standards]]
- [[Decision Framework]]
- [[Glossary]]
- [[Terminology]]
