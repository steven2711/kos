---
type: guide
status: canonical
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [kernel, constitution, governance]
parents: ["[[Home]]"]
children: ["[[AI Contributor Guide]]", "[[Repository Blueprint]]", "[[Knowledge Modeling Guide]]", "[[Quality Gates]]"]
related: ["[[Decision Framework]]", "[[Document Lifecycle]]", "[[Glossary]]"]
---

# Constitution

The supreme law of this Knowledge Operating System. Every other document — including every other Kernel document — is subordinate to this one. When two rules conflict, the order of precedence is: **Constitution → other Kernel documents → everything else.**

## Purpose

Establish the non-negotiable principles that make this vault *executable knowledge* rather than a pile of notes. The Constitution exists so that a contributor who arrives with zero context can act correctly by reading a single page and following its links.

## Context

This vault is the source code of a project's thinking. It preserves definitions, decisions, reasoning, tradeoffs, research, architecture, open questions, and project memory. It must scale from a solo founder to a mature organization while remaining understandable, searchable, and extensible. It is AI-native: an AI agent must be able to read it and answer *what are we building, why, how, what has been decided, what is canonical, and what is unresolved* without external context.

The operating model is defined in the [[Repository Blueprint]]; how knowledge becomes documents is defined in the [[Knowledge Modeling Guide]]; how contributors behave is defined in the [[AI Contributor Guide]].

## Articles

### Article I — Knowledge over documents

We do not optimize for the number of documents. We optimize for durable clarity. A smaller vault of canonical, connected, correct documents beats a larger vault of overlapping drafts.

### Article II — One canonical document per concept

Every concept has exactly one home. Duplicate concepts are forbidden. Reuse before creation; link before duplication. Synonyms are not created without justification recorded in [[Terminology]]. See [[Knowledge Modeling Guide]].

### Article III — The Kernel is sacred

`01 Kernel/` is read-many and write-rarely. It governs every other folder. Changes to the Kernel are decisions of record and require an ADR (see [[Decision Framework]]). No project content may contradict the Kernel.

### Article IV — Everything is connected

There are no orphans. Every document declares its place in the knowledge graph through frontmatter and through a minimum of five meaningful internal links. See [[Linking Standards]].

### Article V — Metadata is mandatory

Every document carries the frontmatter defined in the [[Frontmatter Specification]] and a status from the [[Document Lifecycle]]. A document without valid metadata is not a citizen of the vault.

### Article VI — Reasoning is preserved

We record *why*, not only *what*. Significant decisions become Architecture Decision Records. Unknowns become first-class [[Question|question]] documents and never disappear into prose or meeting notes.

### Article VII — Knowledge has a lifecycle

Documents move through `draft → review → accepted → canonical`, and `deprecated → archived` at end of life. Nothing is deleted; superseded knowledge is archived with its history intact. See [[Document Lifecycle]].

### Article VIII — Capture is separate from canon

Raw input lands in `00 Inbox`. It is not knowledge until it has been modeled, named, linked, and promoted into a canonical folder. Canon is never written directly from unprocessed capture.

### Article IX — Quality is gated

New documents must pass the [[Quality Gates]]. A document that duplicates a concept, lacks links, lacks purpose, or invents terminology is rejected or flagged, and a merge is suggested instead.

### Article X — Validation is owed to the future

The vault is built so that a [[Validation|knowledge compiler]] can one day verify it mechanically. We write today as if that compiler already runs.

## Amendment process

1. Open a [[Question|question]] in `07 Research` describing the tension or gap.
2. Write an ADR in `06 Decisions` proposing the change (see [[Decision Framework]]).
3. On acceptance, edit the affected Kernel document, bump its `updated` date, and record the change in [[Changelog]].
4. Constitutional amendments are rare by design. Prefer clarifying a subordinate Kernel document over amending the Constitution.

## Open Questions

- Should constitutional amendments require more than one reviewer once the organization grows beyond the founder? Tracked as a future [[Question|question]].

## Related Documents

- [[AI Contributor Guide]]
- [[Repository Blueprint]]
- [[Knowledge Modeling Guide]]
- [[Decision Framework]]
- [[Document Lifecycle]]
- [[Quality Gates]]
