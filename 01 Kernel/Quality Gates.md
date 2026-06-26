---
type: guide
status: canonical
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [kernel, quality, gates, governance]
parents: ["[[Constitution]]"]
children: []
related: ["[[Validation Rules]]", "[[AI Contributor Guide]]", "[[Knowledge Modeling Guide]]", "[[Document Lifecycle]]"]
---

# Quality Gates

The conditions that block a document from entering — or advancing within — the vault. Quality is gated (Constitution, Article IX).

## Purpose

Give contributors a short, decisive checklist that catches the failures most likely to degrade the vault: duplication, orphaning, missing metadata, unclear purpose, and invented terminology.

## Context

These gates are the human-readable counterpart to the mechanical [[Validation Rules]]. They are applied by the [[AI Contributor Guide|after-you-write checklist]] and at every forward transition in the [[Document Lifecycle]]. When a gate fails, the correct response is usually to **suggest a merge** or **open a question**, not to force the document through.

## Reject or flag a document if...

1. **A canonical document already exists** for the concept. → Extend or link it; suggest a merge. Do not create a duplicate. (See [[Knowledge Modeling Guide]].)
2. **Required metadata is missing or invalid.** → Complete the [[Frontmatter Specification]].
3. **No relationships exist** — fewer than five meaningful links, or no inbound link (orphan). → Add real links per [[Linking Standards]].
4. **Purpose is unclear.** → Rewrite the Purpose section so a reader knows in one sentence why the document exists.
5. **The concept overlaps another concept.** → Suggest a merge instead of creating a near-duplicate.
6. **Multiple concepts are mixed** in one document. → Split into one-concept-per-document (see [[Writing Style Guide]]).
7. **Terminology is invented** without a definition. → Define it in [[Glossary]] and register it in [[Terminology]], or use the existing canonical term.
8. **It contradicts the Kernel.** → The Kernel wins; reconcile or open an ADR (see [[Decision Framework]]).
9. **Open questions are buried in prose.** → Promote them to the Open Questions section or to a first-class [[Question|question]] document.
10. **Ownership is unclear** (`owner` blank). → Assign an accountable owner.
11. **A canonical document sits in `00 Inbox`.** → Promote it to its correct folder first (see [[Repository Blueprint]]).

## The default remedy: merge, don't duplicate

When in doubt between "create new" and "extend existing," extend. The most common and most damaging failure in a knowledge base is silent duplication. A suggested merge is always a safe move.

## Gate vs. rule

- A **gate** is a reason a human stops and reconsiders.
- A **rule** (see [[Validation Rules]]) is the mechanical check the [[Validation|knowledge compiler]] will run.

Every gate maps to one or more validation rules; keep the two in sync when either changes.

## Open Questions

- Should some gates be advisory (allow with a warning) for `draft` status and only become blocking at `review`? Tracked as a future [[Question|question]].

## Related Documents

- [[Constitution]]
- [[Validation Rules]]
- [[AI Contributor Guide]]
- [[Knowledge Modeling Guide]]
- [[Document Lifecycle]]
- [[Writing Style Guide]]
