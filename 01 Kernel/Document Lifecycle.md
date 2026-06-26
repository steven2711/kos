---
type: guide
status: canonical
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [kernel, lifecycle, status, governance]
parents: ["[[Constitution]]"]
children: ["[[99 Archive/_index|Archive]]"]
related: ["[[Frontmatter Specification]]", "[[Quality Gates]]", "[[Decision Framework]]", "[[Knowledge Modeling Guide]]"]
---

# Document Lifecycle

Every document has a `status`. This guide defines what each status means, how a document moves between them, and what happens at end of life.

## Purpose

Make the maturity of any piece of knowledge legible at a glance, so that contributors never mistake a half-formed draft for a settled truth — or treat a canonical document as casually editable.

## Context

`status` is a required frontmatter field (see [[Frontmatter Specification]]). It is one of the inputs the [[Quality Gates]] and the future [[Validation|knowledge compiler]] check. Significant status changes on canonical documents are governed by the [[Decision Framework]].

## The status values

| Status | Meaning | Editable? |
| --- | --- | --- |
| `draft` | Being written; not yet trustworthy. | Freely. |
| `review` | Complete enough to evaluate; awaiting sign-off. | With review notes. |
| `accepted` | Agreed and in use, but not yet the single source of truth for its concept. | Carefully. |
| `canonical` | The one true home for its concept. Authoritative. | Only via a recorded change. |
| `deprecated` | Superseded or no longer true; kept for history. | No new content; link to replacement. |
| `archived` | Retired to `99 Archive`; historical record only. | Frozen. |

## The state machine

```
draft ──▶ review ──▶ accepted ──▶ canonical
                                      │
                                      ▼
                                 deprecated ──▶ archived
```

- Forward transitions require the document to satisfy the [[Quality Gates]].
- `canonical` is the goal state for concepts and standards. Only one canonical document may exist per concept (Constitution, Article II).
- A document may jump from `draft`/`review` straight to `deprecated` if abandoned.

## Transition criteria

- **draft → review:** all required sections present; frontmatter valid; ≥5 links.
- **review → accepted:** reviewed by an owner; open questions captured (not necessarily resolved).
- **accepted → canonical:** no competing canonical document exists; terminology matches [[Terminology]]; it is referenced by at least one Map of Content.
- **canonical → deprecated:** a replacement exists and the replacement's frontmatter records `supersedes` this document.
- **deprecated → archived:** moved to `99 Archive`, links updated, history preserved.

## Deprecation and archival

Nothing is deleted (Constitution, Article VII). To retire a document:

1. Set the successor's frontmatter to `supersedes` the old document.
2. Set the old document's status to `deprecated` and add a banner linking to the successor.
3. When no live document references it, move it to `99 Archive`, set status `archived`, and note the move in [[Changelog]].

## Open Questions

- Should `accepted` and `canonical` be merged for non-concept documents (e.g. meetings, references) where there is no "one true home" to defend? Tracked as a future [[Question|question]].

## Related Documents

- [[Constitution]]
- [[Frontmatter Specification]]
- [[Quality Gates]]
- [[Decision Framework]]
- [[Knowledge Modeling Guide]]
- [[99 Archive/_index|Archive]]
