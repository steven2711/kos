import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  loadTasks,
  saveTasks,
  mergeTasks,
  updateTask,
  renderOpenTaskQueue,
} from "../tasks/task-store.js";
import { TaskSpec } from "../tasks/task-model.js";

let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "kos-store-"));
  await fs.mkdir(path.join(dir, "90 Meta"), { recursive: true });
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

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

describe("task-store", () => {
  it("returns [] when no task file exists", async () => {
    expect(await loadTasks(dir)).toEqual([]);
  });

  it("round-trips tasks through save/load with zod validation", async () => {
    const tasks = mergeTasks([], [spec()], "2026-06-25T00:00:00.000Z");
    await saveTasks(dir, tasks);
    const loaded = await loadTasks(dir);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("T-001");
    expect(loaded[0].goal).toBe("model something");
  });

  it("rejects a corrupt task file", async () => {
    await fs.writeFile(
      path.join(dir, "90 Meta", "tasks.json"),
      JSON.stringify({ version: 1, tasks: [{ id: "bad" }] }),
    );
    await expect(loadTasks(dir)).rejects.toBeTruthy();
  });

  it("dedupes on merge by type+goal and assigns sequential ids", () => {
    const first = mergeTasks([], [spec()], "t1");
    const again = mergeTasks(first, [spec(), spec({ goal: "new goal" })], "t2");
    expect(again).toHaveLength(2);
    expect(again.map((t) => t.id)).toEqual(["T-001", "T-002"]);
  });

  it("never resurrects a completed task", () => {
    let tasks = mergeTasks([], [spec()], "t1");
    tasks = updateTask(tasks, "T-001", { status: "complete" }, "t2");
    const after = mergeTasks(tasks, [spec()], "t3");
    expect(after).toHaveLength(1);
    expect(after[0].status).toBe("complete");
  });

  it("renders an open-task queue table", () => {
    const tasks = mergeTasks([], [spec({ goal: "render me" })], "t");
    const md = renderOpenTaskQueue(tasks, "2026-06-25");
    expect(md).toContain("# Open Task Queue");
    expect(md).toContain("render me");
  });
});
