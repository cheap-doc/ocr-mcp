// Bundles the MCP server into a single self-contained ESM file with a shebang
// and copies the documentation content the search tool reads, so the package
// runs standalone (via npx) away from the monorepo.
import { cp, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "build");

await rm(outDir, { recursive: true, force: true });

await build({
  entryPoints: [resolve(here, "src/index.ts")],
  outfile: resolve(outDir, "index.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  // The oldest runtime the published package claims to work on (`engines.node`
  // in package.json). It is lower than the monorepo's own pinned Node because
  // this bundle runs on the user's machine, launched by their MCP client, and
  // a client that ships or finds an older Node is the common case rather than
  // an exotic one. Stated as a target so the claim is enforced by the bundler:
  // syntax newer than this is downlevelled where it can be and fails the build
  // where it cannot, instead of reaching a user as a parse error on startup.
  // distribution.test.ts holds the two in step.
  target: "node20",
  banner: { js: "#!/usr/bin/env node" },
  // The runtime dependencies resolve from node_modules at run time; the
  // workspace-only contracts and observability packages are bundled in (they
  // are never published).
  //
  // The tracker SDK is external for a second reason beyond size: the reporter
  // reaches it with a dynamic import so that a run without a DSN — the normal
  // one — never loads it at all. Bundled, esbuild would inline those megabytes
  // into this file and the import would resolve inside the bundle; left
  // external it stays a real import that only happens when a user has opted in.
  external: ["@modelcontextprotocol/sdk", "@modelcontextprotocol/sdk/*", "@sentry/node", "zod"],
});

// Ship a copy of the docs markdown so search_docs works without the docs app.
await cp(resolve(here, "docs-content"), resolve(outDir, "docs-content"), { recursive: true });

console.log(`built ${outDir}`);
