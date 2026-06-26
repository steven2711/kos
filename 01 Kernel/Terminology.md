---
type: guide
status: canonical
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [kernel, terminology, vocabulary, consistency]
parents: ["[[Glossary]]"]
children: []
related: ["[[Knowledge Modeling Guide]]", "[[Quality Gates]]", "[[Naming Standards]]", "[[AI Contributor Guide]]"]
---

# Terminology

The canonical-vs-forbidden word list. Where [[Glossary]] defines *what a term means*, this document decides *which word we use* for it — and which words we refuse.

## Purpose

Enforce vocabulary consistency across the vault. One concept must be referred to by one word, so that search, linking, and the [[Validation|knowledge compiler]] are not defeated by synonyms (Constitution, Article II).

## Context

Terminology drift is the quiet way a knowledge base rots: the same idea acquires three names and silently splits into three documents. This list is consulted by the [[AI Contributor Guide]] before writing and enforced by [[Quality Gates]] (gate 7) and [[Validation Rules]] (`TERM-001`, `TERM-002`).

## The rules

1. **Use the preferred term.** Always. Even when a synonym reads more naturally.
2. **Do not introduce a synonym** without adding a row here and a definition in [[Glossary]], with justification.
3. **Aliases are for search, not for prose.** If Obsidian aliases are used, the canonical term still appears in the body.
4. **Renaming a canonical term is a decision** — it requires an ADR (see [[Decision Framework]]) because every reference must be updated.

## Canonical term table

| Preferred term | Do **not** use | Notes |
| --- | --- | --- |
| Knowledge Operating System (KOS) | knowledge base, wiki, second brain | The system as a whole. |
| Vault | repo, workspace, notebook | The Obsidian folder. |
| Kernel | core, foundation folder, base | `01 Kernel`. ("Foundation" names the *layer*, not the folder.) |
| Document | note, page, file | A single Markdown file. |
| Concept | entity, term, topic, idea-note | A canonical idea in `04 Domain`. |
| Canonical document | master, source-of-truth doc, golden copy | The one true home for a concept. |
| Decision / ADR | RFC, proposal, design doc | Recorded in `06 Decisions`. |
| Open Question | TODO, unknown, issue | First-class `question` document. |
| Map of Content (MOC) | index, hub, dashboard, TOC | Curated navigation page. |
| Frontmatter | metadata header, YAML header, properties | The opening YAML block. |
| Status | state, stage, phase | The lifecycle field. |
| Relationship | link type, edge, connection | The typed graph connection. |
| Orphan | dangling note, stray, unlinked doc | A document with no inbound links. |
| Knowledge compiler | linter, validator, checker | The future validation tool. |
| Promotion | filing, moving out of inbox, processing | Inbox → canonical folder. |
| Archive | trash, deleted, old | `99 Archive`. Nothing is deleted. |

## When a genuinely new term is needed

1. Confirm no preferred term already covers it (search [[Glossary]]).
2. Add the definition to [[Glossary]].
3. Add a row here with the preferred term and known synonyms to avoid.
4. State the justification in the introducing document's Context section.

## Open Questions

- Should we maintain machine-readable aliases (a YAML map) to let the [[Validation|knowledge compiler]] auto-detect forbidden synonyms? Tracked as a future [[Question|question]].

## Related Documents

- [[Glossary]]
- [[Knowledge Modeling Guide]]
- [[Quality Gates]]
- [[Naming Standards]]
- [[AI Contributor Guide]]
- [[Decision Framework]]
