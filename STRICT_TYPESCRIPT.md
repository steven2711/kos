# Strict TypeScript Guardrails

This codebase is developed in a heavily agentic workflow — multiple AI agents edit
it in parallel. These guardrails exist to **reduce AI-generated slop, prevent unsafe
code, and keep refactors safe and predictable**. They make illegal states harder to
represent and fail fast in `npm run check` on type drift, unsafe imports, dead code,
and circular dependencies.

> **The one command that matters:** `npm run check`
> (runs `typecheck` → `lint` → `test` → `knip`). It must stay green. CI is wired to
> these npm scripts; nothing is silently skipped.

Git hooks (husky) enforce this automatically: **pre-commit** runs `lint-staged`
(`eslint --fix` on staged `.ts` files only — fast), and **pre-push** runs the full
`npm run check`. The hooks install on `npm install` via the `prepare` script. Bypass
only in a genuine emergency with `git commit --no-verify` / `git push --no-verify`.

---

## Why these rules exist

| Goal | Mechanism |
| --- | --- |
| No silent `any` / unsafe data flow | `@typescript-eslint` `no-explicit-any` + `no-unsafe-*` (type-aware) |
| Refactor safety / find-usages | Named exports only; `consistent-type-imports`; no over-broad object shapes |
| Catch nullish bugs at compile time | `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `strictNullChecks` |
| No tangled architecture | `import-x/no-restricted-paths` layer zones + `no-cycle` |
| Validated boundaries, not raw JSON | Zod schemas at every external boundary |
| No dead code / unused deps | `knip` (files + dependencies enforced in CI) |
| Predictable async | `no-floating-promises`, `no-misused-promises` |

---

## How agents should comply

1. **Run `npm run check` before declaring work done.** Fix what it reports; do not
   weaken the rules.
2. **Never silence an error with a cast.** `as any`, `as unknown as`, and `!`
   (non-null assertion) are banned in `src/**`. Narrow with a guard, a `?? fallback`,
   a discriminated union, or a Zod schema instead.
3. **Consume validated data at boundaries.** Anything from outside the process
   (env, files, JSON, CLI args, SDK payloads) must pass through a Zod schema before
   the rest of the code touches it. See [Boundaries](#boundary-validation).
4. **One primary symbol per file, named export.** No default exports outside config
   files. Export only what another module actually imports.
5. **Respect the layers.** `core/` is a pure leaf; only `commands/` may touch
   `workers/`. See [Layering](#layering).
6. **Escape hatches require a written reason.** No bare `// eslint-disable` or
   `// @ts-expect-error` — `ban-ts-comment` requires a ≥10-char description, and any
   disable comment must explain *why* it is safe in the line above it.

---

## Compiler strictness (`tsconfig.json`)

`strict: true` was already on. We additionally enabled (and list explicitly so agents
can see the contract):

`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`,
`noPropertyAccessFromIndexSignature`, `noFallthroughCasesInSwitch`, `noImplicitReturns`,
`allowUnreachableCode: false`, `allowUnusedLabels: false`, `isolatedModules`,
`verbatimModuleSyntax`, plus the explicit `strict`-family flags.

`tsconfig.json` excludes `src/tests/**` so `npm run build` emits only shipping code.
`tsconfig.check.json` extends it with `noEmit` and includes tests — that is what
`npm run typecheck` and ESLint use, so tests are fully type-checked too.

---

## Export strategy

- **Named exports everywhere.** Named exports give working find-usages, safe renames,
  and reliable dead-code detection — defaults do not.
- **Default exports are banned in `src/**`** (`import-x/no-default-export`). The only
  exception is config files (`*.config.ts`, `eslint.config.js`), whose tooling
  requires a default export. This is a CLI with no React lazy routes, so there is no
  code-splitting exception to make.
- **One primary symbol per file**; keep files small with clear ownership.

---

## Layering

Leaf → top, enforced by `import-x/no-restricted-paths`:

```
core/  →  tasks/  →  planner/ , scheduler/  →  workers/  →  commands/ , cli.ts
(pure)    (model)     (domain logic)            (side-effects:  (entry / orchestration)
                                                 SDK + env)
```

Forbidden imports (build fails):
- `core/` must not import from `commands`, `planner`, `scheduler`, `workers`,
  `reports`, or `cli` — it is a pure, dependency-light leaf.
- `tasks/` must not import from `commands`, `workers`, or `cli`.
- `planner/` and `scheduler/` must not import from `commands` or `cli`.
- Only `commands/` may import the side-effectful `workers/` layer.

Domain logic should be deterministic and pure; shared utilities side-effect-light; no
hidden global mutable state.

---

## Boundary validation

The codebase already validated frontmatter and the task store with Zod. We closed the
remaining gap — **environment variables** — in `src/config/env.ts`:

- `loadEnv()` parses the KOS-relevant env once through a Zod schema and returns a typed
  `KosEnv`. Values are lowercased before validation (preserving the previous
  case-insensitive behaviour) and an invalid value **fails fast** instead of silently
  degrading.
- `src/workers/claude.ts` consumes `loadEnv()` instead of poking at `process.env`.

Every external boundary must follow this pattern: API responses, file/JSON payloads,
CLI args, and third-party SDK output get validated/narrowed at the edge; internal code
consumes typed data, never raw `unknown` JSON. The Claude Agent SDK is dynamically
imported and untyped, so `claude.ts` describes the message shape it consumes via a
minimal local interface and narrows each message defensively (`isTextBlock`,
`errorMessage`) — no `any`.

---

## How to fix common violations

| Symptom | Wrong fix | Right fix |
| --- | --- | --- |
| `Object is possibly 'undefined'` (index access) | `arr[i]!` | `const x = arr[i]; if (x === undefined) continue;` or `arr[i] ?? fallback` |
| `'x' is not assignable … exactOptionalPropertyTypes` | widen everything to `\| undefined` | omit the key when absent: `...(v !== undefined ? { v } : {})` |
| `Property 'X' comes from an index signature` | `(obj as any).X` | `obj["X"]` (or route through a typed schema) |
| `must be imported using a type-only import` | — | `import type { T }` / `import { type T, value }` (auto-fixed by `eslint --fix`) |
| Nullable boolean in `if` | `if (!opts.flag)` | `if (opts.flag !== true)` — be explicit about the nullish case |
| `unknown` in `catch` | `catch (e: any)` | `catch (e) { … e instanceof Error ? e.message : String(e) }` |
| Untyped third-party payload | `data as Whatever` | parse with a Zod schema / narrow with a type guard |

---

## Accepted exceptions

- **Config files** (`*.config.ts`, `eslint.config.js`) may use a default export.
- **Tests** (`src/tests/**`) relax `no-non-null-assertion` and the `no-unsafe-*`
  rules — test fixtures legitimately poke at internals. All other rules apply.
- **`ts-expect-error`** is allowed only with a ≥10-character description.

---

## Dead-code policy (knip)

`npm run check` runs `knip` enforcing the **high-signal** checks: unused files and
unused / unlisted dependencies. These rarely false-positive. (Removing this hardening
already deleted the unused `yaml` dependency.)

**Export-surface hygiene is reported, not enforced.** Run `npm run knip:exports` to see
exported symbols that no other module imports. We deliberately do *not* fail the build
on these: in active development you routinely export a helper before its consumer is
wired, and failing CI on that is exactly the kind of noisy rule that blocks normal work.
Treat the report as a backlog — prefer dropping the `export` keyword on symbols only
used within their own file, or deleting genuinely dead ones.

The initial backlog (29 symbols) has been cleared: 28 were used only within their own
file and had their `export` keyword dropped (a now-private symbol that is *truly* dead is
then caught by ESLint `no-unused-vars`, so this is self-policing), and one genuinely dead
Zod schema (`FrontmatterSchema`, never wired up) was deleted along with its `z` import.
`npm run knip:exports` is currently clean.

---

## Before / after

| Category | Before | After |
| --- | --- | --- |
| `tsc` strict-flag errors (`src`) | 47 | **0** |
| `tsc` strict-flag errors (incl. tests) | 61 | **0** |
| ESLint type-only-import violations | 34 | **0** (auto-fixed) |
| ESLint safety findings (unsafe/any/nullable-bool/etc.) | 14 | **0** |
| knip unused dependencies | 1 (`yaml`) | **0** (removed) |
| knip unused files | 0 | 0 |
| knip over-exported / dead symbols | 29 | **0** (28 unexported, 1 deleted) |
| `npm run check` | n/a (no lint/CI existed) | **green** |

All fixes were real narrowings, guards, schema validation, and typed boundaries — **no
`as any`, `as unknown as`, or non-null assertions were introduced**, and no test
assertions were weakened.

### Remaining violations

None. `npm run check` is green and `npm run knip:exports` reports no over-exported or dead
symbols. Full strictness was achieved without weakening any rule or test.
