---
type: guide
status: canonical
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [kernel, validation, rules, quality]
parents: ["[[Frontmatter Specification]]"]
children: ["[[Validation]]"]
related: ["[[Quality Gates]]", "[[Linking Standards]]", "[[Terminology]]", "[[Document Lifecycle]]"]
---

# Validation Rules

The machine-checkable rules that define a "correct" document. These rules are the contract the future [[Validation|knowledge compiler]] enforces.

## Purpose

Express the vault's standards as discrete, testable rules so that quality can eventually be verified automatically rather than by hope. We write today as if the compiler already runs (Constitution, Article X).

## Context

[[Quality Gates]] are the *human-facing* reasons to reject a document; these Validation Rules are their *mechanical* form. The compiler that consumes them is specified in [[Validation]] in `90 Meta`. Rules reference the [[Frontmatter Specification]], [[Linking Standards]], [[Document Lifecycle]], and [[Terminology]].

## Rule catalog

Each rule has an id, a severity, and a check. Severities match the compiler output: `ERROR`, `WARNING`, `INFO`.

| Id | Severity | Rule |
| --- | --- | --- |
| `FM-001` | ERROR | Frontmatter block exists and parses as YAML. |
| `FM-002` | ERROR | All required keys present: `type, status, created, updated, owner, tags, parents, children, related`. |
| `FM-003` | ERROR | `type` is one of the allowed values. |
| `FM-004` | ERROR | `status` is one of the six lifecycle values. |
| `FM-005` | ERROR | `created` and `updated` are valid `YYYY-MM-DD`; `updated ≥ created`. |
| `FM-006` | ERROR | `owner` is non-empty (no unclear ownership). |
| `LNK-001` | ERROR | Document contains ≥5 internal `[[wikilinks]]` (excluding navigation chrome). |
| `LNK-002` | WARNING | Document has ≥1 inbound link (not an orphan). |
| `LNK-003` | ERROR | Every `[[wikilink]]` resolves to an existing document. |
| `LNK-004` | WARNING | Links in frontmatter `parents/children/related` also appear meaningfully in the body. |
| `SEC-001` | ERROR | Required sections present: Purpose, Context, Relationships (or concept variants), Open Questions, Related Documents. |
| `SEC-002` | ERROR | Exactly one H1, matching the filename. |
| `DUP-001` | ERROR | No other `canonical` document defines the same concept (one canonical home). |
| `DUP-002` | INFO | No high-overlap document that is a possible merge candidate. |
| `TERM-001` | WARNING | All domain terms used are defined in [[Glossary]] / [[Terminology]]. |
| `TERM-002` | WARNING | No forbidden synonyms from [[Terminology]] are used. |
| `LIFE-001` | WARNING | No live document references a `deprecated`/`archived` document without acknowledging it. |
| `LOC-001` | WARNING | Document's folder matches its `type` per the [[Repository Blueprint]]. |
| `INBOX-001` | WARNING | No `canonical` document resides in `00 Inbox`. |
| `TPL-001` | ERROR | A `template: true` file declares the `type` it produces (never `template`), has `status: draft`, and resides only in `01 Kernel/Templates/`. |
| `TPL-002` | ERROR | No real (non-template) document carries a `template: true` marker. |

## Template exemptions

Files marked `template: true` are blank forms, not knowledge. The compiler **exempts** them from the content-shape checks that assume a real instance: `LNK-001` (five-link minimum), `LNK-002` (orphan), `DUP-001`/`DUP-002` (duplicate concept), `LOC-001` (folder-matches-type — templates live in `01 Kernel/Templates/`, not the folder their produced type implies), and `SEC-001` where placeholder sections stand in for content. They are still subject to `FM-*`, `LNK-003` (links that exist must resolve), and `TPL-001`. See the produced-type rule in the [[Frontmatter Specification]] and [[ADR-0001-template-files-declare-produced-type]].

## How rules map to compiler output

- `ERROR` → blocks "correct" status; must be fixed. (e.g. `ERROR: duplicate canonical concept` ← `DUP-001`).
- `WARNING` → should be fixed; surfaces in dashboards. (e.g. `WARNING: orphan document` ← `LNK-002`).
- `INFO` → advisory. (e.g. `INFO: possible merge candidate` ← `DUP-002`).

## Open Questions

- How is "the same concept" (`DUP-001`) detected mechanically — by title, by tag, by embedding similarity, or by a declared `concept-id`? Tracked as a future [[Question|question]] and a dependency of [[Validation]].

## Related Documents

- [[Frontmatter Specification]]
- [[Quality Gates]]
- [[Validation]]
- [[Linking Standards]]
- [[Terminology]]
- [[Document Lifecycle]]
