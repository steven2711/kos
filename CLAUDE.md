# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is (two things in one root)

This root holds **both** of:

1. **A KOS vault** — the numbered folders (`00 Inbox` … `99 Archive`) are an Obsidian vault of markdown "executable knowledge," governed by the rules in `01 Kernel/` (the Constitution, AI Contributor Guide, Validation Rules, etc.). `01 Kernel/` is *sacred*: read-many, write-rarely.
2. **`kos-cli`** — the TypeScript program in `src/` that validates, ingests, compiles, and runs controlled tasks **against** a vault.

The CLI lives *alongside* the vault at the same root. `src/core/vault.ts` deliberately scopes document discovery to the known vault folders (plus `Home.md`/`README.md`), so `src/`, `node_modules/`, `dist/`, etc. are never treated as vault documents. When you change CLI code you are working in `src/`; the numbered folders are *data*, not source.

## Commands

```bash
npm run dev <cmd> <vaultPath>   # run the CLI from source via tsx (alias: npm run kos)
npm run build                   # tsc → dist/, then copies worker prompt templates
npm run check                   # typecheck → lint → test → knip  (THE gate; must stay green)

npm test                        # vitest run (all tests once)
npm run test:watch              # vitest watch
npm run test:coverage           # coverage (reported, never gated)
npm run typecheck               # tsc -p tsconfig.check.json (includes tests, noEmit)
npm run lint                    # eslint .   (lint:fix to autofix)
npm run knip                    # dead-code / unused-dependency check

# run a single test file / single test
npx vitest run src/tests/scoring.test.ts
npx vitest run -t "computeScore is monotonic"
```

CLI subcommands (the vault is always the first argument):

```bash
npm run dev init     <projectDir>            # scaffold a new project: link-clean starter vault under <projectDir>/vault
npm run dev validate <vaultPath>             # deterministic Kernel checks + Validation Report
npm run dev ingest   <vaultPath> <inputFile> # copy input into 00 Inbox, seed 6 tasks
npm run dev start    <vaultPath>             # one command: seed from 00 Inbox/, build to completion, review, report
npm run dev compile  <vaultPath>             # validate + plan tasks + write reports
npm run dev analyze  <vaultPath>             # LLM Semantic Reviewer → Semantic Report + advisory tasks
npm run dev explain  <vaultPath>             # score, blockers, next task, remaining work
npm run dev run      <vaultPath> --max-iterations 3   # the controlled loop (excludes research/proposal tasks)
npm run dev research <vaultPath> [query]     # Research Worker → cited evidence into 07 Research/
npm run dev promote  <vaultPath> [--proposal P-001 | --approve | --reject | --yes]  # founder review → merge
```

Use `.` as `<vaultPath>` to operate on this repo's own vault. `init` is the exception: it takes a
*project* directory and creates the vault under `<projectDir>/vault`, so subsequent commands take
`<projectDir>/vault` as their `<vaultPath>`.

The two foundational KOS ADRs (`ADR-0000-adopt-knowledge-operating-system`,
`ADR-0001-template-files-declare-produced-type`) ship under `06 Decisions/Foundational/` — they're
inherited framework records the Kernel links to, kept out of the way so a project's own ADRs occupy the
top level of `06 Decisions/` (continuing from `ADR-0002`). Wikilinks resolve by basename, so the
subfolder is transparent to validation.

Git hooks (husky, installed via the `prepare` script): **pre-commit** runs `lint-staged` (`eslint --fix` on staged `.ts`); **pre-push** runs the full `npm run check`. Bypass only in a real emergency with `--no-verify`.

## Architecture: the controlled loop

`kos run` is the heart of the system. The design rule is that **Claude executes one bounded task at a time and never decides when the project is done, never free-loops, and never edits the Kernel.** Each subsystem has exactly one job:

- **Compiler** (`src/core/compiler.ts`) — read-only, deterministic. Validates every doc (frontmatter / required sections / wikilinks / templates), builds the knowledge graph, computes the coverage **score**, and produces a `VaultAnalysis` of what's missing. It only *reports*; it never generates or schedules work.
- **Planner** (`src/planner/planner.ts`) — "what work exists?" Turns `VaultAnalysis` into candidate tasks, infers dependencies between task *types* (a DAG: concept_extraction → domain/vision → architecture/adr), and builds the Task Graph. Never executes, never validates.
- **Scheduler** (`src/scheduler/scheduler.ts`) — "what runs next?" Picks the single highest-priority `open` task whose dependencies are all `complete`; also produces the forward execution plan. Never creates or validates tasks.
- **Worker** (`src/workers/claude.ts`) — the loop's SDK boundary. `ClaudeWorker` runs one task that may Read/Write/Edit vault files; `MockWorker` writes a deterministic valid doc so the loop and tests run offline. Worker is constrained to tools `Read/Write/Edit/Glob/Grep`, `MAX_TURNS`, and model `claude-opus-4-8` (see `src/commands/run.ts`). The Agent SDK is touched only in `src/workers/` (here, plus the Semantic Reviewer and Research Worker) — each such boundary is dynamically imported, defensively narrowed, and paired with a `Mock*` twin selected by env, so the whole system runs offline.
- **Orchestrator** (`src/commands/run.ts`) — wires them: Planner refreshes the graph (via `compileAndPersist`) → Scheduler selects one → Worker executes → Compiler re-validates and judges. **Kernel guard:** it snapshots `01 Kernel/` before/after each task; any change fails the task.

Data flow per iteration: `compileAndPersist` (compile + plan + persist + write reports) → `selectNextTask` → render prompt from `src/workers/prompts/documentation-task.md` → worker → re-validate.

### The pipeline beyond the loop (review, human input, evidence, promotion)

Several stages run **only on their own command**, never inside `kos run`. They share one discipline: the compiler is the deterministic *fact* layer; everything that involves judgement, humans, or the outside world is a separate stage with its own **post-hoc write-boundary guard** (a before/after folder snapshot diff — `snapshotFolders`/`folderChanges` in `core/vault.ts`, generalised from the kernel guard). The SDK's `allowedTools` cannot be path-scoped reliably, so the snapshot diff is the *real* enforcement.

- **Semantic Reviewer** (`kos analyze`, `src/workers/semantic-reviewer.ts`) — the LLM *reasoning* layer (read-only), the deliberate counterpart to the deterministic compiler. It emits `SemanticFinding`s; the Planner (`deriveSemanticTasks`) turns confident recommendations into **advisory** tasks (`priority: low`, `origin: "semantic"`) routed by keyword/cited-layer to research or `knowledge_proposal` types. Findings are evidence, never auto-applied.
- **Interviewer** (`src/workers/interviewer.ts`) — the founder-input boundary used by `founder_interview` tasks. `TerminalInterviewer` prompts on stdin; `MockInterviewer` answers offline. The AI can never answer a founder question on the founder's behalf.
- **Research Worker** (`kos research`, `src/workers/research-worker.ts`, v0.8) — acquires *external evidence* and writes cited documents **only** into `07 Research/`. "Research is evidence, not truth": it may propose follow-up tasks but never mutates canonical layers or promotes anything. The pure doc renderer is `core/research-document.ts`.
- **Promotion Engine** (`kos promote`, `src/commands/promote.ts`, v0.9) — the **only** path that edits a canonical document, and only after the **founder** approves a `knowledge_proposal` (the approval boundary is `src/workers/promotion-reviewer.ts`, mirroring the Interviewer). A merge is a deterministic, provenance-tagged **append** via a `MergeStrategy` (`core/merge-strategy.ts`; only `AppendMergeStrategy` exists — it preserves frontmatter byte-for-byte except `updated:`, since gray-matter has no lossless serialiser). Each approval is guarded: snapshot → append to the *one* explicit target → re-validate → **roll back** on any boundary violation or validation regression; `status: merged` is set only after validation holds. Proposals live in `11 Proposals/`; `01 Kernel/` and `07 Research/` are never merge targets.

Write-boundary cheat-sheet: `kos run` may touch any non-Kernel doc; `kos research` writes only `07 Research/`; `kos promote` appends only to a single canonical target (`CANONICAL_FOLDERS` in `core/vault.ts`) plus `11 Proposals/`; **`01 Kernel/` is immutable everywhere.**

### Task persistence
`90 Meta/tasks.json` is the machine source of truth (`src/tasks/task-store.ts`, validated by a Zod schema in `src/tasks/task-model.ts`). The human-readable `Task Queue.md` / `Open Task Queue.md` and all other files in `90 Meta/` (Compiler Report, Knowledge Score, Task Graph, Execution Plan, …) are **generated projections** — the compiler explicitly skips them during discovery so it never grades its own output.

## Layering (enforced — build fails on violation)

`import-x/no-restricted-paths` (in `eslint.config.js`) enforces a strict leaf→top dependency order:

```
core/  →  tasks/  →  planner/ , scheduler/  →  workers/  →  commands/ , cli.ts
(pure)    (model)     (domain logic)            (SDK+env)    (orchestration)
```

- `core/` is a pure leaf: it must not import from `commands`, `planner`, `scheduler`, `workers`, `reports`, or `cli`.
- `tasks/` must not import from `commands`, `workers`, or `cli`.
- `planner/`/`scheduler/` must not import from `commands` or `cli`.
- **Only `commands/` may import the side-effectful `workers/` layer.**

Keep domain logic deterministic and pure; no hidden global mutable state.

## Strict-TypeScript & boundary conventions

This codebase is edited by AI agents in parallel, so the guardrails are deliberately aggressive (full detail in `STRICT_TYPESCRIPT.md`):

- **`as any`, `as unknown as`, and `!` (non-null assertion) are banned in `src/**`.** Narrow with a type guard, a `?? fallback`, a discriminated union, or a Zod schema. Common fixes are tabulated in `STRICT_TYPESCRIPT.md`.
- **Validate at every external boundary with Zod.** Anything from outside the process — env vars (`src/config/env.ts`), files/JSON (`tasks/task-store.ts`), YAML frontmatter (`core/frontmatter.ts`), CLI args, and the dynamically-imported, untyped Agent SDK (`workers/claude.ts` narrows messages defensively) — must be parsed/narrowed before the rest of the code touches it.
- **Named exports only; one primary symbol per file.** Default exports are banned in `src/**` except config files.
- `tsconfig.json` excludes `src/tests/**` (build ships only runtime code); `tsconfig.check.json` adds tests + `noEmit` and is what `typecheck`/ESLint use.
- Escape hatches need a written reason: `ban-ts-comment` requires a ≥10-char description, and any disable comment must justify itself on the line above.

## Testing conventions

Tests are **executable specifications** optimized for confidence, not coverage (full detail in `TESTING_PHILOSOPHY.md`). Every test should answer "if this fails in production, what behavior broke?" Coverage is reported but never gated — there are no thresholds, so `npm run check` stays fast.

Three tiers, all in `src/tests/`:
- **Unit** (majority) — pure functions: scoring, graph, frontmatter, wikilinks, scheduler, planner, env, task identity/dedupe.
- **Integration** — real modules over an isolated `mkdtemp` vault: `task-store`, `vault`, `compiler`, `planner-seed`. Use the helpers in `src/tests/support/` (`tmp-vault.ts`, `builders.ts`).
- **Command smoke** — drive a whole command through one iteration; critical rails only: `run-guard.test.ts` (kernel guard, validation-regression), `research.test.ts` (research write-boundary), `promote.test.ts` (approve / reject / merge-rollback / kernel refusal).

Mock only the **outside world** at its boundary (`MockWorker`, `MockSemanticReviewer`, `MockResearchWorker`, `MockInterviewer`, `MockPromotionReviewer` — selected by env), never our own modules. Loop-narration noise in command-smoke tests is silenced via `silenceLoopNarration()` (`src/tests/support/silence-console.ts`).

## Worker runtime / environment

`src/config/env.ts` is the single env boundary. Relevant variables: `KOS_AGENT` (`mock` | `claude` — `mock` also auto-selected when no API key is present, and forces every boundary's mock), `KOS_AUTH` (`subscription` | `api-key`), `ANTHROPIC_API_KEY` (honoured only when `KOS_AUTH=api-key`), `CLAUDE_CODE_OAUTH_TOKEN` (subscription token from `claude setup-token`), `KOS_RESEARCH_WORKER` (`mock` | `claude`, overrides the research worker), `KOS_PROMOTION_REVIEWER` (`mock` | `terminal`, overrides the founder-review boundary). Set `KOS_AGENT=mock` to run everything fully offline.
