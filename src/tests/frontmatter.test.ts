import { describe, it, expect } from "vitest";
import {
  parseFile,
  checkFrontmatter,
  ALLOWED_TYPES,
  ALLOWED_STATUSES,
} from "../core/frontmatter.js";

const VALID = `---
type: concept
status: canonical
created: 2026-06-25
updated: 2026-06-25
owner: founder
tags: [domain]
parents: ["[[Domain Map]]"]
children: []
related: ["[[Linking Standards]]"]
---

# Thing

body`;

function check(raw: string, opts?: Partial<Parameters<typeof checkFrontmatter>[1]>) {
  return checkFrontmatter(parseFile(raw), {
    path: "x.md",
    isTemplate: false,
    inTemplatesFolder: false,
    ...opts,
  });
}

describe("frontmatter", () => {
  it("accepts a fully valid block", () => {
    expect(check(VALID)).toHaveLength(0);
  });

  it("flags missing frontmatter (FM-001)", () => {
    const issues = check("# No frontmatter\n\nbody");
    expect(issues.some((i) => i.ruleId === "FM-001")).toBe(true);
  });

  it("flags missing required keys (FM-002)", () => {
    const raw = `---
type: concept
status: draft
---

# T`;
    const issues = check(raw);
    expect(issues.some((i) => i.ruleId === "FM-002")).toBe(true);
  });

  it("flags an invalid type (FM-003) and status (FM-004)", () => {
    const raw = VALID.replace("type: concept", "type: template").replace(
      "status: canonical",
      "status: published",
    );
    const issues = check(raw);
    expect(issues.some((i) => i.ruleId === "FM-003")).toBe(true);
    expect(issues.some((i) => i.ruleId === "FM-004")).toBe(true);
  });

  it("flags updated earlier than created (FM-005)", () => {
    const raw = VALID.replace("updated: 2026-06-25", "updated: 2026-06-24");
    expect(check(raw).some((i) => i.ruleId === "FM-005")).toBe(true);
  });

  it("enforces template marker discipline (TPL-001)", () => {
    const raw = VALID.replace("status: canonical", "status: draft").replace(
      "tags: [domain]",
      "tags: [domain]\ntemplate: true",
    );
    // template:true but not in Templates folder -> TPL-001
    const issues = check(raw, { isTemplate: true, inTemplatesFolder: false });
    expect(issues.some((i) => i.ruleId === "TPL-001")).toBe(true);
    // same marker, in Templates folder, status draft -> clean
    const ok = check(raw, { isTemplate: true, inTemplatesFolder: true });
    expect(ok.filter((i) => i.ruleId.startsWith("TPL")).length).toBe(0);
  });

  it("exposes the canonical enums", () => {
    expect(ALLOWED_TYPES).toContain("adr");
    expect(ALLOWED_TYPES).not.toContain("template");
    expect(ALLOWED_STATUSES).toEqual([
      "draft",
      "review",
      "accepted",
      "canonical",
      "deprecated",
      "archived",
    ]);
  });
});
