import { describe, it, expect } from "vitest";
import { buildGraph, inboundCount } from "../core/graph.js";
import { vaultDoc } from "./support/builders.js";

describe("buildGraph / inboundCount", () => {
  it("credits a document for an inbound body wikilink", () => {
    const source = vaultDoc({ relPath: "04 Domain/Source.md", links: ["Target"] });
    const target = vaultDoc({ relPath: "04 Domain/Target.md" });
    const graph = buildGraph([source, target]);
    expect(inboundCount(graph, target)).toBe(1);
  });

  it("counts links declared in frontmatter relationship fields", () => {
    const source = vaultDoc({
      relPath: "04 Domain/Source.md",
      related: ["[[Target]]"],
    });
    const target = vaultDoc({ relPath: "04 Domain/Target.md" });
    const graph = buildGraph([source, target]);
    expect(inboundCount(graph, target)).toBe(1);
  });

  it("does not count a document's link to itself", () => {
    const solo = vaultDoc({ relPath: "04 Domain/Solo.md", links: ["Solo"] });
    const graph = buildGraph([solo]);
    expect(inboundCount(graph, solo)).toBe(0);
  });

  it("gives no inbound credit for a link that resolves to nothing", () => {
    const source = vaultDoc({ relPath: "04 Domain/Source.md", links: ["Ghost"] });
    const graph = buildGraph([source]);
    expect(graph.inbound.has("ghost")).toBe(false);
  });

  it("reports zero inbound for an orphan document", () => {
    const hub = vaultDoc({ relPath: "04 Domain/Hub.md", links: ["Target"] });
    const target = vaultDoc({ relPath: "04 Domain/Target.md" });
    const orphan = vaultDoc({ relPath: "04 Domain/Orphan.md" });
    const graph = buildGraph([hub, target, orphan]);
    expect(inboundCount(graph, orphan)).toBe(0);
  });
});
