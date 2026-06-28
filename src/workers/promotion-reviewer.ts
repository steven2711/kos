/**
 * The promotion-approval boundary — where the founder, and only the founder,
 * decides whether a knowledge proposal becomes canonical truth.
 *
 * Like the `Interviewer`, this never touches the Agent SDK: the AI may *create*
 * proposals, but it can never approve, reject, or merge one. `TerminalPromotionReviewer`
 * prompts on stdin (live). `MockPromotionReviewer` returns a deterministic canned
 * decision so `kos promote` and its tests run offline. Select the mock with
 * `KOS_AGENT=mock` or `KOS_PROMOTION_REVIEWER=mock`, mirroring the interviewer.
 */
import * as readline from "node:readline/promises";
import { loadEnv } from "../config/env.js";

export type PromotionDecision = "approve" | "reject" | "request_changes";

/** What the founder is shown for one proposal before deciding. */
export interface PromotionPresentation {
  id: string;
  title: string;
  purpose: string;
  proposedChange: string;
  /** Wikilink/relPath of the target canonical document. */
  target: string;
  /** Supporting evidence (wikilinks/relPaths/sources). */
  evidence: string[];
  impact: string;
}

export interface ReviewerResponse {
  decision: PromotionDecision;
  /** Optional founder note, recorded on the proposal (esp. for request_changes). */
  note?: string;
}

export interface PromotionReviewer {
  readonly name: string;
  /** Present one proposal and return the founder's decision. */
  review(p: PromotionPresentation): Promise<ReviewerResponse>;
}

function presentationText(p: PromotionPresentation): string {
  const lines = [
    `\n── Proposal ${p.id}: ${p.title} ──`,
    `Purpose: ${p.purpose}`,
    `Target:  ${p.target}`,
    "",
    "Proposed change:",
    p.proposedChange,
    "",
    "Supporting evidence:",
    ...(p.evidence.length > 0 ? p.evidence.map((e) => `  - ${e}`) : ["  (none cited)"]),
    "",
    `Impact: ${p.impact}`,
  ];
  return lines.join("\n");
}

/** Live reviewer: prints the proposal and prompts the founder on stdin. */
class TerminalPromotionReviewer implements PromotionReviewer {
  readonly name = "terminal";

  async review(p: PromotionPresentation): Promise<ReviewerResponse> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    try {
      console.log(presentationText(p));
      let decision: PromotionDecision | null = null;
      while (decision === null) {
        const answer = (
          await rl.question("\nDecision — [a]pprove / [r]eject / [c]hanges? ")
        )
          .trim()
          .toLowerCase();
        if (answer === "a" || answer === "approve") decision = "approve";
        else if (answer === "r" || answer === "reject") decision = "reject";
        else if (answer === "c" || answer === "changes" || answer === "request_changes")
          decision = "request_changes";
        else console.log('Please answer "a", "r", or "c".');
      }
      const note = (await rl.question("Note (optional): ")).trim();
      return note === "" ? { decision } : { decision, note };
    } finally {
      rl.close();
    }
  }
}

/** Deterministic offline reviewer. Never reads stdin, never calls the model. */
export class MockPromotionReviewer implements PromotionReviewer {
  readonly name = "mock";
  private readonly decision: PromotionDecision;
  private readonly note: string | undefined;

  constructor(decision: PromotionDecision = "approve", note?: string) {
    this.decision = decision;
    this.note = note;
  }

  review(_p: PromotionPresentation): Promise<ReviewerResponse> {
    return Promise.resolve(
      this.note === undefined
        ? { decision: this.decision }
        : { decision: this.decision, note: this.note },
    );
  }
}

/** Choose the reviewer based on env (mirrors `selectInterviewer`). */
export function selectPromotionReviewer(): PromotionReviewer {
  const env = loadEnv();
  if (env.KOS_AGENT === "mock" || env.KOS_PROMOTION_REVIEWER === "mock") {
    return new MockPromotionReviewer();
  }
  return new TerminalPromotionReviewer();
}
