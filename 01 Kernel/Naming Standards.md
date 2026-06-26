---
type: guide
status: canonical
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [kernel, naming, conventions, governance]
parents: ["[[Repository Blueprint]]"]
children: []
related: ["[[Frontmatter Specification]]", "[[Linking Standards]]", "[[Writing Style Guide]]", "[[Decision Framework]]"]
---

# Naming Standards

How documents are named. Consistent names make documents linkable, searchable, and recognizable at a glance.

## Purpose

Ensure that a document's filename is a stable, human-readable, link-friendly identity — and that the name alone communicates what the document is.

## Context

Names interact with [[Linking Standards]] (the filename is the wikilink target), the [[Frontmatter Specification]] (`type` often implies a naming pattern), and [[Writing Style Guide]] (the H1 title matches the filename). The vault uses Obsidian, which links by filename.

## General rules

1. **Title Case, spaces allowed.** Use natural, readable titles: `Knowledge Modeling Guide`, not `knowledge-modeling-guide`. Obsidian links resolve on filename; readability wins.
2. **The H1 matches the filename.** The first heading in the body equals the filename (minus extension).
3. **One concept, one name.** The name is the canonical term from [[Terminology]]. Do not encode synonyms.
4. **No dates or status in names.** Maturity lives in frontmatter (`status`), not the filename. Exception: meeting notes (below).
5. **No version numbers in names.** History is preserved via the [[Document Lifecycle]] and `supersedes`, not `v2` suffixes.
6. **Folders are numbered, files are not.** Folder prefixes (`00`–`99`) order the tree; filenames carry no ordinal prefix except ADRs.

## Type-specific patterns

| Type | Pattern | Example |
| --- | --- | --- |
| `concept` | `<Concept Name>` | `Knowledge Graph` |
| `adr` | `ADR-NNNN-<kebab-slug>` | `ADR-0000-adopt-knowledge-operating-system` |
| `question` | `Q - <the question>` | `Q - How autonomous can AI promotion be` |
| `meeting` | `YYYY-MM-DD <topic>` | `2026-06-25 Kickoff` |
| `moc` | `<Area> Map` | `Domain Map` |
| `specification` | `<Surface or Component> Spec` | `Capture Inbox Spec` |
| `template` | `<Type>` (in `Templates/`) | `Concept` |
| `reference` | `<Source title>` | `Obsidian Help` |

## ADR numbering

- ADRs are numbered sequentially from `0000`, zero-padded to four digits.
- The number is permanent and never reused, even if the ADR is later deprecated.
- The slug is a short kebab-case summary of the decision. See [[Decision Framework]].

## Tags vs. names

Categorization belongs in `tags` (lowercase kebab-case, see [[Frontmatter Specification]]), not in the filename. A document named `Knowledge Graph` is tagged `[domain, knowledge-graph]` — the name stays clean.

## Open Questions

- Should concept names be singular by convention (`Decision`) rather than plural (`Decisions`), even when the folder is plural? Tracked as a future [[Question|question]].

## Related Documents

- [[Repository Blueprint]]
- [[Frontmatter Specification]]
- [[Linking Standards]]
- [[Writing Style Guide]]
- [[Decision Framework]]
- [[Terminology]]
