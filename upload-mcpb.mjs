#!/usr/bin/env node
// Uploads the bundle `pack-mcpb.mjs` wrote to this project's generic package
// registry, and hands the release job what it needs to link it.
//
// Runs in the mirror's tag pipeline only. The job token authenticates the
// upload, so no credential is stored anywhere. The file lives in the package
// registry rather than as a release upload because a job token can write a
// generic package but cannot attach a file to a release; the release then
// links to it under a stable address of its own (`/-/releases/<tag>/downloads/
// <file>`), which is the form the MCP registry accepts for a GitLab-hosted
// bundle.
//
// Writes `bundle.env`, read by the release job as a dotenv report:
//   MCPB_FILE, MCPB_SHA256, MCPB_PACKAGE_URL
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set: this script runs inside a GitLab CI job`);
  return value;
};

const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const file = `doc-cheap-${version}.mcpb`;
const bytes = readFileSync(join("dist-mcpb", file));
const sha256 = createHash("sha256").update(bytes).digest("hex");

const packageUrl =
  `${required("CI_API_V4_URL")}/projects/${required("CI_PROJECT_ID")}` +
  `/packages/generic/doc-cheap-mcpb/${version}/${file}`;

const response = await fetch(packageUrl, {
  method: "PUT",
  headers: { "JOB-TOKEN": required("CI_JOB_TOKEN") },
  body: bytes,
});
if (!response.ok) {
  throw new Error(`upload of ${file} answered ${response.status}: ${await response.text()}`);
}

writeFileSync(
  "bundle.env",
  `MCPB_FILE=${file}\nMCPB_SHA256=${sha256}\nMCPB_PACKAGE_URL=${packageUrl}\n`,
);
console.log(`upload-mcpb: ${file} (${bytes.length} bytes, sha256 ${sha256}) -> ${packageUrl}`);
