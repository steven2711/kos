import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  loadVault,
  snapshotKernel,
  KNOWLEDGE_LAYERS,
} from "../core/vault.js";
import { compileDocs } from "../core/compiler.js";
import { runRunCommand } from "../commands/run.js";
import { loadTasks } from "../tasks/task-store.js";
import { MockWorker, type WorkerRequest } from "../workers/claude.js";
import { markdownDoc, kosTask } from "./support/builders.js";
import {
  makeTempVault,
  removeTempVault,
  writeVaultFile,
} from "./support/tmp-vault.js";
import { silenceLoopNarration } from "./support/silence-console.js";

silenceLoopNarration();

let dir: string;

/** Write a vault-relative file into the current temp vault. */
async function write(rel: string, content: string): Promise<void> {
  await writeVaultFile(dir, rel, content);
}

/** Stub link targets used so wikilinks resolve. */
async function writeStubTargets(names: { rel: string }[]): Promise<void> {
  for (const n of names) {
    await write(n.rel, markdownDoc({ links: ["Home", "Home", "Home", "Home", "Home"] }));
  }
}

beforeEach(async () => {
  dir = await makeTempVault("kos-compile-");
});
afterEach(async () => {
  await removeTempVault(dir);
});

describe("compiler", () => {
  it("flags a broken document and passes a good one", async () => {
    await write("Home.md", "# Home\n\nLinks: [[Good]] [[Broken]]\n");
    await write("01 Kernel/Constitution.md", "# Constitution\n\nstub\n");
    await write("01 Kernel/Glossary.md", "# Glossary\n\nstub\n");
    await write("04 Domain/Domain Map.md", "# Domain Map\n\nstub\n");
    await write(
      "04 Domain/Good.md",
      markdownDoc({ links: ["Home", "Broken", "Domain Map", "Constitution", "Glossary"] }),
    );
    // Broken: missing sections, a broken link, and too few links.
    await write(
      "05 Architecture/Broken.md",
      `---
type: specification
status: draft
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [t]
parents: []
children: []
related: []
---

# Broken

Only one link [[Does Not Exist]].
`,
    );

    const docs = await loadVault(dir);
    const result = compileDocs(docs);

    const ruleAt = (rule: string, p: string) =>
      [...result.errors, ...result.warnings].some(
        (i) => i.ruleId === rule && i.path === p,
      );

    expect(ruleAt("LNK-003", "05 Architecture/Broken.md")).toBe(true);
    expect(ruleAt("SEC-001", "05 Architecture/Broken.md")).toBe(true);
    expect(ruleAt("LNK-001", "05 Architecture/Broken.md")).toBe(true);

    // Good.md produces no ERROR of its own.
    expect(result.errors.some((e) => e.path === "04 Domain/Good.md")).toBe(false);

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    // 05 Architecture has only the broken (non-counting is irrelevant) doc; at
    // least one knowledge layer (04 Domain) is covered.
    expect(result.analysis.coverage.covered).toBeGreaterThanOrEqual(1);
  });

  it("runs one controlled iteration to completion and never touches the Kernel", async () => {
    // Link targets the MockAgent's generated doc references.
    await write("Home.md", "# Home\n\nstub\n");
    await writeStubTargets([
      { rel: "01 Kernel/Constitution.md" },
      { rel: "01 Kernel/Knowledge Modeling Guide.md" },
      { rel: "01 Kernel/Linking Standards.md" },
      { rel: "01 Kernel/Frontmatter Specification.md" },
      { rel: "04 Domain/Domain Map.md" },
      { rel: "04 Domain/Knowledge Graph.md" },
    ]);

    const kernelBefore = await snapshotKernel(dir);

    const code = await runRunCommand(dir, {
      maxIterations: 1,
      worker: new MockWorker(),
    });
    expect(code).toBe(0);

    const tasks = await loadTasks(dir);
    const completed = tasks.filter((t) => t.status === "complete");
    expect(completed.length).toBe(1);

    // The mock created exactly one new document, in the selected task's layer.
    const generated: string[] = [];
    for (const layer of KNOWLEDGE_LAYERS) {
      const files = await fs.readdir(path.join(dir, layer)).catch(() => []);
      generated.push(...files.filter((f) => f.startsWith("Generated ")));
    }
    expect(generated).toHaveLength(1);

    // Kernel is byte-for-byte unchanged.
    const kernelAfter = await snapshotKernel(dir);
    expect([...kernelAfter.entries()]).toEqual([...kernelBefore.entries()]);
  });

  it("the offline mock worker writes a validator-passing doc in a sparse vault", async () => {
    // No scaffolding beyond Home — the mock must still produce a doc whose
    // links all resolve, in the layer matching the task type.
    await write("Home.md", markdownDoc({ title: "Home" }));
    const req: WorkerRequest = {
      vaultPath: dir,
      systemPrompt: "",
      prompt: "",
      allowedTools: [],
      maxTurns: 1,
      model: "mock",
      task: kosTask({ type: "vision_expansion", goal: "fill the vision layer" }),
    };

    const result = await new MockWorker().runTask(req);
    expect(result.success).toBe(true);

    const { analysis } = compileDocs(await loadVault(dir));
    expect(analysis.brokenLinks).toEqual([]); // every generated link resolves
    const vision = await fs.readdir(path.join(dir, "02 Vision"));
    expect(vision.some((f) => f.startsWith("Generated "))).toBe(true);
  });
});
