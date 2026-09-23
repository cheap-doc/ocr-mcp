import { type ScanOptionsInput, ScanStatus } from "./vendor/contracts/reading.ts";
import { Scan } from "./vendor/contracts/scan.ts";
import { Usage } from "./vendor/contracts/usage.ts";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SANDBOX_ALLOWANCE } from "./allowance.ts";
import { type CallContext, createApiClient } from "./api-client.ts";
import type { McpConfig } from "./config.ts";
import { searchDocs } from "./docs-search.ts";
import { ExpectedFailure, isExpectedFailure } from "./errors.ts";
import { resolveImage } from "./image.ts";
import { createNoopReporter, type Reporter } from "./observability/reporter.ts";
import { registerPrompts } from "./prompts.ts";
import { registerDocResources } from "./resources.ts";
import { summarizeScan, summarizeUsage } from "./summary.ts";
import { buildBaggage, buildUserAgent, clientIdentityFrom, doNotTrack } from "./user-agent.ts";
import { SERVER_NAME, SERVER_VERSION } from "./version.ts";

export { SERVER_NAME, SERVER_VERSION };

// What the server tells the model the moment a client connects.
//
// A client hands this to the model alongside the tool list, and it is the only
// place that can say what this server is FOR. A tool description answers "what
// does this call do" once the model has already decided to look here; these
// sentences are what make it look — a user dropping a photo of a passport into
// a conversation is not obviously a tool call until something says it is.
//
// Kept to three sentences on purpose: it is prepended to every conversation
// that mounts this server, so each sentence costs the user context on every
// turn and has to earn it. What it buys, in order: what the server recognises,
// when to reach for the expensive tool and what it costs, and where to look
// things up instead of guessing.
export const SERVER_INSTRUCTIONS =
  "This server recognises identity documents: give it a photo or scan of a passport, " +
  "national ID card or driver's licence and it returns what is printed on the document as " +
  "structured JSON. Reach for scan_document whenever someone shares such a document and " +
  "wants it read, transcribed or checked — it draws one credit ($0.01) per document actually " +
  "recognised and nothing at all when the image holds no readable document. Call " +
  "check_balance before working through a batch, and search_docs for field names, error " +
  "codes, MRZ rules and anything else about the API rather than guessing at them.";

// What each tool's successful result carries as structured content, declared to
// the client as the tool's output schema.
//
// scan_document and check_balance answer with the API's own objects, so their
// schemas are the contract's — the same definitions the API's responses and
// its OpenAPI document are built from, not a second description of them. Each
// is re-wrapped in a plain object because the contract's carries a schema id,
// which turns the top of the generated JSON Schema into a reference, and a
// client requires an output schema whose top is `type: object`.
//
// The generated schemas forbid properties they do not name, and a client
// checks the result against them, so the handlers below parse the API's answer
// through the same schema before returning it: a field the API adds before the
// contract names it is dropped here rather than failing the caller's call.
const ScanOutput = z.object(Scan.shape);
const UsageOutput = z.object(Usage.shape);
const SearchOutput = z.object({
  results: z
    .array(
      z.object({
        title: z.string().describe("Heading of the matching documentation section."),
        page: z.string().describe("Path of the page the section is on; empty for the home page."),
        link: z.string().describe("Address of the section on the documentation site."),
        snippet: z.string().describe("The start of the section's text."),
        score: z.number().describe("Relevance: heading matches count five times a body match."),
      }),
    )
    .describe("Matching sections, best first; empty when nothing matched."),
});

// What the public sandbox key's usage is, without asking the API. The key has no
// account behind it, so the API's own answer is always this — a null balance
// and zero counters over the current UTC calendar month — and asking for it
// cost the caller one of the few requests an hour the sandbox key allows, the
// same ones a scan needs.
export function sandboxUsage(now: Date): Usage {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return {
    balance_credits: null,
    period: { start: start.toISOString(), end: end.toISOString() },
    scans: {
      total: 0,
      billed: 0,
      by_status: Object.fromEntries(ScanStatus.options.map((status) => [status, 0])) as Record<
        ScanStatus,
        number
      >,
    },
    credits_spent: 0,
  };
}

function textContent(text: string): { type: "text"; text: string } {
  return { type: "text", text };
}

// A type alias rather than an interface on purpose: the SDK's result type has
// an index signature, and only an alias of an object type gets the implicit one
// that makes it assignable.
type ToolErrorResult = {
  isError: true;
  content: { type: "text"; text: string }[];
};

// The answer a failed tool call gives back. Whatever went wrong, the caller is
// a model that can act only on what it reads, so every failure arrives as one
// readable line in an error block — never a silent empty result. This shape is
// the contract with the client; reporting is layered on top of it and changes
// nothing about it.
function toolError(error: unknown): ToolErrorResult {
  const message = error instanceof Error ? error.message : String(error);
  return { isError: true, content: [textContent(message)] };
}

// What differs when this server is the hosted one rather than a process on the
// caller's own machine. Absent, the server is the local one.
export interface RemoteContext {
  // The address of the person calling, passed on to the API so its
  // per-address limits count that person rather than this server.
  readonly clientAddress: string | null;
}

export interface BuildOptions {
  readonly remote?: RemoteContext;
}

// The image inputs scan_document offers, and the sentence describing them.
// Hosted, there is no local file of the caller's to read, so `image_path` is
// neither offered nor mentioned; everything else about the tool is the same.
function imageInputsSentence(remote: boolean): string {
  return remote
    ? "Inputs: the image as image_base64 or image_url (https, on a public address); plus the " +
        "optional expect_country, return_portrait, retain_hours, reference and idempotency_key. "
    : "Inputs: the image as image_base64 (always available), image_path (a local file, and " +
        "only inside the directory DOC_CHEAP_IMAGE_ROOT names) or image_url (https, on a " +
        "public address); plus the optional expect_country, return_portrait, retain_hours, " +
        "reference and idempotency_key. ";
}

// Builds the MCP server and registers the three doc-cheap tools. The server is
// a thin client of the public HTTP API and the documentation content; it holds
// no data of its own.
//
// The reporter defaults to the no-op one, so a caller that has not opted into
// reporting — which is every caller that did not set a DSN — gets a server that
// behaves identically and sends nothing.
export function buildServer(
  config: McpConfig,
  reporter: Reporter = createNoopReporter(),
  options: BuildOptions = {},
): McpServer {
  const remote = options.remote !== undefined;
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  );
  const api = createApiClient(config);

  // Who is driving this particular tool call, rebuilt from the protocol on
  // every one of them: the current revision carries the client's identity in
  // the per-request metadata, and a client on an older revision only said who
  // it was when it connected. Both are read; neither is trusted for anything
  // but reporting, which is what the specification asks of them.
  //
  // `DO_NOT_TRACK=1` is honoured here, once, so no call site can forget it.
  function callContext(extra: { _meta?: Record<string, unknown> }): CallContext {
    const suppressed = doNotTrack();
    const identity = suppressed
      ? null
      : clientIdentityFrom(extra?._meta, server.server.getClientVersion());
    const baggage = buildBaggage(identity, { doNotTrack: suppressed });
    return {
      userAgent: buildUserAgent(identity, { doNotTrack: suppressed }),
      ...(baggage === null ? {} : { baggage }),
      ...(options.remote?.clientAddress ? { clientAddress: options.remote.clientAddress } : {}),
    };
  }

  // The one place the expected/unexpected split is acted on. The caller's
  // answer is the same either way; what differs is whether anyone else is told.
  // `isExpectedFailure` decides, on the marker the deliberate throws carry
  // (`./errors.ts`), so a condition this server planned for — the API refusing
  // the call, a path outside the image root, a host that will not resolve —
  // stays between the server and its caller, and only a throw nobody planned
  // for becomes an event.
  function failed(error: unknown, tool: string): ToolErrorResult {
    if (!isExpectedFailure(error)) reporter.capture(error, { component: `tool:${tool}` });
    return toolError(error);
  }

  server.registerTool(
    "scan_document",
    {
      title: "Recognise a passport or ID document",
      description:
        "Recognise a passport, national ID card or driver's licence from a photo or scan and " +
        "return what is printed on it as structured JSON. " +
        imageInputsSentence(remote) +
        "Output: a Scan object — meta (id, status, billed, confidence, timing), document " +
        "(kind, issuing country, number, series, date of issue, date of expiry, whether it " +
        "has expired and how many days are left), holder " +
        "(given names, surname, date of birth, sex, nationality), fields (every field read " +
        "off the printed page, each with its own confidence), mrz (whether the " +
        "machine-readable zone checks out, why not when it does not, and its lines exactly " +
        "as read), images, quality and authenticity — plus a one-line summary of the same " +
        "result. Calls POST /v1/scans. " +
        "Cost: it bills one credit ($0.01) only when a document is recognised; an unreadable " +
        "image, an empty frame or an unsupported type costs nothing, and meta.billed says " +
        "which happened. " +
        SANDBOX_ALLOWANCE +
        " " +
        "Use it whenever someone hands over an identity document and wants it read, " +
        "transcribed, or checked against what they claim — a name, a document number, a date " +
        "of birth or an expiry date.",
      // Behaviour hints, each one a claim about what this handler below does.
      //
      // The pair the specification leaves meaningful only while readOnlyHint is
      // false is stated here for that reason: this tool is not read-only, so a
      // client reading these has a real question to answer about retrying it.
      annotations: {
        // The call posts an image to the API, which records a scan and can draw
        // a credit from the account. A client that took it for a free lookup
        // would be free to call it speculatively, or twice.
        readOnlyHint: false,
        // A scan only ever adds a record. Nothing the caller already has is
        // overwritten or deleted, and retain_hours only shortens how long this
        // call's own result is kept.
        destructiveHint: false,
        // True because of idempotency_key, and only because of it: a repeat
        // carrying the same key returns the first result instead of recognising
        // and charging a second time. A retry without one is a second scan, so
        // a client that means to retry has to send a key.
        idempotentHint: true,
        // The subject is whatever document the caller supplies and the answer
        // comes from a remote service over the network — not from any closed
        // set this process knows.
        openWorldHint: true,
      },
      inputSchema: {
        image_base64: z
          .string()
          .optional()
          .describe("The document image as base64 (a data: URL is also accepted)."),
        ...(remote
          ? {}
          : {
              image_path: z
                .string()
                .optional()
                .describe(
                  "Path to a local image file, inside the directory named by DOC_CHEAP_IMAGE_ROOT. " +
                    "Disabled unless that variable is set; send image_base64 instead.",
                ),
            }),
        image_url: z
          .string()
          .optional()
          .describe(
            "https: URL of an image on a public internet address, which the server fetches " +
              "(25 MB maximum).",
          ),
        expect_country: z
          .string()
          .length(3)
          .optional()
          .describe("ISO 3166-1 alpha-3 country you expect, or omit for any."),
        return_portrait: z
          .boolean()
          .optional()
          .describe(
            "Whether to include the holder photograph crop, images.main_photo (default true).",
          ),
        retain_hours: z
          .number()
          .int()
          .min(0)
          .max(8760)
          .optional()
          .describe(
            "Hours the result stays readable via GET /v1/scans/{id} (0 = store nothing). " +
              "Omit it to use the account's own history-retention setting.",
          ),
        reference: z
          .string()
          .max(128)
          .optional()
          .describe("Your own correlation string, echoed back in the result."),
        idempotency_key: z
          .string()
          .optional()
          .describe("Makes a retried scan return the first result instead of charging again."),
      },
      outputSchema: ScanOutput,
    },
    async (args, extra) => {
      try {
        const image = await resolveImage(args, { allowPath: !remote });
        const options: ScanOptionsInput = {};
        if (args.expect_country !== undefined) options.expect_country = args.expect_country;
        if (args.return_portrait !== undefined) options.return_portrait = args.return_portrait;
        if (args.retain_hours !== undefined) options.retain_hours = args.retain_hours;
        const answer = await api.createScan(
          {
            image,
            ...(Object.keys(options).length > 0 ? { options } : {}),
            ...(args.reference !== undefined ? { reference: args.reference } : {}),
            ...(args.idempotency_key !== undefined ? { idempotencyKey: args.idempotency_key } : {}),
          },
          callContext(extra),
        );
        const scan = ScanOutput.parse(answer);
        return {
          structuredContent: scan as unknown as Record<string, unknown>,
          content: [textContent(summarizeScan(scan)), textContent(JSON.stringify(scan, null, 2))],
        };
      } catch (error) {
        return failed(error, "scan_document");
      }
    },
  );

  server.registerTool(
    "check_balance",
    {
      title: "Check remaining credits",
      description:
        "Return how many credits are left on the account and what the current period has " +
        "used: the balance, the credits spent, and the scan counters broken down by status " +
        "(recognized, unreadable, no document found, unsupported document, rejected). " +
        "Takes no arguments and calls GET /v1/usage; under the public sandbox key it answers " +
        "without calling anything. " +
        "One recognised document draws one credit, at $0.01; scans that recognised nothing " +
        "are counted and never charged. " +
        "Needs a real API key — under the public sandbox key there is no account behind the " +
        "call, and the answer says so instead of reporting zeros that read like a balance. " +
        "Use it before working through a batch of documents, or when a scan is refused for " +
        "lack of credit.",
      annotations: {
        // A GET that reads counters. Nothing is created, charged or deleted,
        // which is also why the destructive and idempotent hints are left
        // unstated: the specification gives them meaning only when a tool is
        // not read-only, and a client that reads them here would be reading
        // something this server never claimed.
        readOnlyHint: true,
        // The figures are the account's live standing at a remote service, and
        // they move as scans are billed — not a fixed answer this process could
        // compute.
        openWorldHint: true,
      },
      inputSchema: {},
      outputSchema: UsageOutput,
    },
    async (_args, extra) => {
      try {
        // Under the public sandbox key there is nobody's account to read, so
        // the answer is built here rather than fetched (see `sandboxUsage`).
        // The first line says so, and says how to get one, so a model does not
        // read the zeros as the caller's own.
        const usage = UsageOutput.parse(
          config.usingSandboxKey
            ? sandboxUsage(new Date())
            : await api.getUsage(callContext(extra)),
        );
        const headline = !config.usingSandboxKey
          ? summarizeUsage(usage)
          : remote
            ? "No API key was sent, so the public demo sandbox key is in use and has no " +
              `balance. ${SANDBOX_ALLOWANCE} Register for a key and send it as ` +
              "`X-Doc-Cheap-Api-Key: <key>` or `Authorization: Bearer <key>` to check your " +
              "balance and usage."
            : "No API key is configured, so the public demo sandbox key is in use and has no " +
              `balance. ${SANDBOX_ALLOWANCE} Register for a key and set DOC_CHEAP_API_KEY to ` +
              "check your balance and usage.";
        return {
          structuredContent: usage as unknown as Record<string, unknown>,
          content: [textContent(headline), textContent(JSON.stringify(usage, null, 2))],
        };
      } catch (error) {
        return failed(error, "check_balance");
      }
    },
  );

  server.registerTool(
    "search_docs",
    {
      title: "Search the doc.cheap API documentation",
      description:
        "Full-text search over the doc.cheap API documentation — endpoints, request options, " +
        "every response field, the error codes and what to do about each, MRZ rules, " +
        "retention and pricing. " +
        "Takes a query and an optional limit (1 to 20, default 5), and answers with the " +
        "matching sections: title, a snippet, and a link to the page. " +
        "It reads a copy of the documentation shipped beside this server, so it makes no " +
        "network call and works offline. " +
        "Use it before guessing at a field name, an error code or a scan option — what it " +
        "returns is the published contract rather than a recollection of it.",
      annotations: {
        // Reading markdown off the local disk: no request leaves the process
        // and nothing is written. The destructive and idempotent hints are
        // omitted for the reason given on check_balance.
        readOnlyHint: true,
        // The corpus is the documentation copy shipped with this server — a
        // closed, local set, the same answer for the same query.
        openWorldHint: false,
      },
      inputSchema: {
        query: z.string().min(1).describe("What to search the documentation for."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe("Maximum number of results (default 5)."),
      },
      outputSchema: SearchOutput,
    },
    async (args) => {
      if (config.docsDir === "") {
        // A deployment that shipped without the documentation copy. The caller
        // can act on it (ask the API instead, or point DOC_CHEAP_DOCS_DIR at a
        // checkout), and it would repeat on every call, so it is a message and
        // not an event.
        return failed(
          new ExpectedFailure("Documentation content is not available to this server."),
          "search_docs",
        );
      }
      try {
        const hits = await searchDocs(config.docsDir, config.docsBase, args.query, args.limit ?? 5);
        if (hits.length === 0) {
          return {
            structuredContent: { results: [] },
            content: [textContent(`No documentation matched "${args.query}".`)],
          };
        }
        const lines = hits.map(
          (hit, index) => `${index + 1}. ${hit.title} — ${hit.link}\n   ${hit.snippet}`,
        );
        return {
          structuredContent: { results: hits },
          content: [textContent(lines.join("\n\n"))],
        };
      } catch (error) {
        return failed(error, "search_docs");
      }
    },
  );

  // The documentation pages as resources and four ready-made prompts, both
  // read from the same documentation copy search_docs uses. Registered here,
  // in the one function both entry points call, so the hosted server and the
  // local one cannot offer different sets.
  registerDocResources(server, config.docsDir, config.docsBase);
  registerPrompts(server, config.docsDir, config.docsBase);

  return server;
}
