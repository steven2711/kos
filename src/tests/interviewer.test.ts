import { describe, it, expect } from "vitest";
import { MockInterviewer } from "../workers/interviewer.js";

describe("MockInterviewer", () => {
  it("returns exactly one deterministic answer per question", async () => {
    const interviewer = new MockInterviewer();
    const questions = ["What is the product?", "Who is it for?"];

    const first = await interviewer.collect(questions);
    const second = await interviewer.collect(questions);

    expect(first).toHaveLength(questions.length);
    // Offline answers are stable across runs (no AI, no randomness, no clock).
    expect(first).toEqual(second);
  });

  it("returns no answers when there are no questions", async () => {
    expect(await new MockInterviewer().collect([])).toEqual([]);
  });
});
