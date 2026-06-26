---
type: moc
status: canonical
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [moc, domain, knowledge-graph, navigation]
parents: ["[[Home]]"]
children: ["[[Knowledge Graph]]"]
related: ["[[Knowledge Modeling Guide]]", "[[Glossary]]", "[[Product Map]]", "[[Architecture Map]]"]
---

# Domain Map

The curated entry point to the knowledge layer: the canonical concepts and the relationships between them. This is the heart of the knowledge graph.

## Purpose

Make every canonical concept discoverable from one place, and show how the domain's ideas connect.

## Context

This map curates `04 Domain` (see [[Repository Blueprint]]). Concepts here are the canonical homes referenced by product, architecture, and research. Modeling rules are in the [[Knowledge Modeling Guide]]; term meanings are in the [[Glossary]]. Maps curate, they do not auto-dump (see [[Linking Standards]]).

## Curated index

- [[Knowledge Graph]] — *(worked example)* the network of all documents connected by typed relationships. Demonstrates a fully-modeled, fully-linked canonical concept.

_Further domain concepts are added as a venture is instantiated. Create each from `01 Kernel/Templates/Concept.md`._

## Live index (optional)

```dataview
TABLE status, updated FROM "04 Domain" WHERE type = "concept" SORT file.name ASC
```
Fallback without Dataview: maintain the curated index above by hand (see [[Automation Guide]]).

## Open Questions

- Which canonical concepts must exist before any venture begins? Pending instantiation; tracked as [[Question|question]] documents in `07 Research`.

## Related Documents

- [[Home]]
- [[Knowledge Graph]]
- [[Knowledge Modeling Guide]]
- [[Glossary]]
- [[Product Map]]
- [[Architecture Map]]
