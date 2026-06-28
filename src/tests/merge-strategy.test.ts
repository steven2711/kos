import { describe, it, expect } from "vitest";
import { AppendMergeStrategy, type MergeInput } from "../core/merge-strategy.js";

const TARGET = `---
type: concept
status: canonical
created: 2026-06-01
updated: 2026-06-01
owner: founder
tags: ["pricing"]
parents: ["[[Domain Map]]"]
children: []
related: []
---

# Pricing

## Purpose

The canonical pricing model. Links [[Home]] [[A]] [[B]] [[C]] [[D]].

## Open Questions

- None.
`;

function input(over: Partial<MergeInput> = {}): MergeInput {
  return {
    targetRaw: TARGET,
    targetRelPath: "04 Domain/Pricing.md",
    proposal: {
      id: "P-003",
      title: "Usage-based pricing",
      body: "Adopt usage-based pricing as the canonical model.",
      evidenceLinks: ["[[Runway Analysis]]", "Pricing"],
      proposalLink: "11 Proposals/P-003 - Usage-based pricing",
    },
    now: "2026-06-27",
    ...over,
  };
}

describe("AppendMergeStrategy", () => {
  it("appends a provenance-tagged section without rewriting existing prose", () => {
    const { mergedRaw } = new AppendMergeStrategy().merge(input());

    // The original body is preserved verbatim, followed by the promotion block.
    expect(mergedRaw).toContain("# Pricing\n\n## Purpose");
    expect(mergedRaw).toContain("## Promoted Knowledge: Usage-based pricing");
    expect(mergedRaw).toContain(
      "<!-- promoted: P-003 · 2026-06-27 · founder-approved -->",
    );
    expect(mergedRaw).toContain("<!-- evidence: [[Runway Analysis]], [[Pricing]] -->");
    expect(mergedRaw).toContain(
      "<!-- proposal: [[11 Proposals/P-003 - Usage-based pricing]] -->",
    );
    expect(mergedRaw).toContain("Adopt usage-based pricing as the canonical model.");
    expect(mergedRaw).toContain(
      "Source: [[11 Proposals/P-003 - Usage-based pricing]]",
    );
  });

  it("preserves the frontmatter byte-for-byte except the updated line", () => {
    const { mergedRaw } = new AppendMergeStrategy().merge(input());
    expect(mergedRaw).toContain("updated: 2026-06-27"); // bumped
    expect(mergedRaw).not.toContain("updated: 2026-06-01"); // old value gone
    // Every other frontmatter line is untouched.
    expect(mergedRaw).toContain("created: 2026-06-01");
    expect(mergedRaw).toContain('parents: ["[[Domain Map]]"]');
    expect(mergedRaw).toContain("owner: founder");
  });

  it("only adds to the body tail — the pre-existing body is a prefix", () => {
    const { mergedRaw } = new AppendMergeStrategy().merge(input());
    const bodyStart = mergedRaw.indexOf("# Pricing");
    const original = TARGET.slice(TARGET.indexOf("# Pricing")).trimEnd();
    expect(mergedRaw.slice(bodyStart).startsWith(original)).toBe(true);
  });

  it("renders an em-dash when no evidence links are cited", () => {
    const { mergedRaw } = new AppendMergeStrategy().merge(
      input({
        proposal: {
          id: "P-004",
          title: "X",
          body: "y",
          evidenceLinks: [],
          proposalLink: "11 Proposals/P-004 - X",
        },
      }),
    );
    expect(mergedRaw).toContain("<!-- evidence: — -->");
  });
});
