---
type: moc
template: true
status: draft
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [moc, navigation]
parents: ["[[Home]]"]
children: []
related: []
---

# <Area> Map

<One sentence: what area of the vault this map curates.>

> Template: a Map of Content is a *curated* entry point — it links the important documents in its area with context, not every file (see [[Linking Standards]]). Optionally include a Dataview block for a live index (see [[Automation Guide]]); always keep a hand-curated list so the map works without plugins. Requires ≥5 meaningful links.

## Purpose

<What a reader can find and accomplish from this map.>

## Context

<The folder(s) this map covers and how it relates to neighboring maps.>

## Curated index

<Hand-picked links with one-line context each. Group by sub-topic.>

- [[<Linked Document>]] — what it is and why it matters here.

## Live index (optional)

```dataview
TABLE status, updated FROM "<folder>" WHERE type != "moc" SORT updated DESC
```
<Fallback when Dataview is not installed: maintain the curated list above by hand.>

## Open Questions

<Area-level unknowns. Link to [[Question|question]] documents in `07 Research`.>

## Related Documents

- [[Home]]
- [[Repository Blueprint]]
- [[Automation Guide]]
