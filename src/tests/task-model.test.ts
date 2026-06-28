import { describe, it, expect } from "vitest";
import { nextTaskId, taskKey } from "../tasks/task-model.js";
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
