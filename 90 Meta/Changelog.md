---
type: reference
status: canonical
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [meta, changelog, history]
parents: ["[[Home]]"]
children: []
related: ["[[Document Lifecycle]]", "[[Decision Map]]", "[[Constitution]]"]
---

# Changelog

The vault-level history log. Significant structural changes, Kernel amendments, and archival events are recorded here in reverse-chronological order.

## Purpose

Give the vault a single, append-only record of how it has changed over time, so its evolution is auditable independent of any external version-control history.

## Context

This log complements — it does not replace — the [[Document Lifecycle]] (per-document status) and the [[Decision Map]] (per-decision ADRs). It records *vault-level* events: Kernel amendments (which always have an ADR — see [[Constitution]], Article III), folder-structure changes, and archival moves.

## What to log here

- Kernel amendments (link the governing [[ADR|adr]]).
- New or removed top-level folders.
- Documents archived to `99 Archive`.
- Major migrations or restructurings.

Do **not** log routine document edits; those live in each document's `updated` field.

## Log

### 2026-06-25 — Kernel amendment: template typing
- Adopted the rule that template files declare the document type they **produce** (not a `template` type) and carry a `template: true` marker — via [[ADR-0001-template-files-declare-produced-type]].
- Removed `template` from the `type` enumeration; updated the [[Frontmatter Specification]], [[AI Contributor Guide]], [[Validation Rules]] (`TPL-001`/`TPL-002` + template exemptions), and [[Glossary]].

### 2026-06-25 — Vault initialized (Phase 1)
- Created the Knowledge Operating System foundation: full directory structure, the 14-document Kernel, 12 templates, 8 Maps of Content, folder indexes, and the `90 Meta` validation/automation/changelog set.
- Adopted via [[ADR-0000-adopt-knowledge-operating-system]].
- Worked examples added: the [[Knowledge Graph]] concept and `ADR-0000`.
- Scope: KOS foundation only; no venture instantiated yet (Phase 2 deferred).

## Open Questions

- Should the changelog be split by year once it grows long? Tracked as a future [[Question|question]].

## Related Documents

- [[Document Lifecycle]]
- [[Decision Map]]
- [[Constitution]]
- [[ADR-0000-adopt-knowledge-operating-system]]
- [[99 Archive/_index|Archive]]
