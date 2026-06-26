import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadVault, snapshotKernel } from "../core/vault.js";
import { compileDocs } from "../core/compiler.js";
import { runRunCommand } from "../commands/run.js";
import { loadTasks } from "../tasks/task-store.js";
import { MockAgent } from "../agents/claude.js";

let dir: string;

async function write(rel: string, content: string): Promise<void> {
  const abs = path.join(dir, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf8");
}

function doc(opts: {
  type?: string;
  links: string[];
  sections?: boolean;
}): string {
  const links = opts.links.map((l) => `- [[${l}]]`).join("\n");
  const body = opts.sections === false
    ? "# Doc\n\nNo required sections here."
    : `# Doc

## Purpose

Purpose text linking ${opts.links.map((l) => `[[${l}]]`).join(" ")}.

## Context

Context.

## Related Documents

${links}

## Open Questions

- A question?
`;
  return `---
type: ${opts.type ?? "concept"}
status: canonical
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [t]
parents: []
children: []
related: []
---

${body}`;
}

/** Stub link targets used so wikilinks resolve. */
async function writeStubTargets(names: { rel: string }[]): Promise<void> {
  for (const n of names) {
    await write(n.rel, doc({ links: ["Home", "Home", "Home", "Home", "Home"] }));
  }
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "kos-compile-"));
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("compiler", () => {
  it("flags a broken document and passes a good one", async () => {
    await write("Home.md", "# Home\n\nLinks: [[Good]] [[Broken]]\n");
    await write("01 Kernel/Constitution.md", "# Constitution\n\nstub\n");
    await write("01 Kernel/Glossary.md", "# Glossary\n\nstub\n");
    await write("04 Domain/Domain Map.md", "# Domain Map\n\nstub\n");
    await write(
      "04 Domain/Good.md",
      doc({ links: ["Home", "Broken", "Domain Map", "Constitution", "Glossary"] }),
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
      agent: new MockAgent(),
    });
    expect(code).toBe(0);

    const tasks = await loadTasks(dir);
    const completed = tasks.filter((t) => t.status === "complete");
    expect(completed.length).toBe(1);

    // The mock created exactly one new domain document.
    const domain = await fs.readdir(path.join(dir, "04 Domain"));
    expect(domain.some((f) => f.startsWith("Generated Concept"))).toBe(true);

    // Kernel is byte-for-byte unchanged.
    const kernelAfter = await snapshotKernel(dir);
    expect([...kernelAfter.entries()]).toEqual([...kernelBefore.entries()]);
  });
});
