import { absoluteDocLinks } from "./vendor/contracts/doc-links.ts";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { type DocPage, loadPages } from "./docs-pages.ts";

// Every documentation page is a resource, addressed by its path in the docs:
// `doccheap://docs/reference/fields` is the page served at /reference/fields.
export const DOCS_URI_PREFIX = "doccheap://docs/";

// The same address as a template, for a client that knows which page it wants
// — an error code it was just handed, say — without listing all of them first.
// `+` because a slug carries slashes.
export const DOCS_URI_TEMPLATE = `${DOCS_URI_PREFIX}{+slug}`;

const MARKDOWN = "text/markdown";

// The code the specification assigns to a read of a resource that does not
// exist. The SDK exports no name for it.
export const RESOURCE_NOT_FOUND = -32002;

export function uriForPage(slug: string): string {
  return `${DOCS_URI_PREFIX}${slug}`;
}

// The slug a URI names, or null when it is not one of ours. Only the exact
// prefix is accepted and the result is only ever looked up among the pages
// already loaded, so no part of a URI reaches the filesystem.
function slugFromUri(uri: string): string | null {
  return uri.startsWith(DOCS_URI_PREFIX) ? uri.slice(DOCS_URI_PREFIX.length) : null;
}

export async function findPage(docsDir: string, slug: string): Promise<DocPage | undefined> {
  return (await loadPages(docsDir)).find((page) => page.slug === slug);
}

// Registers the documentation as read-only resources: the list, the lookup
// template, and the read. Everything comes from the documentation copy that
// search_docs already reads, so a read makes no network call; a server that
// shipped without that copy answers with an empty list rather than an error,
// because having no pages is a state, not a failure of the call.
// `docsBase` is where the published site lives: the pages link to each other
// with site-absolute paths, which mean nothing to a client holding the text, so
// what a read returns carries them as full addresses on that site.
export function registerDocResources(server: McpServer, docsDir: string, docsBase: string): void {
  server.server.registerCapabilities({ resources: {} });

  server.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: (await loadPages(docsDir)).map((page) => ({
      uri: uriForPage(page.slug),
      name: page.slug,
      title: page.title,
      description: page.description,
      mimeType: MARKDOWN,
    })),
  }));

  server.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: [
      {
        uriTemplate: DOCS_URI_TEMPLATE,
        name: "docs-page",
        title: "doc.cheap documentation page",
        description:
          "One page of the doc.cheap API documentation as markdown, by its path: " +
          "reference/fields, reference/errors, reference/mrz, reference/limits, " +
          "concepts/what-a-billed-scan-is, or errors/<code> for any error code the API returns.",
        mimeType: MARKDOWN,
      },
    ],
  }));

  server.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const slug = slugFromUri(uri);
    const page = slug === null ? undefined : await findPage(docsDir, slug);
    if (!page) {
      throw new McpError(RESOURCE_NOT_FOUND, `Resource not found: ${uri}`, { uri });
    }
    return {
      contents: [{ uri, mimeType: MARKDOWN, text: absoluteDocLinks(page.markdown, docsBase) }],
    };
  });
}
