// Vendored from the private monorepo's @doc-cheap/contracts (src/urls.ts).
// Copied by scripts/sync-mcp-mirror.mjs because that package is not published;
// edit it there, not here.

// The public origins the contract is written against. They are part of the
// documented API surface — the `servers` entry of the generated spec, the
// `docs_url` every error body carries, the base of the copy-paste examples — so
// they live here, next to the schemas, and every consumer reads the same value
// instead of repeating a literal. A deployment may override the running
// service's view of them from the environment; these are the defaults the
// committed spec and the documented examples are generated with.

// Base URL of the documentation. `docs_url` on an error is
// `${DEFAULT_DOCS_BASE_URL}/errors/<code>`.
//
// It is a path on the product's own origin rather than a documentation
// subdomain. A subdomain is a separate site to a search engine: its pages
// accumulate their own authority and lend none of it to the origin that sells
// the product, while the documentation is the largest body of text this
// product publishes. Serving it from `/docs` puts that text on the host the
// rest of the site is ranked as.
export const DEFAULT_DOCS_BASE_URL = "https://doc.cheap/docs";

// Origin of the public API, the single `servers` entry of the generated spec.
export const DEFAULT_API_PUBLIC_URL = "https://api.doc.cheap";
