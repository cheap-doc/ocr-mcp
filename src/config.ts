// Runtime configuration for the MCP server, read from the environment. All of
// it is optional: with nothing set the server talks to the public API and calls
// it with the public demo sandbox key, so the server runs with no setup.
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SANDBOX_PUBLIC_KEY } from "./vendor/contracts/headers.ts";
import { DEFAULT_DOCS_BASE_URL } from "./vendor/contracts/urls.ts";

// The public service, because that is where an installed copy of this server
// belongs: it is launched by somebody else's MCP client, on somebody else's
// machine, from a configuration that names no base at all in the common case.
// A loopback default there is not "unconfigured", it is a server that answers
// every call with a connection refused and gives the model nothing to say
// about why.
//
// Developing against a local API is the case that states itself: the package's
// own `start` script sets the loopback address, the acceptance suite sets the
// address of the API it started, and the documented development snippet sets it
// in the client's env block.
// Exported because `server.json` advertises this same address as the default
// of DOC_CHEAP_API_BASE, and a registry entry that names a base the server does
// not actually fall back to is a documented lie; the check is in
// distribution.test.ts.
export const DEFAULT_API_BASE = "https://api.doc.cheap";
// The documentation origin, the same one the API builds `docs_url` from, so a
// link this server hands back resolves to the same page the API pointed at.
const DEFAULT_DOCS_BASE = DEFAULT_DOCS_BASE_URL;

export interface McpConfig {
  readonly apiBase: string;
  readonly apiKey: string;
  // True when no key was supplied and the public sandbox key is standing in:
  // balance has no meaning for it, and its scans run free within an allowance.
  readonly usingSandboxKey: boolean;
  readonly docsBase: string;
  // Directory the documentation markdown is read from for search_docs. Empty
  // when no such directory could be located.
  readonly docsDir: string;
}

function firstExisting(candidates: string[]): string {
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return "";
}

// Where the documentation markdown lives for search_docs. An explicit override
// wins; then a copy shipped inside the package (the build places one there);
// then the sibling docs app when running from the monorepo sources.
export function resolveDocsDir(): string {
  const override = process.env.DOC_CHEAP_DOCS_DIR?.trim();
  if (override) return override;
  const here = dirname(fileURLToPath(import.meta.url));
  return firstExisting([
    // Shipped inside the bundled package (the build copies it next to index.js).
    resolve(here, "docs-content"),
    // The sibling docs app when running from the monorepo sources.
    resolve(here, "../../docs/content"),
  ]);
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function loadConfig(): McpConfig {
  const apiBase = stripTrailingSlash(process.env.DOC_CHEAP_API_BASE?.trim() || DEFAULT_API_BASE);
  const suppliedKey = process.env.DOC_CHEAP_API_KEY?.trim();
  const docsBase = stripTrailingSlash(process.env.DOC_CHEAP_DOCS_BASE?.trim() || DEFAULT_DOCS_BASE);
  return {
    apiBase,
    apiKey: suppliedKey || SANDBOX_PUBLIC_KEY,
    usingSandboxKey: !suppliedKey,
    docsBase,
    docsDir: resolveDocsDir(),
  };
}
