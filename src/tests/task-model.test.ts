import { describe, it, expect } from "vitest";
import {
  nextTaskId,
  taskKey,
  isResearchType,
  isPromotionType,
} from "../tasks/task-model.js";
import { kosTask } from "./support/builders.js";

describe("nextTaskId", () => {
  it("starts at T-001 when there are no tasks", () => {
    expect(nextTaskId([])).toBe("T-001");
  });

  it("increments from the highest existing id, not the count", () => {
    const tasks = [kosTask({ id: "T-001" }), kosTask({ id: "T-005" })];
    expect(nextTaskId(tasks)).toBe("T-006");
  });

  it("ignores ids that are not in T-NNN form", () => {
    const tasks = [kosTask({ id: "TMP-0" }), kosTask({ id: "bad" }), kosTask({ id: "T-x" })];
    expect(nextTaskId(tasks)).toBe("T-001");
  });

  it("zero-pads to three digits and grows past 999", () => {
    expect(nextTaskId([kosTask({ id: "T-008" })])).toBe("T-009");
    expect(nextTaskId([kosTask({ id: "T-999" })])).toBe("T-1000");
  });
});

describe("taskKey", () => {
  it("keys on type and a normalised goal", () => {
    expect(taskKey({ type: "domain_modeling", goal: "Model the graph" })).toBe(
      "domain_modeling::model the graph",
    );
  });

  it("collapses case and surrounding whitespace so duplicates dedupe", () => {
    const a = taskKey({ type: "domain_modeling", goal: "Model X" });
    const b = taskKey({ type: "domain_modeling", goal: "  model x  " });
    expect(a).toBe(b);
  });

  it("distinguishes the same goal under different task types", () => {
    const domain = taskKey({ type: "domain_modeling", goal: "same goal" });
    const vision = taskKey({ type: "vision_expansion", goal: "same goal" });
    expect(domain).not.toBe(vision);
  });
});

describe("isResearchType", () => {
  it("is true for every research task type", () => {
    for (const t of [
      "research",
      "competitor_research",
      "technical_research",
      "market_research",
      "legal_research",
    ] as const) {
      expect(isResearchType(t)).toBe(true);
    }
  });

  it("is false for non-research work the generic worker handles", () => {
    expect(isResearchType("domain_modeling")).toBe(false);
    expect(isResearchType("founder_interview")).toBe(false);
    // architecture_research/business_research are documentation tasks, not the
    // external-evidence research the Research Worker owns.
    expect(isResearchType("architecture_research")).toBe(false);
    expect(isResearchType("business_research")).toBe(false);
    // A promotion task is not research.
    expect(isResearchType("knowledge_proposal")).toBe(false);
  });
});

describe("isPromotionType", () => {
  it("is true only for knowledge_proposal", () => {
    expect(isPromotionType("knowledge_proposal")).toBe(true);
    expect(isPromotionType("research")).toBe(false);
    expect(isPromotionType("domain_modeling")).toBe(false);
    expect(isPromotionType("founder_interview")).toBe(false);
  });
});
