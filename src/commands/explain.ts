/**
 * `kos explain <vaultPath>` — read-only. Explains why the score is what it is,
 * what is blocking progress, and what the Scheduler would do next.
 *
 * This command writes nothing. It aggregates the read-only Compiler (score +
 * analysis), the Planner (task graph), and the Scheduler (next task + plan).
 */
import { compileVault } from "../core/compiler.js";
import { loadTasks } from "../tasks/task-store.js";
import { buildTaskGraph } from "../planner/planner.js";
import { executionPlan, selectNextTask } from "../scheduler/scheduler.js";
import { CompilerIssue } from "../core/issues.js";
import { KosTask } from "../tasks/task-model.js";

function countByRule(issues: CompilerIssue[]): string {
  const m = new Map<string, number>();
  for (const i of issues) m.set(i.ruleId, (m.get(i.ruleId) ?? 0) + 1);
  const sorted = [...m.entries()].sort((a, b) => b[1] - a[1]);
  return sorted.length === 0
    ? "  (none)"
    : sorted.map(([rule, n]) => `  ${rule}: ${n}`).join("\n");
}

function countByType(tasks: KosTask[]): string {
  const open = tasks.filter(
    (t) => t.status === "open" || t.status === "in_progress",
  );
  if (open.length === 0) return "  (no open work)";
  const m = new Map<string, number>();
  for (const t of open) m.set(t.type, (m.get(t.type) ?? 0) + 1);
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, n]) => `  ${type}: ${n}`)
    .join("\n");
}

export async function explainVault(vaultPath: string): Promise<number> {
  const result = await compileVault(vaultPath);
  const tasks = await loadTasks(vaultPath);
  const b = result.scoreBreakdown;
  const graph = buildTaskGraph(tasks);
  const plan = executionPlan(tasks);
  const next = selectNextTask(tasks);

  const out: string[] = [];
  out.push(`KOS — explain (${vaultPath})`);
  out.push("");
  out.push("## Score");
  out.push(`Overall: ${b.score}/100`);
  out.push(
    `  Quality  ${b.quality}/100  — from ${b.errors} error(s), ${b.warnings} warning(s)`,
  );
  out.push(
    `  Coverage ${b.coverage}%   — ${b.layersCovered}/${b.layersTotal} knowledge layers have a real document`,
  );
  out.push("");
  out.push("### Why (top error rules)");
  out.push(countByRule(result.errors));
  out.push("### Why (top warning rules)");
  out.push(countByRule(result.warnings));
  out.push("");

  out.push("## Missing knowledge layers");
  out.push(
    result.analysis.missingLayers.length === 0
      ? "  (every layer covered)"
      : result.analysis.missingLayers.map((l) => `  - ${l}`).join("\n"),
  );
  out.push("");

  out.push("## Next recommended task");
  out.push(
    next
      ? `  ${next.id} [${next.priority}] ${next.type} — ${next.goal}`
      : "  (no actionable task — all blocked or complete)",
  );
  out.push("");

  out.push("## Blockers");
  out.push(
    plan.blocked.length === 0
      ? "  (nothing blocked)"
      : plan.blocked
          .map(
            (x) =>
              `  - ${x.task.id} ${x.task.type} — waiting on ${
                x.missing.join(", ") || "(unresolvable dependency)"
              }`,
          )
          .join("\n"),
  );
  out.push("");

  out.push("## Dependency graph");
  if (graph.tasks.length === 0) {
    out.push("  (no tasks)");
  } else {
    for (const t of graph.tasks) {
      const deps = t.dependencies.join(", ") || "—";
      const blocks = (graph.blocks[t.id] ?? []).join(", ") || "—";
      out.push(`  ${t.id} (${t.status})  depends on: ${deps}  | blocks: ${blocks}`);
    }
  }
  out.push("");

  out.push("## Remaining work (open tasks by type)");
  out.push(countByType(tasks));

  console.log(out.join("\n"));
  return 0;
}

export async function runExplainCommand(vaultPath: string): Promise<number> {
  return explainVault(vaultPath);
}
