/**
 * How an approved knowledge proposal lands in a canonical document.
 *
 * `MergeStrategy` is the seam between the promotion *workflow* (discover → review
 * → decide) and the *edit* itself. v0.9 ships exactly one strategy:
 * `AppendMergeStrategy`, which appends the approved change as a deterministic,
 * provenance-tagged section. It never rewrites existing prose — it only adds an
 * attributed block — honouring "knowledge is never silently rewritten." A future
 * `WorkerMergeStrategy` (LLM-integrated edits) can slot in behind this interface
 * with no change to the command.
 *
 * Strategies are **pure**: they transform raw markdown text and return the new
 * text. They never touch the filesystem — the command writes, snapshots,
 * re-validates, and rolls back. The frontmatter is preserved byte-for-byte except
 * the `updated:` line, because there is no lossless frontmatter serialiser in the
 * codebase (gray-matter only parses) — surgical text editing is the safe path.
 */

/** Everything a strategy needs about the approved proposal. */
export interface ProposalMergeInfo {
  /** Proposal id, `P-NNN`. */
  id: string;
  /** Proposal title (rendered into the section heading). */
  title: string;
  /** The approved proposed-change body to merge in. */
  body: string;
  /** Evidence wikilink targets (rendered into the provenance comment). */
  evidenceLinks: string[];
  /** Wikilink target of the proposal document itself. */
  proposalLink: string;
}

export interface MergeInput {
  /** Raw markdown of the target canonical document. */
  targetRaw: string;
  /** Vault-relative path of the target (for diagnostics). */
  targetRelPath: string;
  proposal: ProposalMergeInfo;
  /** `YYYY-MM-DD` merge date (stamped into the block and the `updated:` line). */
  now: string;
}

export interface MergeResult {
  /** The merged raw markdown to write back to the target. */
  mergedRaw: string;
}

export interface MergeStrategy {
  readonly name: string;
  merge(input: MergeInput): MergeResult;
}

const FRONTMATTER_RE = /^(﻿?---\r?\n[\s\S]*?\r?\n---\r?\n)([\s\S]*)$/;

function asWikilink(target: string): string {
  const inner = target.match(/\[\[([^\]]+?)\]\]/)?.[1] ?? target;
  return `[[${inner.trim()}]]`;
}

/**
 * Append the approved change as a provenance-tagged section. Deterministic and
 * idempotent in format: the same input always yields the same output.
 */
export class AppendMergeStrategy implements MergeStrategy {
  readonly name = "append";

  merge(input: MergeInput): MergeResult {
    const { targetRaw, proposal, now } = input;

    const match = FRONTMATTER_RE.exec(targetRaw);
    const frontmatter = match ? (match[1] ?? "") : "";
    const body = match ? (match[2] ?? "") : targetRaw;

    // Surgically bump only the `updated:` line; leave the rest byte-for-byte.
    const newFrontmatter = frontmatter.replace(
      /^updated:.*$/m,
      `updated: ${now}`,
    );

    const evidence =
      proposal.evidenceLinks.length > 0
        ? proposal.evidenceLinks.map(asWikilink).join(", ")
        : "—";
    const proposalLink = asWikilink(proposal.proposalLink);

    const block = [
      `## Promoted Knowledge: ${proposal.title}`,
      "",
      `<!-- promoted: ${proposal.id} · ${now} · founder-approved -->`,
      `<!-- evidence: ${evidence} -->`,
      `<!-- proposal: ${proposalLink} -->`,
      "",
      proposal.body.trim(),
      "",
      `Source: ${proposalLink}`,
    ].join("\n");

    const trimmedBody = body.replace(/\s*$/, "");
    const mergedBody = `${trimmedBody}\n\n${block}\n`;

    return { mergedRaw: `${newFrontmatter}${mergedBody}` };
  }
}
