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
] as const;

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
