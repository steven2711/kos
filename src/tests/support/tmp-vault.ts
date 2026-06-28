/**
 * Temp-vault helpers for integration tests that need a real filesystem.
 *
 * Each test gets an isolated `mkdtemp` directory (scaffolded with `90 Meta/`)
 * and tears it down afterwards — no shared state, no cross-test leakage. This
 * consolidates the per-file setup that compiler/task-store tests duplicated.
 */
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

/** Create an isolated temp vault with a `90 Meta/` folder ready for reports. */
export async function makeTempVault(prefix = "kos-test-"): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  await fs.mkdir(path.join(dir, "90 Meta"), { recursive: true });
  return dir;
}

/** Recursively remove a temp vault. Safe to call in `afterEach`. */
export async function removeTempVault(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

/** Write a vault-relative file, creating parent folders as needed. */
export async function writeVaultFile(
  dir: string,
  relPath: string,
  content: string,
): Promise<void> {
  const abs = path.join(dir, relPath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf8");
}

/** Run `fn` against a fresh temp vault, cleaning up even if it throws. */
export async function withTempVault<T>(
  fn: (dir: string) => Promise<T>,
): Promise<T> {
  const dir = await makeTempVault();
  try {
    return await fn(dir);
  } finally {
    await removeTempVault(dir);
  }
}
