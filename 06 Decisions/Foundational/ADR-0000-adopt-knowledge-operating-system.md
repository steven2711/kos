---
type: adr
status: accepted
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [adr, decision, kernel, foundational]
parents: ["[[Decision Map]]"]
children: []
related: ["[[Constitution]]", "[[Repository Blueprint]]", "[[AI Contributor Guide]]", "[[Decision Framework]]"]
---

# ADR-0000: Adopt the Knowledge Operating System

Adopt a Kernel-governed, AI-native Obsidian vault as the canonical source of truth for the company's thinking.

> This is both the founding decision of record **and** a worked example of the ADR format (see `01 Kernel/Templates/ADR.md` and the [[Decision Framework]]).

## Purpose

Record why this vault exists in the form it does, so the foundational choice is never mistaken for an accident and can be revisited deliberately if needed.

## Problem

Startups accumulate documentation in scattered, duplicative, context-free fragments — docs, chats, slides, memories. Reasoning behind decisions is lost; the same concept is redefined repeatedly; new contributors (especially AI agents) cannot answer *what are we building, why, how, and what is unresolved* without external context. We need a single, durable, navigable, AI-native source of truth that scales from a solo founder to an organization.

## Decision

Adopt a **Knowledge Operating System**: an Obsidian vault structured like a software repository, governed by a sacred, read-many/write-rarely **Kernel** (`01 Kernel`). Every document carries required frontmatter, declares one type, follows a lifecycle, and joins the knowledge graph with a minimum of five meaningful links. AI contributors operate under the [[AI Contributor Guide]] and the [[Quality Gates]]. The full operating model is the [[Constitution]] and [[Repository Blueprint]].

## Alternatives

### Do nothing (status quo)
Keep documentation in ad-hoc tools. Rejected: this is the exact failure mode we are solving.

### A traditional wiki (e.g. Notion/Confluence)
Good editing UX. Rejected: weak as a connected graph, weaker as a plain-text, version-controllable, AI-readable repository; encourages duplication.

### A code repository of Markdown without a governing Kernel
Portable and versionable, but without enforced modeling, naming, and linking standards it degrades into the same scattered state. Rejected in favor of the Kernel-governed approach.

### This KOS (chosen)
Obsidian vault + sacred Kernel + lifecycle + knowledge graph + future knowledge compiler.

## Tradeoffs

- **Discipline cost:** contributors must learn and follow the Kernel. Mitigated by templates, guides, and the [[AI Contributor Guide]] checklist.
- **Upfront effort:** building the Kernel before any product content. Justified because it is reused across every future venture (Phase 2).
- **Tooling coupling:** richer dashboards assume Dataview/Templater. Mitigated by the hybrid approach — the vault works as plain Markdown without plugins (see [[Automation Guide]]).

## Consequences

- The Kernel becomes binding. Future Kernel changes require their own ADRs (Constitution, Article III).
- Every new document must pass the [[Quality Gates]] and conform to the [[Frontmatter Specification]] and [[Linking Standards]].
- A future [[Validation|knowledge compiler]] can mechanically verify the vault against the [[Validation Rules]].
- The KOS is reusable: instantiating a venture (Phase 2) copies this foundation and fills `02 Vision` → `09 Roadmap`, leaving the Kernel intact.

## Status

accepted

## Date

2026-06-25

## Related ADRs

_None. This is the first record (`ADR-0000`). It supersedes nothing and is superseded by nothing._

## Related Documents

- [[Decision Map]]
- [[Constitution]]
- [[Repository Blueprint]]
- [[AI Contributor Guide]]
- [[Decision Framework]]
- [[Validation]]
