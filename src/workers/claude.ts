/**
 * Worker runtime — the only place the Claude Agent SDK is touched.
 *
 * A Worker executes exactly one bounded task and knows nothing about the task
 * graph or the schedule. `ClaudeWorker` wraps the SDK's `query()` to run one task
 * that may Read/Write/Edit files in the vault. `MockWorker` writes a
 * deterministic, valid document so `kos run` and its tests work offline.
 *
 * Select the mock with `KOS_AGENT=mock` (or when no ANTHROPIC_API_KEY is set).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { KosTask } from "../tasks/task-model.js";
import { loadVault, vaultBasenames } from "../core/vault.js";
import { loadEnv } from "../config/env.js";

/**
 * Minimal structural view of the `@anthropic-ai/claude-agent-sdk` surface we
 * consume. The SDK is dynamically imported (and may be absent), so we describe
 * only the message fields we read and narrow defensively at runtime rather than
 * trusting its types.
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

/** True for an assistant text block `{ type: "text", text: string }`. */
function isTextBlock(block: unknown): block is { type: "text"; text: string } {
  return (
    typeof block === "object" &&
    block !== null &&
    (block as { type?: unknown }).type === "text" &&
    typeof (block as { text?: unknown }).text === "string"
  );
}

/** True for a tool-use block `{ type: "tool_use", name: string, input?: ... }`. */
function isToolUseBlock(
  block: unknown,
): block is { type: "tool_use"; name: string; input?: Record<string, unknown> } {
  return (
    typeof block === "object" &&
    block !== null &&
    (block as { type?: unknown }).type === "tool_use" &&
    typeof (block as { name?: unknown }).name === "string"
  );
}

/** A one-line progress label for a tool call, e.g. `→ Edit 04 Domain/Foo.md`. */
function toolProgressLine(
  name: string,
  input: Record<string, unknown> | undefined,
): string {
  const candidate = input?.["file_path"] ?? input?.["path"] ?? input?.["pattern"];
  const target = typeof candidate === "string" ? ` ${candidate}` : "";
  return `→ ${name}${target}`;
}

/** Best-effort message extraction from an unknown thrown value. */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export interface WorkerRequest {
  vaultPath: string;
  systemPrompt: string;
  prompt: string;
  allowedTools: string[];
  maxTurns: number;
  model: string;
  task: KosTask;
  /** Optional live-progress sink, called per tool-use as the task streams. */
  onProgress?: (line: string) => void;
}

export interface WorkerResult {
  success: boolean;
  finalText: string;
  error?: string;
}

export interface Worker {
  readonly name: string;
  runTask(req: WorkerRequest): Promise<WorkerResult>;
}

/** Real worker backed by `@anthropic-ai/claude-agent-sdk`. */
class ClaudeWorker implements Worker {
  readonly name = "claude";

  async runTask(req: WorkerRequest): Promise<WorkerResult> {
    let query: SdkQuery;
    try {
      // Dynamic import so the project builds/tests even if the SDK is absent.
      const mod = (await import("@anthropic-ai/claude-agent-sdk")) as {
        query: SdkQuery;
      };
      query = mod.query;
    } catch {
      return {
        success: false,
        finalText: "",
        error:
          "Claude Agent SDK not available. Install @anthropic-ai/claude-agent-sdk, or run with KOS_AGENT=mock.",
      };
    }

    // Auth: the SDK delegates to the Claude Code process, which authenticates
    // exactly like the `claude` CLI — via your logged-in subscription when no
    // API key is present. We prefer the subscription by default and only let an
    // ANTHROPIC_API_KEY through when the user explicitly opts into API billing
    // (KOS_AUTH=api-key). A CLAUDE_CODE_OAUTH_TOKEN (from `claude setup-token`)
    // is always passed through for non-interactive subscription auth.
    const cfg = loadEnv();
    const env: Record<string, string | undefined> = { ...process.env };
    const preferSubscription = cfg.KOS_AUTH !== "api-key";
    if (preferSubscription) delete env["ANTHROPIC_API_KEY"];

    try {
      const stream = query({
        prompt: req.prompt,
        options: {
          cwd: req.vaultPath,
          systemPrompt: req.systemPrompt,
          allowedTools: req.allowedTools,
          permissionMode: "acceptEdits",
          maxTurns: req.maxTurns,
          model: req.model,
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
            else if (isToolUseBlock(b)) {
              req.onProgress?.(toolProgressLine(b.name, b.input));
            }
          }
        } else if (message.type === "result") {
          if (message.subtype === "success") {
            success = true;
            if (typeof message.result === "string") finalText = message.result;
          } else {
            error = `worker ended with ${message.subtype ?? "unknown"}`;
          }
        }
      }

      // Omit `error` when unset so the optional property stays absent under
      // exactOptionalPropertyTypes.
      return {
        success,
        finalText,
        ...(error !== undefined ? { error } : {}),
      };
    } catch (err) {
      return { success: false, finalText: "", error: errorMessage(err) };
    }
  }
}

/**
 * Deterministic offline worker. Writes one valid concept document into
 * `04 Domain/` that satisfies the validator (valid frontmatter, required
 * sections, and 5 resolving wikilinks).
 */
/** The knowledge layer each task type contributes to in the offline mock. */
const MOCK_LAYER_BY_TYPE: Readonly<Record<string, string>> = {
  vision_expansion: "02 Vision",
  concept_extraction: "04 Domain",
  domain_modeling: "04 Domain",
  architecture_research: "05 Architecture",
  adr_creation: "06 Decisions",
  business_research: "08 Business",
};
const MOCK_DEFAULT_LAYER = "04 Domain";
/** LNK-001 requires at least this many resolving wikilinks. */
const MOCK_MIN_LINKS = 5;

export class MockWorker implements Worker {
  readonly name = "mock";

  async runTask(req: WorkerRequest): Promise<WorkerResult> {
    const today = new Date().toISOString().slice(0, 10);
    const title = `Generated ${req.task.id}`;
    const folder = MOCK_LAYER_BY_TYPE[req.task.type] ?? MOCK_DEFAULT_LAYER;
    const rel = path.join(folder, `${title}.md`);
    const abs = path.join(req.vaultPath, rel);

    // Link only to documents that already exist, so the generated doc always
    // passes LNK-003 (resolve) no matter how the vault is scaffolded. Cycle the
    // pool to meet the LNK-001 minimum even when very few docs exist; the
    // self-link fallback resolves once this file is written.
    const existing = vaultBasenames(await loadVault(req.vaultPath))
      .filter((b) => b !== title)
      .sort();
    const pool = existing.length > 0 ? existing : [title];
    const links = Array.from(
      { length: MOCK_MIN_LINKS },
      (_, i) => pool[i % pool.length] ?? title,
    );
    const bullets = links.map((l) => `- [[${l}]]`).join("\n");
    const inline = links.map((l) => `[[${l}]]`).join(" ");

    const content = `---
type: concept
status: draft
created: ${today}
updated: ${today}
owner: kos-agent
tags: [generated]
parents: []
children: []
related: []
---

# ${title}

A placeholder document produced offline by the mock worker for task ${req.task.id} (${req.task.type}).

## Purpose

Demonstrate that the controlled loop can create a validator-passing document without calling the real model. See ${inline}.

## Context

This document was generated to satisfy the task goal: "${req.task.goal}".

## Open Questions

- Is this a duplicate of an existing canonical document? (Mock placeholder.)

## Related Documents

${bullets}
`;
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, "utf8");
    return {
      success: true,
      finalText: `Mock worker created ${rel} for task ${req.task.id}.`,
    };
  }
}

/** Choose the worker implementation based on env. */
export function selectWorker(): Worker {
  if (loadEnv().KOS_AGENT === "mock") return new MockWorker();
  // Default: the real Claude worker. It authenticates via your Claude Code
  // subscription (no API key needed). Use KOS_AGENT=mock for offline runs.
  return new ClaudeWorker();
}
