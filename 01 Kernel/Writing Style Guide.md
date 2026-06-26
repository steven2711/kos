---
type: guide
status: canonical
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [kernel, style, writing, governance]
parents: ["[[Constitution]]"]
children: []
related: ["[[Linking Standards]]", "[[Naming Standards]]", "[[Knowledge Modeling Guide]]", "[[Glossary]]"]
---

# Writing Style Guide

How documents in this vault read. Consistent structure and voice make knowledge scannable and trustworthy.

## Purpose

Define the shape and tone of every document so that any reader — or AI agent — can predict where to find a purpose, a relationship, or an open question without hunting.

## Context

Style serves the same goal as [[Linking Standards]] and the [[Frontmatter Specification]]: legibility for both humans and the [[Validation|knowledge compiler]]. Terms used in writing must conform to [[Glossary]] and [[Terminology]].

## Required structure

Every document follows this skeleton after its frontmatter:

```
# <Title matching the filename>

<one- or two-sentence lede: what this document is>

## Purpose
## Context
## <type-specific body sections>
## Open Questions
## Related Documents
```

Concept documents substitute the relationship sections defined in [[Linking Standards]] (`Related Concepts`, `Parent Concepts`, `Child Concepts`).

## Voice and tone

1. **Opinionated, not hedged.** State the rule, then the reasoning. Avoid "it depends" without saying on what.
2. **Plain language.** Prefer the simplest accurate word. Define jargon in [[Glossary]] before using it.
3. **Active and present.** "The Kernel governs every folder," not "every folder is governed by the Kernel."
4. **Reasoning is content.** Always record *why*. A rule without a reason will be broken or ignored.

## One concept per document

A document covers exactly one thing (Constitution, Article II). If a section starts to define a second concept, extract it into its own document and link to it. Mixed-concept documents are a [[Quality Gates|quality gate]] failure.

## Prose vs. lists vs. tables

- **Prose** for reasoning, narrative, and nuance.
- **Lists** for steps, rules, and enumerations.
- **Tables** for structured comparisons (statuses, relationship types, field rules).

Do not bury a decision or an open question inside prose — promote it to its own section or its own document.

## Formatting conventions

- One H1 per document, matching the filename (see [[Naming Standards]]).
- Use `[[wikilinks]]` for every internal reference; never paste raw paths in prose.
- Code fences for schemas, commands, and examples.
- Dates as `YYYY-MM-DD` everywhere, matching the [[Frontmatter Specification]].

## Open Questions

- Should we adopt a maximum document length before a split is required? Tracked as a future [[Question|question]].

## Related Documents

- [[Constitution]]
- [[Linking Standards]]
- [[Naming Standards]]
- [[Knowledge Modeling Guide]]
- [[Glossary]]
- [[Quality Gates]]
