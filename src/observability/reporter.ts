import { readEnvironment, readRelease } from "../vendor/observability/release.ts";
import { scrubBreadcrumb, scrubEvent } from "../vendor/observability/scrub.ts";
import type { NodeOptions } from "@sentry/node";
import { SERVER_VERSION } from "../version.ts";

// The port this server reports a failure through, its one adapter, and the
// doubles that stand in for it. Everything else depends on `Reporter` and never
// on a tracker SDK, so what is reported and what is not is decided in plain
// code and unit-tested by substituting the recording fake below.
//
// This process is not like the API service that shares the scrubbing policy
// with it. The API runs on machines we own, where telemetry is our own
// operational data; this runs on the end user's laptop, launched by their MCP
// client, next to their files. Telemetry from someone else's machine is not
// ours to take by default, so reporting here is off unless that user turns it
// on, and off means the SDK is never even loaded.

// The one switch that turns reporting on. It is deliberately NOT `SENTRY_DSN`:
// that name is already exported in the shell of anyone who works on the server
// side of this product, and the MCP server inherits the environment of whoever
// launched it. Reading it would mean a developer's own DSN silently starting to
// collect events from every machine that ran this server with that variable in
// scope — reporting nobody opted into, pointed at the wrong project. A name
// only this server answers to cannot be set by accident.
export const DSN_ENV = "DOC_CHEAP_SENTRY_DSN";

// How long the SDK may spend handing buffered events to the network while the
// process is on its way out. Short on purpose: an MCP client that launched this
// server is waiting on it, and a crash handler that lingers is one the client
// kills mid-flush anyway.
export const FLUSH_TIMEOUT_MS = 2_000;

// What may accompany an event. One key, on purpose: `component` says which part
// of the server failed — `boot`, `process`, or `tool:<name>`. A tool name does
// not get a key of its own because the shared scrubber keeps a fixed allow-list
// of keys and drops everything outside it, so a `tool` tag would be stripped
// before it ever left the process. Riding on an allow-listed key is what makes
// it arrive.
export interface ReportContext {
  readonly component?: string;
}

export interface Reporter {
  // Sends one event and returns the tracker's id for it, or undefined when
  // reporting is off — which is the normal case here.
  capture(error: unknown, context?: ReportContext): string | undefined;
  // Hands buffered events to the network and resolves when they are gone or the
  // budget expires. The crash handlers await this before the process ends.
  flush(timeoutMs: number): Promise<boolean>;
}

// The reporter every run gets unless a DSN was set. Callers never branch on
// "is reporting on": they capture, and nothing happens.
export function createNoopReporter(): Reporter {
  return {
    capture: () => undefined,
    flush: async () => true,
  };
}

export interface RecordedReport {
  readonly error: unknown;
  readonly context: ReportContext | undefined;
}

export interface RecordingReporter extends Reporter {
  readonly events: readonly RecordedReport[];
  readonly flushes: readonly number[];
  reset(): void;
}

// The test double. It records what would have been sent and hands back a stable
// event id, so a test can assert both that an event was produced and that
// exactly one was — the difference between "we report failures" and "we report
// every retry of one failure".
export function createRecordingReporter(): RecordingReporter {
  const events: RecordedReport[] = [];
  const flushes: number[] = [];
  let counter = 0;
  return {
    events,
    flushes,
    capture(error, context) {
      events.push({ error, context });
      counter += 1;
      return `evt_${String(counter).padStart(8, "0")}`;
    },
    async flush(timeoutMs) {
      flushes.push(timeoutMs);
      return true;
    },
    reset() {
      events.length = 0;
      flushes.length = 0;
    },
  };
}

// The SDK configuration, built as a value rather than written inline at the
// init call, so the settings that decide what leaves the machine are asserted
// by a unit test instead of being taken on trust.
// The SDK integrations that file an event, or end the process, on their own.
//
// An event filed on its own is one this code never decided to send: it skips
// the expected/unexpected split entirely, so the ordinary refusals the API
// answers with would be reported from a user's own machine. Because it fires
// first, `Dedupe` then drops the deliberate capture as a duplicate. The crash
// handlers go because this server owns them, and two handlers racing to end a
// process is worse than either alone.
const SELF_CAPTURING_INTEGRATIONS: ReadonlySet<string> = new Set([
  "OnUncaughtException",
  "OnUnhandledRejection",
  "Dedupe",
  "Http",
]);

export function buildSentryOptions(
  env: Readonly<Record<string, string | undefined>>,
  dsn: string,
  version: string,
): NodeOptions {
  return {
    dsn,
    integrations: (defaults) =>
      defaults.filter((integration) => !SELF_CAPTURING_INTEGRATIONS.has(integration.name)),
    release: readRelease(env, version),
    environment: readEnvironment(env),
    // Off explicitly rather than by default: with it on the SDK attaches IP
    // addresses, headers and request bodies. Here that would mean a document
    // photograph, a holder's name and the user's own address leaving a machine
    // we do not own. The hooks below are the second line of defence, not the
    // first.
    sendDefaultPii: false,
    // Error reporting only. Tracing is a separate decision with its own cost,
    // and on a user's machine it would sample their work rather than ours.
    tracesSampleRate: 0,
    beforeSend: (event) => {
      scrubEvent(event as unknown as Parameters<typeof scrubEvent>[0]);
      return event;
    },
    beforeBreadcrumb: (crumb) => {
      const kept = scrubBreadcrumb(crumb as unknown as Parameters<typeof scrubBreadcrumb>[0]);
      return kept === null ? null : (kept as unknown as typeof crumb);
    },
  };
}

export interface SentryReporterOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly version?: string;
  // Where a tracker that was asked for but could not be started is announced.
  // Never stdout: see `process-handlers.ts`.
  readonly warn?: (message: string, detail?: unknown) => void;
}

// Builds the reporter for this process. Returns the no-op one when the user has
// not opted in, so no caller has to ask whether reporting is on.
//
// The SDK is pulled in with a dynamic import rather than a top-level one so
// that in the ordinary case — no DSN — the module is never loaded: several
// megabytes of instrumentation that hooks http, fs and the process's own
// handlers are not evaluated at all, which keeps this server's startup cheap
// and its behaviour on a user's machine plainly inert. The build keeps
// `@sentry/node` out of the bundle for the same reason, so this import stays a
// real one at run time.
export async function createSentryReporter(options: SentryReporterOptions = {}): Promise<Reporter> {
  const env = options.env ?? process.env;
  const dsn = env[DSN_ENV]?.trim();
  if (!dsn) return createNoopReporter();

  try {
    const Sentry = await import("@sentry/node");
    Sentry.init(buildSentryOptions(env, dsn, options.version ?? SERVER_VERSION));
    return {
      capture(error, context) {
        // The context goes on a forked scope with the capture made inside it:
        // handing `captureException` a scope callback is documented too, but
        // the tags did not survive the SDK's scope management that way.
        return Sentry.withScope((scope) => {
          if (context?.component) scope.setTag("component", context.component);
          return Sentry.captureException(error);
        });
      },
      flush(timeoutMs) {
        return Sentry.flush(timeoutMs);
      },
    };
  } catch (error) {
    // A tracker that will not start must not stop the server: the user launched
    // this to scan documents, not to report errors. Say so once on stderr and
    // carry on reporting nothing.
    options.warn?.("error reporting is configured but could not be started", error);
    return createNoopReporter();
  }
}
