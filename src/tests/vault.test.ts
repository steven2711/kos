import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  loadVault,
  collectInboxDocs,
  snapshotKernel,
  kernelChanges,
  knowledgeLayerCoverage,
  looksLikeVault,
  resolveVaultDir,
  type VaultDoc,
} from "../core/vault.js";
import { vaultDoc, markdownDoc } from "./support/builders.js";
import {
  makeTempVault,
  removeTempVault,
  writeVaultFile,
} from "./support/tmp-vault.js";

describe("knowledgeLayerCoverage", () => {
  it("counts a layer only for a real, non-navigation, non-template document", () => {
    const docs = [
      vaultDoc({ relPath: "04 Domain/Real Concept.md" }),
      vaultDoc({ relPath: "02 Vision/_index.md" }), // navigation
      vaultDoc({ relPath: "03 Product/Template.md", status: "draft", template: true }),
      vaultDoc({ relPath: "05 Architecture/Map.md", type: "moc" }), // navigation
    ];
    const coverage = knowledgeLayerCoverage(docs);
    expect(coverage.total).toBe(8);
    expect(coverage.covered).toBe(1);
    expect(coverage.perLayer["04 Domain"]).toBe(true);
    expect(coverage.perLayer["02 Vision"]).toBe(false);
    expect(coverage.perLayer["03 Product"]).toBe(false);
    expect(coverage.perLayer["05 Architecture"]).toBe(false);
  });
});

describe("resolveVaultDir (CLI path discovery)", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await makeTempVault("kos-resolve-");
  });
  afterEach(async () => {
    await removeTempVault(dir);
  });

  it("uses an explicit path verbatim, even before the vault exists", () => {
    // An override always wins — discovery never runs, so it need not be a vault yet.
    expect(resolveVaultDir("some/where", dir)).toBe(path.resolve(dir, "some/where"));
    expect(resolveVaultDir("/abs/vault", dir)).toBe(path.resolve("/abs/vault"));
  });

  it("discovers a nested vault/ — init's layout — from the project root", async () => {
    await writeVaultFile(dir, "vault/01 Kernel/Constitution.md", "# C\n");
    expect(resolveVaultDir(undefined, dir)).toBe(path.join(dir, "vault"));
  });

  it("falls back to the cwd when the cwd itself is the vault", async () => {
    await writeVaultFile(dir, "01 Kernel/Constitution.md", "# C\n");
    // No nested vault/, but the cwd has a Kernel → operate on the cwd.
    expect(resolveVaultDir(undefined, dir)).toBe(dir);
  });

  it("returns the cwd (a non-vault) when nothing is found, for the caller to reject", () => {
    // makeTempVault only seeds 90 Meta/, so there is no Kernel anywhere.
    expect(resolveVaultDir(undefined, dir)).toBe(dir);
    expect(looksLikeVault(dir)).toBe(false);
  });
});

describe("loadVault classification", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await makeTempVault("kos-vault-");
  });
  afterEach(async () => {
    await removeTempVault(dir);
  });

  const find = (docs: VaultDoc[], rel: string): VaultDoc | undefined =>
    docs.find((d) => d.relPath === rel);

  it("classifies captures, templates, and navigation documents", async () => {
    await writeVaultFile(dir, "00 Inbox/raw idea.md", "# raw idea\n\nnotes\n");
    await writeVaultFile(dir, "00 Inbox/_index.md", "# Inbox\n\nindex\n");
    await writeVaultFile(
      dir,
      "01 Kernel/Templates/Concept.md",
      markdownDoc({ status: "draft", template: true }),
    );
    await writeVaultFile(dir, "04 Domain/Map.md", markdownDoc({ type: "moc" }));

    const docs = await loadVault(dir);

    expect(find(docs, "00 Inbox/raw idea.md")?.isCapture).toBe(true);
    expect(find(docs, "00 Inbox/_index.md")?.isCapture).toBe(false);

    const template = find(docs, "01 Kernel/Templates/Concept.md");
    expect(template?.isTemplate).toBe(true);
    expect(template?.inTemplatesFolder).toBe(true);
    expect(template?.inKernel).toBe(true);

    expect(find(docs, "04 Domain/Map.md")?.isNavigation).toBe(true);
  });
});

describe("collectInboxDocs", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await makeTempVault("kos-inbox-");
  });
  afterEach(async () => {
    await removeTempVault(dir);
  });

  it("returns top-level inbox docs, excluding _index and Interviews captures", async () => {
    await writeVaultFile(dir, "00 Inbox/thesis.md", "# thesis\n");
    await writeVaultFile(dir, "00 Inbox/research.md", "# research\n");
    await writeVaultFile(dir, "00 Inbox/_index.md", "# Inbox\n");
    await writeVaultFile(dir, "00 Inbox/Interviews/Interview-x.md", "# interview\n");

    expect(await collectInboxDocs(dir)).toEqual([
      "00 Inbox/research.md",
      "00 Inbox/thesis.md",
    ]);
  });

  it("returns an empty list when there are no inbox docs", async () => {
    expect(await collectInboxDocs(dir)).toEqual([]);
  });
});

describe("kernelChanges", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await makeTempVault("kos-kernel-");
  });
  afterEach(async () => {
    await removeTempVault(dir);
  });

  it("detects modified and newly-added Kernel files", async () => {
    await writeVaultFile(dir, "01 Kernel/Constitution.md", "# Constitution\n\nv1\n");
    const before = await snapshotKernel(dir);

    await writeVaultFile(dir, "01 Kernel/Constitution.md", "# Constitution\n\nv2\n");
    await writeVaultFile(dir, "01 Kernel/Glossary.md", "# Glossary\n\nnew\n");

    const changed = await kernelChanges(dir, before);
    expect(changed).toContain("01 Kernel/Constitution.md");
    expect(changed).toContain("01 Kernel/Glossary.md");
  });

  it("flags a deleted Kernel file", async () => {
    await writeVaultFile(dir, "01 Kernel/Constitution.md", "# Constitution\n\nv1\n");
    const before = await snapshotKernel(dir);

    await fs.rm(path.join(dir, "01 Kernel/Constitution.md"));

    const changed = await kernelChanges(dir, before);
    expect(changed).toContain("01 Kernel/Constitution.md (deleted)");
  });

  it("reports no changes when the Kernel is untouched", async () => {
    await writeVaultFile(dir, "01 Kernel/Constitution.md", "# Constitution\n\nv1\n");
    const before = await snapshotKernel(dir);
    expect(await kernelChanges(dir, before)).toEqual([]);
  });
});
