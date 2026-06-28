# Founder Knowledge Operating System (KOS)

This repository is not documentation. It is **executable knowledge**.

It is a reusable, project-agnostic **Knowledge Operating System**: an Obsidian vault that behaves like a software repository for a company's thinking — its definitions, decisions, reasoning, tradeoffs, research, and open questions. Obsidian is only the interface. Markdown is only the storage format. The real product is a disciplined knowledge system that humans and AI agents can safely extend over time.

> Humans build products. AI accelerates knowledge. The repository preserves wisdom.

## Start here

- **[Home](Home.md)** — the top-level Map of Content and navigation hub.
- **[Constitution](01%20Kernel/Constitution.md)** — the supreme law of the vault. Read this first.
- **[AI Contributor Guide](01%20Kernel/AI%20Contributor%20Guide.md)** — the operating rules for any AI (or human) contributor.
- **[Repository Blueprint](01%20Kernel/Repository%20Blueprint.md)** — what every folder is for and where things go.

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
2. (Recommended) install the **Dataview** and **Templater** community plugins — see [Automation Guide](90%20Meta/Automation%20Guide.md). The vault works without them; they only power the dynamic dashboards in the Maps of Content.
3. Create new documents from the templates in `01 Kernel/Templates/`.
4. Before creating anything, run the checklist in the [AI Contributor Guide](01%20Kernel/AI%20Contributor%20Guide.md).

## The CLI (`kos-cli`)

This root holds two things: the **vault** (the numbered folders above) and **`kos-cli`**, a TypeScript program in `src/` that validates, ingests, compiles, and runs controlled tasks *against* a vault. The vault is data; `src/` is source. The CLI scopes document discovery to the known vault folders, so `src/`, `node_modules/`, and `dist/` are never treated as vault documents.

```bash
npm run dev <cmd> <vaultPath>   # run from source via tsx (alias: npm run kos)
npm run build                   # tsc → dist/, then copy worker prompt templates
npm run check                   # typecheck → lint → test → knip  (THE gate; must stay green)
```

Use `.` as `<vaultPath>` to operate on this repo's own vault.

### Commands

| Command | What it does |
| --- | --- |
| `kos validate <vault>` | Deterministic Kernel checks; writes a Validation Report. |
| `kos ingest <vault> <input>` | Copies an idea/PRD into `00 Inbox` and seeds the task queue. |
| `kos compile <vault>` | Validate + analyse + plan tasks; writes the `90 Meta/` reports. Read-only, deterministic. |
| `kos analyze <vault>` | Runs the **LLM Semantic Reviewer**: writes `90 Meta/Semantic Report.md` and proposes advisory tasks. |
| `kos explain <vault>` | Reports the coverage score, blockers, next task, and remaining work. |
| `kos run <vault> --max-iterations 3` | The controlled loop: one Claude-powered task at a time. |

### Two analysis stages: facts vs. reasoning

> Facts are validated. Reasoning is reviewed.

1. **Deterministic Compiler** (`kos compile`) — objective and offline. Validates frontmatter, links, templates, orphans, coverage, and Kernel integrity. It only *reports*; it may **block** readiness but never generates work itself.
2. **LLM Semantic Reviewer** (`kos analyze`) — advisory and non-deterministic. Reviews whether the vision, product, architecture, and business layers actually cohere. Every finding cites its documents, explains why it matters, and carries a self-reported confidence. The reviewer is **read-only** (it cannot mutate docs), **never** invents founder intent (it raises a `founder_interview` task instead), and **never** blocks the build.

The **Planner** consumes both: deterministic findings become required work; semantic findings become optional, low-priority work tagged `origin: "semantic"`. The **Scheduler** picks the single highest-priority unblocked task, a **Worker** executes it (the only place the Claude Agent SDK is touched), and the Compiler re-validates. A Kernel guard snapshots `01 Kernel/` before and after each task; any change fails the task.

Set `KOS_AGENT=mock` to run the whole pipeline offline and deterministically (no API key needed).

## Reusing it for a new project

This is the **Phase 1** foundation. To start a real venture (e.g. StoryForge), copy this vault and begin filling `02 Vision` → `09 Roadmap` while leaving `01 Kernel` untouched. Every venture that starts from this baseline shares the same vocabulary, architecture, and reasoning process from day one.
