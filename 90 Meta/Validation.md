---
type: specification
status: canonical
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [meta, validation, knowledge-compiler, specification]
parents: ["[[Home]]"]
children: []
related: ["[[Validation Rules]]", "[[Quality Gates]]", "[[Frontmatter Specification]]", "[[Linking Standards]]"]
---

# Validation

The specification for the **knowledge compiler** — a future tool that scans the vault and reports where it violates the Kernel. This document defines the compiler; it does **not** implement it.

## Purpose

Describe, precisely enough to build later, a program that mechanically verifies the vault against the [[Validation Rules]], so quality is enforced by a machine rather than by vigilance (Constitution, Article X).

## Context

The vault is written today as if this compiler already runs. The rules it checks are defined in [[Validation Rules]]; their human-facing rationale is in [[Quality Gates]]; the metadata it parses is defined by the [[Frontmatter Specification]] and [[Linking Standards]]. This document is the bridge between those rules and a real implementation. **Do not implement the compiler unless explicitly asked** — define it so it can be implemented.

## What the compiler does

1. Walks every Markdown file in the vault (excluding `00 Inbox`, which is exempt from canonical checks).
2. Parses each file's frontmatter and body structure.
3. Builds the knowledge graph (nodes = documents, edges = links/relationships).
4. Evaluates each rule in [[Validation Rules]] against each document and against the graph as a whole.
5. Emits a report of findings, grouped by severity.

## Output format

The compiler emits one line per finding, prefixed by severity, in the form `SEVERITY: message (rule-id) — path`. The canonical messages are:

```
ERROR:   duplicate canonical concept        (DUP-001)
WARNING: orphan document                    (LNK-002)
WARNING: missing frontmatter                (FM-001/FM-002)
WARNING: undefined terminology              (TERM-001)
WARNING: deprecated reference               (LIFE-001)
INFO:    possible merge candidate           (DUP-002)
```

Additional rule violations from [[Validation Rules]] (e.g. `LNK-001` link minimum, `SEC-001` missing sections, `LOC-001` wrong folder) are reported with their own ids using the same line format.

## Severity semantics

- **ERROR** — the vault is invalid here; must be fixed. Mirrors a blocking [[Quality Gates|quality gate]].
- **WARNING** — should be fixed; surfaces in dashboards (see [[Automation Guide]]).
- **INFO** — advisory; a human decides (e.g. whether two documents should merge).

## Detecting duplicates and merge candidates

`DUP-001`/`DUP-002` are the hardest checks and the highest value. A future implementation may use, in increasing order of sophistication: (a) exact title/term collision, (b) shared canonical tags, (c) a declared `concept-id`, or (d) embedding similarity over document bodies. The chosen mechanism should itself be recorded as an [[ADR|adr]].

## Implementation notes (for later)

- Language and runtime are unspecified; any tool that can parse YAML + Markdown and build a graph will do.
- The compiler reads the rule catalog from [[Validation Rules]] as its source of truth — rules live there, not in code comments.
- It should run as a pre-promotion check (before `accepted → canonical`) and on demand for the whole vault.

## Open Questions

- How is "the same concept" defined mechanically for `DUP-001`? This is a dependency; see the open question in [[Validation Rules]].
- Should the compiler auto-fix trivial violations (e.g. add a missing `updated` date) or only report? Tracked as a future [[Question|question]].

## Related Documents

- [[Validation Rules]]
- [[Quality Gates]]
- [[Frontmatter Specification]]
- [[Linking Standards]]
- [[Automation Guide]]
- [[Knowledge Graph]]
