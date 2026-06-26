/** Small filesystem helpers shared by the commands. */
import { promises as fs } from "node:fs";
import path from "node:path";
import { META_FOLDER } from "./vault.js";

/** Write a generated file into the vault's `90 Meta/` folder. */
export async function writeMetaFile(
  vaultPath: string,
  fileName: string,
  content: string,
): Promise<string> {
  const dir = path.join(vaultPath, META_FOLDER);
  await fs.mkdir(dir, { recursive: true });
  const abs = path.join(dir, fileName);
  await fs.writeFile(abs, content, "utf8");
  return `${META_FOLDER}/${fileName}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
