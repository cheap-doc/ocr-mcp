// Vendored from the private monorepo's @doc-cheap/observability (src/release.ts).
// Copied by scripts/sync-mcp-mirror.mjs because that package is not published;
// edit it there, not here.

// The release and environment strings every reported failure is stamped with.
//
// Shared by every process that reports, because an issue is only attributable
// to a deploy if all of them spell the release the same way — and because the
// source maps a build uploads are keyed by that exact string. Two apps that
// disagree about it produce two sets of issues for one deploy and maps that
// attach to nothing.

// The version constant alone is not enough: several commits ship under one
// version while a branch is in flight, and the stack line numbers that matter
// belong to a commit. So the commit is appended when the deployment supplies
// it. `SENTRY_RELEASE` wins outright: a deployment that sets it has already
// decided what to call this build, and the same string must reach the source-map
// upload.
export function readRelease(
  env: Readonly<Record<string, string | undefined>>,
  version: string,
): string {
  const explicit = env.SENTRY_RELEASE?.trim();
  if (explicit) return explicit;
  const sha = env.GIT_SHA?.trim();
  return sha ? `${version}+${sha}` : version;
}

// Which deployment this is. Left to the operator rather than inferred, because
// `NODE_ENV` says how the code was built, not where it runs.
export function readEnvironment(env: Readonly<Record<string, string | undefined>>): string {
  return env.SENTRY_ENVIRONMENT?.trim() || env.NODE_ENV?.trim() || "production";
}
