import type { ScanOptionsInput } from "./vendor/contracts/reading.ts";
import type { Scan } from "./vendor/contracts/scan.ts";
import type { Usage } from "./vendor/contracts/usage.ts";
import type { McpConfig } from "./config.ts";
import { ExpectedFailure } from "./errors.ts";

// The doc-cheap public API as seen by the MCP tools. The server is a thin HTTP
// client of that API (no direct data access), so this is all it needs.
export interface ScanInput {
  readonly image: string;
  readonly options?: ScanOptionsInput;
  readonly reference?: string | null;
  readonly idempotencyKey?: string;
}

// What the caller of this API knows about the request that triggered it, and
// nothing else: which host application drove the tool call. It travels as a
// user agent and a baggage header so the published API's own log can tell an
// MCP-originated call from a browser or a script, which is the only honest
// measure of how much this server is used.
//
// Optional on purpose: a caller that supplies none — the acceptance suite, a
// direct use of this module — still works, and sends the package's own name
// with no client half.
export interface CallContext {
  readonly userAgent: string;
  readonly baggage?: string | null;
  // The address of the person calling, when this server is the hosted one and
  // is calling the API on their behalf. Without it every hosted caller would
  // reach the API from this server's own address and share one per-address
  // allowance. Absent when the server runs on the caller's own machine, where
  // the caller's address is already the one the API sees.
  readonly clientAddress?: string | null;
}

export interface ApiClient {
  createScan(input: ScanInput, context?: CallContext): Promise<Scan>;
  getUsage(context?: CallContext): Promise<Usage>;
}

interface ApiErrorBody {
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
    readonly docs_url?: string;
  };
}

// Turns an error response into one readable line, preferring the API's own
// error shape and falling back to the status line.
async function describeError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    const error = body.error;
    if (error?.message) {
      const head = error.code ? `${error.code}: ${error.message}` : error.message;
      return error.docs_url ? `${head} (see ${error.docs_url})` : head;
    }
  } catch {
    // Body was not the JSON error shape; fall through to the status line.
  }
  return `HTTP ${response.status} ${response.statusText}`;
}

export function createApiClient(config: McpConfig): ApiClient {
  const baseHeaders: Record<string, string> = {
    authorization: `Bearer ${config.apiKey}`,
    "content-type": "application/json",
  };

  // Rebuilt per call rather than folded into the base headers: one process can
  // serve more than one client, so a value fixed here would attribute every
  // later call to whichever one connected first.
  function withContext(
    headers: Record<string, string>,
    context: CallContext | undefined,
  ): Record<string, string> {
    if (!context) return headers;
    const withIdentity: Record<string, string> = {
      ...headers,
      "user-agent": context.userAgent,
    };
    if (context.baggage) withIdentity.baggage = context.baggage;
    if (context.clientAddress) {
      // Both headers, because the API believes the edge's client header only
      // from a peer it trusts, and a forwarded-for chain is how it recognises
      // that peer as one it trusts.
      withIdentity["x-forwarded-for"] = context.clientAddress;
      withIdentity["cf-connecting-ip"] = context.clientAddress;
    }
    return withIdentity;
  }

  async function request(path: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(`${config.apiBase}${path}`, init);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      // Expected, not a defect: this server runs on the user's own machine and
      // defaults to a local API base, so "nothing is listening there" is the
      // ordinary first-run experience. What the caller needs is the address it
      // tried, not an issue filed against us.
      throw new ExpectedFailure(
        `Could not reach the doc-cheap API at ${config.apiBase}: ${reason}`,
      );
    }
  }

  return {
    async createScan(input, context) {
      const headers: Record<string, string> = withContext(baseHeaders, context);
      if (input.idempotencyKey) headers["idempotency-key"] = input.idempotencyKey;
      const body: Record<string, unknown> = { image: input.image };
      if (input.options !== undefined) body.options = input.options;
      if (input.reference !== undefined) body.reference = input.reference;

      const response = await request("/v1/scans", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      // A documented refusal — an exhausted balance, a rejected image, a rate
      // limit — is the API answering, not failing. It carries its own code,
      // message and docs link, which is everything the caller needs, so it
      // travels back as an expected failure and stays out of any report.
      if (!response.ok) throw new ExpectedFailure(`Scan failed — ${await describeError(response)}`);
      return (await response.json()) as Scan;
    },

    async getUsage(context) {
      const response = await request("/v1/usage", { headers: withContext(baseHeaders, context) });
      if (!response.ok) {
        throw new ExpectedFailure(`Usage lookup failed — ${await describeError(response)}`);
      }
      return (await response.json()) as Usage;
    },
  };
}
