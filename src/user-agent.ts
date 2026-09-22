// What this server calls the API as, and where that name comes from.
//
// The published API's log is the only place that can answer "how much use does
// the MCP server actually get, and from which host application". A package
// download is not a user — the registry counts every tarball fetch, mirrors and
// build servers on purpose — and a directory's install count is not a call. A
// user agent on the request is.
//
// Three rules shape it, and all three are deliberate:
//
//   1. It is rebuilt PER REQUEST. One process can serve more than one client,
//      and a value captured once at start-up would attribute all of them to
//      whichever connected first.
//   2. The client's own name is self-reported and the protocol says so in as
//      many words: it is "intended for display, logging, and debugging" and
//      implementations "SHOULD NOT use them to change the behavior". So it is
//      reported and never acted on — nothing in this package branches on it.
//   3. `DO_NOT_TRACK=1` removes the client half entirely. The package name and
//      version stay, because a server has to identify itself to the service it
//      calls; who is driving it does not travel.
//
// It is disclosed in the package README, which is the part comparable servers
// leave out.
import { SERVER_NAME, SERVER_VERSION } from "./version.ts";

export interface ClientIdentity {
  readonly name: string;
  readonly version: string | null;
}

// The key the current protocol revision carries per-request client identity
// under. Any `_meta` key whose second label is `mcp` or `modelcontextprotocol`
// is reserved by the specification, so this is read and never written.
export const CLIENT_INFO_META_KEY = "io.modelcontextprotocol/clientInfo";

// Client names are unnormalised in the wild: the same editor appears under two
// spellings, one product name covers a desktop application and its web
// counterpart, and a display name arrives with spaces in it. Left alone they
// fragment a count into a dozen rows that are all the same thing.
//
// The map is a maintained list, matched case-insensitively after punctuation is
// folded, and it is EXTENDED as names are observed rather than guessed at in
// advance: an unmapped name is passed through in its normalised form, so a
// client nobody has seen yet still produces one stable row of its own.
const CLIENT_ALIASES = new Map<string, string>([
  ["claude", "claude"],
  ["claude-ai", "claude"],
  ["claude-desktop", "claude"],
  ["claude-code", "claude-code"],
  ["claudecode", "claude-code"],
  ["cursor", "cursor"],
  ["cursor-ide", "cursor"],
  ["visual-studio-code", "vscode"],
  ["vscode", "vscode"],
  ["vs-code", "vscode"],
  ["windsurf", "windsurf"],
  ["zed", "zed"],
  ["cline", "cline"],
  ["continue", "continue"],
  ["goose", "goose"],
  ["librechat", "librechat"],
  ["mcp-inspector", "mcp-inspector"],
  ["modelcontextprotocol-inspector", "mcp-inspector"],
]);

// A client name reduced to something that can be a stable key: lower case,
// runs of anything that is not a letter or a digit collapsed to one hyphen, and
// the result bounded in length. A user agent is a header, and a header built
// from a value somebody else controls is bounded here or it is unbounded
// everywhere downstream.
export function normalizeClientName(name: string): string {
  const slug = String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  if (slug === "") return "unknown";
  return CLIENT_ALIASES.get(slug) ?? slug;
}

// A version reduced to the characters a user agent may carry. Anything else —
// a build string full of spaces, a newline somebody pasted in — is dropped
// rather than escaped: a header cannot carry a newline at all, and a version
// this server cannot vouch for is worth less than a clean absence.
export function normalizeClientVersion(version: string | null | undefined): string | null {
  const value = String(version ?? "").trim();
  if (value === "") return null;
  if (!/^[A-Za-z0-9._+-]{1,32}$/.test(value)) return null;
  return value;
}

// Whether the caller has asked not to be identified.
//
// The published convention is an environment variable set to `1`. Read from the
// environment on every call rather than once, because the value is read by a
// process that may have been started by a client that sets it per session.
export function doNotTrack(env: NodeJS.ProcessEnv = process.env): boolean {
  return String(env.DO_NOT_TRACK ?? "").trim() === "1";
}

// The identity the protocol carried on THIS request, preferring the per-request
// metadata of the current revision and falling back to what the client said
// when it connected.
//
// The per-request key is read out of a loosely-typed bag on purpose: the
// installed SDK validates `_meta` with a schema that passes unknown keys
// through, so a key the SDK does not model still arrives intact, and reading it
// defensively is what lets this work on a client that already sends it without
// waiting for the SDK to catch up.
export function clientIdentityFrom(
  meta: Record<string, unknown> | undefined,
  handshake: { name?: string; version?: string } | undefined,
): ClientIdentity | null {
  const fromMeta = readIdentity(meta?.[CLIENT_INFO_META_KEY]);
  if (fromMeta) return fromMeta;
  return readIdentity(handshake);
}

function readIdentity(value: unknown): ClientIdentity | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as { name?: unknown; version?: unknown };
  if (typeof record.name !== "string" || record.name.trim() === "") return null;
  return {
    name: record.name,
    version: typeof record.version === "string" ? record.version : null,
  };
}

// The header value: this package and its version, then the client in brackets.
//
// The shape copies the one vendor precedent that carries both a name and a
// version, because a count of "which editor" is worth much less without "which
// release of it" — a defect reported against an integration is a defect in a
// version.
export function buildUserAgent(
  identity: ClientIdentity | null,
  options: { readonly doNotTrack?: boolean } = {},
): string {
  const self = `${SERVER_NAME}/${SERVER_VERSION}`;
  if (options.doNotTrack === true || identity === null) return self;
  const name = normalizeClientName(identity.name);
  const version = normalizeClientVersion(identity.version);
  return version === null ? `${self} (${name})` : `${self} (${name}/${version})`;
}

// The one standard header that carries a name-value pair across a service
// boundary. It states the channel, which is the thing the API's own log cannot
// work out for itself once the request has arrived as plain HTTP.
//
// Dropped entirely under `DO_NOT_TRACK`, like the client half of the user
// agent: a caller who asked not to be identified has asked about this too.
export function buildBaggage(
  identity: ClientIdentity | null,
  options: { readonly doNotTrack?: boolean } = {},
): string | null {
  if (options.doNotTrack === true) return null;
  const parts = ["doc-cheap.channel=mcp"];
  if (identity !== null) parts.push(`doc-cheap.client=${normalizeClientName(identity.name)}`);
  return parts.join(",");
}
