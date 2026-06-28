import { describe, it, expect } from "vitest";
import {
  MockSemanticReviewer,
  parseReview,
} from "../workers/semantic-reviewer.js";
import { SemanticReviewSchema } from "../core/semantic-rules.js";

const REQ = { context: "ignored", vaultPath: "/virtual" };

describe("MockSemanticReviewer", () => {
  it("returns a deterministic, schema-valid review without calling the SDK", async () => {
    const reviewer = new MockSemanticReviewer();

    const first = await reviewer.review(REQ);
    const second = await reviewer.review(REQ);

    expect(SemanticReviewSchema.safeParse(first).success).toBe(true);
    // Offline review is stable across calls (no model, no randomness).
    expect(first).toEqual(second);
  });

  it("covers each planner mapping branch (contradiction, recommendation, suggestion)", async () => {
    const { findings } = await new MockSemanticReviewer().review(REQ);
    const classes = findings.map((f) => f.class);
    expect(classes).toContain("possible_contradiction");
    expect(classes).toContain("recommendation");
    expect(classes).toContain("suggestion");
  });
});

describe("parseReview", () => {
  it("extracts a JSON object from a fenced model response", () => {
    const text = 'Here is my review:\n```json\n{"findings": []}\n```\n';
    expect(parseReview(text).findings).toEqual([]);
  });

  it("extracts a bare JSON object surrounded by prose", () => {
    const text = 'noise {"findings": [], "note": "n"} trailing';
    const review = parseReview(text);
    expect(review.findings).toEqual([]);
    expect(review.note).toBe("n");
  });

  it("falls back to an empty advisory review on unparsable output", () => {
    const review = parseReview("the model said no thanks");
    expect(review.findings).toEqual([]);
    expect(typeof review.note).toBe("string");
  });

  it("falls back to empty when JSON is valid but the schema does not match", () => {
    const review = parseReview('{"findings": [{"class": "nope"}]}');
    expect(review.findings).toEqual([]);
  });
});
