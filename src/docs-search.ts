import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

// One heading-delimited section of a documentation page.
interface DocSection {
  readonly page: string;
  readonly title: string;
  readonly anchor: string;
  readonly body: string;
}

export interface SearchHit {
  readonly title: string;
  readonly page: string;
  readonly link: string;
  readonly snippet: string;
  readonly score: number;
}

async function listMarkdown(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMarkdown(full)));
    } else if (entry.name.endsWith(".md")) {
      files.push(full);
    }
  }
  return files;
}

// The clean URL slug a page is served at: index.md is the home page (""),
// nested files keep their path (errors/not_found).
function slugForFile(root: string, file: string): string {
  const rel = relative(root, file).split(sep).join("/").replace(/\.md$/, "");
  return rel === "index" ? "" : rel;
}

// A GitHub-style heading anchor.
function anchorFor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function splitSections(page: string, markdown: string): DocSection[] {
  const sections: DocSection[] = [];
  let title = page === "" ? "Overview" : page;
  let anchor = "";
  let buffer: string[] = [];
  const flush = (): void => {
    const body = buffer.join("\n").trim();
    if (body.length > 0) sections.push({ page, title, anchor, body });
    buffer = [];
  };
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      title = (heading[1] ?? "").trim();
      anchor = anchorFor(title);
    } else {
      buffer.push(line);
    }
  }
  flush();
  return sections;
}

let cache: { readonly dir: string; readonly sections: DocSection[] } | null = null;

async function loadSections(dir: string): Promise<DocSection[]> {
  if (cache && cache.dir === dir) return cache.sections;
  const sections: DocSection[] = [];
  for (const file of await listMarkdown(dir)) {
    const markdown = await readFile(file, "utf8");
    sections.push(...splitSections(slugForFile(dir, file), markdown));
  }
  cache = { dir, sections };
  return sections;
}

function countOccurrences(haystack: string, term: string): number {
  let count = 0;
  let index = haystack.indexOf(term);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(term, index + term.length);
  }
  return count;
}

function linkFor(base: string, slug: string, anchor: string): string {
  const path = slug === "" ? "/" : `/${slug}`;
  return anchor ? `${base}${path}#${anchor}` : `${base}${path}`;
}

function snippet(body: string): string {
  const text = body
    .replace(/`{1,3}/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}

// Scores every section against the query terms — a hit in a heading counts for
// more than one in the body — and returns the best matches with their links.
export async function searchDocs(
  dir: string,
  docsBase: string,
  query: string,
  limit: number,
): Promise<SearchHit[]> {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 2);
  if (terms.length === 0) return [];

  const hits: SearchHit[] = [];
  for (const section of await loadSections(dir)) {
    const title = section.title.toLowerCase();
    const body = section.body.toLowerCase();
    let score = 0;
    for (const term of terms) {
      score += countOccurrences(title, term) * 5 + countOccurrences(body, term);
    }
    if (score > 0) {
      hits.push({
        title: section.title,
        page: section.page,
        link: linkFor(docsBase, section.page, section.anchor),
        snippet: snippet(section.body),
        score,
      });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}
