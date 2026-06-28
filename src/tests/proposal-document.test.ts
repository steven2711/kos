import { describe, it, expect } from "vitest";
import {
  renderProposalDocument,
  proposalFileName,
  nextProposalId,
  asWikilink,
  linkTarget,
  type ProposalDocumentInput,
} from "../core/proposal-document.js";
import { compileDocs } from "../core/compiler.js";
import { vaultDoc } from "./support/builders.js";

const BASE: ProposalDocumentInput = {
  id: "P-001",
  title: "Usage-based pricing beats seats",
  created: "2026-06-27",
  updated: "2026-06-27",
  claim: "Usage-based pricing beats per-seat pricing for our market",
  targetDocument: "[[Pricing]]",
  supportingDocuments: ["[[Pricing]]"],
  sourceResearch: ["[[Runway Analysis]]"],
};

/** Sinks so the proposal's wikilinks resolve when compiled. */
function sinks() {
  return [
    vaultDoc({ relPath: "Home.md" }),
    vaultDoc({ relPath: "11 Proposals/Proposals Map.md", type: "moc" }),
    vaultDoc({ relPath: "04 Domain/Pricing.md", links: ["Home"] }),
    vaultDoc({ relPath: "07 Research/Runway Analysis.md", type: "research" }),
  ];
}

describe("renderProposalDocument", () => {
  it("renders every required proposal section", () => {
    const md = renderProposalDocument(BASE);
    for (const section of [
      "## Purpose",
      "## Proposed Change",
      "## Target Document",
      "## Supporting Evidence",
      "## Source Research",
      "## Impact",
      "## Open Questions",
      "## Reviewer Notes",
      "## Decision",
      "## Related Documents",
    ]) {
      expect(md).toContain(section);
    }
  });

  it("records provenance and the proposal lifecycle status in frontmatter", () => {
    const md = renderProposalDocument(BASE);
    expect(md).toContain("type: knowledge_proposal");
    expect(md).toContain("status: review");
    expect(md).toContain("proposal_id: P-001");
    expect(md).toContain('target_document: "[[Pricing]]"');
    expect(md).toContain('claim: "Usage-based pricing');
    expect(md).toContain("confidence: medium");
  });

  it("compiles with zero errors of its own", () => {
    const rel = "11 Proposals/P-001 - Pricing.md";
    const proposal = vaultDoc({ relPath: rel, raw: renderProposalDocument(BASE) });
    const errors = compileDocs([proposal, ...sinks()]).errors.filter(
      (e) => e.path === rel,
    );
    expect(errors).toEqual([]);
  });

  it("flags PROV-001 when the target document does not resolve", () => {
    const rel = "11 Proposals/P-002 - Ghost.md";
    const proposal = vaultDoc({
      relPath: rel,
      raw: renderProposalDocument({
        ...BASE,
        id: "P-002",
        targetDocument: "[[Ghost]]",
        supportingDocuments: ["[[Pricing]]"],
      }),
    });
    const issues = compileDocs([proposal, ...sinks()]).errors.filter(
      (e) => e.path === rel,
    );
    expect(issues.some((i) => i.ruleId === "PROV-001")).toBe(true);
  });
});

describe("proposal id and file-name helpers", () => {
  it("assigns sequential P-NNN ids", () => {
    expect(nextProposalId([])).toBe("P-001");
    expect(nextProposalId(["P-001", "P-004"])).toBe("P-005");
    expect(nextProposalId(["T-009", "junk"])).toBe("P-001");
  });

  it("builds a filesystem-safe file name", () => {
    expect(proposalFileName("P-003", "Runway: Positioning?")).toBe(
      "P-003 - Runway Positioning.md",
    );
  });

  it("normalises wikilinks idempotently", () => {
    expect(asWikilink("Pricing")).toBe("[[Pricing]]");
    expect(asWikilink("[[Pricing]]")).toBe("[[Pricing]]");
    expect(linkTarget("[[04 Domain/Pricing.md|Pricing]]")).toBe("04 Domain/Pricing.md");
  });
});
