---
type: guide
status: canonical
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [kernel, blueprint, structure, governance]
parents: ["[[Constitution]]"]
children: ["[[Naming Standards]]", "[[Document Lifecycle]]"]
related: ["[[Home]]", "[[Knowledge Modeling Guide]]", "[[Automation Guide]]"]
---

# Repository Blueprint

The map of the vault: what every folder is for, what belongs in it, and what does not. If you are unsure where a document goes, this is the authority.

## Purpose

Give every document an obvious, single home, so that knowledge is found by location as well as by link. A predictable structure is what makes the vault feel like a repository rather than a folder of notes.

## Context

The structure realizes the six-layer model named in the [[Constitution]]. Layers describe *intent*; folders are their physical form. Modeling decisions (what becomes a concept vs. a decision vs. research) are governed by the [[Knowledge Modeling Guide]]; naming within a folder is governed by [[Naming Standards]].

## The layer model

| Layer | Name | Folders | What it holds |
| --- | --- | --- | --- |
| 0 | Capture | `00 Inbox` | Raw, unprocessed input awaiting modeling. |
| 1 | Foundation | `01 Kernel` | Governing rules, guides, glossary, templates. |
| 2 | Knowledge | `04 Domain` | Canonical concepts, relationships, rules, processes. |
| 3 | Execution | `02 Vision`, `03 Product`, `05 Architecture`, `07 Research`, `08 Business`, `09 Roadmap`, `10 Operations` | What we build and how. |
| 4 | Decisions | `06 Decisions` | ADRs and their reasoning. |
| 5 | Archive | `99 Archive` | Deprecated, historical, completed. |
| — | Meta | `90 Meta` | Validation, automation, changelog. |

## Folder reference

### `00 Inbox/`
Raw capture: voice notes, scratch, meeting dumps, half-formed ideas. **Nothing here is canonical.** Items are processed out of the Inbox into a canonical folder (modeled, named, linked, promoted) or archived. The Inbox should trend toward empty. See [[00 Inbox/_index|Inbox index]].

### `01 Kernel/`
The sacred governing layer. Read-many, write-rarely. Holds the [[Constitution]], all standards and guides, the [[Glossary]], [[Terminology]], and the `Templates/` subfolder. Changes here require an ADR.

### `02 Vision/`
Why the company exists, where it is going, the long-term thesis. Document type `vision`.

### `03 Product/`
What we are building for users: product specifications, principles, and surfaces. Curated by [[Product Map]].

### `04 Domain/`
The knowledge layer: canonical `concept` documents and the relationships between them. This is the heart of the knowledge graph. Curated by [[Domain Map]].

### `05 Architecture/`
How the system is built: components, data, interfaces, technical specifications. Curated by [[Architecture Map]].

### `06 Decisions/`
Architecture Decision Records — the decisions of record. One ADR per significant decision, numbered. Curated by [[Decision Map]]. See [[Decision Framework]].

### `07 Research/`
Open investigations, experiments, findings, and first-class [[Question|question]] documents. Curated by [[Research Map]].

### `08 Business/`
Business model, market, pricing, go-to-market, operations strategy. Curated by [[Business Map]].

### `09 Roadmap/`
Sequencing, milestones, and what-next. Curated by [[Roadmap Map]].

### `10 Operations/`
How the company runs day to day: processes, runbooks, policies, rituals. See [[10 Operations/_index|Operations index]].

### `90 Meta/`
Knowledge *about* the vault: the [[Validation]] specification (knowledge compiler), the [[Automation Guide]], and the [[Changelog]].

### `99 Archive/`
Deprecated concepts, historical snapshots, completed research. Nothing is deleted; it is archived here with status `archived`. See [[99 Archive/_index|Archive index]].

## Where does X go? (quick decisions)

- A reusable definition → `04 Domain` as a `concept`.
- A choice we made and its reasoning → `06 Decisions` as an `adr`.
- Something we do not yet know → `07 Research` as a `question`.
- What a user-facing feature should do → `03 Product` as a `specification`.
- How a system component works → `05 Architecture` as a `specification`.
- A rule about the vault itself → `01 Kernel`.

## Recommended tooling (hybrid)

The vault is pure Markdown and works with no plugins. For the dynamic dashboards in the Maps of Content, install **Dataview** (queries) and **Templater** (template instantiation). Setup and query recipes are in the [[Automation Guide]].

## Open Questions

- When does `10 Operations` justify its own dedicated Map of Content rather than relying on its `_index`? Tracked as a future [[Question|question]].

## Related Documents

- [[Constitution]]
- [[Home]]
- [[Knowledge Modeling Guide]]
- [[Naming Standards]]
- [[Document Lifecycle]]
- [[Automation Guide]]
