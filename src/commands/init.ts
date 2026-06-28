/**
 * `kos init` — scaffold a brand-new KOS project.
 *
 * Creates a self-contained project whose vault lives under a `vault/` subfolder,
 * seeded from this repo's full, link-clean starter vault: the Kernel (the
 * governance layer a vault cannot run without), the structural MOCs/indexes that
 * make the Kernel's links resolve, and a small set of worked-example docs. The
 * project root itself is left untouched so the user owns it (git, README, notes).
 *
 * Transient, project-specific files are filtered out so they never leak into a
 * new project: generated `90 Meta/` reports, `tasks.json`, and `00 Inbox/`
 * captures. `init` only ever *adds* files; it refuses to scaffold over an
 * existing non-empty vault unless `--force`, and never deletes user content.
 */
import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  VAULT_FOLDERS,
  KERNEL_FOLDER,
  META_FOLDER,
  INBOX_FOLDER,
  GENERATED_META_FILES,
} from "../core/vault.js";

/** The vault lives under this subfolder of the project directory. */
const VAULT_SUBDIR = "vault";
/** LNK-001 requires at least this many resolving wikilinks in a fallback Home. */
const HOME_MIN_LINKS = 5;

export interface InitOptions {
  force?: boolean;
}

/** Today as `YYYY-MM-DD` for frontmatter dates. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Locate the bundled starter vault (a directory that holds the numbered folders).
 * Tries the packaged copy first (built: `dist/templates/vault`), then the repo's
 * own vault root (dev via tsx and `npm link`). It is only ever read, never mutated.
 */
export function resolveStarterVaultDir(): string {
  const candidates = [
    new URL("../templates/vault/", import.meta.url),
    new URL("../../", import.meta.url),
  ].map((u) => fileURLToPath(u));
  for (const dir of candidates) {
    if (existsSync(path.join(dir, KERNEL_FOLDER, "Constitution.md"))) return dir;
  }
  throw new Error(
    "Starter vault template not found. Run `npm run build`, or run from the repo root.",
  );
}

/** Generated tool output in `90 Meta/` that must never be bundled into a new vault. */
function isTransientMetaFile(name: string): boolean {
  return GENERATED_META_FILES.has(name) || name === "tasks.json";
}

/**
 * An `fs.cp` filter for one starter folder: drops generated `90 Meta/` reports +
 * `tasks.json` and every `00 Inbox/` capture (keeping only the inbox `_index.md`).
 * Every other folder is copied verbatim.
 */
function starterFilter(folder: string, srcFolder: string): (src: string) => boolean {
  if (folder === META_FOLDER) {
    return (src) => {
      const rel = path.relative(srcFolder, src);
      if (rel === "" || rel.includes(path.sep)) return true; // dir itself / nested files
      return !isTransientMetaFile(rel);
    };
  }
  if (folder === INBOX_FOLDER) {
    return (src) => {
      const rel = path.relative(srcFolder, src);
      return rel === "" || rel === "_index.md"; // captures + Interviews/ are dropped
    };
  }
  return () => true;
}

/** Render a fallback `Home.md` if the starter has none. Pure, unit-testable. */
export function renderHomeDoc(linkTargets: string[]): string {
  const day = today();
  const bullets = linkTargets.map((t) => `- [[${t}]]`).join("\n");
  const inline = linkTargets.map((t) => `[[${t}]]`).join(" ");
  return `---
type: moc
status: canonical
created: ${day}
updated: ${day}
owner: founder
tags: [home]
parents: []
children: []
related: []
---

# Home

The entry point for this knowledge base. Start with the Kernel: ${inline}.

## Purpose

Orient a reader (human or agent) and link out to the governing Kernel documents.

## Context

This vault was scaffolded by \`kos init\`. Drop source material into \`00 Inbox/\`
and run \`kos start\` to grow the knowledge layers.

## Open Questions

- What should this knowledge base cover first?

## Related Documents

${bullets}
`;
}

/**
 * A generic vault-level `README.md`. Some structural MOCs link to `[[README]]`,
 * so it must exist; it is frontmatter-less and validation-exempt, so a short
 * project-agnostic stub is enough. (This is the *vault's* readme, distinct from
 * any readme the user keeps at the project root.)
 */
const STARTER_README = `# Knowledge Base

A [KOS](https://github.com/) vault. Start at [[Home]]; the governing rules live
in \`01 Kernel/\`. Drop source material into \`00 Inbox/\` and run \`kos start\`
to grow the knowledge layers.
`;

/** Pick at least `HOME_MIN_LINKS` link targets from the copied Kernel docs. */
function homeLinkTargets(kernelBasenames: string[]): string[] {
  const pool = kernelBasenames.length > 0 ? kernelBasenames : ["Home"];
  return Array.from(
    { length: HOME_MIN_LINKS },
    (_, i) => pool[i % pool.length] ?? "Home",
  );
}

export async function runInitCommand(
  projectDir: string,
  opts: InitOptions = {},
): Promise<number> {
  const vaultDir = path.join(projectDir, VAULT_SUBDIR);

  // Refuse to scaffold over an existing non-empty vault (never delete content).
  const existing = await fs.readdir(vaultDir).catch((): string[] => []);
  if (existing.length > 0 && opts.force !== true) {
    console.error(
      `A vault already exists at ${vaultDir} (not empty). ` +
        `Choose an empty location, or pass --force to re-scaffold.`,
    );
    return 1;
  }

  const starter = resolveStarterVaultDir();

  // 1. Copy each numbered folder from the starter, filtering transient files.
  for (const folder of VAULT_FOLDERS) {
    const dest = path.join(vaultDir, folder);
    await fs.mkdir(dest, { recursive: true });
    const srcFolder = path.join(starter, folder);
    if (!existsSync(srcFolder)) continue; // folder absent in starter → leave empty
    await fs.cp(srcFolder, dest, {
      recursive: true,
      filter: starterFilter(folder, srcFolder),
    });
  }

  // 2. Home.md — bundle the starter's, or synthesise a clean fallback.
  const starterHome = path.join(starter, "Home.md");
  const destHome = path.join(vaultDir, "Home.md");
  if (existsSync(starterHome)) {
    await fs.cp(starterHome, destHome);
  } else {
    const kernelBasenames = (await fs.readdir(path.join(vaultDir, KERNEL_FOLDER)))
      .filter((f) => f.toLowerCase().endsWith(".md"))
      .map((f) => f.replace(/\.md$/i, ""))
      .sort();
    await fs.writeFile(destHome, renderHomeDoc(homeLinkTargets(kernelBasenames)), "utf8");
  }

  // 3. A vault-level README so the structural MOCs' `[[README]]` links resolve.
  await fs.writeFile(path.join(vaultDir, "README.md"), STARTER_README, "utf8");

  // 4. A `.gitkeep` in any folder left empty so the tree survives `git init`.
  //    `*.md`-only discovery ignores it, so validation is unaffected.
  for (const folder of VAULT_FOLDERS) {
    const dest = path.join(vaultDir, folder);
    if ((await fs.readdir(dest)).length === 0) {
      await fs.writeFile(path.join(dest, ".gitkeep"), "", "utf8");
    }
  }

  // 5. Summary + the single next step.
  console.log(`✓ Initialized KOS project at ${projectDir}`);
  console.log(`  Vault: ${vaultDir}`);
  console.log("");
  console.log("Next:");
  console.log(`  1. Drop your .md docs into ${path.join(vaultDir, "00 Inbox")}/`);
  console.log(`  2. cd ${projectDir} && kos start`);
  return 0;
}
