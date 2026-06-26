/**
 * Shared issue vocabulary for the knowledge compiler.
 *
 * Rule ids mirror the vault's own `01 Kernel/Validation Rules.md` catalog
 * (FM-*, SEC-*, LNK-*, TPL-*, LOC-*) so terminal output and the written
 * reports speak the same language as the Kernel.
 */

export type Severity = "ERROR" | "WARNING" | "INFO";

export interface CompilerIssue {
  ruleId: string;
  severity: Severity;
  message: string;
  /** Vault-relative path of the offending document, when applicable. */
  path?: string;
  /** 1-based line number, when known. */
  line?: number;
}

export function issue(
  ruleId: string,
  severity: Severity,
  message: string,
  path?: string,
  line?: number,
): CompilerIssue {
  return { ruleId, severity, message, path, line };
}

export function bySeverity(
  issues: CompilerIssue[],
  severity: Severity,
): CompilerIssue[] {
  return issues.filter((i) => i.severity === severity);
}
