import { describe, it, expect } from "vitest";
import { renderResearchReport } from "../reports/research-report.js";
import { kosTask, researchTask } from "./support/builders.js";

describe("renderResearchReport", () => {
  it("groups the research lifecycle by task status", () => {
    const tasks = [
      researchTask({ id: "T-001", status: "complete", goal: "done research" }),
      researchTask({ id: "T-002", status: "failed", goal: "bad research" }),
      researchTask({ id: "T-003", status: "open", goal: "todo research" }),
      kosTask({
        id: "T-004",
        type: "founder_interview",
        origin: "research",
        status: "open",
        goal: "interpret the findings",
      }),
    ];

    const md = renderResearchReport({
      tasks,
      createdDocs: ["07 Research/2026-06-27 - Research T-001.md"],
      now: "2026-06-27",
    });

    expect(md).toContain("# Research Report");
    expect(md).toContain("done research"); // completed
    expect(md).toContain("bad research"); // failed
    expect(md).toContain("todo research"); // gap
    expect(md).toContain("interpret the findings"); // follow-up (non-research)
    expect(md).toContain("07 Research/2026-06-27 - Research T-001.md"); // created doc
  });

  it("states clearly when nothing has been researched", () => {
    const md = renderResearchReport({ tasks: [], createdDocs: [], now: "d" });
    expect(md).toContain("No research documents created");
    expect(md).toContain("No open research tasks");
  });
});
