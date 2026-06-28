import { describe, it, expect } from "vitest";
import {
  MockPromotionReviewer,
  type PromotionPresentation,
} from "../workers/promotion-reviewer.js";

const PRESENTATION: PromotionPresentation = {
  id: "P-001",
  title: "A claim",
  purpose: "Decide whether to promote.",
  proposedChange: "Adopt the claim.",
  target: "[[Pricing]]",
  evidence: ["[[Runway Analysis]]"],
  impact: "Updates canonical knowledge.",
};

describe("MockPromotionReviewer", () => {
  it("returns its canned decision without reading stdin", async () => {
    const approve = await new MockPromotionReviewer().review(PRESENTATION);
    expect(approve.decision).toBe("approve");

    const reject = await new MockPromotionReviewer("reject").review(PRESENTATION);
    expect(reject.decision).toBe("reject");

    const changes = await new MockPromotionReviewer(
      "request_changes",
      "tighten the claim",
    ).review(PRESENTATION);
    expect(changes.decision).toBe("request_changes");
    expect(changes.note).toBe("tighten the claim");
  });
});
