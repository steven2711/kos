/**
 * The KOS task model — the unit of work the compiler hands to Claude.
 * Shapes are fixed by the v0 spec; zod mirrors them for safe load/save.
 */
import { z } from "zod";

const TASK_STATUSES = [
  "open",
  "in_progress",
  "complete",
  "blocked",
  "failed",
] as const;

const TASK_TYPES = [
  "concept_extraction",
  "vision_expansion",
  "domain_modeling",
  "architecture_research",
  "business_research",
  "documentation_repair",
  "link_repair",
  "adr_creation",
  "founder_interview",
  // Research types (v0.8) — executed only by `kos research`, never `kos run`.
  "research",
  "competitor_research",
  "technical_research",
  "market_research",
  "legal_research",
  // Promotion type (v0.9) — reviewed only by `kos promote`, never `kos run`.
  // A founder-approved promotion of researched evidence into canonical knowledge.
  "knowledge_proposal",
] as const;

/** Task types the Research Worker handles (gathered into `07 Research/`). */
const RESEARCH_TASK_TYPES = new Set<TaskType>([
  "research",
  "competitor_research",
  "technical_research",
  "market_research",
  "legal_research",
]);

/** True for a task type executed by the Research Worker (`kos research`). */
export function isResearchType(type: TaskType): boolean {
  return RESEARCH_TASK_TYPES.has(type);
}

/** Task types handled by the Promotion Engine (`kos promote`). */
const PROMOTION_TASK_TYPES = new Set<TaskType>(["knowledge_proposal"]);

/**
 * True for a promotion task type. Like research, promotion work is never run by
 * the autonomous `kos run` loop — only the founder, via `kos promote`, may
 * review and merge a proposal into canonical knowledge.
 */
export function isPromotionType(type: TaskType): boolean {
  return PROMOTION_TASK_TYPES.has(type);
}

const PRIORITIES = ["low", "medium", "high", "critical"] as const;

type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskType = (typeof TASK_TYPES)[number];
export type Priority = (typeof PRIORITIES)[number];

export interface KosTask {
  id: string;
  type: TaskType;
  status: TaskStatus;
  priority: Priority;
  goal: string;
  inputs: string[];
  expectedOutputs: string[];
  acceptanceCriteria: string[];
  dependencies: string[];
  /** Questions to put to the founder. Only set for `founder_interview` tasks. */
  questions?: string[] | undefined;
  /**
   * Provenance: `compiler` = required work derived from the deterministic
   * analysis; `semantic` = advisory work proposed by the LLM Semantic Reviewer;
   * `research` = a one-off `kos research` task or a Research Worker follow-up;
   * `promotion` = a `knowledge_proposal` task created by the Promotion Engine.
   * Keeps "facts vs reasoning" visible in the task layer (see semantic-rules.ts).
   */
  origin?: "compiler" | "semantic" | "research" | "promotion" | undefined;
  /** Free-text query for a research task (`kos research "<query>"`). */
  researchQuery?: string | undefined;
  /** Optional starting points (URLs, doc paths) for a research task. */
  sourceHints?: string[] | undefined;
  /** A one-line description of the research artifact expected. */
  expectedResearchOutput?: string | undefined;
  // --- Promotion provenance (v0.9), only set for `knowledge_proposal` tasks. ---
  /** The single claim this proposal asks the founder to promote. */
  claim?: string | undefined;
  /** Wikilink/relPath of the canonical document the claim would be added to. */
  targetDocument?: string | undefined;
  /** Wikilinks/relPaths of the documents that support the claim. */
  supportingDocuments?: string[] | undefined;
  /** External sources (URLs/titles) backing the claim. */
  supportingSources?: string[] | undefined;
  /** How confident the source channel is in the claim. */
  confidence?: "low" | "medium" | "high" | undefined;
  createdAt: string;
  updatedAt: string;
}

const KosTaskSchema = z.object({
  id: z.string(),
  type: z.enum(TASK_TYPES),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(PRIORITIES),
  goal: z.string(),
  inputs: z.array(z.string()),
  expectedOutputs: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
  dependencies: z.array(z.string()),
  questions: z.array(z.string()).optional(),
  origin: z.enum(["compiler", "semantic", "research", "promotion"]).optional(),
  researchQuery: z.string().optional(),
  sourceHints: z.array(z.string()).optional(),
  expectedResearchOutput: z.string().optional(),
  claim: z.string().optional(),
  targetDocument: z.string().optional(),
  supportingDocuments: z.array(z.string()).optional(),
  supportingSources: z.array(z.string()).optional(),
  confidence: z.enum(["low", "medium", "high"]).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const TaskFileSchema = z.object({
  version: z.literal(1),
  tasks: z.array(KosTaskSchema),
});

export type TaskFile = z.infer<typeof TaskFileSchema>;

/** A task spec before the store assigns id/timestamps (used by the Planner). */
export type TaskSpec = Omit<KosTask, "id" | "createdAt" | "updatedAt">;

export const PRIORITY_RANK: Record<Priority, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
};

/** Stable id: T-001, T-002, ... given the count of existing tasks. */
export function nextTaskId(existing: KosTask[]): string {
  let max = 0;
  for (const t of existing) {
    const digits = t.id.match(/^T-(\d+)$/)?.[1];
    if (digits !== undefined) max = Math.max(max, parseInt(digits, 10));
  }
  return `T-${String(max + 1).padStart(3, "0")}`;
}

/** Identity key for dedupe: type + normalised goal. */
export function taskKey(t: Pick<KosTask, "type" | "goal">): string {
  return `${t.type}::${t.goal.trim().toLowerCase()}`;
}
