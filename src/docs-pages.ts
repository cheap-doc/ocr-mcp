import { readFile } from "node:fs/promises";
import { listMarkdown, slugForFile } from "./docs-search.ts";

// One page of the documentation copy this server ships, as a client reads it
// through `resources/read`: the page's own title and one-line description from
// its front matter, and the markdown below that front matter.
export interface DocPage {
  // The page's path under the documentation root, without `.md`; the home page
  // is `index`, so every page has a non-empty name a URI can carry.
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly markdown: string;
}

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

// The front matter's flat `key: value` lines. The documentation pages hold
// nothing nested, and only title and description are read from it, so a
// YAML parser would be a dependency bought for two strings.
function frontMatter(text: string): { fields: Map<string, string>; body: string } {
  const match = FRONT_MATTER.exec(text);
  if (!match) return { fields: new Map(), body: text };
  const fields = new Map<string, string>();
  for (const line of (match[1] ?? "").split(/\r?\n/)) {
    const pair = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!pair) continue;
    let value = (pair[2] ?? "").trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replace(/\\"/g, '"');
    }
    fields.set(pair[1] ?? "", value);
  }
  return { fields, body: text.slice(match[0].length) };
}

export function pageFromMarkdown(slug: string, text: string): DocPage {
  const { fields, body } = frontMatter(text);
  return {
    slug,
    title: fields.get("title") || slug,
    description: fields.get("description") ?? "",
    markdown: body.trimStart(),
  };
}

let cache: { readonly dir: string; readonly pages: readonly DocPage[] } | null = null;

// Every page under the documentation root, sorted by slug. Read once per
// directory and kept: the hosted server builds a fresh MCP server for each
// request, and the corpus does not change while the process runs.
export async function loadPages(dir: string): Promise<readonly DocPage[]> {
  if (dir === "") return [];
  if (cache && cache.dir === dir) return cache.pages;
  const pages: DocPage[] = [];
  for (const file of await listMarkdown(dir)) {
    const slug = slugForFile(dir, file) || "index";
    pages.push(pageFromMarkdown(slug, await readFile(file, "utf8")));
  }
  pages.sort((a, b) => a.slug.localeCompare(b.slug));
  cache = { dir, pages };
  return pages;
}
