/**
 * The Research Worker boundary — a controlled way for KOS to acquire *external*
 * evidence and record it as a research document.
 *
 * Like `Worker`/`SemanticReviewer`, this is a side-effectful boundary that only
 * `commands/` may import. `ClaudeResearchWorker` wraps the Agent SDK's `query()`
 * with web tools plus a `Write` that the model is instructed to confine to
 * `07 Research/`; the *real* write-boundary enforcement is the command's
 * before/after folder snapshot (SDK `allowedTools` cannot be path-scoped). The
 * worker proposes follow-up tasks but never persists them — the command does.
 * `MockResearchWorker` writes a deterministic, validator-passing document so
 * `kos research` and its tests run offline.
 *
 * Select the mock with `KOS_RESEARCH_WORKER=mock` (or the global `KOS_AGENT=mock`).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { loadEnv } from "../config/env.js";
import { type KosTask, type TaskSpec } from "../tasks/task-model.js";
import {
  renderResearchDocument,
  researchFileName,
  type ResearchSource,
} from "../core/research-document.js";

const MODEL = "claude-opus-4-8";
const MAX_TURNS = 24;
/** Web tools let the worker gather evidence; Write is confined by the command guard. */
const ALLOWED_TOOLS = ["Read", "Glob", "Grep", "WebSearch", "WebFetch", "Write"];

/** Minimal structural view of the SDK surface we consume (mirrors `claude.ts`). */
interface SdkMessage {
  readonly type: string;
  readonly subtype?: string;
  readonly result?: unknown;
  readonly message?: { readonly content?: readonly unknown[] };
  readonly content?: readonly unknown[];
}

type SdkQuery = (args: {
  prompt: string;
  options: Record<string, unknown>;
}) => AsyncIterable<SdkMessage>;

function isTextBlock(block: unknown): block is { type: "text"; text: string } {
  return (
    typeof block === "object" &&
    block !== null &&
    (block as { type?: unknown }).type === "text" &&
    typeof (block as { text?: unknown }).text === "string"
  );
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export interface ResearchRequest {
  vaultPath: string;
  task: KosTask;
  /** System prompt (loaded from `prompts/research-task.md` by the command). */
  systemPrompt: string;
  /** The user prompt describing the research query and constraints. */
  prompt: string;
  /** The research query (used by the mock to title the document). */
  query: string;
  /** Injectable clock for deterministic dates in tests. */
  clock?: () => Date;
}

export interface ResearchResult {
  success: boolean;
  finalText: string;
  /** Follow-up task specs the command persists (origin already set to research). */
  proposedTasks: TaskSpec[];
  error?: string;
}

export interface ResearchWorker {
  readonly name: string;
  runResearchTask(req: ResearchRequest): Promise<ResearchResult>;
}

/** Follow-up task types the worker is allowed to propose. */
const PROPOSED_TASK_TYPES = [
  "founder_interview",
  "business_research",
  "market_research",
  "competitor_research",
  "technical_research",
  "legal_research",
  "research",
  "adr_creation",
  "documentation_repair",
] as const;

const ProposedTasksSchema = z.object({
  proposedTasks: z.array(
    z.object({
      type: z.enum(PROPOSED_TASK_TYPES),
      goal: z.string().min(1),
      priority: z.enum(["low", "medium"]).optional(),
      questions: z.array(z.string()).optional(),
    }),
  ),
});

/** Pull the last JSON object out of a model response (proposals are emitted last). */
function extractLastJsonObject(text: string): string | null {
  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  const body = fenced.length > 0 ? (fenced[fenced.length - 1]?.[1] ?? text) : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return body.slice(start, end + 1);
}

/** Parse the worker's proposed follow-ups, defaulting to none on any failure. */
export function parseProposedTasks(text: string): TaskSpec[] {
  const candidate = extractLastJsonObject(text);
  if (candidate === null) return [];
  let data: unknown;
  try {
    data = JSON.parse(candidate);
  } catch {
    return [];
  }
  const parsed = ProposedTasksSchema.safeParse(data);
  if (!parsed.success) return [];
  return parsed.data.proposedTasks.map((p) => toSpec(p.type, p.goal, p.priority, p.questions));
}

/** Build a follow-up `TaskSpec` (origin `research`) from a parsed proposal. */
function toSpec(
  type: TaskSpec["type"],
  goal: string,
  priority: "low" | "medium" | undefined,
  questions: string[] | undefined,
): TaskSpec {
  return {
    type,
    status: "open",
    priority: priority ?? "low",
    goal,
    inputs: [],
    expectedOutputs: [],
    acceptanceCriteria: [],
    dependencies: [],
    origin: "research",
    ...(questions !== undefined ? { questions } : {}),
  };
}

/** Real research worker backed by `@anthropic-ai/claude-agent-sdk`. */
class ClaudeResearchWorker implements ResearchWorker {
  readonly name = "claude";

  async runResearchTask(req: ResearchRequest): Promise<ResearchResult> {
    let query: SdkQuery;
    try {
      const mod = (await import("@anthropic-ai/claude-agent-sdk")) as {
        query: SdkQuery;
      };
      query = mod.query;
    } catch {
      return {
        success: false,
        finalText: "",
        proposedTasks: [],
        error:
          "Claude Agent SDK not available. Install @anthropic-ai/claude-agent-sdk, or run with KOS_RESEARCH_WORKER=mock.",
      };
    }

    // Auth handling mirrors the worker: prefer the subscription unless the user
    // explicitly opted into API billing (KOS_AUTH=api-key).
    const cfg = loadEnv();
    const env: Record<string, string | undefined> = { ...process.env };
    if (cfg.KOS_AUTH !== "api-key") delete env["ANTHROPIC_API_KEY"];

    try {
      const stream = query({
        prompt: req.prompt,
        options: {
          cwd: req.vaultPath,
          systemPrompt: req.systemPrompt,
          allowedTools: ALLOWED_TOOLS,
          permissionMode: "acceptEdits",
          maxTurns: MAX_TURNS,
          model: MODEL,
          env,
        },
      });

      let finalText = "";
      let success = false;
      let error: string | undefined;
      for await (const message of stream) {
        if (message.type === "assistant") {
          const blocks = message.message?.content ?? message.content ?? [];
          for (const b of blocks) {
            if (isTextBlock(b)) finalText += b.text;
          }
        } else if (message.type === "result") {
          if (message.subtype === "success") {
            success = true;
            if (typeof message.result === "string") finalText = message.result;
          } else {
            error = `research worker ended with ${message.subtype ?? "unknown"}`;
          }
        }
      }
      return {
        success,
        finalText,
        proposedTasks: parseProposedTasks(finalText),
        ...(error !== undefined ? { error } : {}),
      };
    } catch (err) {
      return {
        success: false,
        finalText: "",
        proposedTasks: [],
        error: errorMessage(err),
      };
    }
  }
}

/** A deterministic, clearly-labelled offline source for the mock document. */
const MOCK_SOURCES: ResearchSource[] = [
  {
    title: "Offline placeholder source",
    url: "https://example.com/offline",
    publisher: "example.com",
    accessed: "OFFLINE",
    relevance: "Mock research (offline; no web access, no AI judgement).",
  },
];

/**
 * Deterministic offline research worker. Writes one valid document into
 * `07 Research/` (via the pure `renderResearchDocument`) and proposes a single
 * founder-interview follow-up. It never reads the web and never calls the model.
 */
export class MockResearchWorker implements ResearchWorker {
  readonly name = "mock";

  async runResearchTask(req: ResearchRequest): Promise<ResearchResult> {
    const date = (req.clock ? req.clock() : new Date()).toISOString().slice(0, 10);
    const title = `Research ${req.task.id}`;
    const rel = path.join("07 Research", researchFileName(date, title));
    const abs = path.join(req.vaultPath, rel);

    const content = renderResearchDocument({
      title,
      query: req.query,
      created: date,
      updated: date,
      sources: MOCK_SOURCES,
      findings: [
        "Mock finding produced offline; no real evidence was gathered.",
      ],
      openQuestions: [
        "Does this evidence require founder interpretation before any decision?",
      ],
      relatedDocuments: ["Research Map", "Home"],
    });

    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, "utf8");

    const followUp: TaskSpec = {
      type: "founder_interview",
      status: "open",
      priority: "low",
      goal: `Interpret research findings for ${req.task.id}`,
      inputs: [rel.split(path.sep).join("/")],
      expectedOutputs: [
        "00 Inbox/Interviews/Interview-<timestamp>.md capturing the founder's answers",
      ],
      acceptanceCriteria: ["Every question has a founder answer recorded"],
      dependencies: [],
      origin: "research",
      questions: [
        "Mock follow-up (offline; no AI judgement): how should this evidence influence the plan, if at all?",
      ],
    };

    return {
      success: true,
      finalText: `Mock research worker wrote ${rel.split(path.sep).join("/")} for task ${req.task.id}.`,
      proposedTasks: [followUp],
    };
  }
}

/** Choose the research worker based on env (mirrors `selectWorker`). */
export function selectResearchWorker(): ResearchWorker {
  const env = loadEnv();
  if (env.KOS_RESEARCH_WORKER === "mock" || env.KOS_AGENT === "mock") {
    return new MockResearchWorker();
  }
  return new ClaudeResearchWorker();
}
