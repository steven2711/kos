/**
 * The founder-input boundary — the only place human answers are gathered.
 *
 * An Interviewer turns a list of questions into a list of answers. It is the
 * deliberate counterpart to the Worker: where `ClaudeWorker` lets the model act,
 * the Interviewer pauses for a *human*. It never touches the Agent SDK, so the
 * AI can never answer a founder question on the founder's behalf.
 *
 * `TerminalInterviewer` prompts on stdin (live). `MockInterviewer` returns
 * deterministic canned answers so `kos run` and its tests work offline. Select
 * the mock with `KOS_AGENT=mock` (or when no ANTHROPIC_API_KEY is set), exactly
 * like the worker.
 */
import * as readline from "node:readline/promises";
import { loadEnv } from "../config/env.js";

export interface Interviewer {
  readonly name: string;
  /** Ask each question in order; return one answer per question. */
  collect(questions: string[]): Promise<string[]>;
}

/** Live interviewer: prompts the founder on stdin, one question at a time. */
class TerminalInterviewer implements Interviewer {
  readonly name = "terminal";

  async collect(questions: string[]): Promise<string[]> {
    if (questions.length === 0) return [];
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    try {
      const answers: string[] = [];
      console.log(
        `\nFounder interview — ${questions.length} question(s). Answer each below.\n`,
      );
      for (let i = 0; i < questions.length; i++) {
        const answer = await rl.question(`Q${i + 1}. ${questions[i] ?? ""}\n> `);
        answers.push(answer.trim() || "(no answer provided)");
      }
      return answers;
    } finally {
      rl.close();
    }
  }
}

/** Deterministic offline interviewer. Never reads stdin, never calls the model. */
export class MockInterviewer implements Interviewer {
  readonly name = "mock";

  collect(questions: string[]): Promise<string[]> {
    return Promise.resolve(
      questions.map(
        (_q, i) =>
          `Mock founder answer ${i + 1} — provided offline; no AI judgement involved.`,
      ),
    );
  }
}

/** Choose the interviewer implementation based on env (mirrors `selectWorker`). */
export function selectInterviewer(): Interviewer {
  if (loadEnv().KOS_AGENT === "mock") return new MockInterviewer();
  return new TerminalInterviewer();
}
