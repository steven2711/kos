---
type: guide
status: canonical
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [kernel, decisions, adr, governance]
parents: ["[[Constitution]]"]
children: ["[[Decision Map]]"]
related: ["[[Knowledge Modeling Guide]]", "[[Document Lifecycle]]", "[[Naming Standards]]"]
---

# Decision Framework

When a decision must be recorded, and how. Significant decisions become Architecture Decision Records (ADRs) so that reasoning outlives memory (Constitution, Article VI).

## Purpose

Ensure that every choice with lasting consequences is captured with its alternatives and tradeoffs, so future contributors understand not just *what* was decided but *why*, and what was rejected.

## Context

ADRs live in `06 Decisions` and are curated by the [[Decision Map]]. They are a document type (`adr`) with their own template (`01 Kernel/Templates/ADR.md`). Deciding *that* something is a decision (vs. a concept or a question) is covered in the [[Knowledge Modeling Guide]]; an ADR's status follows the [[Document Lifecycle]].

## When does a decision need an ADR?

Write an ADR when the decision:

- is **hard to reverse**, or expensive to revisit;
- **constrains future work** (architecture, vocabulary, process, tooling);
- **chose among real alternatives** that a reasonable person might have picked differently;
- **changes the Kernel** (always requires an ADR — Constitution, Article III).

Routine, easily-reversible choices do not need an ADR. When unsure, default to writing one — a cheap ADR is better than lost reasoning.

## ADR anatomy

Every ADR records these sections:

1. **Problem** — the forces and context that make a decision necessary.
2. **Decision** — the choice, stated plainly in one or two sentences.
3. **Alternatives** — the options considered, including "do nothing."
4. **Tradeoffs** — what each alternative costs and gains.
5. **Consequences** — what becomes true (and newly constrained) once this is adopted.
6. **Status** — `draft | review | accepted | canonical | deprecated` (see [[Document Lifecycle]]).
7. **Date** — when the decision was accepted.
8. **Related ADRs** — links, including any it `supersedes` or is superseded by.

## Lifecycle of a decision

```
question (07 Research)  →  ADR draft (06 Decisions)  →  review  →  accepted  →  canonical
                                                                         │
                                                                  superseded by a later ADR
                                                                         ▼
                                                                    deprecated
```

A decision often begins as a first-class [[Question|question]]. When superseded, the new ADR sets `supersedes` and the old one becomes `deprecated` — it is never deleted.

## Numbering and naming

ADRs are numbered sequentially (`ADR-0000`, `ADR-0001`, …) per [[Naming Standards]]. The first record, [[ADR-0000-adopt-knowledge-operating-system]], documents the adoption of this KOS itself.

## Open Questions

- Should superseded ADRs auto-archive to `99 Archive`, or remain in `06 Decisions` as deprecated for discoverability? Tracked as a future [[Question|question]].

## Related Documents

- [[Constitution]]
- [[Decision Map]]
- [[Knowledge Modeling Guide]]
- [[Document Lifecycle]]
- [[Naming Standards]]
- [[ADR-0000-adopt-knowledge-operating-system]]
