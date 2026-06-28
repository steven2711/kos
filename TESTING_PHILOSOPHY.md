# Testing Philosophy

This codebase is developed in a heavily agentic workflow — many AI agents and humans edit
it in parallel. Tests exist to make that safe: they are **executable specifications** of
what `kos` guarantees, so a refactor that preserves behavior keeps the suite green, and a
change that breaks behavior fails loudly and specifically.

The goal is **maximum confidence, not maximum coverage.** Every test must earn its place by
answering one question:

> If this fails in production, what user or business behavior broke?

If the honest answer is "nothing important," the test should not exist.

> **The one command that matters:** `npm run check` (typecheck → lint → test → knip). It
> must stay green; it runs on `pre-push`. Coverage is separate and informational —
> `npm run test:coverage`.

---

## What "business behavior" means here

`kos` is a Knowledge Operating System CLI. It has no UI, no payments, no auth — so the
"pricing / money / permissions" logic other guides obsess over maps onto **these** rules,
which are exactly what the tests protect:

| Domain rule | Where | Why it's high-value |
| --- | --- | --- |
| Document validation (FM/SEC/LNK/TPL) | `core/compiler.ts`, `core/frontmatter.ts` | The contract every vault document must meet |
| Knowledge **score** formula | `core/scoring.ts` | The headline metric; must be monotonic and bounded |
| Knowledge **graph** (orphans, inbound) | `core/graph.ts` | Drives LNK-002 orphan detection and link credit |
| Task **identity & dedupe** | `tasks/task-model.ts` | A bad `nextTaskId`/`taskKey` collides or duplicates every task |
| Task **scheduling** order | `scheduler/scheduler.ts` | Picks the one task that runs next |
| Work **generation** | `planner/planner.ts` | The six seed tasks bootstrap every ingest |
| **Kernel-immutability** guard | `commands/run.ts`, `core/vault.ts` | The safety rail: agents must never edit `01 Kernel/` |
| **Boundary validation** | `config/env.ts`, `tasks/task-store.ts`, `core/frontmatter.ts` | Untyped outside data (env, JSON, YAML) parsed once, at the edge |

---

## The testing pyramid (adapted for a CLI)

There is **no React and no browser**, so the generic "Component" and browser-"E2E" tiers do
not apply. They are replaced by command-level tests that run the real CLI command functions
in-process. The pyramid is:

### 1. Unit — the majority
Pure functions and deterministic algorithms, no I/O: `nextTaskId`, `taskKey`, `computeScore`,
`buildGraph`/`inboundCount`, `checkFrontmatter`, `sortByPriority`/`selectNextTask`,
`inferDependencies`, `loadEnv`. Microseconds each, zero setup.
_Examples:_ `task-model.test.ts`, `scoring.test.ts`, `graph.test.ts`, `env.test.ts`,
`wikilinks.test.ts`, `frontmatter.test.ts`, `scheduler.test.ts`, `planner.test.ts`.

### 2. Integration — real modules + a temp filesystem
Multiple real modules wired together, exercising actual file I/O against an isolated
`mkdtemp` vault. Persistence round-trips, vault discovery/classification, the kernel diff,
and the compiler over real files.
_Examples:_ `task-store.test.ts`, `vault.test.ts`, `compiler.test.ts`, `planner-seed.test.ts`.

### 3. Command smoke — the controlled loop end-to-end
The smallest number of tests that drive a whole command (`runRunCommand`) through one
iteration: select → dispatch → guard → re-validate. Critical paths only (kernel guard,
validation-regression). No duplication of what the lower tiers already prove.
_Examples:_ `compiler.test.ts` (happy path), `run-guard.test.ts` (the two failure rails).

---

## Mocking philosophy

A mock isolates our code from the **outside world** — never from itself.

### The one legitimate boundary
The only thing outside the process is the **Claude Agent SDK** (network, non-determinism,
auth). It is faked by a `Worker` implementation:

- `MockWorker` (`workers/claude.ts`) — writes a deterministic, validator-passing document so
  `kos run` works offline. This is the canonical boundary fake.
- Tests may supply their own tiny `Worker` (see `run-guard.test.ts`'s `KernelMutatingWorker`
  and `RegressingWorker`) to drive a specific loop outcome. These stand in for the SDK; they
  are **not** mocks of any owned logic.

`runRunCommand` accepts an injectable `worker` precisely so the boundary can be swapped
without touching anything real underneath it.

### The other controlled inputs
- **Clock:** `isoNow(clock?)` (`tasks/task-store.ts`) takes an optional clock. Pass a fixed
  one (or a fixed timestamp string into `mergeTasks`) instead of asserting on wall-clock time.
- **Dates in fixtures:** builders default to `FIXED_DATE` / `FIXED_TIMESTAMP`.

### Never mock (we own it — it's what we're validating)
`core/*` (compiler, scoring, graph, frontmatter, vault, wikilinks), `tasks/*`,
`scheduler/*`, `planner/*`. Mocking these would test the mock, not the software. The whole
existing suite follows this rule — it has **zero** `vi.mock`/`vi.fn` of internal modules.

```
runRunCommand           ✅ good: real planner + scheduler + compiler + store,
  └─ Worker (faked)             only the SDK worker is faked

runRunCommand           ❌ bad: would verify mocks, not behavior
  └─ mocked selectNextTask
  └─ mocked compileDocs
  └─ mocked task-store
```

### Never mock the system under test
If a test is about `buildGraph`, call the real `buildGraph`. Build its **inputs** with
factories; never stub the function you are asserting on.

---

## Test data: builders, not inline blobs

Shared factories live in `src/tests/support/`. Construct with valid defaults and override
**only the field under test** — the override is the test's intent made visible.

- `taskSpec(over?)` / `kosTask(over?)` — task objects with valid defaults.
- `vaultDoc(over)` — an in-memory `VaultDoc`, parsed by the **real** `parseFile`, classified
  honestly from its `relPath`. Lets graph/compiler unit tests run with no filesystem.
- `markdownDoc(opts)` — a valid frontmatter+sections markdown string, for tests that write
  real files.
- `tmp-vault.ts` — `makeTempVault` / `removeTempVault` / `writeVaultFile` / `withTempVault`
  for isolated, self-cleaning temp vaults.

Rules: no giant inline JSON, no copy-pasted fixtures, no duplicated builders. If two tests
need the same shape, it belongs in `support/`.

```ts
// good — the override is the whole point of the test
const blocked = taskSpec({ priority: "critical", dependencies: ["T-999"] });

// bad — 15 lines of noise; the reader can't tell what matters
const t = { type: "domain_modeling", status: "open", priority: "critical",
            goal: "x", inputs: [], expectedOutputs: [], /* …8 more fields… */ };
```

---

## Naming

A test name is a sentence about behavior. The reader should know what broke from the name
alone, without reading the body.

**Good (all real names from this repo):**
- `never resurrects a completed task`
- `selects the highest-priority open task whose deps are complete`
- `gives no inbound credit for a link that resolves to nothing`
- `rejects an unknown KOS_AUTH value rather than degrading silently`
- `fails the task and aborts when a worker edits the Kernel`

**Bad:** `works`, `renders`, `calls handler`, `test run`, `snapshot`.

---

## Determinism

Tests must pass identically on every machine and in any order.

- **Time:** inject `isoNow(clock)` or pass a fixed timestamp; builders use `FIXED_TIMESTAMP`.
  Never assert against `new Date()`.
- **Ids:** task ids are deterministic `T-NNN`, assigned by sequence — assert exact ids.
- **No randomness, no sleeps, no real network.** (`Math.random`/`Date.now` are banned in
  `src/**` by the strict-TS setup anyway.)
- **Isolation:** each filesystem test gets its own `mkdtemp` vault and removes it in
  `afterEach`. No shared mutable state between tests.

---

## Boundary validation — test both sides

Every external input is parsed/validated at the edge, and tested for **valid and invalid**
input:

- **Env** (`config/env.ts`) — `env.test.ts` asserts defaults, case-insensitivity, *and*
  rejection of bad enum values / empty credentials.
- **Task JSON** (`tasks/task-store.ts`) — `task-store.test.ts` round-trips valid data *and*
  asserts a corrupt file `rejects.toThrow()` (the real Zod failure, not just "truthy").
- **Frontmatter/YAML** (`core/frontmatter.ts`) — `frontmatter.test.ts` covers valid blocks
  *and* every FM/TPL rule plus malformed dates and whitespace owners.

A boundary test that only checks the happy path is half a test.

---

## Regression protocol (when fixing a bug)

1. **Reproduce** — write a test that fails for the reported reason.
2. **Red** — confirm it fails against the current code.
3. **Fix** — change the source.
4. **Green** — that test and the whole suite pass.

The failing test goes in **first**; it is the proof the bug existed and the guard that it
stays fixed.

---

## Rules for agents

Agents **may**: add tests, strengthen assertions, add regression coverage, improve naming,
remove genuine duplication, and improve determinism.

Agents **may not**:
- weaken or delete an assertion to make a build pass (fix the code, or justify in the PR);
- replace a real assertion with a snapshot;
- skip or `.only` a critical-path test to get green;
- disable ESLint or TypeScript to silence a failure;
- mock owned logic, internal services, or the system under test;
- introduce non-determinism (time, randomness, ordering, network).

If a change makes a test fail, the default assumption is the **change** is wrong, not the
test. Overriding that requires an explicit, written reason.

---

## Coverage philosophy

Coverage is a **signal, not a goal.** `npm run test:coverage` prints a v8 report (and writes
HTML to `coverage/`, which is git-ignored). It is **not** gated — there is no threshold, and
it is not part of `npm run check` or `pre-push`. This is deliberate: failing CI on a coverage
percentage rewards low-value tests written to hit a number, which is exactly the slop these
rules exist to prevent.

Use the report to find **thin spots in high-value logic**, then decide with judgment. High
value to cover: scoring, graph, compiler rules, task identity/scheduling, planner seeds,
boundary validation. Low value, fine to leave thin: the SDK worker (`claude.ts` — a boundary
we deliberately don't unit-test), report string formatting (`reports/**`), CLI wiring
(`cli.ts`), and thin command glue (`explain.ts`, `ingest.ts`).

---

## Continuous integration

`npm run check` is the gate; nothing is silently skipped. It must fail on:

- TypeScript errors (`tsc -p tsconfig.check.json`, tests included);
- ESLint errors (type-aware rules, layer-boundary checks);
- unit / integration / command-smoke test failures;
- dead code & unused dependencies (`knip`).

Enforced locally by husky: `lint-staged` on `pre-commit`, full `npm run check` on
`pre-push`. Bypassing (`--no-verify`) is for genuine emergencies only.

---

## Examples: good vs. bad

**Good — behavior, real modules, boundary-only fake, deterministic:**
```ts
it("fails the task when validation regresses, without aborting the run", async () => {
  const code = await runRunCommand(dir, {
    maxIterations: 1,
    worker: new RegressingWorker(), // boundary fake writes a doc that worsens validation
  });
  expect(code).toBe(0);                                  // run continues
  const tasks = await loadTasks(dir);
  expect(tasks.some((t) => t.status === "failed")).toBe(true);
  expect(tasks.some((t) => t.status === "complete")).toBe(false);
});
```

**Bad — asserts an implementation detail, mocks owned logic, non-deterministic:**
```ts
it("works", async () => {
  const spy = vi.spyOn(scheduler, "selectNextTask");     // ❌ mocks owned logic
  vi.spyOn(compiler, "compileDocs").mockReturnValue(/*…*/); // ❌ tests the mock
  await runRunCommand(dir, { maxIterations: 1 });
  expect(spy).toHaveBeenCalledTimes(1);                  // ❌ internal call count, not behavior
  expect(Date.now()).toBeGreaterThan(0);                 // ❌ asserts nothing; non-deterministic
});
```
