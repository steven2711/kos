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
export class MockWorker implements Worker {
  readonly name = "mock";

  async runTask(req: WorkerRequest): Promise<WorkerResult> {
    const today = new Date().toISOString().slice(0, 10);
    const title = `Generated Concept ${req.task.id}`;
    const rel = path.join("04 Domain", `${title}.md`);
    const abs = path.join(req.vaultPath, rel);
    const content = `---
type: concept
status: draft
created: ${today}
updated: ${today}
owner: kos-agent
tags: [domain, generated]
parents: ["[[Domain Map]]"]
children: []
related: ["[[Knowledge Modeling Guide]]", "[[Linking Standards]]"]
---

# ${title}

A placeholder concept produced by the offline mock worker for task ${req.task.id}.

## Purpose

Demonstrate that the controlled run loop can create a validator-passing document without calling the real model. See [[Home]] and the [[Constitution]].

## Context

This document was generated to satisfy the task goal: "${req.task.goal}". It follows the [[Frontmatter Specification]] and [[Linking Standards]].

## Related Concepts

- [[Knowledge Graph]] — the network this concept would join.

## Open Questions

- Is this concept a duplicate of an existing canonical concept? (Mock placeholder.)

## Related Documents

- [[Domain Map]]
- [[Knowledge Modeling Guide]]
- [[Linking Standards]]
- [[Constitution]]
- [[Home]]
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
