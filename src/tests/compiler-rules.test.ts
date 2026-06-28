import { describe, it, expect } from "vitest";
import { compileDocs, type CompilerResult } from "../core/compiler.js";
import { vaultDoc } from "./support/builders.js";

/** Five resolvable link targets so a document can clear the 5-link minimum. */
const LINK_NAMES = ["Home", "A", "B", "C", "D"];
const LINK_BULLETS = LINK_NAMES.map((n) => `- [[${n}]]`).join("\n");

function sinks() {
  return [
    vaultDoc({ relPath: "Home.md" }),
    vaultDoc({ relPath: "04 Domain/A.md" }),
    vaultDoc({ relPath: "04 Domain/B.md" }),
    vaultDoc({ relPath: "04 Domain/C.md" }),
    vaultDoc({ relPath: "04 Domain/D.md" }),
  ];
}

const allIssues = (r: CompilerResult) => [...r.errors, ...r.warnings, ...r.suggestions];
const ruleAt = (r: CompilerResult, ruleId: string, p: string): boolean =>
  allIssues(r).some((i) => i.ruleId === ruleId && i.path === p);

describe("compiler rules", () => {
  it("flags a missing required section (SEC-001)", () => {
    // Concept body with Purpose/Context/Related Documents but no Open Questions.
    const partial = vaultDoc({
      relPath: "04 Domain/Partial.md",
      body: `# Partial\n\n## Purpose\n\nx\n\n## Context\n\nx\n\n## Related Documents\n\n${LINK_BULLETS}`,
    });
    const result = compileDocs([partial, ...sinks()]);
    expect(ruleAt(result, "SEC-001", "04 Domain/Partial.md")).toBe(true);
  });

  it("routes ADRs to the decision-anatomy section set", () => {
    // An ADR missing its "Decision" section fails; a concept without one is fine.
    const adr = vaultDoc({
      relPath: "06 Decisions/ADR-1.md",
      type: "adr",
      body: `# ADR\n\n## Purpose\n\nx\n\n## Problem\n\nx\n\n## Consequences\n\nx\n\n## Status\n\naccepted\n\n## Related Documents\n\n${LINK_BULLETS}`,
    });
    const concept = vaultDoc({ relPath: "04 Domain/Concept.md", links: LINK_NAMES });
    const result = compileDocs([adr, concept, ...sinks()]);
    expect(ruleAt(result, "SEC-001", "06 Decisions/ADR-1.md")).toBe(true);
    expect(ruleAt(result, "SEC-001", "04 Domain/Concept.md")).toBe(false);
  });

  it("requires at least five wikilinks (LNK-001)", () => {
    const sparse = vaultDoc({ relPath: "04 Domain/Sparse.md", links: ["Home"] });
    const result = compileDocs([sparse, ...sinks()]);
    expect(ruleAt(result, "LNK-001", "04 Domain/Sparse.md")).toBe(true);
  });

  it("flags an unresolved wikilink (LNK-003)", () => {
    const broken = vaultDoc({ relPath: "05 Architecture/Broken.md", links: ["Ghost"] });
    const result = compileDocs([broken, ...sinks()]);
    expect(ruleAt(result, "LNK-003", "05 Architecture/Broken.md")).toBe(true);
  });

  it("warns about an orphan with no inbound links (LNK-002)", () => {
    const lonely = vaultDoc({ relPath: "04 Domain/Lonely.md", links: LINK_NAMES });
    const result = compileDocs([lonely, ...sinks()]);
    expect(ruleAt(result, "LNK-002", "04 Domain/Lonely.md")).toBe(true);
  });

  it("scrapes bullets under an Open Questions heading", () => {
    const doc = vaultDoc({ relPath: "04 Domain/Q.md", links: LINK_NAMES });
    const result = compileDocs([doc, ...sinks()]);
    expect(
      result.analysis.openQuestions.some(
        (q) => q.text === "A question?" && q.path === "04 Domain/Q.md",
      ),
    ).toBe(true);
  });
});
