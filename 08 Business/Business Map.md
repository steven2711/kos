---
type: moc
status: canonical
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [moc, business, navigation]
parents: ["[[Home]]"]
children: []
related: ["[[Product Map]]", "[[Roadmap Map]]", "[[10 Operations/_index|Operations]]"]
---

# Business Map

The curated entry point to the business: model, market, pricing, and go-to-market.

## Purpose

Let a contributor understand how the company creates and captures value, and find the canonical document for any business question.

## Context

This map curates `08 Business` (see [[Repository Blueprint]]). Business documents connect to the [[Product Map]] (what we sell), the [[Roadmap Map]] (when), and [[10 Operations/_index|Operations]] (how we run). Maps curate, they do not auto-dump (see [[Linking Standards]]).

## Curated index

_No business documents yet. This is the Phase 1 KOS foundation; model, market, and pricing documents are added when a venture is instantiated._

To add one: create the appropriate document from a template in `01 Kernel/Templates/`, place it in `08 Business`, and link it here with one line of context.

## Live index (optional)

```dataview
TABLE type, status, updated FROM "08 Business" WHERE type != "moc" SORT updated DESC
```
Fallback without Dataview: maintain the curated index above by hand (see [[Automation Guide]]).

## Open Questions

- What is the business model of the first venture? Pending instantiation; tracked as [[Question|question]] documents in `07 Research`.

## Related Documents

- [[Home]]
- [[Product Map]]
- [[Roadmap Map]]
- [[10 Operations/_index|Operations]]
- [[Repository Blueprint]]
