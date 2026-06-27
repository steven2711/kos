/** `kos validate <vaultPath>` — deterministic checks + a written report. */
import { loadVault } from "../core/vault.js";
import { compileDocs, type CompilerResult } from "../core/compiler.js";
import { writeMetaFile, todayISO } from "../core/io.js";
import { renderValidationReport } from "../reports/compiler-report.js";
import { type CompilerIssue } from "../core/issues.js";

export interface ValidateOptions {
  /** Suppress writing the report (used by `run`'s internal re-validation). */
  noReport?: boolean;
  /** Suppress console output. */
  quiet?: boolean;
}

function printIssues(label: string, issues: CompilerIssue[]): void {
  if (issues.length === 0) return;
  console.log(`\n${label} (${issues.length}):`);
  for (const i of issues) {
    const loc =
      i.path !== undefined && i.path !== ""
        ? ` ${i.path}${i.line !== undefined ? `:${i.line}` : ""}`
        : "";
    console.log(`  ${i.severity} ${i.ruleId} — ${i.message}${loc}`);
  }
}

export async function validateVault(
  vaultPath: string,
  opts: ValidateOptions = {},
): Promise<CompilerResult> {
  const docs = await loadVault(vaultPath);
  const result = compileDocs(docs);

  if (opts.quiet !== true) {
    console.log(`Scanned ${result.docCount} documents in ${vaultPath}`);
    printIssues("ERRORS", result.errors);
    printIssues("WARNINGS", result.warnings);
    printIssues("SUGGESTIONS", result.suggestions);
    console.log(
      `\nSummary: ${result.errors.length} error(s), ${result.warnings.length} warning(s), ${result.suggestions.length} suggestion(s).`,
    );
  }

  if (opts.noReport !== true) {
    const rel = await writeMetaFile(
      vaultPath,
      "Validation Report.md",
      renderValidationReport(result, vaultPath, todayISO()),
    );
    if (opts.quiet !== true) console.log(`Wrote ${rel}`);
  }

  return result;
}

/** CLI entry: returns the process exit code (non-zero if any ERROR). */
export async function runValidateCommand(vaultPath: string): Promise<number> {
  const result = await validateVault(vaultPath);
  return result.errors.length > 0 ? 1 : 0;
}
