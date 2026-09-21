// Vendored from the private monorepo's @doc-cheap/observability (src/scrub.ts).
// Copied by scripts/sync-mcp-mirror.mjs because that package is not published;
// edit it there, not here.

// What may leave this process in an error report, and nothing else.
//
// The service recognises identity documents and keeps none of them: an image,
// an extracted field or a holder's name that reaches a third-party tracker is
// retention by another route, and a tracker holds what it receives for weeks.
// So the rule here is an allow-list, not a deny-list — a new field added to a
// request body or a new key put on a scope is dropped by default and has to be
// named here to survive. A deny-list would let every future field through until
// someone remembered to add it.
//
// The functions are pure and take structurally-typed events rather than the
// SDK's own types, so the policy is unit-tested without a tracker and the same
// code scrubs whatever SDK is wired behind the reporting port.

// The only scope keys worth keeping: internal identifiers and the shape of the
// request. None of them is derived from a document or from a person.
const ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "account_id",
  "key_id_prefix",
  "scan_id",
  "request_id",
  "route",
  "method",
  "status",
  "status_code",
  "engine_status",
  "cause",
  "component",
  "release",
  "environment",
  "reason",
  "attempt",
  "outage_seconds",
]);

// A `data:` URL, with or without the base64 marker: the shape a document image
// arrives in.
const DATA_URL = /data:[a-z0-9.+-]*\/?[a-z0-9.+-]*;?[a-z0-9-]*,[A-Za-z0-9+/=\s]{16,}/gi;

// A long run of base64 alphabet. A document photograph is megabytes of it; no
// legitimate error message carries sixty-four unbroken base64 characters.
const BASE64_RUN = /[A-Za-z0-9+/]{64,}={0,2}/g;

// Deliberately loose: the point is to catch anything that could be an address,
// not to validate one.
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

// The credential shapes this service issues or accepts: a bearer token, an API
// key and the sandbox key that shares its prefix.
const BEARER = /\bBearer\s+\S+/gi;
const API_KEY = /\bsk_[A-Za-z0-9_]+/g;

// A machine-readable string is not a document, so redaction leaves a marker
// that says which class of value was removed. That keeps a scrubbed message
// diagnosable ("a base64 payload was here") without carrying the value.
export function redactText(text: string): string {
  return text
    .replace(DATA_URL, "[redacted:data-url]")
    .replace(BEARER, "Bearer [redacted:token]")
    .replace(API_KEY, "[redacted:key]")
    .replace(EMAIL, "[redacted:email]")
    .replace(BASE64_RUN, "[redacted:payload]");
}

// The one shape the scrubber understands. It is a subset of what an exception
// tracker's event looks like, written structurally so this module depends on no
// SDK.
export interface ScrubbableEvent {
  request?: {
    url?: string;
    method?: string;
    data?: unknown;
    headers?: Record<string, unknown>;
    cookies?: unknown;
    query_string?: unknown;
    env?: unknown;
  };
  user?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  message?: unknown;
  breadcrumbs?: ScrubbableBreadcrumb[];
  exception?: { values?: ScrubbableExceptionValue[] };
  // Attached by the SDK from the machine's hostname. On a server that is a
  // container id; on a developer's laptop it is very often a person's name.
  server_name?: unknown;
  [key: string]: unknown;
}

export interface ScrubbableExceptionValue {
  type?: string;
  value?: string;
  stacktrace?: { frames?: ScrubbableFrame[] };
}

// A stack frame as the SDK reports it. The three context fields are the
// dangerous ones: they are lines of source read off disk around the throw.
export interface ScrubbableFrame {
  context_line?: string | undefined;
  pre_context?: string[] | undefined;
  post_context?: string[] | undefined;
  vars?: Record<string, unknown> | undefined;
  [key: string]: unknown;
}

export interface ScrubbableBreadcrumb {
  type?: string;
  category?: string;
  message?: string;
  data?: Record<string, unknown>;
  level?: string;
  timestamp?: number;
  [key: string]: unknown;
}

// Keeps only the allow-listed keys, and redacts what survives. Values that are
// not primitives are dropped outright: a nested object is where a body hides.
function allowedOnly(source: Record<string, unknown> | undefined): Record<string, unknown> {
  const kept: Record<string, unknown> = {};
  if (!source) return kept;
  for (const [key, value] of Object.entries(source)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    if (typeof value === "string") {
      kept[key] = redactText(value);
    } else if (typeof value === "number" || typeof value === "boolean") {
      kept[key] = value;
    }
  }
  return kept;
}

// Strips the query string: a query carries references, ids and, on a mistaken
// call, credentials. The path alone is what groups an issue.
function pathOnly(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;
  const cut = url.split("?", 1)[0] ?? url;
  return redactText(cut);
}

// Removes everything a report must never carry and redacts the free text that
// is left. Returns the same event object, mutated: the SDK hooks this runs
// behind hand over an event they expect back.
export function scrubEvent(event: ScrubbableEvent): ScrubbableEvent {
  // The request: keep the shape of the call, never its content. `data` is the
  // body — for this API a base64 document — and headers carry the API key, the
  // session cookie and the caller's own correlation values.
  if (event.request) {
    const method = event.request.method;
    const url = pathOnly(event.request.url);
    event.request = {
      ...(method !== undefined ? { method } : {}),
      ...(url !== undefined ? { url } : {}),
    };
  }

  // A subject is an internal account id and nothing else — no email, no name,
  // no address. The SDK attaches the rest unless told not to.
  if (event.user) {
    const id = event.user.id;
    event.user = typeof id === "string" ? { id: redactText(id) } : {};
  }

  event.extra = allowedOnly(event.extra);
  event.tags = allowedOnly(event.tags);
  // Contexts is where the SDK's own integrations put runtime, OS and trace
  // information, plus anything a call site attached. Only the allow-list
  // survives, and nested context objects go entirely.
  event.contexts = allowedOnly(event.contexts);

  if (typeof event.message === "string") {
    event.message = redactText(event.message);
  }

  for (const value of event.exception?.values ?? []) {
    if (typeof value.value === "string") value.value = redactText(value.value);
    // Source lines read off disk around each frame, attached by an SDK
    // integration that runs after the call site has handed the event over.
    // They are genuinely useful — a stack without the code around it is half a
    // diagnosis — but they are also whatever happened to be interpolated into
    // that line, which on this service can be a document or an address. So the
    // frames survive, redacted, rather than being thrown away.
    for (const frame of value.stacktrace?.frames ?? []) {
      if (typeof frame.context_line === "string") {
        frame.context_line = redactText(frame.context_line);
      }
      if (Array.isArray(frame.pre_context)) frame.pre_context = frame.pre_context.map(redactText);
      if (Array.isArray(frame.post_context)) {
        frame.post_context = frame.post_context.map(redactText);
      }
      // Local variables captured at the throw. There is no allow-list that
      // could make these safe — the whole point of the feature is to send
      // whatever was in scope, which here is the image and the extracted
      // fields — so they go entirely.
      if (frame.vars !== undefined) frame.vars = undefined;
    }
  }

  // The hostname the SDK reads off the machine. In a container it is an id; on
  // a laptop it is routinely "<someone>'s MacBook", which is a person's name
  // arriving through a default nobody chose.
  if (event.server_name !== undefined) event.server_name = undefined;

  // Breadcrumbs are recorded automatically — every outgoing HTTP call, every
  // console line — so they are the widest unguarded channel of the lot.
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .map(scrubBreadcrumb)
      .filter((crumb): crumb is ScrubbableBreadcrumb => crumb !== null);
  }

  return event;
}

// The breadcrumb categories that are only ever noise or exposure here: a
// console line may hold anything the code logged, and a DOM or user-input
// crumb belongs to a browser session.
const DROPPED_BREADCRUMB_CATEGORIES: ReadonlySet<string> = new Set([
  "console",
  "ui.click",
  "ui.input",
  "sentry.transaction",
]);

// Returns null for a breadcrumb that must not be recorded at all.
export function scrubBreadcrumb(crumb: ScrubbableBreadcrumb): ScrubbableBreadcrumb | null {
  if (crumb.category !== undefined && DROPPED_BREADCRUMB_CATEGORIES.has(crumb.category)) {
    return null;
  }
  const scrubbed: ScrubbableBreadcrumb = { ...crumb };
  if (typeof scrubbed.message === "string") scrubbed.message = redactText(scrubbed.message);
  // An HTTP breadcrumb's data holds the call it made. The path is what makes
  // the crumb worth keeping, so it survives with its query string cut off —
  // that is where ids and, on a mistaken call, credentials ride. Everything
  // else falls to the same allow-list as a scope.
  const data = allowedOnly(scrubbed.data);
  const url = typeof scrubbed.data?.url === "string" ? pathOnly(scrubbed.data.url) : undefined;
  scrubbed.data = url === undefined ? data : { ...data, url };
  return scrubbed;
}
