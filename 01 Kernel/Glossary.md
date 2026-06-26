---
type: guide
status: canonical
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [kernel, glossary, definitions]
parents: ["[[Constitution]]"]
children: ["[[Terminology]]"]
related: ["[[Knowledge Modeling Guide]]", "[[Writing Style Guide]]", "[[Frontmatter Specification]]"]
---

# Glossary

Plain-language definitions of every term the Knowledge Operating System uses to describe itself. If a system term is used anywhere in the vault, it is defined here.

## Purpose

Give one authoritative, plain definition for each system term so that contributors share a vocabulary and the no-invented-terminology rule (Constitution, Article II) is enforceable. The Glossary defines *meaning*; [[Terminology]] governs *which word to use*.

## Context

This is the canonical home for the meanings below; no other document redefines them (Constitution, Article II). Where a term names a full concept with its own document, this entry links to it. Writing must conform to these definitions (see [[Writing Style Guide]]).

## Definitions

- **Knowledge Operating System (KOS)** — the disciplined, reusable system (this vault) for modeling, storing, connecting, and validating a project's knowledge. The product; Obsidian and Markdown are merely its interface and storage.
- **Vault** — the Obsidian folder containing the entire KOS instance.
- **Kernel** — the sacred governing layer (`01 Kernel`): read-many, write-rarely rules that every other folder inherits. See [[Repository Blueprint]].
- **Layer** — one of the six bands of intent (Capture, Foundation, Knowledge, Execution, Decisions, Archive) realized as folders. See [[Constitution]].
- **Document** — a single Markdown file with valid frontmatter and exactly one `type`.
- **Type** — the kind of a document; exactly one per document. One of: concept, vision, specification, adr, research, experiment, question, meeting, reference, guide, moc. See [[Frontmatter Specification]].
- **Template / template file** — a blank form in `01 Kernel/Templates/` for producing a document. A template declares the `type` it *produces* (not a `template` type) and carries a `template: true` marker. See [[Frontmatter Specification]] and [[ADR-0001-template-files-declare-produced-type]].
- **Concept** — a durable, reusable idea, entity, or definition with exactly one canonical home in `04 Domain`. See [[Knowledge Modeling Guide]].
- **Canonical document** — the single authoritative home for a concept (`status: canonical`). Only one may exist per concept.
- **Decision / ADR** — a recorded choice with its alternatives and tradeoffs; an Architecture Decision Record in `06 Decisions`. See [[Decision Framework]].
- **Open Question** — a first-class, explicitly stated unknown; a `question` document in `07 Research`. Never buried in prose.
- **Research** — an active investigation aimed at resolving an unknown.
- **Specification** — a concrete description of what a product surface or system component should do.
- **Map of Content (MOC)** — a curated navigation page for an area of the vault (e.g. [[Domain Map]]). Maps curate; they do not auto-dump.
- **Frontmatter** — the YAML metadata block opening every document. See [[Frontmatter Specification]].
- **Status** — a document's position in its lifecycle: draft, review, accepted, canonical, deprecated, archived. See [[Document Lifecycle]].
- **Relationship** — a typed connection between documents: contains, depends_on, extends, implements, references, supersedes, related_to. See [[Knowledge Modeling Guide]].
- **Orphan** — a document with no inbound links; a violation of [[Linking Standards]].
- **Knowledge graph** — the network of all documents connected by their relationships.
- **Knowledge compiler** — the future tool that mechanically validates the vault against the [[Validation Rules]]. Specified in [[Validation]].
- **Quality gate** — a condition that blocks a substandard document. See [[Quality Gates]].
- **Promotion** — moving an item from `00 Inbox` capture into a canonical folder after it is modeled and linked.
- **Inbox** — the capture layer (`00 Inbox`); nothing canonical lives here.
- **Archive** — `99 Archive`; the resting place for deprecated and historical documents, preserved not deleted.

## Open Questions

- Should the Glossary be split once the count of terms grows large, with a per-area glossary linked from each Map? Tracked as a future [[Question|question]].

## Related Documents

- [[Constitution]]
- [[Terminology]]
- [[Knowledge Modeling Guide]]
- [[Frontmatter Specification]]
- [[Writing Style Guide]]
- [[Validation]]
