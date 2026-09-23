#!/usr/bin/env node
// Packs the built server into an MCP Bundle (`.mcpb`): the zip Claude Desktop
// and other MCPB-aware clients install with one click, with the server, its
// runtime dependencies and `manifest.json` inside.
//
// Run it after the build, from this directory:
//
//   node pack-mcpb.mjs            -> dist-mcpb/doc-cheap-<version>.mcpb (+ .sha256)
//
// It is plain `.mjs` rather than `.ts` because the public mirror copies it out
// unchanged and runs it on the oldest Node the package claims (`engines.node`),
// which cannot strip types.
//
// What goes in, and why each piece is there:
//   manifest.json, icon.png   the bundle's own description, read by the client
//   server/index.js           build/index.js, the same file npm ships as `bin`
//   server/docs-content/      the corpus search_docs answers from; config.ts
//                             looks for it next to index.js, so the layout
//                             of the npm package is kept one level down
//   package.json              `type: module` for the ESM bundle, plus the
//                             dependencies build.ts leaves external
//   node_modules/             those dependencies, installed here: a bundle
//                             must run with no network install on first launch
//   README.md, LICENSE        what the user and a directory reviewer read
//
// The official CLI does the validation and the zipping, pinned to one version
// so a new release of it cannot change what a release of this package is.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const MCPB_CLI = "@anthropic-ai/mcpb@2.1.2";

const here = dirname(fileURLToPath(import.meta.url));

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** The package.json the bundle carries: enough to load the ESM bundle and install its externals. */
export function bundlePackageJson(sourceManifest) {
  return {
    name: sourceManifest.name,
    version: sourceManifest.version,
    private: true,
    type: "module",
    dependencies: sourceManifest.dependencies ?? {},
  };
}

/** The file name a release of `version` is published under. */
export function bundleFileName(version) {
  return `doc-cheap-${version}.mcpb`;
}

function run(command, args, cwd) {
  // npm and npx are `.cmd` shims on Windows; this runs on Linux CI and macOS.
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

export function packBundle({ appDir = here, outDir = join(appDir, "dist-mcpb") } = {}) {
  const packageJson = readJson(join(appDir, "package.json"));
  const manifest = readJson(join(appDir, "manifest.json"));
  if (manifest.version !== packageJson.version) {
    throw new Error(
      `manifest.json says ${manifest.version} but package.json says ${packageJson.version}`,
    );
  }
  const built = join(appDir, "build", "index.js");
  if (!existsSync(built)) {
    throw new Error(`${built} does not exist: build the package before packing it`);
  }

  const stage = join(outDir, "stage");
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });

  for (const file of ["manifest.json", "icon.png", "README.md", "LICENSE"]) {
    cpSync(join(appDir, file), join(stage, file));
  }
  cpSync(join(appDir, "build"), join(stage, "server"), { recursive: true });
  writeFileSync(
    join(stage, "package.json"),
    `${JSON.stringify(bundlePackageJson(packageJson), null, 2)}\n`,
  );

  // No lockfile to honour: the three dependencies are pinned to exact versions
  // in package.json. Install scripts are skipped because none of them has one
  // the server needs, and a bundle should not carry the side effects of one.
  run(
    "npm",
    ["install", "--omit=dev", "--no-package-lock", "--ignore-scripts", "--no-audit", "--no-fund"],
    stage,
  );

  const output = join(outDir, bundleFileName(manifest.version));
  run("npx", ["--yes", MCPB_CLI, "validate", join(stage, "manifest.json")], appDir);
  run("npx", ["--yes", MCPB_CLI, "pack", stage, output], appDir);

  const sha256 = createHash("sha256").update(readFileSync(output)).digest("hex");
  writeFileSync(`${output}.sha256`, `${sha256}  ${bundleFileName(manifest.version)}\n`);
  return { output, sha256, stage };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { output, sha256 } = packBundle();
  console.log(`pack-mcpb: ${output}\npack-mcpb: sha256 ${sha256}`);
}
