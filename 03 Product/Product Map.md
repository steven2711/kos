---
type: moc
status: canonical
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [moc, product, navigation]
parents: ["[[Home]]"]
children: []
related: ["[[Domain Map]]", "[[Architecture Map]]", "[[Roadmap Map]]", "[[Business Map]]"]
---

# Product Map

The curated entry point to everything we are building for users — product principles, specifications, and surfaces.

## Purpose

Let any contributor find what the product is, what it should do, and the decisions shaping it, without reading every file in `03 Product`.

## Context

This map curates `03 Product` (see [[Repository Blueprint]]). Product specifications `implement` concepts from the [[Domain Map]], are realized by the [[Architecture Map]], and are sequenced by the [[Roadmap Map]]. This is a Map of Content — it curates, it does not auto-dump (see [[Linking Standards]]).

## Curated index

_No product documents yet. This is the Phase 1 KOS foundation; product specifications are added when a venture is instantiated (see [[README]])._

To add one: create a `specification` from `01 Kernel/Templates/Specification.md`, place it in `03 Product`, and link it here with one line of context.

## Live index (optional)

```dataview
TABLE status, updated FROM "03 Product" WHERE type != "moc" SORT updated DESC
```
Fallback without Dataview: maintain the curated index above by hand (see [[Automation Guide]]).

## Open Questions

- What are the product's first canonical surfaces? Pending venture instantiation; will be tracked as [[Question|question]] documents in `07 Research`.

## Related Documents

- [[Home]]
- [[Domain Map]]
- [[Architecture Map]]
- [[Roadmap Map]]
- [[Business Map]]
