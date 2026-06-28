import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { seedIngestTasks, inferDependencies } from "../planner/planner.js";
import { mergeTasks, saveTasks, loadTasks } from "../tasks/task-store.js";
import { type KosTask } from "../tasks/task-model.js";
import { FIXED_TIMESTAMP } from "./support/builders.js";
import { makeTempVault, removeTempVault } from "./support/tmp-vault.js";

const INBOX = "00 Inbox/idea.md";

/** Depth-first cycle check over the inferred `dependencies` edges. */
function isAcyclic(tasks: KosTask[]): boolean {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const state = new Map<string, 1 | 2>(); // 1 = on stack, 2 = done
  const visit = (id: string): boolean => {
    const s = state.get(id);
    if (s === 1) return false; // back edge => cycle
    if (s === 2) return true;
    state.set(id, 1);
    for (const dep of byId.get(id)?.dependencies ?? []) {
      if (!visit(dep)) return false;
    }
    state.set(id, 2);
    return true;
  };
  return tasks.every((t) => visit(t.id));
}

describe("seedIngestTasks", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await makeTempVault("kos-seed-");
  });
  afterEach(async () => {
    await removeTempVault(dir);
  });

  it("seeds six bootstrap tasks led by a critical concept-extraction task", () => {
    const specs = seedIngestTasks(INBOX);
    expect(specs).toHaveLength(6);
    expect(specs[0]?.type).toBe("concept_extraction");
    expect(specs[0]?.priority).toBe("critical");
  });

  it("gives every seed the ingested input and a non-empty contract", () => {
    for (const s of seedIngestTasks(INBOX)) {
      expect(s.inputs).toContain(INBOX);
      expect(s.goal.trim().length).toBeGreaterThan(0);
      expect(s.acceptanceCriteria.length).toBeGreaterThan(0);
    }
  });

  it("produces specs that satisfy the task schema on save/load", async () => {
    // saveTasks -> loadTasks runs the real TaskFileSchema (Zod) over every seed,
    // so an invalid type/status/priority would throw here.
    const tasks = mergeTasks([], seedIngestTasks(INBOX), FIXED_TIMESTAMP);
    await saveTasks(dir, tasks);
    expect(await loadTasks(dir)).toHaveLength(6);
  });

  it("infers an acyclic dependency graph referencing only real task ids", () => {
    const tasks = inferDependencies(
      mergeTasks([], seedIngestTasks(INBOX), FIXED_TIMESTAMP),
    );
    const ids = new Set(tasks.map((t) => t.id));
    for (const t of tasks) {
      for (const dep of t.dependencies) {
        expect(ids.has(dep)).toBe(true);
        expect(dep).not.toBe(t.id);
      }
    }
    expect(isAcyclic(tasks)).toBe(true);
  });
});
