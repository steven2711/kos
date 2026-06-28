/**
 * The Semantic Reviewer boundary — an LLM stage, kept strictly separate from the
 * deterministic compiler.
 *
 * Like `Worker`/`Interviewer`, this is a side-effectful boundary that only
 * `commands/` may import. `ClaudeSemanticReviewer` wraps the Agent SDK's
 * `query()` with **read-only** tools (no `Write`/`Edit`), so a finding can never
 * mutate a document. Its output is parsed and Zod-validated; anything malformed
 * collapses to an empty advisory review rather than throwing. `MockSemanticReviewer`
 * returns a deterministic canned review so `kos analyze` and its tests run offline.
 *
 * Select the mock with `KOS_AGENT=mock` (mirrors `selectWorker`).
 */
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadEnv } from "../config/env.js";
import {
  type SemanticReview,
  SemanticReviewSchema,
} from "../core/semantic-rules.js";

const MODEL = "claude-opus-4-8";
const MAX_TURNS = 12;
const READ_ONLY_TOOLS = ["Read", "Glob", "Grep"];

/**
 * Minimal structural view of the SDK surface we consume — identical to the
 * worker's. The SDK is dynamically imported (and may be absent), so we narrow
 * defensively rather than trusting its types.
 */
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

export interface SemanticReviewRequest {
  /** The serialised vault + objective analysis (from `buildReviewContext`). */
  context: string;
  /** Vault root, used as the reviewer's cwd for its read-only tools. */
  vaultPath: string;
}

export interface SemanticReviewer {
  readonly name: string;
  review(req: SemanticReviewRequest): Promise<SemanticReview>;
}

/** Extract and validate a `SemanticReview` from the model's raw text output. */
export function parseReview(text: string): SemanticReview {
  const candidate = extractJsonObject(text);
  if (candidate === null) {
    return { findings: [], note: "Semantic reviewer returned no parsable JSON." };
  }
  let data: unknown;
  try {
    data = JSON.parse(candidate);
  } catch {
    return { findings: [], note: "Semantic reviewer returned invalid JSON." };
  }
  const parsed = SemanticReviewSchema.safeParse(data);
  if (!parsed.success) {
    return {
      findings: [],
      note: "Semantic reviewer output did not match the expected schema.",
    };
  }
  return parsed.data;
}

/** Pull the most likely JSON object out of a model response. */
function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced?.[1] ?? text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return body.slice(start, end + 1);
}

/** Real reviewer backed by `@anthropic-ai/claude-agent-sdk`. */
class ClaudeSemanticReviewer implements SemanticReviewer {
  readonly name = "claude";

  async review(req: SemanticReviewRequest): Promise<SemanticReview> {
    let query: SdkQuery;
    try {
      const mod = (await import("@anthropic-ai/claude-agent-sdk")) as {
        query: SdkQuery;
      };
      query = mod.query;
    } catch {
      return {
        findings: [],
        note: "Claude Agent SDK not available; run with KOS_AGENT=mock for an offline review.",
      };
    }

    const systemPrompt = await loadSystemPrompt();

    // Auth handling mirrors the worker: prefer the subscription unless the user
    // explicitly opted into API billing (KOS_AUTH=api-key).
    const cfg = loadEnv();
    const env: Record<string, string | undefined> = { ...process.env };
    if (cfg.KOS_AUTH !== "api-key") delete env["ANTHROPIC_API_KEY"];

    try {
      const stream = query({
        prompt: req.context,
        options: {
          cwd: req.vaultPath,
          systemPrompt,
          allowedTools: READ_ONLY_TOOLS,
          permissionMode: "bypassPermissions",
          maxTurns: MAX_TURNS,
          model: MODEL,
          env,
        },
      });

      let finalText = "";
      for await (const message of stream) {
        if (message.type === "assistant") {
          const blocks = message.message?.content ?? message.content ?? [];
          for (const b of blocks) {
            if (isTextBlock(b)) finalText += b.text;
          }
        } else if (message.type === "result") {
          if (message.subtype === "success" && typeof message.result === "string") {
            finalText = message.result;
          }
        }
      }
      return parseReview(finalText);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { findings: [], note: `Semantic review failed: ${msg}` };
    }
  }
}

async function loadSystemPrompt(): Promise<string> {
  const url = new URL("./prompts/semantic-review.md", import.meta.url);
  return fs.readFile(fileURLToPath(url), "utf8");
}

/**
 * Deterministic offline reviewer. Returns a fixed, clearly-labelled advisory
 * review covering each mapping branch (a contradiction, an actionable
 * recommendation, and a low-weight suggestion) so the loop and tests exercise
 * the planner without the SDK. It never reads files and never calls the model.
 */
export class MockSemanticReviewer implements SemanticReviewer {
  readonly name = "mock";

  review(_req: SemanticReviewRequest): Promise<SemanticReview> {
    return Promise.resolve({
      findings: [
        {
          class: "possible_contradiction",
          confidence: "medium",
          title: "Architecture complexity may exceed the stated MVP scope",
          reasoning:
            "Mock review (offline; no AI judgement). Flags a plausible vision/architecture tension so a human is asked rather than assumed.",
          supportingDocuments: ["02 Vision/_index.md", "05 Architecture/_index.md"],
          recommendedAction:
            "Ask the founder whether the architectural complexity is intentional for the MVP.",
        },
        {
          class: "recommendation",
          confidence: "high",
          title: "Capture supporting research for key assumptions",
          reasoning:
            "Mock review (offline; no AI judgement). Suggests grounding assumptions with research.",
          supportingDocuments: ["08 Business/_index.md"],
          recommendedAction:
            "Add a research document recording evidence for the core business assumptions.",
        },
        {
          class: "suggestion",
          confidence: "low",
          title: "Consider clarifying product differentiation",
          reasoning:
            "Mock review (offline; no AI judgement). Low-confidence suggestion, surfaced but not turned into work.",
          supportingDocuments: ["03 Product/_index.md"],
          recommendedAction: "Optionally sharpen the differentiation statement.",
        },
      ],
      note: "Deterministic mock review — no model was called.",
    });
  }
}

/** Choose the reviewer implementation based on env (mirrors `selectWorker`). */
export function selectSemanticReviewer(): SemanticReviewer {
  if (loadEnv().KOS_AGENT === "mock") return new MockSemanticReviewer();
  return new ClaudeSemanticReviewer();
}
