# KOS CLI v0

A small TypeScript/Node tool that makes the vault's Kernel rules executable. It
lives alongside the vault at the repo root; it only treats the numbered vault
folders (+ `Home.md`, `README.md`) as documents — its own `src/` is ignored.

## Setup

```bash
npm install
npm run build        # compiles to dist/ and copies the prompt template
npm test             # 28 unit/integration tests
```

Run the CLI either built (`node dist/cli.js …`) or via tsx (`npm run kos -- …`).

## Commands

```bash
kos validate <vaultPath>
kos ingest   <vaultPath> <inputFile>
kos compile  <vaultPath>
kos run      <vaultPath> --max-iterations 3
```

- **validate** — deterministic checks (frontmatter FM-*, sections SEC-001,
  links LNK-001/002/003, template rules TPL-*) and writes
  `90 Meta/Validation Report.md`. Exit code is non-zero if any ERROR.
- **ingest** — copies the input idea/PRD into `00 Inbox/` and seeds six tasks;
  writes `90 Meta/Ingestion Report.md` and `90 Meta/Task Queue.md`. No documents
  are authored at ingest.
- **compile** — validation + analysis; writes `90 Meta/Compiler Report.md`,
  `Knowledge Score.md`, `Open Task Queue.md`, and reconciles `90 Meta/tasks.json`.
- **run** — the controlled loop: compile → select one task → dispatch to Claude →
  re-validate → mark complete only if validation holds and `01 Kernel/` is
  unchanged. Stops after `--max-iterations` (default 3) or when no task is
  actionable. The compiler owns the loop; Claude only executes one task at a time.

## The agent (auth)

`kos run` uses the Claude Agent SDK, which runs the Claude Code engine under the
hood and authenticates exactly like the `claude` CLI. **It uses your Claude Code
subscription by default — no API key required.** Just be logged in:

```bash
claude            # then /login with your Pro/Max subscription, once
kos run <vaultPath> --max-iterations 1
```

The CLI prefers your subscription: it strips any stray `ANTHROPIC_API_KEY` from
the environment it hands the SDK, so a leftover key won't silently switch you to
API billing.

- **Non-interactive subscription auth** (CI, scripts): run `claude setup-token`
  once and export the resulting `CLAUDE_CODE_OAUTH_TOKEN`. It's passed through.
- **Opt into API billing instead:** set `KOS_AUTH=api-key` (with
  `ANTHROPIC_API_KEY` set).
- **Offline / deterministic** (and for the tests): `KOS_AGENT=mock`:

```bash
KOS_AGENT=mock kos run <vaultPath> --max-iterations 1
```

## Design rule

Claude writes documents; the compiler judges quality; the compiler owns the loop.
Deterministic validation is preferred over AI judgment. The `01 Kernel/` layer is
never mutated — a before/after content snapshot fails any task that touches it.

## Knowledge score

```
quality  = clamp(100 - 6*errors - 1.5*warnings, 0, 100)
coverage = (knowledge layers with a real document) / 8
score    = round(0.6*quality + 0.4*coverage*100)
```
