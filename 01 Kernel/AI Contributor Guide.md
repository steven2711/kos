---
type: guide
status: canonical
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [kernel, ai, contribution, governance]
parents: ["[[Constitution]]"]
children: ["[[Quality Gates]]", "[[Validation Rules]]"]
related: ["[[Knowledge Modeling Guide]]", "[[Linking Standards]]", "[[Terminology]]", "[[Document Lifecycle]]"]
---

# AI Contributor Guide

The operating manual for any AI agent (and any human) contributing to this vault. Read it before you write. It turns the principles of the [[Constitution]] into concrete actions.

## Purpose

Make it safe for an autonomous or semi-autonomous agent to extend the vault without degrading it: no duplicate concepts, no orphans, no invented terminology, no buried decisions.

## Context

This vault is AI-native. An agent is expected to read existing knowledge, find the right home for new knowledge, and connect it. The danger an agent introduces is *plausible-sounding duplication* — restating an existing concept under a new name. This guide exists primarily to prevent that. Modeling rules are in the [[Knowledge Modeling Guide]]; the gates that reject bad work are in [[Quality Gates]]; the machine-checkable rules are in [[Validation Rules]].

## The Ten Rules

1. **Search before creating.** Look for an existing canonical document before writing a new one. Check [[Glossary]], [[Terminology]], the relevant Map of Content, and full-text search.
2. **Link before duplicating.** If a related concept exists, extend or link to it instead of restating it.
3. **Preserve canonical terminology.** Use the preferred term from [[Terminology]]. Do not introduce a synonym.
4. **No undefined synonyms.** If a new term is genuinely needed, define it in [[Glossary]] and register it in [[Terminology]], with justification.
5. **Flag duplicate concepts.** If you find two documents describing the same concept, raise it — do not silently pick one.
6. **Recommend merges.** When two documents overlap, propose a merge (which survives, which is archived) rather than editing both.
7. **Create Open Questions instead of inventing answers.** If you do not know, write a [[Question|question]] document. Never fabricate a decision, metric, or fact.
8. **Never redefine canon outside its home.** A concept is defined in exactly one place. Elsewhere you link to it; you do not re-explain it.
9. **Never create orphans.** Every new document has parents, children or related links, and at least five meaningful internal links. See [[Linking Standards]].
10. **Respect the lifecycle.** Honor each document's `status`. Do not treat a `draft` as canonical, and do not silently overwrite a `canonical` document — propose a change through the [[Decision Framework]] when the change is significant.

## Before-you-write checklist

- [ ] I searched for an existing canonical document and found none (or found one and am extending it).
- [ ] I know the document's single `type` (see [[Frontmatter Specification]]).
- [ ] I know which folder is its correct home (see [[Repository Blueprint]]).
- [ ] The terms I use match [[Terminology]].
- [ ] I have identified at least five real documents to link to.

## After-you-write checklist

- [ ] Frontmatter is complete and valid (see [[Frontmatter Specification]]).
- [ ] The body contains Purpose, Context, Relationships, Open Questions, and Related Documents.
- [ ] I added backlinks: the documents I link to should make sense linking back, and I updated their `related`/`children` where appropriate.
- [ ] I added the document to the relevant Map of Content if it deserves a curated entry.
- [ ] The document passes every gate in [[Quality Gates]].
- [ ] I recorded any noteworthy change in [[Changelog]].

## Generating from a template

Templates in `01 Kernel/Templates/` already declare the **produced** type (e.g. the Concept template is `type: concept`), so the metadata you inherit is correct by construction. When you instantiate one:

- **Keep** the produced `type` exactly as the template declares it. Never write `type: template`.
- **Remove** the `template: true` marker — it identifies a blank form, not your new document.
- **Set** the real `status` (usually `draft`) and fill every `<placeholder>`.

This is the rule that stops generation from producing bad metadata. See the [[Frontmatter Specification]] and [[ADR-0001-template-files-declare-produced-type]].

## When you are unsure

Stop and create a [[Question|question]]. An honest, well-linked open question is a contribution. A confident, duplicate, or invented document is damage.

## Open Questions

- What is the right level of autonomy for an agent to promote a `review` document to `canonical` without human sign-off? Tracked as a future [[Question|question]].

## Related Documents

- [[Constitution]]
- [[Knowledge Modeling Guide]]
- [[Quality Gates]]
- [[Validation Rules]]
- [[Terminology]]
- [[Linking Standards]]
