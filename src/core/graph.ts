/**
 * Knowledge graph: nodes are documents, edges are resolved wikilinks
 * (from both the body and the frontmatter parents/children/related fields).
 * Used for orphan detection (LNK-002) and inbound-link counts.
 */
import { VaultDoc, vaultBasenames } from "./vault.js";
import {
  extractWikilinks,
  buildResolutionIndex,
  resolutionKey,
  Wikilink,
} from "./wikilinks.js";

export interface DocLinks {
  doc: VaultDoc;
  /** Every wikilink found in the body. */
  bodyLinks: Wikilink[];
  /** Wikilinks found in frontmatter parents/children/related. */
  frontmatterLinks: string[];
  /** Distinct resolution keys this doc links out to (body + frontmatter). */
  outKeys: Set<string>;
}

export interface KnowledgeGraph {
  index: Set<string>;
  links: Map<string, DocLinks>;
  /** resolution key -> number of inbound links. */
  inbound: Map<string, number>;
}

function frontmatterLinkStrings(doc: VaultDoc): string[] {
  const out: string[] = [];
  for (const field of ["parents", "children", "related"] as const) {
    const val = doc.parsed.data[field];
    if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item !== "string") continue;
        const m = item.match(/\[\[([^\]]+?)\]\]/);
        if (m) out.push(m[1].replace(/\\\|/g, "|").split("|")[0].trim());
      }
    }
  }
  return out;
}

export function buildGraph(docs: VaultDoc[]): KnowledgeGraph {
  const index = buildResolutionIndex(vaultBasenames(docs));
  const links = new Map<string, DocLinks>();
  const inbound = new Map<string, number>();

  for (const doc of docs) {
    const bodyLinks = extractWikilinks(doc.parsed.content);
    const frontmatterLinks = frontmatterLinkStrings(doc);
    const outKeys = new Set<string>();
    for (const l of bodyLinks) outKeys.add(resolutionKey(l.target));
    for (const t of frontmatterLinks) outKeys.add(resolutionKey(t));
    links.set(doc.relPath, { doc, bodyLinks, frontmatterLinks, outKeys });
  }

  // Tally inbound links (only edges that resolve to a real note count).
  for (const { doc, outKeys } of links.values()) {
    const selfKey = doc.basename.toLowerCase();
    for (const key of outKeys) {
      if (key === selfKey) continue; // ignore self-links
      if (!index.has(key)) continue; // unresolved links carry no inbound credit
      inbound.set(key, (inbound.get(key) ?? 0) + 1);
    }
  }

  return { index, links, inbound };
}

/** Inbound link count for a document. */
export function inboundCount(graph: KnowledgeGraph, doc: VaultDoc): number {
  return graph.inbound.get(doc.basename.toLowerCase()) ?? 0;
}
