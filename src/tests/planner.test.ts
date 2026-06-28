import { describe, it, expect } from "vitest";
import {
  seedIngestTasks,
  deriveCompilerTasks,
  deriveSemanticTasks,
  inferDependencies,
  buildTaskGraph,
} from "../planner/planner.js";
import { mergeTasks } from "../tasks/task-store.js";
import { selectNextTask } from "../scheduler/scheduler.js";
import { compileDocs } from "../core/compiler.js";
import type { VaultAnalysis } from "../core/compiler.js";
import { semanticReview, semanticFinding, kosTask } from "./support/builders.js";

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

  it("seeds one task set carrying every inbox doc as inputs", () => {
    const docs = ["00 Inbox/thesis.md", "00 Inbox/research.md"];
    const seeds = seedIngestTasks(docs);
    // Generic goals mean the set is seeded once regardless of doc count...
    expect(seeds.length).toBeGreaterThan(0);
    // ...and every seed carries all the dropped docs for the worker to read.
    for (const s of seeds) expect(s.inputs).toEqual(docs);
    // The single-string form (one-file `ingest`) still works.
    expect(seedIngestTasks("00 Inbox/x.md")[0]?.inputs).toEqual(["00 Inbox/x.md"]);
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

  it("turns a possible contradiction into a low-priority founder interview", () => {
    const review = semanticReview([
      semanticFinding({
        class: "possible_contradiction",
        confidence: "low",
        title: "Event sourcing vs CRUD MVP",
        supportingDocuments: ["05 Architecture/Spec.md", "03 Product/PRD.md"],
      }),
    ]);
    const tasks = deriveSemanticTasks(review);
    expect(tasks).toHaveLength(1);
    const t = tasks[0];
    expect(t?.type).toBe("founder_interview");
    expect(t?.priority).toBe("low");
    expect(t?.origin).toBe("semantic");
    // The founder is asked, never assumed for; the contradiction is the question.
    expect((t?.questions ?? []).length).toBeGreaterThan(0);
  });

  it("routes a confident recommendation to a research task by cited layer", () => {
    const review = semanticReview([
      semanticFinding({
        class: "recommendation",
        confidence: "high",
        supportingDocuments: ["05 Architecture/Spec.md"],
        recommendedAction: "Investigate the scaling approach.",
      }),
    ]);
    const tasks = deriveSemanticTasks(review);
    expect(tasks[0]?.type).toBe("architecture_research");
    expect(tasks[0]?.priority).toBe("low");
    expect(tasks[0]?.acceptanceCriteria).toContain("Investigate the scaling approach.");
  });

  it("routes a recommendation about competitors to a competitor_research task", () => {
    const review = semanticReview([
      semanticFinding({
        class: "recommendation",
        confidence: "high",
        title: "Map the competitor landscape",
        reasoning: "No competitive analysis exists for the product.",
        supportingDocuments: ["08 Business/Map.md"],
        recommendedAction: "Research direct competitors and their positioning.",
      }),
    ]);
    const tasks = deriveSemanticTasks(review);
    expect(tasks[0]?.type).toBe("competitor_research");
    expect(tasks[0]?.priority).toBe("low");
    expect(tasks[0]?.origin).toBe("semantic");
  });

  it("routes a recommendation about legal/regulatory uncertainty to legal_research", () => {
    const review = semanticReview([
      semanticFinding({
        class: "recommendation",
        confidence: "medium",
        title: "Clarify data-privacy compliance",
        reasoning: "Regulatory exposure under GDPR is unclear.",
        supportingDocuments: ["02 Vision/Vision.md"],
        recommendedAction: "Research the applicable privacy regulations.",
      }),
    ]);
    expect(deriveSemanticTasks(review)[0]?.type).toBe("legal_research");
  });

  it("routes a recommendation to promote a finding into a knowledge_proposal task", () => {
    const review = semanticReview([
      semanticFinding({
        class: "recommendation",
        confidence: "high",
        title: "Promote the pricing model to canonical",
        reasoning: "The evidence consistently supports usage-based pricing.",
        supportingDocuments: ["04 Domain/Pricing.md"],
        recommendedAction: "Adopt this as canonical knowledge.",
      }),
    ]);
    const t = deriveSemanticTasks(review)[0];
    expect(t?.type).toBe("knowledge_proposal");
    expect(t?.priority).toBe("low");
    expect(t?.origin).toBe("semantic");
    // It carries the provenance a proposal needs.
    expect(t?.claim).toBe("Promote the pricing model to canonical");
    expect(t?.targetDocument).toBe("04 Domain/Pricing.md");
    expect(t?.confidence).toBe("high");
  });

  it("leaves suggestions and low-confidence findings as report-only (no task)", () => {
    const review = semanticReview([
      semanticFinding({ class: "suggestion", confidence: "high" }),
      semanticFinding({ class: "observation", confidence: "medium" }),
      semanticFinding({ class: "recommendation", confidence: "low" }),
    ]);
    expect(deriveSemanticTasks(review)).toHaveLength(0);
  });

  it("never lets advisory semantic work outrank required compiler work", () => {
    const required = kosTask({
      id: "T-001",
      type: "adr_creation",
      priority: "medium",
      origin: "compiler",
    });
    const advisory = kosTask({
      id: "T-002",
      type: "documentation_repair",
      priority: "low",
      goal: "advisory",
      origin: "semantic",
    });
    expect(selectNextTask([advisory, required])?.id).toBe("T-001");
  });

  it("compiler no longer returns tasks (read-only)", () => {
    const result = compileDocs([]);
    expect("tasks" in result).toBe(false);
    expect(result.analysis).toBeDefined();
    expect(typeof result.score).toBe("number");
  });
});
