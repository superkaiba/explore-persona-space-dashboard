/**
 * Markdown ↔ HTML round-trip for the TipTap rich-text editor.
 *
 * Bodies are stored as markdown strings in `claim.body_json.text`. TipTap
 * works on a Prosemirror document tree which it serializes as HTML. We
 * convert at the boundaries:
 *   - On load:  markdown -> HTML (marked)              → TipTap initial content
 *   - On save:  TipTap HTML -> markdown (turndown + GFM tables) → DB
 */

import { marked } from "marked";
import TurndownService from "turndown";
// @ts-expect-error -- no types for turndown-plugin-gfm
import { gfm } from "turndown-plugin-gfm";

// marked: enable GitHub-flavored markdown features (tables, strikethrough)
marked.setOptions({ gfm: true, breaks: false });

let turndown: TurndownService | null = null;
function getTurndown(): TurndownService {
  if (turndown) return turndown;
  turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "_",
    strongDelimiter: "**",
  });
  turndown.use(gfm);
  return turndown;
}

export function markdownToHtml(md: string): string {
  if (!md) return "<p></p>";
  return marked.parse(md, { async: false }) as string;
}

export function htmlToMarkdown(html: string): string {
  if (!html) return "";
  return getTurndown().turndown(html);
}
