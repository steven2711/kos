import { describe, it, expect } from "vitest";
import {
  seedIngestTasks,
  deriveCompilerTasks,
  inferDependencies,
  buildTaskGraph,
} from "../planner/planner.js";
import { mergeTasks } from "../tasks/task-store.js";
import { compileDocs } from "../core/compiler.js";
import type { VaultAnalysis } from "../core/compiler.js";

function byId<T extends { id: string }>(items: T[], id: string): T {
  const found = items.find((i) => i.id === id);
  if (!found) throw new Error(`no item ${id}`);
  return found;
}

describe("planner", () => {
  it("infers dependencies from task types as an acyclic graph", () => {
    const tasks = inferDependencies(
      mergeTasks([], seedIngestTasks("00 Inbox/x.md"), "t"),
    );
    // T-001 concept_extraction, T-002 vision, T-003 domain, T-004/5 arch, T-006 biz.
    expect(byId(tasks, "T-001").dependencies).toEqual([]); // concept root
    expect(byId(tasks, "T-002").dependencies).toEqual(["T-001"]); // vision <- concept
    expect(byId(tasks, "T-003").dependencies).toEqual(["T-001"]); // domain <- concept
    expect(byId(tasks, "T-004").dependencies).toEqual(["T-003"]); // arch <- domain
    expect(byId(tasks, "T-006").dependencies).toEqual([]); // business independent

    // No task lists itself; no self-cycles.
    for (const t of tasks) expect(t.dependencies).not.toContain(t.id);
  });

  it("is idempotent — recomputing yields the same dependencies", () => {
    const once = inferDependencies(
      mergeTasks([], seedIngestTasks("00 Inbox/x.md"), "t"),
    );
    const twice = inferDependencies(once);
    expect(twice.map((t) => t.dependencies)).toEqual(
      once.map((t) => t.dependencies),
    );
  });

  it("builds the inverse 'blocks' adjacency", () => {
    const tasks = inferDependencies(
      mergeTasks([], seedIngestTasks("00 Inbox/x.md"), "t"),
    );
    const graph = buildTaskGraph(tasks);
    expect(graph.blocks["T-001"].sort()).toEqual(["T-002", "T-003"]);
    expect(graph.blocks["T-003"].sort()).toEqual(["T-004", "T-005"]);
    expect(graph.blocks["T-006"]).toEqual([]);
  });

  it("derives tasks from a compile analysis", () => {
    const analysis: VaultAnalysis = {
      missingLayers: ["02 Vision", "06 Decisions"],
      openQuestions: [],
      brokenLinks: [{ path: "a.md", target: "Nope", line: 1 }],
      orphans: [],
      coverage: { covered: 0, total: 8, perLayer: {} },
    };
    const tasks = deriveCompilerTasks(analysis);
    const types = tasks.map((t) => t.type);
    expect(types).toContain("link_repair"); // from the broken link
    expect(types).toContain("vision_expansion"); // 02 Vision
    expect(types).toContain("adr_creation"); // 06 Decisions
  });

  it("compiler no longer returns tasks (read-only)", () => {
    const result = compileDocs([]);
    expect((result as Record<string, unknown>).tasks).toBeUndefined();
    expect(result.analysis).toBeDefined();
    expect(typeof result.score).toBe("number");
  });
});
