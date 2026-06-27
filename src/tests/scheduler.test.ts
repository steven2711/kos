import { describe, it, expect } from "vitest";
import {
  selectNextTask,
  sortByPriority,
  executionPlan,
} from "../scheduler/scheduler.js";
import { mergeTasks, updateTask } from "../tasks/task-store.js";
import { type KosTask, type TaskSpec } from "../tasks/task-model.js";

const spec = (over: Partial<TaskSpec> = {}): TaskSpec => ({
  type: "domain_modeling",
  status: "open",
  priority: "medium",
  goal: "model something",
  inputs: [],
  expectedOutputs: [],
  acceptanceCriteria: [],
  dependencies: [],
  ...over,
});

describe("scheduler", () => {
  it("selects the highest-priority open task whose deps are complete", () => {
    const now = "t";
    let tasks: KosTask[] = mergeTasks(
      [],
      [
        spec({ priority: "low", goal: "a" }),
        spec({ priority: "critical", goal: "b" }),
        spec({ priority: "high", goal: "c" }),
      ],
      now,
    );
    expect(selectNextTask(tasks)!.goal).toBe("b");

    // A critical task blocked by an incomplete dep is skipped.
    tasks = mergeTasks(
      [],
      [
        spec({ priority: "high", goal: "ready" }),
        spec({ priority: "critical", goal: "blocked", dependencies: ["T-999"] }),
      ],
      now,
    );
    expect(selectNextTask(tasks)!.goal).toBe("ready");
  });

  it("sorts by priority then creation order", () => {
    const tasks = mergeTasks(
      [],
      [
        spec({ priority: "medium", goal: "m" }),
        spec({ priority: "critical", goal: "c" }),
      ],
      "t",
    );
    expect(sortByPriority(tasks)[0]?.priority).toBe("critical");
  });

  it("orders the execution plan and reports blocked tasks", () => {
    // T-001 root; T-002 depends on T-001; T-003 depends on a missing id.
    let tasks = mergeTasks(
      [],
      [
        spec({ priority: "critical", goal: "root" }),
        spec({ priority: "high", goal: "dependent" }),
        spec({ priority: "high", goal: "stuck" }),
      ],
      "t",
    );
    tasks = updateTask(tasks, "T-002", { dependencies: ["T-001"] }, "t");
    tasks = updateTask(tasks, "T-003", { dependencies: ["T-404"] }, "t");

    const plan = executionPlan(tasks);
    expect(plan.sequence.map((t) => t.id)).toEqual(["T-001", "T-002"]);
    expect(plan.blocked).toHaveLength(1);
    expect(plan.blocked[0]?.task.id).toBe("T-003");
    expect(plan.blocked[0]?.missing).toEqual(["T-404"]);
  });

  it("treats completed dependencies as satisfied", () => {
    let tasks = mergeTasks(
      [],
      [spec({ goal: "done" }), spec({ goal: "next", dependencies: ["T-001"] })],
      "t",
    );
    tasks = updateTask(tasks, "T-001", { status: "complete" }, "t");
    expect(selectNextTask(tasks)!.id).toBe("T-002");
    expect(executionPlan(tasks).sequence.map((t) => t.id)).toEqual(["T-002"]);
  });
});
