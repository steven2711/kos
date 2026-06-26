/**
 * Agent adapter — the only place the Claude Agent SDK is touched.
 *
 * `ClaudeAgent` wraps the SDK's `query()` to run exactly one bounded task that
 * may Read/Write/Edit files in the vault. `MockAgent` writes a deterministic,
 * valid document so `kos run` and its tests work offline without API calls.
 *
 * Select the mock with `KOS_AGENT=mock` (or when no ANTHROPIC_API_KEY is set).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { KosTask } from "../tasks/task-model.js";

export interface AgentRequest {
  vaultPath: string;
  systemPrompt: string;
  prompt: string;
  allowedTools: string[];
  maxTurns: number;
  model: string;
  task: KosTask;
}

export interface AgentResult {
  success: boolean;
  finalText: string;
  error?: string;
}

export interface Agent {
  readonly name: string;
  runTask(req: AgentRequest): Promise<AgentResult>;
}

/** Real agent backed by `@anthropic-ai/claude-agent-sdk`. */
export class ClaudeAgent implements Agent {
  readonly name = "claude";

  async runTask(req: AgentRequest): Promise<AgentResult> {
    let query: any;
    try {
      // Dynamic import so the project builds/tests even if the SDK is absent.
      ({ query } = await import("@anthropic-ai/claude-agent-sdk"));
    } catch (err) {
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
    const env: Record<string, string | undefined> = { ...process.env };
    const preferSubscription =
      (process.env.KOS_AUTH ?? "subscription").toLowerCase() !== "api-key";
    if (preferSubscription) delete env.ANTHROPIC_API_KEY;

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

      for await (const message of stream as AsyncIterable<any>) {
        if (message?.type === "assistant") {
          const blocks = message.message?.content ?? message.content ?? [];
          for (const b of blocks) {
            if (b?.type === "text" && typeof b.text === "string") {
              finalText += b.text;
            }
          }
        } else if (message?.type === "result") {
          if (message.subtype === "success") {
            success = true;
            if (typeof message.result === "string") finalText = message.result;
          } else {
            error = `agent ended with ${message.subtype}`;
          }
        }
      }

      return { success, finalText, error };
    } catch (err: any) {
      return { success: false, finalText: "", error: String(err?.message ?? err) };
    }
  }
}

/**
 * Deterministic offline agent. Writes one valid concept document into
 * `04 Domain/` that satisfies the validator (valid frontmatter, required
 * sections, and 5 resolving wikilinks).
 */
export class MockAgent implements Agent {
  readonly name = "mock";

  async runTask(req: AgentRequest): Promise<AgentResult> {
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

A placeholder concept produced by the offline mock agent for task ${req.task.id}.

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
      finalText: `Mock agent created ${rel} for task ${req.task.id}.`,
    };
  }
}

/** Choose the agent implementation based on env. */
export function selectAgent(): Agent {
  const forced = process.env.KOS_AGENT?.toLowerCase();
  if (forced === "mock") return new MockAgent();
  // Default: the real Claude agent. It authenticates via your Claude Code
  // subscription (no API key needed). Use KOS_AGENT=mock for offline runs.
  return new ClaudeAgent();
}
