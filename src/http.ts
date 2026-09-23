// The hosted face of this server: the same three tools over Streamable HTTP,
// for a client that connects to a URL instead of launching a process.
//
// It is stateless on purpose. Every POST gets a fresh server and a fresh
// transport, answers, and is thrown away, so no session lives in memory, a
// restart loses nothing, and one caller's key can never be seen by another
// caller's request. The specification allows a server that keeps no session;
// the price is that a server-to-client stream (GET) is not offered, which none
// of these three tools needs.
//
// What the caller controls, and how each of those is bounded here:
//
// - the API key, optional, in `X-Doc-Cheap-Api-Key` or `Authorization: Bearer …`.
//   Without one the public sandbox key stands in, exactly as it does for the
//   package run locally with no configuration. The key is handed to the API
//   and nowhere else: it is never logged and never part of an event.
// - the request body, capped before it is parsed, so a hostile caller cannot
//   grow this process by sending more; and the bytes held for every request in
//   progress together, so many callers at once cannot either.
// - the request rate, one fixed window per client address, in front of the
//   API's own limits rather than instead of them.
//
// The client address is the one the edge vouches for (`cf-connecting-ip`). The
// only way into this container is the tunnel connector on the project network,
// which sets that header on every request it forwards, so the header is the
// visitor rather than a claim by the visitor. It is passed on to the API so the
// sandbox key's per-address allowance is spent by the person calling, not by
// this server on everybody's behalf.
import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { isIP } from "node:net";
import { ApiKey, SANDBOX_PUBLIC_KEY } from "./vendor/contracts/headers.ts";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { McpConfig } from "./config.ts";
import type { Reporter } from "./observability/reporter.ts";
import { buildServer } from "./server.ts";
import { SERVER_NAME, SERVER_VERSION } from "./version.ts";

// The path the MCP endpoint answers on. A path rather than the bare origin so
// the origin can say what it is to a person who opens it in a browser.
export const MCP_PATH = "/mcp";
// Where the hosted copy of this server is published. `server.json` advertises
// it to the registry, and distribution.test.ts holds the two in step.
export const PUBLIC_REMOTE_URL = "https://mcp.doc.cheap/mcp";
export const HEALTH_PATH = "/healthz";

// The largest request body accepted. The biggest legitimate one is a 25 MiB
// image sent as image_base64: base64 inflates by 4/3, and the JSON-RPC envelope
// around it is small. Anything larger could not be a scan the API would accept.
export const MAX_REQUEST_BYTES = 36 * 1024 * 1024;

// Requests per client address per window. Generous enough for an agent working
// through a batch — every tool call is one request — and small enough that one
// address cannot occupy the server. The API's own per-key and per-address
// limits still apply behind it.
export const RATE_LIMIT_PER_WINDOW = 120;
export const RATE_LIMIT_WINDOW_MS = 60_000;

// Requests in progress at once, across every caller. A scan holds its image in
// memory for as long as the API takes, so the ceiling on memory is this many
// images; past it a caller is told to come back rather than queued.
export const MAX_IN_FLIGHT = 64;

// The bytes all requests in progress may hold between them, counted as they
// arrive, plus the image an `image_url` call may fetch. The cap on requests in
// flight alone does not bound memory: 64 bodies of 36 MiB are well over the
// container's 1 GiB, and each body is held several times over while it is
// parsed, re-encoded and sent on to the API. This budget keeps the worst case a
// fraction of the container, and a caller past it is told to come back.
export const MAX_IN_FLIGHT_BYTES = 128 * 1024 * 1024;

// What an `image_url` call is charged against that budget before it runs: the
// largest image it may fetch, since how large it is cannot be known in advance.
export const IMAGE_URL_RESERVATION_BYTES = 25 * 1024 * 1024;

// How long one request may take end to end. The edge in front gives an origin
// about a hundred seconds before it answers for it, so the server gives up
// first and says why.
export const REQUEST_TIMEOUT_MS = 90_000;

// The header an API key arrives in for clients whose configuration has room for
// a named header but reserves `Authorization` for its own use — a directory's
// proxy that authenticates its users with a token of its own is one. It wins
// over `Authorization` whenever both are sent.
export const API_KEY_HEADER = "x-doc-cheap-api-key";

// What a key is allowed to look like before it is put into an outbound header.
// Wider than the API's own pattern on purpose — the API decides whether a key is
// real and says so in words the caller can act on — but narrow enough that
// nothing a caller sends can become a second header or a broken request.
const KEY_SHAPE = /^[A-Za-z0-9_-]{1,200}$/;

// Browsers are allowed to call this endpoint: it carries no cookies and no
// ambient credential, so an origin gains nothing by calling it that it could
// not do from its own server. These are the headers a client sends.
const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers":
    "authorization, content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id, x-doc-cheap-api-key",
  "access-control-expose-headers": "mcp-session-id, mcp-protocol-version",
  "access-control-max-age": "86400",
};

export type KeyReading =
  | { readonly kind: "none" }
  | { readonly kind: "key"; readonly key: string }
  | { readonly kind: "malformed" };

function headerValue(headers: IncomingMessage["headers"], name: string): string | undefined {
  const raw = headers[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === "" ? undefined : trimmed;
}

/**
 * The caller's API key, if one was sent.
 *
 * The named header is this server's own, so whatever it carries is meant as a
 * doc.cheap key, and it wins. `Authorization` is shared with everything between
 * the caller and here: it is read only when it is `Bearer` with a doc.cheap key
 * in it. Any other credential there — another scheme, or a bearer token that is
 * not one of ours — belongs to somebody else and is never forwarded to the API;
 * the call goes on as if no key was sent. A bearer value that starts like one of
 * ours but is not well-formed is refused, since it was plainly meant as a key.
 */
export function readApiKey(headers: IncomingMessage["headers"]): KeyReading {
  const named = headerValue(headers, API_KEY_HEADER);
  if (named !== undefined) {
    return KEY_SHAPE.test(named) ? { kind: "key", key: named } : { kind: "malformed" };
  }
  const authorization = headerValue(headers, "authorization");
  if (authorization === undefined) return { kind: "none" };
  const bearer = /^Bearer\s+(\S+)$/i.exec(authorization)?.[1];
  if (bearer === undefined) return { kind: "none" };
  if (ApiKey.safeParse(bearer).success) return { kind: "key", key: bearer };
  return bearer.startsWith("sk_") ? { kind: "malformed" } : { kind: "none" };
}

/** A shared allowance of bytes, taken before they are held and given back after. */
export interface ByteBudget {
  /** Takes `bytes` from the budget; false, and nothing taken, when they do not fit. */
  take(bytes: number): boolean;
  give(bytes: number): void;
  /** Bytes currently taken, for tests and diagnostics. */
  readonly inUse: number;
}

export function createByteBudget(limit: number): ByteBudget {
  let inUse = 0;
  return {
    take(bytes) {
      if (inUse + bytes > limit) return false;
      inUse += bytes;
      return true;
    },
    give(bytes) {
      inUse = Math.max(0, inUse - bytes);
    },
    get inUse() {
      return inUse;
    },
  };
}

/**
 * The caller's address as the edge vouches for it, or null when no such header
 * came — a request made on the project network, a health probe, a run on a
 * developer's machine. Only a vouched address is passed on to the API: an
 * address this server made up for itself is not the caller's.
 */
export function vouchedClientAddress(headers: IncomingMessage["headers"]): string | null {
  const vouched = headerValue(headers, "cf-connecting-ip");
  return vouched !== undefined && isIP(vouched) !== 0 ? vouched : null;
}

export interface WindowLimiter {
  /** Counts one request for the key; true while the key is within its allowance. */
  hit(key: string): { readonly allowed: boolean; readonly retryAfterSeconds: number };
}

/**
 * A fixed-window counter per key, held in this process. One process serves the
 * endpoint, so there is nothing to share it with; a restart forgets it, which
 * errs toward letting callers through.
 */
export function createWindowLimiter(options: {
  readonly limit: number;
  readonly windowMs: number;
  readonly now?: () => number;
}): WindowLimiter {
  const now = options.now ?? Date.now;
  const windows = new Map<string, { start: number; count: number }>();
  let lastSweep = now();
  return {
    hit(key) {
      const at = now();
      // Expired windows are dropped once a window has passed, so the map holds
      // the callers of the last minute rather than every caller ever seen.
      if (at - lastSweep >= options.windowMs) {
        for (const [entryKey, entry] of windows) {
          if (at - entry.start >= options.windowMs) windows.delete(entryKey);
        }
        lastSweep = at;
      }
      let entry = windows.get(key);
      if (entry === undefined || at - entry.start >= options.windowMs) {
        entry = { start: at, count: 0 };
        windows.set(key, entry);
      }
      entry.count += 1;
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((entry.start + options.windowMs - at) / 1000),
      );
      return { allowed: entry.count <= options.limit, retryAfterSeconds };
    },
  };
}

/** One line of the request log. Never a body, a key or an address. */
export interface RequestLogLine {
  readonly msg: string;
  readonly request_id: string;
  readonly method: string;
  readonly path: string;
  readonly status: number;
  readonly duration_ms: number;
  readonly rpc?: string;
  readonly tool?: string;
  readonly key?: "sandbox" | "own";
  readonly reason?: string;
}

export interface HttpServerOptions {
  // The configuration every request starts from; the key is replaced per request.
  readonly config: McpConfig;
  readonly reporter: Reporter;
  readonly log: (line: RequestLogLine) => void;
  readonly release?: string;
  readonly limiter?: WindowLimiter;
  readonly maxRequestBytes?: number;
  readonly maxInFlight?: number;
  readonly maxInFlightBytes?: number;
  readonly requestTimeoutMs?: number;
}

class BodyTooLarge extends Error {}
class OverBudget extends Error {}
class ClientGone extends Error {}

// Reads the body, taking each chunk from the shared budget before keeping it.
// `charge` is what this request has taken so far, so the caller can give back
// exactly that however the read ends.
async function readBody(
  request: IncomingMessage,
  limit: number,
  budget: ByteBudget,
  charge: { bytes: number },
): Promise<Buffer> {
  const declared = Number(request.headers["content-length"]);
  if (Number.isFinite(declared) && declared > limit) throw new BodyTooLarge();
  // A declared length is taken whole, up front, so a request that cannot fit
  // is turned away before its first byte is read rather than half-way through.
  if (Number.isFinite(declared) && declared > 0) {
    if (!budget.take(declared)) throw new OverBudget();
    charge.bytes += declared;
  }
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for await (const chunk of request) {
      const buffer = chunk as Buffer;
      total += buffer.byteLength;
      if (total > limit) throw new BodyTooLarge();
      if (total > charge.bytes) {
        const more = total - charge.bytes;
        if (!budget.take(more)) throw new OverBudget();
        charge.bytes += more;
      }
      chunks.push(buffer);
    }
  } catch (error) {
    // The caller hung up mid-upload. That is theirs to do, not a fault here:
    // there is nobody left to answer and nothing to report.
    if (request.destroyed && !(error instanceof BodyTooLarge || error instanceof OverBudget)) {
      throw new ClientGone();
    }
    throw error;
  }
  return Buffer.concat(chunks);
}

// Whether the message is a scan that will fetch its image from a URL, which
// holds up to a whole image in memory beyond the body that asked for it.
function fetchesImageUrl(body: unknown): boolean {
  const messages = Array.isArray(body) ? body : [body];
  return messages.some((message) => {
    if (typeof message !== "object" || message === null) return false;
    const call = message as { method?: unknown; params?: { arguments?: unknown } };
    if (call.method !== "tools/call") return false;
    const args = call.params?.arguments;
    return (
      typeof args === "object" &&
      args !== null &&
      typeof (args as { image_url?: unknown }).image_url === "string"
    );
  });
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): void {
  if (response.headersSent) return;
  response.writeHead(status, {
    ...CORS_HEADERS,
    "content-type": "application/json",
    "cache-control": "no-store",
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
}

// A refusal in the shape a JSON-RPC client reads. The specification's transport
// answers its own refusals this way, so a client sees one shape for all of them.
function sendRpcError(
  response: ServerResponse,
  status: number,
  code: number,
  message: string,
  extraHeaders: Record<string, string> = {},
): void {
  sendJson(response, status, { jsonrpc: "2.0", error: { code, message }, id: null }, extraHeaders);
}

// What the request asked for, for the log only: the JSON-RPC method, and the
// tool name when it is a call. A batch is described by its first message.
function describeRpc(body: unknown): { rpc?: string; tool?: string } {
  const first = Array.isArray(body) ? body[0] : body;
  if (typeof first !== "object" || first === null) return {};
  const message = first as { method?: unknown; params?: { name?: unknown } };
  const rpc = typeof message.method === "string" ? message.method.slice(0, 64) : undefined;
  const tool =
    rpc === "tools/call" && typeof message.params?.name === "string"
      ? message.params.name.slice(0, 64)
      : undefined;
  return { ...(rpc === undefined ? {} : { rpc }), ...(tool === undefined ? {} : { tool }) };
}

/** The HTTP server that carries the MCP endpoint, its health check and nothing else. */
export function createMcpHttpServer(options: HttpServerOptions): Server {
  const limiter =
    options.limiter ??
    createWindowLimiter({ limit: RATE_LIMIT_PER_WINDOW, windowMs: RATE_LIMIT_WINDOW_MS });
  const maxRequestBytes = options.maxRequestBytes ?? MAX_REQUEST_BYTES;
  const maxInFlight = options.maxInFlight ?? MAX_IN_FLIGHT;
  const budget = createByteBudget(options.maxInFlightBytes ?? MAX_IN_FLIGHT_BYTES);
  let inFlight = 0;

  async function handleMcp(
    request: IncomingMessage,
    response: ServerResponse,
    finish: (fields: Partial<RequestLogLine>) => void,
  ): Promise<void> {
    const address = vouchedClientAddress(request.headers);
    const verdict = limiter.hit(address ?? request.socket.remoteAddress ?? "unknown");
    if (!verdict.allowed) {
      sendRpcError(response, 429, -32000, "Too many requests from this address; slow down.", {
        "retry-after": String(verdict.retryAfterSeconds),
      });
      finish({ reason: "rate_limited" });
      return;
    }

    const key = readApiKey(request.headers);
    if (key.kind === "malformed") {
      sendRpcError(
        response,
        400,
        -32000,
        `The API key header is not in a usable form: send your doc.cheap key as \`X-Doc-Cheap-Api-Key: <your key>\` or \`Authorization: Bearer <your key>\`, or no key at all to use the public sandbox key.`,
      );
      finish({ reason: "malformed_key" });
      return;
    }

    if (inFlight >= maxInFlight) {
      sendRpcError(response, 503, -32000, "The server is busy; retry shortly.", {
        "retry-after": "5",
      });
      finish({ reason: "busy" });
      return;
    }

    inFlight += 1;
    const charge = { bytes: 0 };
    const busy = (): void => {
      sendRpcError(response, 503, -32000, "The server is busy; retry shortly.", {
        "retry-after": "5",
      });
      finish({ reason: "busy_bytes" });
    };
    try {
      let raw: Buffer;
      try {
        raw = await readBody(request, maxRequestBytes, budget, charge);
      } catch (error) {
        if (error instanceof ClientGone) {
          // Logged under the status nginx gives the same event, 499, so the
          // line is not read as an answer the caller received.
          response.statusCode = 499;
          finish({ reason: "client_closed" });
          return;
        }
        if (error instanceof OverBudget) {
          busy();
          return;
        }
        if (error instanceof BodyTooLarge) {
          sendRpcError(
            response,
            413,
            -32000,
            `The request is larger than the ${maxRequestBytes} bytes this server accepts. Send a smaller image, or its image_url.`,
          );
          finish({ reason: "too_large" });
          return;
        }
        throw error;
      }

      let body: unknown;
      try {
        body = JSON.parse(raw.toString("utf8"));
      } catch {
        sendRpcError(response, 400, -32700, "Parse error: the body is not JSON.");
        finish({ reason: "parse_error" });
        return;
      }

      if (fetchesImageUrl(body)) {
        if (!budget.take(IMAGE_URL_RESERVATION_BYTES)) {
          busy();
          return;
        }
        charge.bytes += IMAGE_URL_RESERVATION_BYTES;
      }

      const own = key.kind === "key" && key.key !== SANDBOX_PUBLIC_KEY;
      const config: McpConfig = {
        ...options.config,
        apiKey: key.kind === "key" ? key.key : SANDBOX_PUBLIC_KEY,
        usingSandboxKey: !own,
      };
      const server = buildServer(config, options.reporter, {
        remote: { clientAddress: address },
      });
      // No session id generator is what makes the transport stateless, and a
      // JSON answer rather than an event stream is all a request-and-answer
      // tool call needs.
      const transport = new StreamableHTTPServerTransport({ enableJsonResponse: true });
      response.on("close", () => {
        void transport.close();
        void server.close();
      });
      for (const [name, value] of Object.entries(CORS_HEADERS)) response.setHeader(name, value);
      // The SDK's own transport type declares its optional callbacks without
      // `undefined`, which this repository's stricter optional-property check
      // refuses; the object is the SDK's and satisfies its own interface.
      await server.connect(transport as unknown as Transport);
      await transport.handleRequest(request, response, body);
      finish({ ...describeRpc(body), key: own ? "own" : "sandbox" });
    } finally {
      inFlight -= 1;
      budget.give(charge.bytes);
    }
  }

  const server = createServer((request, response) => {
    const started = performance.now();
    const requestId = `req_${randomUUID()}`;
    response.setHeader("x-request-id", requestId);
    const path = (request.url ?? "/").split("?")[0] ?? "/";
    let logged = false;
    const finish = (fields: Partial<RequestLogLine>): void => {
      if (logged) return;
      logged = true;
      options.log({
        msg: "request",
        request_id: requestId,
        method: request.method ?? "",
        path: path.slice(0, 128),
        status: response.statusCode,
        duration_ms: Math.round(performance.now() - started),
        ...fields,
      });
    };

    const route = async (): Promise<void> => {
      if (request.method === "OPTIONS") {
        response.writeHead(204, CORS_HEADERS);
        response.end();
        finish({});
        return;
      }
      if (path === HEALTH_PATH && (request.method === "GET" || request.method === "HEAD")) {
        sendJson(response, 200, {
          status: "ok",
          version: SERVER_VERSION,
          ...(options.release ? { release: options.release } : {}),
        });
        finish({});
        return;
      }
      if (path === "/" && request.method === "GET") {
        sendJson(response, 200, {
          name: SERVER_NAME,
          version: SERVER_VERSION,
          transport: "streamable-http",
          endpoint: `${MCP_PATH}`,
          docs: `${options.config.docsBase}/guides/use-the-mcp-server`,
        });
        finish({});
        return;
      }
      if (path === MCP_PATH) {
        if (request.method === "POST") {
          await handleMcp(request, response, finish);
          return;
        }
        // No session is kept, so there is no stream to open with GET and no
        // session to end with DELETE: the specification's answer to both is 405.
        sendRpcError(response, 405, -32000, "Method not allowed: this endpoint takes POST.", {
          allow: "POST, OPTIONS",
        });
        finish({});
        return;
      }
      sendJson(response, 404, { error: "not_found", endpoint: MCP_PATH });
      finish({});
    };

    route().catch((error: unknown) => {
      // Everything the tools themselves can fail with is already a tool error
      // inside a 200; reaching here means the transport or this code broke.
      const eventId = options.reporter.capture(error, { component: "http" });
      sendRpcError(response, 500, -32603, "Internal error.");
      finish({ reason: eventId ? `internal_error:${eventId}` : "internal_error" });
    });
  });

  server.requestTimeout = options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
  server.headersTimeout = 20_000;
  // Longer than the edge connector keeps an idle connection, so the connector
  // is the side that closes it and never writes into one this side dropped.
  server.keepAliveTimeout = 95_000;
  return server;
}
