import { describe, it, expect } from "vitest";
import {
  renderResearchDocument,
  researchFileName,
} from "../core/research-document.js";
import { compileDocs } from "../core/compiler.js";
import { parseFile } from "../core/frontmatter.js";
import { vaultDoc } from "./support/builders.js";

const RENDERED = renderResearchDocument({
  title: "Collaborative AI storytelling competitors",
  query: "competitors for collaborative AI storytelling",
  created: "2026-06-27",
  updated: "2026-06-27",
  sources: [
    {
      title: "An example source",
      url: "https://example.com/a",
      publisher: "example.com",
      accessed: "2026-06-27",
      relevance: "Background on the space.",
    },
  ],
  relatedDocuments: ["Research Map", "Home"],
});

describe("renderResearchDocument", () => {
  it("includes every required section, including Sources", () => {
    for (const heading of [
      "## Purpose",
      "## Context",
      "## Hypotheses",
      "## Method",
      "## Findings",
      "## Sources",
      "## Conclusion",
      "## Open Questions",
      "## Related Documents",
    ]) {
      expect(RENDERED).toContain(heading);
    }
  });

  it("emits valid type:research frontmatter", () => {
    const parsed = parseFile(RENDERED);
    expect(parsed.data.type).toBe("research");
    expect(parsed.data.status).toBe("draft");
  });

  it("contains at least five wikilinks in the body (LNK-001)", () => {
    const body = parseFile(RENDERED).content;
    const count = (body.match(/\[\[[^\]]+\]\]/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(5);
  });

  it("passes the compiler with no errors against resolvable targets", () => {
    // Only the research doc's own validity is asserted; the link targets just
    // need to exist so [[Research Map]] / [[Home]] resolve.
    const docs = [
      vaultDoc({ relPath: "07 Research/Doc.md", raw: RENDERED }),
      vaultDoc({ relPath: "Home.md" }),
      vaultDoc({ relPath: "07 Research/Research Map.md", type: "moc" }),
    ];
    const result = compileDocs(docs);
    const errors = result.errors.filter((e) => e.path === "07 Research/Doc.md");
    expect(errors).toEqual([]);
  });
});

describe("researchFileName", () => {
  it("builds a dated, filesystem-safe name", () => {
    expect(researchFileName("2026-06-27", 'A/B: a "topic"')).toBe(
      "2026-06-27 - A B a topic.md",
    );
  });
});
