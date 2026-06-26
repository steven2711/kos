---
type: adr
status: accepted
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [adr, decision, kernel, templates, metadata]
parents: ["[[Decision Map]]"]
children: []
related: ["[[Frontmatter Specification]]", "[[AI Contributor Guide]]", "[[Validation Rules]]", "[[ADR-0000-adopt-knowledge-operating-system]]"]
---

# ADR-0001: Template files declare the produced type, not "template"

Template files carry the `type` of the document they produce (plus a `template: true` marker), rather than a `type: template`.

## Purpose

Record why templates are typed by what they create, so the convention is binding and the reasoning survives. This is a Kernel amendment and therefore requires an ADR (Constitution, Article III).

## Problem

A template can be typed two ways. If templates declared `type: template`, then every document generated from one would start life with `type: template` in its frontmatter, and an AI (or hurried human) would have to remember to rewrite it to the real type. That is exactly the moment bad metadata is created — silently, at generation time, across every new document. We need templates to make correct metadata the default, while still being distinguishable from real documents for tooling and the [[Validation|knowledge compiler]].

## Decision

Template files in `01 Kernel/Templates/` **declare the type they produce** (e.g. `Concept.md` is `type: concept`, `ADR.md` is `type: adr`) and additionally carry a boolean **`template: true`** marker. There is no `template` value in the `type` enumeration. Instantiating a template keeps the produced `type` and removes the `template: true` marker.

## Alternatives

### `type: template` for all templates (rejected)
Simple and literal, but pushes a metadata-correction step onto every generation, which is the failure this decision prevents.

### Produced type, distinguished only by folder location (rejected)
Drop the marker and rely on the `01 Kernel/Templates/` path to identify templates. Rejected: location is lost on export, copy, or move, leaving a file indistinguishable from a real draft of that type.

### Produced type + `template: true` marker (chosen)
Correct metadata by default, plus a portable, explicit signal that survives independent of folder.

## Tradeoffs

- **Gain:** generation produces valid metadata with zero post-edit; templates remain trivially identifiable by tooling.
- **Cost:** one extra frontmatter field on 12 files, and the [[Validation Rules]] must exempt templates from content-shape checks (orphan, five-link, duplicate, folder-matches-type). Encoded as rules `TPL-001`/`TPL-002` and the template-exemptions list.

## Consequences

- The `type` enumeration drops `template`; the [[Frontmatter Specification]] gains a "Template files" section and the optional `template` field.
- The [[AI Contributor Guide]] gains a "Generating from a template" rule: keep the produced `type`, remove the marker.
- The [[Validation Rules]] gain `TPL-001`/`TPL-002` and exempt `template: true` files from instance-only checks.
- The [[Glossary]] removes `template` from the listed types and defines "template file."

## Status

accepted

## Date

2026-06-25

## Related ADRs

- Extends [[ADR-0000-adopt-knowledge-operating-system]] (the founding decision this refines).

## Related Documents

- [[Decision Map]]
- [[Frontmatter Specification]]
- [[AI Contributor Guide]]
- [[Validation Rules]]
- [[Glossary]]
