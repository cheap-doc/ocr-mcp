// Vendored from the private monorepo's @doc-cheap/contracts (src/doc-links.ts).
// Copied by scripts/sync-mcp-mirror.mjs because that package is not published;
// edit it there, not here.

// The documentation is written with site-absolute links — `](/errors/not_found)`
// — which the HTML pages resolve against the path they are served under. The
// markdown copies of the same pages (`/docs/<page>.md`, `llms-full.txt`, the
// pages the MCP server hands a client) have no page to resolve against: a
// reader fetching them follows `/errors/not_found` from the origin's root, and
// that address does not exist. Those copies therefore carry every such link as
// a full URL under the documentation's base.
//
// Only markdown link destinations are rewritten. A path inside a code span or a
// fenced block is an example, not a link, and is left exactly as written; so
// is a protocol-relative `//host` address, which already names its host.

const FENCE = /^\s{0,3}(```|~~~)/;
// `](` then a site-absolute path: one slash, not two.
const INLINE_LINK = /\]\(\/(?!\/)/g;
// A reference definition, `[label]: /path`.
const REFERENCE_DEFINITION = /^(\s{0,3}\[[^\]]+\]:\s*)\/(?!\/)/;

function rewriteOutsideCodeSpans(line: string, base: string): string {
  // Splitting on backticks puts code spans at the odd indices.
  return line
    .split("`")
    .map((part, index) => (index % 2 === 1 ? part : part.replace(INLINE_LINK, `](${base}/`)))
    .join("`");
}

/** The markdown with every site-absolute link destination made absolute under `docsBase`. */
export function absoluteDocLinks(markdown: string, docsBase: string): string {
  const base = docsBase.replace(/\/+$/, "");
  let fence: string | null = null;
  return markdown
    .split("\n")
    .map((line) => {
      const opener = FENCE.exec(line)?.[1];
      if (fence !== null) {
        if (opener === fence) fence = null;
        return line;
      }
      if (opener !== undefined) {
        fence = opener;
        return line;
      }
      return rewriteOutsideCodeSpans(line.replace(REFERENCE_DEFINITION, `$1${base}/`), base);
    })
    .join("\n");
}

/** Every link destination under `docsBase` in the markdown, as the path below the base. */
export function docLinkPaths(markdown: string, docsBase: string): string[] {
  const base = docsBase.replace(/\/+$/, "");
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\]\\(${escaped}(/[^)\\s#]*)?(?=[)#\\s])`, "g");
  return [...markdown.matchAll(pattern)].map((match) => match[1] || "/");
}
