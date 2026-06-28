/**
 * The Planner answers "what work exists?".
 *
 * It analyses the vault (via the compiler's read-only `VaultAnalysis`), generates
 * candidate work, infers dependencies between tasks, and constructs a Task Graph.
 * The Planner never executes work and never validates work.
 */
import { type KosTask, type Priority, type TaskType, type TaskSpec } from "../tasks/task-model.js";
import type { VaultAnalysis } from "../core/compiler.js";
import type { SemanticFinding, SemanticReview } from "../core/semantic-rules.js";

const LAYER_BY_TYPE: Partial<Record<TaskType, string>> = {
  vision_expansion: "02 Vision",
  domain_modeling: "04 Domain",
  architecture_research: "05 Architecture",
  business_research: "08 Business",
};

/**
 * Static dependency rules between task types. A task of type K depends on every
 * task in the same graph whose type is one of `DEPENDS_ON_TYPE[K]`. The relation
 * is a DAG over types (concept_extraction → domain/vision → architecture/adr),
 * so the inferred graph is always acyclic.
 */
const DEPENDS_ON_TYPE: Partial<Record<TaskType, TaskType[]>> = {
  domain_modeling: ["concept_extraction"],
  vision_expansion: ["concept_extraction"],
  architecture_research: ["domain_modeling"],
  adr_creation: ["domain_modeling"],
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

  // Founder interviews — human input only the founder can supply. Each trigger
  // is gated on foundational layers already existing, so an empty vault (nothing
  // to ask about yet) never produces one. Goal text is stable so dedupe by
  // type+goal prevents re-asking once an interview is complete.
  specs.push(...deriveFounderTasks(analysis));

  // Materialise with placeholder ids/timestamps; the store reassigns them. All
  // of this is required work derived from the deterministic analysis.
  return specs.map((s, i) => ({
    ...s,
    id: `TMP-${i}`,
    origin: "compiler" as const,
    createdAt: "",
    updatedAt: "",
  }));
}

/** Keywords that mark an open question as one only the founder can resolve. */
const STRATEGIC_RE =
  /\b(vision|intent|goal|strategy|strategic|assumption|decision|direction|priorit)/i;

/** Cap on how many scraped open questions we surface in one interview task. */
const MAX_SCRAPED_QUESTIONS = 8;

/** Founder-interview specs derived from the compile analysis. */
function deriveFounderTasks(analysis: VaultAnalysis): TaskSpec[] {
  const specs: TaskSpec[] = [];
  const missing = (layer: string): boolean => analysis.missingLayers.includes(layer);
  const present = (layer: string): boolean => !missing(layer);

  const mk = (goal: string, questions: string[]): TaskSpec => ({
    type: "founder_interview",
    status: "open",
    priority: "medium",
    goal,
    inputs: [],
    expectedOutputs: [
      "00 Inbox/Interviews/Interview-<timestamp>.md capturing the founder's answers",
    ],
    acceptanceCriteria: ["Every question has a founder answer recorded"],
    dependencies: [],
    questions,
  });

  // Required product intent is missing (there is domain substance to anchor it).
  if (present("04 Domain") && missing("03 Product")) {
    specs.push(
      mk("Capture founder product intent for the 03 Product layer", [
        "What is the core product, in one sentence?",
        "Who is the target user, and what problem does the product solve for them?",
        "What does success look like 12 months from now?",
      ]),
    );
  }

  // Open questions that block major docs and need founder direction.
  const strategic = analysis.openQuestions
    .filter((q) => STRATEGIC_RE.test(q.text))
    .slice(0, MAX_SCRAPED_QUESTIONS);
  if (strategic.length > 0) {
    specs.push(
      mk(
        "Resolve strategic open questions that require founder direction",
        strategic.map((q) => `${q.text} (from ${q.path})`),
      ),
    );
  }

  // Business assumptions lack founder direction (business layer has substance).
  if (present("08 Business") && strategic.length > 0) {
    specs.push(
      mk("Confirm founder direction on key business assumptions", [
        "What is the primary revenue model?",
        "Which business assumptions are you most and least confident about?",
        "What are the biggest business risks you want tracked?",
      ]),
    );
  }

  // Architecture decisions require founder preference/tradeoff input.
  if (present("04 Domain") && missing("06 Decisions")) {
    specs.push(
      mk("Capture founder preferences for key architecture decisions", [
        "How do you weigh speed of delivery vs. long-term simplicity?",
        "How do you weigh cost vs. performance for core infrastructure?",
        "For major capabilities, do you prefer to build or to buy?",
      ]),
    );
  }

  return specs;
}

/**
 * Turn a Semantic Review into **optional** work. Every semantic task is
 * `priority: "low"` with `origin: "semantic"`, so required deterministic work
 * always schedules first and advisory work never blocks readiness. Mapping:
 *
 *  - `possible_contradiction` (any confidence) → a `founder_interview` (ask,
 *    never assume);
 *  - `recommendation` with medium/high confidence → an actionable doc/research
 *    task, routed by the cited layer;
 *  - everything else (`suggestion`, `observation`, any low-confidence finding) →
 *    report-only, not promoted to a task.
 *
 * Goal text is derived from the finding class + sorted cited documents so the
 * non-deterministic reviewer dedupes via `mergeTasks` (type+goal) across runs
 * rather than spawning near-duplicate tasks.
 */
export function deriveSemanticTasks(review: SemanticReview): KosTask[] {
  const specs: TaskSpec[] = [];
  for (const finding of review.findings) {
    const spec = semanticTaskSpec(finding);
    if (spec !== null) specs.push(spec);
  }
  return specs.map((s, i) => ({
    ...s,
    id: `TMP-${i}`,
    origin: "semantic" as const,
    createdAt: "",
    updatedAt: "",
  }));
}

/** A readable, run-stable label from the documents a finding cites. */
function docsLabel(documents: string[]): string {
  const sorted = documents
    .map((d) => d.trim())
    .filter((d) => d !== "")
    .sort();
  return sorted.length > 0 ? sorted.join(" ↔ ") : "the vault";
}

/**
 * Keyword → research task type. Findings calling for external evidence become
 * research tasks (executed deliberately by `kos research`). Checked in order, so
 * the most specific evidence need wins before the generic layer routing.
 */
const RESEARCH_ROUTES: { type: TaskType; re: RegExp }[] = [
  { type: "competitor_research", re: /\b(competitor|competition|competitive|incumbent|rival)/i },
  { type: "legal_research", re: /\b(legal|compliance|regulation|regulatory|licen[sc]e|gdpr|privacy law|liabilit)/i },
  { type: "technical_research", re: /\b(feasibilit|technical risk|scalab|benchmark|performance|prototype)/i },
  { type: "market_research", re: /\b(market|demand|tam|go-to-market|gtm|customer segment|addressable)/i },
];

/**
 * A recommendation explicitly asking to elevate a finding into canonical
 * knowledge. Routed to a `knowledge_proposal` (the founder decides via
 * `kos promote`), but only after the research routes — gathering evidence
 * precedes proposing its promotion.
 */
const PROMOTE_RE =
  /\b(promote|proposal|canonical|formali[sz]e|adopt as|make .* official)/i;

/**
 * Route an actionable recommendation to a task type. A finding that asks for
 * external evidence (competitors, market, legal, technical feasibility) becomes
 * the matching research task; one that asks to elevate a finding to canonical
 * knowledge becomes a `knowledge_proposal`; otherwise it falls back to the
 * cited-layer routing.
 */
function recommendationType(finding: SemanticFinding): TaskType {
  const haystack = `${finding.title} ${finding.reasoning} ${finding.recommendedAction} ${finding.supportingDocuments.join(" ")}`;
  for (const route of RESEARCH_ROUTES) {
    if (route.re.test(haystack)) return route.type;
  }
  if (PROMOTE_RE.test(haystack)) return "knowledge_proposal";
  const inLayer = (layer: string): boolean =>
    finding.supportingDocuments.some((d) => d.startsWith(layer));
  if (inLayer("05 Architecture")) return "architecture_research";
  if (inLayer("08 Business")) return "business_research";
  return "documentation_repair";
}

/** Map a single finding to an optional task spec, or null to leave it report-only. */
function semanticTaskSpec(finding: SemanticFinding): TaskSpec | null {
  const label = docsLabel(finding.supportingDocuments);

  if (finding.class === "possible_contradiction") {
    return {
      type: "founder_interview",
      status: "open",
      priority: "low",
      goal: `Resolve a possible contradiction involving ${label}`,
      inputs: finding.supportingDocuments,
      expectedOutputs: [
        "00 Inbox/Interviews/Interview-<timestamp>.md capturing the founder's answers",
      ],
      acceptanceCriteria: ["Every question has a founder answer recorded"],
      dependencies: [],
      questions: [`${finding.title} — ${finding.reasoning} (${finding.recommendedAction})`],
    };
  }

  if (
    finding.class === "recommendation" &&
    (finding.confidence === "medium" || finding.confidence === "high")
  ) {
    const type = recommendationType(finding);

    // A promotion recommendation carries the provenance a proposal needs: the
    // claim, the target it would land in, and the documents that support it.
    if (type === "knowledge_proposal") {
      const target = finding.supportingDocuments[0];
      if (target === undefined) return null; // nothing to promote into
      return {
        type,
        status: "open",
        priority: "low",
        goal: `Propose promoting to canonical: ${finding.title}`,
        inputs: finding.supportingDocuments,
        expectedOutputs: ["A knowledge proposal under 11 Proposals/ for founder review"],
        acceptanceCriteria: [
          finding.recommendedAction,
          "Founder reviews and decides the proposal",
        ],
        dependencies: [],
        claim: finding.title,
        targetDocument: target,
        supportingDocuments: finding.supportingDocuments,
        confidence: finding.confidence,
      };
    }

    return {
      type,
      status: "open",
      priority: "low",
      goal: `Address a semantic recommendation involving ${label}`,
      inputs: finding.supportingDocuments,
      expectedOutputs: ["Documents updated or added to address the recommendation"],
      acceptanceCriteria: [
        finding.recommendedAction,
        "No new validation errors introduced",
      ],
      dependencies: [],
    };
  }

  // suggestion / observation / low-confidence → advisory only, report-only.
  return null;
}

function layerTaskMeta(layer: string): { type: TaskType; priority: Priority } {
  for (const [type, l] of Object.entries(LAYER_BY_TYPE)) {
    if (l === layer) return { type: type as TaskType, priority: "medium" };
  }
  if (layer === "06 Decisions") return { type: "adr_creation", priority: "medium" };
  return { type: "documentation_repair", priority: "low" };
}

/**
 * Populate each task's `dependencies` from the static `DEPENDS_ON_TYPE` rules.
 * Deterministic and idempotent: dependencies are fully recomputed from the
 * task set, so calling it twice yields the same graph. Returns a new array.
 */
export function inferDependencies(tasks: KosTask[]): KosTask[] {
  const idsByType = new Map<TaskType, string[]>();
  for (const t of tasks) {
    const list = idsByType.get(t.type) ?? [];
    list.push(t.id);
    idsByType.set(t.type, list);
  }

  return tasks.map((t) => {
    const prereqTypes = DEPENDS_ON_TYPE[t.type] ?? [];
    const deps = new Set<string>();
    for (const pt of prereqTypes) {
      for (const id of idsByType.get(pt) ?? []) {
        if (id !== t.id) deps.add(id);
      }
    }
    return { ...t, dependencies: [...deps].sort() };
  });
}

/** A task and its dependents (the inverse of `dependencies`). */
export interface TaskGraph {
  tasks: KosTask[];
  /** task id -> ids of tasks that depend on it. */
  blocks: Record<string, string[]>;
}

/** Build the dependency graph: nodes are tasks, edges are `dependencies`. */
export function buildTaskGraph(tasks: KosTask[]): TaskGraph {
  const blocks: Record<string, string[]> = {};
  for (const t of tasks) blocks[t.id] = [];
  for (const t of tasks) {
    for (const dep of t.dependencies) {
      if (blocks[dep]) blocks[dep].push(t.id);
    }
  }
  return { tasks, blocks };
}
