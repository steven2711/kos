---
type: moc
status: canonical
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [moc, decisions, adr, navigation]
parents: ["[[Home]]"]
children: ["[[ADR-0000-adopt-knowledge-operating-system]]", "[[ADR-0001-template-files-declare-produced-type]]"]
related: ["[[Decision Framework]]", "[[Architecture Map]]", "[[Roadmap Map]]"]
---

# Decision Map

The register of decisions of record. Every significant choice the company has made, with its reasoning preserved.

## Purpose

Provide a single, ordered index of all Architecture Decision Records, so anyone can see what has been decided and why.

## Context

This map curates `06 Decisions` (see [[Repository Blueprint]]). How and when to write an ADR is governed by the [[Decision Framework]]; ADR status follows the [[Document Lifecycle]]. Maps curate, they do not auto-dump (see [[Linking Standards]]).

## ADR register

| ADR | Title | Status | Date |
| --- | --- | --- | --- |
| [[ADR-0000-adopt-knowledge-operating-system\|ADR-0000]] | Adopt the Knowledge Operating System | accepted | 2026-06-25 |
| [[ADR-0001-template-files-declare-produced-type\|ADR-0001]] | Template files declare the produced type, not "template" | accepted | 2026-06-25 |

_Add each new ADR as a row, newest at the bottom, with its permanent number (see [[Naming Standards]])._

## Live index (optional)

```dataview
TABLE status, date FROM "06 Decisions" WHERE type = "adr" SORT file.name ASC
```
Fallback without Dataview: maintain the register table above by hand (see [[Automation Guide]]).

## Open Questions

- Should superseded ADRs move to `99 Archive` or remain here as `deprecated`? See the open question in [[Decision Framework]].

## Related Documents

- [[Home]]
- [[Decision Framework]]
- [[ADR-0000-adopt-knowledge-operating-system]]
- [[Architecture Map]]
- [[Roadmap Map]]
