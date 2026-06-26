# Founder Knowledge Operating System (KOS)

This repository is not documentation. It is **executable knowledge**.

It is a reusable, project-agnostic **Knowledge Operating System**: an Obsidian vault that behaves like a software repository for a company's thinking — its definitions, decisions, reasoning, tradeoffs, research, and open questions. Obsidian is only the interface. Markdown is only the storage format. The real product is a disciplined knowledge system that humans and AI agents can safely extend over time.

> Humans build products. AI accelerates knowledge. The repository preserves wisdom.

## Start here

- **[[Home]]** — the top-level Map of Content and navigation hub.
- **[[Constitution]]** — the supreme law of the vault. Read this first.
- **[[AI Contributor Guide]]** — the operating rules for any AI (or human) contributor.
- **[[Repository Blueprint]]** — what every folder is for and where things go.

## How this vault is governed

Everything in `01 Kernel/` is **sacred**: read-many, write-rarely. The Kernel defines how knowledge is modeled, named, linked, validated, and archived. Every other folder inherits from it. Every contributor — human or AI — must obey it. When in doubt, the Kernel wins.

## The layers

| Layer | Folder(s) | Purpose |
| --- | --- | --- |
| 0 — Capture | `00 Inbox` | Raw, unprocessed input. Nothing canonical lives here. |
| 1 — Foundation | `01 Kernel` | The governing rules, guides, glossary, and templates. |
| 2 — Knowledge | `04 Domain` | Canonical concepts, relationships, rules, processes. |
| 3 — Execution | `02 Vision`, `03 Product`, `05 Architecture`, `07 Research`, `08 Business`, `09 Roadmap`, `10 Operations` | What we are building and how. |
| 4 — Decisions | `06 Decisions` | Architecture Decision Records and their reasoning. |
| 5 — Archive | `99 Archive` | Deprecated concepts, historical snapshots, completed work. |
| Meta | `90 Meta` | Validation rules, automation, and vault changelog. |

## Using it as an Obsidian vault

1. Open this folder as a vault in [Obsidian](https://obsidian.md).
2. (Recommended) install the **Dataview** and **Templater** community plugins — see [[Automation Guide]]. The vault works without them; they only power the dynamic dashboards in the Maps of Content.
3. Create new documents from the templates in `01 Kernel/Templates/`.
4. Before creating anything, run the checklist in the [[AI Contributor Guide]].

## Reusing it for a new project

This is the **Phase 1** foundation. To start a real venture (e.g. StoryForge), copy this vault and begin filling `02 Vision` → `09 Roadmap` while leaving `01 Kernel` untouched. Every venture that starts from this baseline shares the same vocabulary, architecture, and reasoning process from day one.
