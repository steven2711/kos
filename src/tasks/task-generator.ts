/**
 * Task generation.
 *
 *  - `seedIngestTasks` produces the fixed six tasks created by `kos ingest`.
 *  - `deriveCompilerTasks` turns a compile analysis into recommended tasks
 *    (missing layers, broken links). These are recommendations with status
 *    `open`; the task store reconciles them against persisted state.
 *
 * Generated tasks here carry placeholder ids/timestamps; the store assigns real
 * ids and timestamps when persisting (see task-store.mergeTasks).
 */
import { KosTask, Priority, TaskType } from "./task-model.js";
import type { VaultAnalysis } from "../core/compiler.js";

/** A task spec before the store assigns id/timestamps. */
export type TaskSpec = Omit<KosTask, "id" | "createdAt" | "updatedAt">;

const LAYER_BY_TYPE: Partial<Record<TaskType, string>> = {
  vision_expansion: "02 Vision",
  domain_modeling: "04 Domain",
  architecture_research: "05 Architecture",
  business_research: "08 Business",
};

/** The six initial tasks seeded by ingest, in priority order. */
export function seedIngestTasks(inboxRelPath: string): TaskSpec[] {
  const inputs = [inboxRelPath];
  const mk = (
    type: TaskType,
    priority: Priority,
    goal: string,
    expectedOutputs: string[],
    acceptanceCriteria: string[],
  ): TaskSpec => ({
    type,
    status: "open",
    priority,
    goal,
    inputs,
    expectedOutputs,
    acceptanceCriteria,
    dependencies: [],
  });

  return [
    mk(
      "concept_extraction",
      "critical",
      "Extract the core concepts from the ingested input and list each as a candidate canonical concept",
      ["04 Domain/<Concept>.md (one per core concept)"],
      [
        "Each core concept named and described in one sentence",
        "No duplicates of existing canonical concepts",
        "Each new concept doc passes validation",
      ],
    ),
    mk(
      "vision_expansion",
      "high",
      "Identify missing vision documents implied by the input",
      ["02 Vision/<Vision>.md"],
      ["Gaps in the vision layer named", "Each new vision doc passes validation"],
    ),
    mk(
      "domain_modeling",
      "high",
      "Identify missing domain concepts implied by the input",
      ["04 Domain/<Concept>.md"],
      ["Missing domain concepts named", "Each new domain doc passes validation"],
    ),
    mk(
      "architecture_research",
      "medium",
      "Identify missing architecture questions raised by the input",
      ["07 Research/<Question>.md or 05 Architecture/<Spec>.md"],
      ["Open architecture questions captured as question documents"],
    ),
    mk(
      "architecture_research",
      "medium",
      "Identify missing research areas implied by the input",
      ["07 Research/<Research>.md"],
      ["Research gaps captured as research or question documents"],
    ),
    mk(
      "business_research",
      "medium",
      "Identify missing business assumptions implied by the input",
      ["08 Business/<Assumption>.md"],
      ["Key business assumptions captured and linked"],
    ),
  ];
}

/** Recommended tasks derived from a compile analysis. */
export function deriveCompilerTasks(analysis: VaultAnalysis): KosTask[] {
  const specs: TaskSpec[] = [];

  // Broken links -> a single link-repair task (high priority).
  if (analysis.brokenLinks.length > 0) {
    const sample = analysis.brokenLinks
      .slice(0, 5)
      .map((b) => `[[${b.target}]] in ${b.path}`)
      .join("; ");
    specs.push({
      type: "link_repair",
      status: "open",
      priority: "high",
      goal: `Repair ${analysis.brokenLinks.length} unresolved wikilink(s)`,
      inputs: [],
      expectedOutputs: ["Edited documents with resolving links"],
      acceptanceCriteria: [
        "Every wikilink resolves to an existing document",
        "No new validation errors introduced",
      ],
      dependencies: [],
    });
    void sample;
  }

  // Missing knowledge layers -> a modeling/research task each.
  for (const layer of analysis.missingLayers) {
    const { type, priority } = layerTaskMeta(layer);
    specs.push({
      type,
      status: "open",
      priority,
      goal: `Populate the ${layer} layer with at least one real document`,
      inputs: [],
      expectedOutputs: [`A real document under ${layer}`],
      acceptanceCriteria: [
        `${layer} contains at least one non-index, non-map document`,
        "The new document passes validation and is linked into its Map",
      ],
      dependencies: [],
    });
  }

  // Materialise with placeholder ids/timestamps; the store reassigns them.
  return specs.map((s, i) => ({
    ...s,
    id: `TMP-${i}`,
    createdAt: "",
    updatedAt: "",
  }));
}

function layerTaskMeta(layer: string): { type: TaskType; priority: Priority } {
  for (const [type, l] of Object.entries(LAYER_BY_TYPE)) {
    if (l === layer) return { type: type as TaskType, priority: "medium" };
  }
  if (layer === "06 Decisions") return { type: "adr_creation", priority: "medium" };
  return { type: "documentation_repair", priority: "low" };
}
