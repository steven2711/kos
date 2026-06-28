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
    expect((graph.blocks["T-001"] ?? []).sort()).toEqual(["T-002", "T-003"]);
    expect((graph.blocks["T-003"] ?? []).sort()).toEqual(["T-004", "T-005"]);
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

  it("asks the founder for product intent once domain substance exists", () => {
    const analysis: VaultAnalysis = {
      missingLayers: ["03 Product", "06 Decisions"], // 04 Domain present
      openQuestions: [],
      brokenLinks: [],
      orphans: [],
      coverage: { covered: 1, total: 8, perLayer: {} },
    };
    const founder = deriveCompilerTasks(analysis).filter(
      (t) => t.type === "founder_interview",
    );
    // Product-intent and architecture-preference interviews, each with questions.
    expect(founder.length).toBeGreaterThanOrEqual(1);
    expect(
      founder.some((t) => /product intent/i.test(t.goal)),
    ).toBe(true);
    for (const t of founder) {
      expect((t.questions ?? []).length).toBeGreaterThan(0);
    }
  });

  it("never interviews the founder about an empty vault with no layers yet", () => {
    const analysis: VaultAnalysis = {
      missingLayers: [
        "02 Vision",
        "03 Product",
        "04 Domain",
        "05 Architecture",
        "06 Decisions",
        "07 Research",
        "08 Business",
        "09 Roadmap",
      ],
      openQuestions: [],
      brokenLinks: [],
      orphans: [],
      coverage: { covered: 0, total: 8, perLayer: {} },
    };
    const founder = deriveCompilerTasks(analysis).filter(
      (t) => t.type === "founder_interview",
    );
    expect(founder).toHaveLength(0);
  });

  it("turns strategic open questions into a founder interview", () => {
    const analysis: VaultAnalysis = {
      missingLayers: ["02 Vision"],
      openQuestions: [
        { text: "What is our pricing strategy?", path: "08 Business/Map.md" },
        { text: "How is the build script structured?", path: "04 Domain/X.md" },
      ],
      brokenLinks: [],
      orphans: [],
      coverage: { covered: 7, total: 8, perLayer: {} },
    };
    const founder = deriveCompilerTasks(analysis).filter(
      (t) => t.type === "founder_interview",
    );
    const strategic = founder.find((t) => /strategic open questions/i.test(t.goal));
    expect(strategic).toBeDefined();
    // Only the strategy question is surfaced; the build-script one is not founder work.
    expect(strategic?.questions?.some((q) => /pricing strategy/i.test(q))).toBe(true);
    expect(strategic?.questions?.some((q) => /build script/i.test(q))).toBe(false);
  });

  it("compiler no longer returns tasks (read-only)", () => {
    const result = compileDocs([]);
    expect("tasks" in result).toBe(false);
    expect(result.analysis).toBeDefined();
    expect(typeof result.score).toBe("number");
  });
});
