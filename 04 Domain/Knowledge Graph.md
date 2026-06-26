---
type: concept
status: canonical
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [domain, knowledge-graph, example]
parents: ["[[Domain Map]]"]
children: []
related: ["[[Knowledge Modeling Guide]]", "[[Linking Standards]]", "[[Validation]]"]
---

# Knowledge Graph

The network formed by all documents in the vault and the typed relationships between them.

> This is a **worked example** of a canonical concept document. It demonstrates correct frontmatter, the concept-specific link sections, and ≥5 meaningful links (see [[Linking Standards]]). Use it as a model when authoring new concepts from `01 Kernel/Templates/Concept.md`.

## Purpose

Give the vault a single canonical home for the idea of the *knowledge graph*, so that other documents can reference it rather than re-explaining what "the graph" means.

## Definition

The knowledge graph is the directed network whose **nodes** are documents and whose **edges** are the typed relationships declared in their frontmatter and prose — `contains`, `depends_on`, `extends`, `implements`, `references`, `supersedes`, `related_to`. A vault is healthy when its graph is fully connected: every document is reachable, and no node is an orphan.

## Context

This concept is the structural payoff of the whole system. The [[Constitution]] (Article IV) requires that everything be connected; the [[Linking Standards]] enforce a five-link minimum; the [[Knowledge Modeling Guide]] defines the edge vocabulary. The graph is also what makes the future [[Validation|knowledge compiler]] possible — orphan and duplicate detection are graph operations.

## Examples

- The Kernel forms a tightly connected subgraph: [[Constitution]] `contains` the standards, which `depend_on` the [[Frontmatter Specification]].
- A `specification` node `implements` a [[Concept|concept]] node; an [[ADR|adr]] node `supersedes` an earlier ADR node.
- An orphan is a node with in-degree zero — flagged by rule `LNK-002` in [[Validation Rules]].

## Related Concepts

- The relationship vocabulary defined in the [[Knowledge Modeling Guide]].

## Parent Concepts

- The [[Domain Map]] organizes this and every other canonical concept.

## Child Concepts

- _None yet. Sub-concepts such as "orphan" or "relationship type" may be extracted into their own canonical documents if they grow beyond a glossary entry._

## Open Questions

- Should relationship edges carry weights or confidence, so the [[Validation|knowledge compiler]] can rank merge candidates? Tracked as a future [[Question|question]].

## References

- [[Glossary]] — the plain-language definition of *knowledge graph* and related terms.

## Related Documents

- [[Domain Map]]
- [[Knowledge Modeling Guide]]
- [[Linking Standards]]
- [[Validation]]
- [[Constitution]]
