import { describe, it, expect } from "vitest";
import {
  renderPromotionReport,
  type ProposalSummary,
} from "../reports/promotion-report.js";
import { proposalTask } from "./support/builders.js";

function summary(over: Partial<ProposalSummary>): ProposalSummary {
  return {
    id: "P-001",
    title: "A claim",
    status: "review",
    target: "Pricing",
    relPath: "11 Proposals/P-001 - A claim.md",
    ...over,
  };
}

describe("renderPromotionReport", () => {
  it("groups proposals by lifecycle status", () => {
    const proposals = [
      summary({ id: "P-001", title: "pending one", status: "review" }),
      summary({ id: "P-002", title: "merged one", status: "merged" }),
      summary({ id: "P-003", title: "rejected one", status: "rejected" }),
      summary({ id: "P-004", title: "changes one", status: "draft" }),
    ];
    const md = renderPromotionReport({
      proposals,
      tasks: [proposalTask({ id: "T-001", status: "open" })],
      mergedDocs: ["04 Domain/Pricing.md"],
      now: "2026-06-27",
    });

    expect(md).toContain("# Promotion Report");
    expect(md).toContain("pending one"); // Pending
    expect(md).toContain("merged one"); // Merged
    expect(md).toContain("rejected one"); // Rejected
    expect(md).toContain("changes one"); // Changes requested
    expect(md).toContain("04 Domain/Pricing.md"); // Canonical documents updated
    expect(md).toContain("T-001"); // Open proposal tasks
  });

  it("states clearly when nothing has been proposed", () => {
    const md = renderPromotionReport({
      proposals: [],
      tasks: [],
      mergedDocs: [],
      now: "d",
    });
    expect(md).toContain("No proposals awaiting review.");
    expect(md).toContain("No canonical documents were updated this run.");
    expect(md).toContain("No proposals exist yet.");
  });
});
