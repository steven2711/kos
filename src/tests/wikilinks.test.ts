import { describe, it, expect } from "vitest";
import {
  extractWikilinks,
  stripCode,
  buildResolutionIndex,
  resolves,
  resolutionKey,
} from "../core/wikilinks.js";

describe("wikilinks", () => {
  it("extracts plain, aliased, and escaped-pipe links", () => {
    const body = `See [[Constitution]] and [[Glossary|the glossary]] and a table [[ADR-0001\\|ADR-0001]].`;
    const links = extractWikilinks(body);
    expect(links.map((l) => l.target)).toEqual([
      "Constitution",
      "Glossary",
      "ADR-0001",
    ]);
    expect(links[1]?.alias).toBe("the glossary");
  });

  it("ignores links inside code spans and fenced blocks", () => {
    const body = [
      "Real [[Home]].",
      "Inline `[[NotALink]]` here.",
      "```",
      "[[AlsoNotALink]]",
      "```",
    ].join("\n");
    const links = extractWikilinks(body);
    expect(links.map((l) => l.target)).toEqual(["Home"]);
  });

  it("excludes angle-bracket placeholders", () => {
    const links = extractWikilinks("Use [[<Concept Name>]] then [[Domain Map]].");
    expect(links.map((l) => l.target)).toEqual(["Domain Map"]);
  });

  it("resolves case-insensitively and strips anchors", () => {
    const index = buildResolutionIndex(["Knowledge Graph", "Home"]);
    expect(resolves("knowledge graph", index)).toBe(true);
    expect(resolves("Knowledge Graph#Purpose", index)).toBe(true);
    expect(resolves("04 Domain/Knowledge Graph", index)).toBe(true);
    expect(resolves("Nonexistent", index)).toBe(false);
  });

  it("resolutionKey normalises path, extension, anchor and case", () => {
    expect(resolutionKey("Foo/Bar.md#Sec")).toBe("bar");
  });

  it("stripCode preserves line count", () => {
    const body = "a\n```\nx\n```\nb";
    expect(stripCode(body).split("\n").length).toBe(body.split("\n").length);
  });
});
