/**
 * Wikilink extraction and resolution (rules LNK-001, LNK-002, LNK-003).
 *
 * Obsidian-style `[[Target]]`, `[[Target|alias]]`, and the escaped-pipe table
 * form `[[Target\|alias]]` are all supported. Links inside fenced or inline
 * code, and `<angle-bracket>` placeholders, are deliberately ignored — they are
 * documentation of the syntax or template slots, not real edges.
 */

export interface Wikilink {
  /** The link target (filename or path, before any alias). */
  target: string;
  /** The display alias, if any. */
  alias?: string;
  /** The full raw match including brackets. */
  raw: string;
  /** 1-based line number in the original body. */
  line: number;
}

/**
 * Remove fenced code blocks and inline code spans so that wikilink-looking
 * syntax inside examples is not treated as a real link. Replaces them with
 * blanks of equal newline count to keep line numbers stable.
 */
export function stripCode(body: string): string {
  // Fenced blocks ``` ... ``` (and ~~~), keep newlines.
  let out = body.replace(/(^|\n)(```|~~~)[\s\S]*?\n\2[^\n]*/g, (m) =>
    m.replace(/[^\n]/g, " "),
  );
  // Inline code `...`
  out = out.replace(/`[^`\n]*`/g, (m) => " ".repeat(m.length));
  return out;
}

const WIKILINK_RE = /\[\[([^\]\n]+?)\]\]/g;

/** True if a target is an angle-bracket placeholder like `<Concept Name>`. */
export function isPlaceholder(target: string): boolean {
  return target.includes("<") || target.includes(">");
}

/**
 * Extract all real wikilinks from a document body (code already stripped).
 * Placeholders are excluded.
 */
export function extractWikilinks(body: string): Wikilink[] {
  const cleaned = stripCode(body);
  const links: Wikilink[] = [];
  const lines = cleaned.split("\n");
  lines.forEach((lineText, idx) => {
    let m: RegExpExecArray | null;
    WIKILINK_RE.lastIndex = 0;
    while ((m = WIKILINK_RE.exec(lineText)) !== null) {
      const inner = m[1];
      // Normalise the escaped pipe used in markdown tables to a plain pipe.
      const normalised = inner.replace(/\\\|/g, "|");
      const pipeIdx = normalised.indexOf("|");
      const target = (pipeIdx >= 0 ? normalised.slice(0, pipeIdx) : normalised).trim();
      const alias =
        pipeIdx >= 0 ? normalised.slice(pipeIdx + 1).trim() : undefined;
      if (isPlaceholder(target)) continue;
      links.push({ target, alias, raw: m[0], line: idx + 1 });
    }
  });
  return links;
}

/**
 * Normalise a link target to its resolution key: strip any `#heading` and
 * `^block` anchors, drop a folder path, drop a trailing `.md`, and lowercase.
 * Obsidian resolves links by the shortest unique note name, case-insensitively.
 */
export function resolutionKey(target: string): string {
  let t = target.split("#")[0].split("^")[0].trim();
  // Use the last path segment (basename) for resolution.
  const seg = t.split("/").pop() ?? t;
  return seg.replace(/\.md$/i, "").trim().toLowerCase();
}

/**
 * Build the set of resolvable note names for a vault, keyed by lowercased
 * basename. (Multiple files sharing a basename collapse — acceptable for v0.)
 */
export function buildResolutionIndex(basenames: string[]): Set<string> {
  return new Set(basenames.map((b) => b.toLowerCase()));
}

/** True if a link target resolves against the index. */
export function resolves(target: string, index: Set<string>): boolean {
  return index.has(resolutionKey(target));
}
