---
type: guide
status: canonical
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [meta, automation, dataview, templater]
parents: ["[[Home]]"]
children: []
related: ["[[Validation]]", "[[Repository Blueprint]]", "[[Linking Standards]]", "[[Frontmatter Specification]]"]
---

# Automation Guide

How to set up and use the optional automation in this vault. The vault is pure Markdown and works with no plugins; this guide explains the **hybrid** layer that makes maintenance easier when plugins are installed.

## Purpose

Document the recommended Obsidian plugins, how to install them, and a small library of query recipes for the Maps of Content and validation dashboards — without making the vault depend on them.

## Context

The hybrid policy (see [[Repository Blueprint]]): every Map of Content keeps a hand-curated index that works without plugins, plus an optional `dataview` block that produces a live index when Dataview is installed. The dashboards below operationalize, by eye, the same checks the future [[Validation|knowledge compiler]] will run mechanically (see [[Validation Rules]]).

## Recommended plugins

| Plugin | Why | Required? |
| --- | --- | --- |
| **Dataview** | Live indexes and validation dashboards driven by frontmatter. | Optional. |
| **Templater** | Instantiate documents from `01 Kernel/Templates/` with auto-filled dates. | Optional. |

### Install

1. Obsidian → Settings → Community plugins → Browse.
2. Install and enable **Dataview** and **Templater**.
3. Templater → set the template folder to `01 Kernel/Templates`.
4. (Optional) Templater → enable "trigger on new file creation" to auto-stamp `created`/`updated`.

Without these plugins, the `dataview` code blocks render as plain code — harmless — and you maintain the curated lists by hand.

## Query recipes

### Orphan dashboard (no inbound links — `LNK-002`)
```dataview
LIST WHERE length(file.inlinks) = 0 AND file.name != "Home"
```

### Missing-frontmatter dashboard (`FM-002`)
```dataview
TABLE type, status FROM "" WHERE !type OR !status OR !owner
```

### Documents by status (`Document Lifecycle`)
```dataview
TABLE file.folder AS folder, type FROM "" WHERE status = "draft" SORT file.mtime DESC
```

### Open questions across the vault (`question` type)
```dataview
TABLE status, updated FROM "" WHERE type = "question" SORT updated DESC
```

### Deprecated documents still referenced (`LIFE-001`)
```dataview
LIST FROM "" WHERE status = "deprecated" AND length(file.inlinks) > 0
```

### Under-linked documents (below the five-link minimum — `LNK-001`)
```dataview
TABLE length(file.outlinks) AS links FROM "" WHERE length(file.outlinks) < 5 AND type != "moc"
```

## Templater usage

Create a new document via Templater's "Insert template" command and pick the matching type from `01 Kernel/Templates/`. Replace the angle-bracket placeholders, then complete the after-you-write checklist in the [[AI Contributor Guide]].

One template exists per document type (see [[Frontmatter Specification]]):
[[Concept]], [[Vision]], [[Specification]], [[ADR]], [[Research]], [[Experiment]], [[Question]], [[Meeting]], [[Reference]], [[Guide]], [[Roadmap]], [[MOC]].

## Open Questions

- Should these Dataview recipes be promoted into a single `90 Meta/Dashboard` document once there is enough content to make them useful? Tracked as a future [[Question|question]].

## Related Documents

- [[Validation]]
- [[Validation Rules]]
- [[Repository Blueprint]]
- [[Linking Standards]]
- [[Frontmatter Specification]]
- [[AI Contributor Guide]]
