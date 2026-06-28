import { describe, it, expect } from "vitest";
import {
  buildReviewContext,
  SemanticReviewSchema,
  SEMANTIC_CHECKS,
} from "../core/semantic-rules.js";
import type { VaultAnalysis } from "../core/compiler.js";
import { vaultDoc, semanticFinding } from "./support/builders.js";

const EMPTY_ANALYSIS: VaultAnalysis = {
  missingLayers: [],
  openQuestions: [],
  brokenLinks: [],
  orphans: [],
  coverage: { covered: 0, total: 8, perLayer: {} },
};

describe("buildReviewContext", () => {
  it("serialises authored documents and the objective analysis for the reviewer", () => {
    const docs = [
      vaultDoc({ relPath: "02 Vision/Vision.md", title: "Vision" }),
      vaultDoc({ relPath: "05 Architecture/Spec.md", type: "specification" }),
    ];
    const analysis: VaultAnalysis = {
      ...EMPTY_ANALYSIS,
      missingLayers: ["08 Business"],
      coverage: { covered: 2, total: 8, perLayer: {} },
    };

    const ctx = buildReviewContext(docs, analysis);

    // Cites the documents and the compiler's objective signals.
    expect(ctx).toContain("02 Vision/Vision.md");
    expect(ctx).toContain("05 Architecture/Spec.md");
    expect(ctx).toContain("2/8");
    expect(ctx).toContain("08 Business");
    // Embeds the rubric so the model applies a consistent set of checks.
    expect(ctx).toContain(SEMANTIC_CHECKS[0]?.title ?? "");
  });

  it("excludes kernel, template, capture, and readme documents", () => {
    const docs = [
      vaultDoc({ relPath: "01 Kernel/Constitution.md" }),
      vaultDoc({ relPath: "01 Kernel/Templates/Concept.md", template: true }),
      vaultDoc({ relPath: "00 Inbox/raw note.md" }),
      vaultDoc({ relPath: "README.md" }),
      vaultDoc({ relPath: "04 Domain/Concept.md" }),
    ];

    const ctx = buildReviewContext(docs, EMPTY_ANALYSIS);

    expect(ctx).toContain("04 Domain/Concept.md");
    expect(ctx).not.toContain("01 Kernel/Constitution.md");
    expect(ctx).not.toContain("00 Inbox/raw note.md");
    expect(ctx).toContain("Documents (1)");
  });
});

describe("SemanticReviewSchema", () => {
  it("accepts a well-formed review", () => {
    const review = { findings: [semanticFinding()], note: "ok" };
    expect(SemanticReviewSchema.safeParse(review).success).toBe(true);
  });

  it("rejects a finding missing its reasoning", () => {
    const malformed = {
      findings: [{ ...semanticFinding(), reasoning: "" }],
    };
    expect(SemanticReviewSchema.safeParse(malformed).success).toBe(false);
  });

  it("rejects an unknown finding class", () => {
    const malformed = {
      findings: [{ ...semanticFinding(), class: "rumor" }],
    };
    expect(SemanticReviewSchema.safeParse(malformed).success).toBe(false);
  });
});
