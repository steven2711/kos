import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { runInitCommand, renderHomeDoc } from "../commands/init.js";
import { loadVault, VAULT_FOLDERS } from "../core/vault.js";
import { compileDocs } from "../core/compiler.js";
import { makeTempVault, removeTempVault } from "./support/tmp-vault.js";
import { silenceLoopNarration } from "./support/silence-console.js";

silenceLoopNarration();

describe("renderHomeDoc", () => {
  it("emits a validator-shaped root doc with frontmatter, sections, and links", () => {
    const md = renderHomeDoc(["Constitution", "Glossary", "A", "B", "C"]);
    // Frontmatter every authored doc needs (FM-*).
    for (const key of [
      "type:",
      "status:",
      "created:",
      "updated:",
      "owner:",
      "tags:",
      "parents:",
      "children:",
      "related:",
    ]) {
      expect(md).toContain(key);
    }
    // The four required sections (SEC-001 default set).
    for (const section of ["## Purpose", "## Context", "## Open Questions", "## Related Documents"]) {
      expect(md).toContain(section);
    }
    // At least the LNK-001 minimum of five wikilinks.
    expect((md.match(/\[\[[^\]]+\]\]/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });
});

describe("kos init", () => {
  let projectDir: string;
  beforeEach(async () => {
    // Reuse the temp-vault helper purely as an isolated mkdtemp root; init
    // creates the `vault/` subfolder itself.
    projectDir = await makeTempVault("kos-init-");
  });
  afterEach(async () => {
    await removeTempVault(projectDir);
  });

  it("creates a nested vault with every folder, the Kernel, and structural MOCs", async () => {
    const code = await runInitCommand(projectDir);
    expect(code).toBe(0);

    const vaultDir = path.join(projectDir, "vault");
    // The Kernel was copied in.
    await expect(
      fs.readFile(path.join(vaultDir, "01 Kernel", "Constitution.md"), "utf8"),
    ).resolves.toBeTruthy();
    // A structural MOC the Kernel links to is present (proves the full starter).
    await expect(
      fs.readFile(path.join(vaultDir, "04 Domain", "Domain Map.md"), "utf8"),
    ).resolves.toBeTruthy();
    // Every numbered folder exists.
    for (const folder of VAULT_FOLDERS) {
      const stat = await fs.stat(path.join(vaultDir, folder));
      expect(stat.isDirectory()).toBe(true);
    }
    // Home.md was seeded at the vault root.
    await expect(
      fs.readFile(path.join(vaultDir, "Home.md"), "utf8"),
    ).resolves.toContain("# Home");
  });

  it("produces a freshly initialized vault that validates with zero errors", async () => {
    await runInitCommand(projectDir);
    const vaultDir = path.join(projectDir, "vault");

    const { errors } = compileDocs(await loadVault(vaultDir));
    expect(errors).toEqual([]); // the bundled starter is link-clean end to end
  });

  it("does not leak transient project files into the new vault", async () => {
    await runInitCommand(projectDir);
    const vaultDir = path.join(projectDir, "vault");

    // Generated reports and tasks.json are filtered out of 90 Meta/.
    const meta = await fs.readdir(path.join(vaultDir, "90 Meta"));
    expect(meta).not.toContain("Validation Report.md");
    expect(meta).not.toContain("tasks.json");
    // The inbox starts empty of captures — only its _index survives.
    const inbox = await fs.readdir(path.join(vaultDir, "00 Inbox"));
    expect(inbox.filter((f) => f !== "_index.md")).toEqual([]);
  });

  it("refuses to overwrite an existing non-empty vault unless forced", async () => {
    const vaultDir = path.join(projectDir, "vault");
    const sentinel = path.join(vaultDir, "01 Kernel", "Keep.md");
    await fs.mkdir(path.dirname(sentinel), { recursive: true });
    await fs.writeFile(sentinel, "do not clobber", "utf8");

    expect(await runInitCommand(projectDir)).toBe(1);
    // The pre-existing file is untouched.
    await expect(fs.readFile(sentinel, "utf8")).resolves.toBe("do not clobber");

    // --force proceeds and scaffolds over it.
    expect(await runInitCommand(projectDir, { force: true })).toBe(0);
    await expect(
      fs.readFile(path.join(vaultDir, "Home.md"), "utf8"),
    ).resolves.toContain("# Home");
  });

  it("leaves the project root free (only adds vault/)", async () => {
    await runInitCommand(projectDir);
    // init puts all KOS content under vault/ and never writes README/git at the
    // project root — that space is deliberately the user's.
    const atRoot = await fs.readdir(projectDir);
    expect(atRoot).toContain("vault");
    expect(atRoot).not.toContain("README.md");
    expect(atRoot).not.toContain(".git");
  });
});
