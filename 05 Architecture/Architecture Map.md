---
type: moc
status: canonical
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [moc, architecture, navigation]
parents: ["[[Home]]"]
children: []
related: ["[[Product Map]]", "[[Domain Map]]", "[[Decision Map]]"]
---

# Architecture Map

The curated entry point to how the system is built — components, data, interfaces, and technical specifications.

## Purpose

Let a contributor understand the shape of the system and find the spec for any component without reading all of `05 Architecture`.

## Context

This map curates `05 Architecture` (see [[Repository Blueprint]]). Architecture specifications `implement` product requirements from the [[Product Map]] and domain concepts from the [[Domain Map]], and are justified by decisions in the [[Decision Map]]. Maps curate, they do not auto-dump (see [[Linking Standards]]).

## Curated index

_No architecture documents yet. This is the Phase 1 KOS foundation; component specifications are added when a venture is instantiated._

To add one: create a `specification` from `01 Kernel/Templates/Specification.md`, place it in `05 Architecture`, and link it here with one line of context.

## Live index (optional)

```dataview
TABLE status, updated FROM "05 Architecture" WHERE type != "moc" SORT updated DESC
```
Fallback without Dataview: maintain the curated index above by hand (see [[Automation Guide]]).

## Open Questions

- What are the system's first architectural components and boundaries? Pending venture instantiation; tracked as [[Question|question]] documents in `07 Research`.

## Related Documents

- [[Home]]
- [[Product Map]]
- [[Domain Map]]
- [[Decision Map]]
- [[Repository Blueprint]]
