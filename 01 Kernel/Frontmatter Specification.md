---
type: guide
status: canonical
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [kernel, frontmatter, metadata, schema]
parents: ["[[Constitution]]"]
children: ["[[Validation Rules]]"]
related: ["[[Document Lifecycle]]", "[[Linking Standards]]", "[[Naming Standards]]"]
---

# Frontmatter Specification

The canonical schema for the YAML frontmatter that opens every document in the vault. A document without valid frontmatter is not a citizen of the vault (Constitution, Article V).

## Purpose

Define a single, machine-checkable metadata contract so that humans can scan and the [[Validation|knowledge compiler]] can validate, query, and connect documents automatically.

## Context

Frontmatter is the structural half of the knowledge graph; the prose Relationships section is the human half (see [[Linking Standards]]). The `status` field is governed by the [[Document Lifecycle]]; the `type` field is constrained by the document-type list below. These fields are the primary inputs to [[Validation Rules]].

## The schema

Every Markdown file must begin with exactly this block (order recommended, all keys required):

```yaml
---
type:            # one of the allowed types (below). Exactly one.
status:          # one of: draft | review | accepted | canonical | deprecated | archived
created:         # YYYY-MM-DD, the creation date. Never changes.
updated:         # YYYY-MM-DD, the last meaningful edit.
owner:           # the accountable person or role (e.g. founder)
tags:            # list of lowercase kebab-case tags
parents:         # list of [[wikilinks]] to broader documents
children:        # list of [[wikilinks]] to narrower documents
related:         # list of [[wikilinks]] to associated documents
---
```

## Field rules

| Field | Required | Type | Rules |
| --- | --- | --- | --- |
| `type` | yes | string | Exactly one of the allowed types. Immutable; changing type means a new document. |
| `status` | yes | string | One of the six lifecycle values. See [[Document Lifecycle]]. |
| `created` | yes | date | `YYYY-MM-DD`. Set once; never edited. |
| `updated` | yes | date | `YYYY-MM-DD`. Bumped on every meaningful change. Must be ≥ `created`. |
| `owner` | yes | string | A person or role. Never blank (no unclear ownership — see [[Quality Gates]]). |
| `tags` | yes | list | Lowercase kebab-case. May be empty `[]` but the key must exist. |
| `parents` | yes | list of links | Broader documents. May be empty only for `Home`. |
| `children` | yes | list of links | Narrower documents. May be empty. |
| `related` | yes | list of links | Associated documents. Together with parents/children, supports the ≥5-link rule in [[Linking Standards]]. |

## Allowed `type` values

`concept`, `vision`, `specification`, `adr`, `research`, `experiment`, `question`, `meeting`, `reference`, `guide`, `moc`.

Every document declares exactly one type. See the matching files in `01 Kernel/Templates/`.

There is deliberately **no `template` type**. A template is not its own kind of document — it is a blank instance of the document type it produces. See "Template files" below and [[ADR-0001-template-files-declare-produced-type]].

## Template files

Template files in `01 Kernel/Templates/` follow one extra rule:

1. **Declare the produced type, not "template".** A template's `type` is the type of the document it creates — `01 Kernel/Templates/Concept.md` is `type: concept`, `ADR.md` is `type: adr`. This means an AI or human who instantiates a template inherits correct metadata automatically and never has to fix a `type: template` left over from generation.
2. **Carry a `template: true` marker.** This is the *only* difference in frontmatter between a template and a real instance. It lets tooling and the [[Validation|knowledge compiler]] identify templates without inspecting their folder.
3. **Stay `status: draft` and live only in `01 Kernel/Templates/`.** A `template: true` file outside that folder, or with any other status, is a violation.

When instantiating a template: keep the produced `type`, **remove the `template: true` marker**, set the real `status`, and fill the placeholders (see [[AI Contributor Guide]]).

### The `template` field

| Field | Required | Type | Rules |
| --- | --- | --- | --- |
| `template` | only on templates | boolean | `true` on every file in `01 Kernel/Templates/`; absent on all real documents. |

## Allowed `status` values

`draft`, `review`, `accepted`, `canonical`, `deprecated`, `archived`. See [[Document Lifecycle]].

## Example

```yaml
---
type: concept
status: canonical
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [domain, knowledge-graph]
parents: ["[[Domain Map]]"]
children: []
related: ["[[Knowledge Modeling Guide]]", "[[Linking Standards]]"]
---
```

## Open Questions

- Should we add an optional `aliases` field to support Obsidian alias search without violating the no-synonym rule in [[Terminology]]? Tracked as a future [[Question|question]].

## Related Documents

- [[Constitution]]
- [[Document Lifecycle]]
- [[Validation Rules]]
- [[Linking Standards]]
- [[Naming Standards]]
