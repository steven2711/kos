/**
 * The Scheduler answers "what should happen next?".
 *
 * It resolves dependencies and priority to choose the next executable task and
 * to produce a forward-looking execution plan. The Scheduler never creates tasks
 * and never validates work.
 */
import { KosTask, PRIORITY_RANK } from "../tasks/task-model.js";

/** Order tasks by priority (desc) then creation order (asc). */
export function sortByPriority(tasks: KosTask[]): KosTask[] {
  return [...tasks].sort((a, b) => {
    const pr = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    if (pr !== 0) return pr;
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
  });
}

/**
 * Select the next actionable task: highest priority `open` task whose
 * dependencies are all `complete`. Returns null if none.
 */
export function selectNextTask(tasks: KosTask[]): KosTask | null {
  const completeIds = new Set(
    tasks.filter((t) => t.status === "complete").map((t) => t.id),
  );
  const candidates = sortByPriority(
    tasks.filter(
      (t) =>
        t.status === "open" &&
        t.dependencies.every((d) => completeIds.has(d)),
    ),
  );
  return candidates[0] ?? null;
}

/** An open task that cannot run yet, with the dependency ids it is waiting on. */
export interface BlockedTask {
  task: KosTask;
  missing: string[];
}

/** The forward-looking plan: the order work would run, plus what is blocked. */
export interface ExecutionPlan {
  /** Open/in-progress tasks in the order they would execute as deps clear. */
  sequence: KosTask[];
  /** Open tasks waiting on incomplete dependencies. */
  blocked: BlockedTask[];
}

/**
 * Compute the execution plan. Tasks already `complete` satisfy dependencies;
 * the sequence is built greedily (highest priority first) over tasks whose deps
 * are complete or already earlier in the sequence. Anything left waiting on a
 * dependency that is not complete and not schedulable is reported as blocked.
 */
export function executionPlan(tasks: KosTask[]): ExecutionPlan {
  const completeIds = new Set(
    tasks.filter((t) => t.status === "complete").map((t) => t.id),
  );
  const pending = sortByPriority(
    tasks.filter((t) => t.status === "open" || t.status === "in_progress"),
  );

  const satisfied = new Set(completeIds);
  const sequence: KosTask[] = [];
  let remaining = [...pending];
  // Greedily emit any task whose deps are satisfied; repeat until stable.
  for (;;) {
    const ready = remaining.find((t) =>
      t.dependencies.every((d) => satisfied.has(d)),
    );
    if (!ready) break;
    sequence.push(ready);
    satisfied.add(ready.id);
    remaining = remaining.filter((t) => t.id !== ready.id);
  }

  const blocked: BlockedTask[] = remaining.map((task) => ({
    task,
    missing: task.dependencies.filter((d) => !satisfied.has(d)),
  }));

  return { sequence, blocked };
}
