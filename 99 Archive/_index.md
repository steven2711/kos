---
type: moc
status: canonical
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [archive, history, navigation]
parents: ["[[Home]]"]
children: []
related: ["[[Document Lifecycle]]", "[[Repository Blueprint]]", "[[Changelog]]"]
---

# Archive

The resting place for deprecated concepts, historical snapshots, and completed research. Nothing is deleted; it is archived here with its history intact (Constitution, Article VII).

## Purpose

Preserve superseded and historical knowledge so the reasoning behind past states of the company is never lost, while keeping it out of the live, canonical layers.

## Context

This is `99 Archive`, Layer 5 in the [[Repository Blueprint]]. Documents arrive here at the end of the [[Document Lifecycle]] (`deprecated → archived`). The move is recorded in [[Changelog]].

## What belongs here

- `deprecated` concepts that have been `superseded` by a newer canonical document.
- Historical snapshots of documents kept for the record.
- Completed research whose findings have been promoted into concepts or decisions.

## How to archive a document

1. Confirm no live document still depends on it (update any that do).
2. Ensure its successor records `supersedes` it (see [[Decision Framework]] for ADRs).
3. Move it here, set `status: archived`, and add a note to [[Changelog]].

## Archived index

_Empty. Nothing has been archived yet._

## Open Questions

- Should the archive mirror the source folder structure (e.g. `99 Archive/06 Decisions/...`) or stay flat? Tracked as a future [[Question|question]].

## Related Documents

- [[Home]]
- [[Document Lifecycle]]
- [[Repository Blueprint]]
- [[Changelog]]
- [[Decision Framework]]
