import { FLUSH_TIMEOUT_MS, type Reporter } from "./reporter.ts";

// The process-level failures this server owns, and the one channel it is
// allowed to speak about them on.
//
// **Everything printed goes to stderr.** An MCP server speaks the protocol over
// stdout: the client parses that stream as framed JSON-RPC, so a stray line
// there is not a lost diagnostic, it is a corrupted message and a dead session.
// That is why nothing in this app calls `console.log`, and why the writer below
// is the only place the process writes at all.
//
// The handlers are installed by the entry point rather than left to a tracker
// SDK's defaults, because the SDK installs its own only when a DSN is
// configured — which here is almost never. Reporting is a side effect of these
// handlers, not their reason to exist.

export interface DiagnosticLogger {
  error(message: string, detail?: unknown): void;
  warn(message: string, detail?: unknown): void;
}

// An Error does not survive `JSON.stringify` — it serialises to `{}` — so the
// three fields worth reading are lifted out by hand.
function describeDetail(detail: unknown): unknown {
  if (detail instanceof Error) {
    return { name: detail.name, message: detail.message, stack: detail.stack };
  }
  return detail;
}

/**
 * Writes one JSON object per line to stderr, or to the injected sink in a test.
 *
 * The sink is a parameter for the same reason the exit is: a test must be able
 * to prove where a line went, and "it went to stdout" is the failure mode that
 * matters most here.
 */
export function createStderrLogger(
  write: (line: string) => void = (line) => {
    process.stderr.write(line);
  },
): DiagnosticLogger {
  const emit = (level: string, message: string, detail?: unknown): void => {
    let line: string;
    try {
      line = JSON.stringify({
        level,
        msg: message,
        ...(detail === undefined ? {} : { detail: describeDetail(detail) }),
      });
    } catch {
      // A value that cannot be serialised — a cycle, a getter that throws —
      // must not become a second failure inside the handler for the first.
      line = JSON.stringify({ level, msg: message });
    }
    write(`${line}\n`);
  };
  return {
    error: (message, detail) => emit("error", message, detail),
    warn: (message, detail) => emit("warn", message, detail),
  };
}

// The slice of the process object these handlers need, so a test drives them
// without touching the real one.
export interface ProcessEventSource {
  on(event: "unhandledRejection", handler: (reason: unknown) => void): unknown;
  on(event: "uncaughtException", handler: (error: Error) => void): unknown;
  on(event: "warning", handler: (warning: Error) => void): unknown;
}

export interface CrashHandlerOptions {
  readonly source: ProcessEventSource;
  readonly reporter: Reporter;
  readonly logger: DiagnosticLogger;
  // Called with the status the process should end on. Injected because the real
  // one never returns.
  readonly exit: (code: number) => void;
  readonly flushTimeoutMs?: number;
}

// The status an uncaught exception ends the process on. Non-zero so the client
// that launched this server sees a failure rather than a clean stop, and its
// own restart and error surfacing behave accordingly.
export const CRASH_EXIT_CODE = 1;

// Waits for the tracker to hand its events over, but never for longer than the
// budget. The bound is enforced here rather than trusted to the SDK's own
// timeout: a flush that resolves late, or never, would leave a process that has
// already decided to die sitting on the client's pipe with no exit ever
// reached — a hang is a worse failure than a lost event. A rejection is
// swallowed for the same reason.
async function flushWithin(reporter: Reporter, timeoutMs: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      reporter.flush(timeoutMs),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } catch {
    // A tracker that cannot be reached must not keep a dying process alive.
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function installCrashHandlers(options: CrashHandlerOptions): void {
  const flushTimeoutMs = options.flushTimeoutMs ?? FLUSH_TIMEOUT_MS;

  // A rejected promise nobody awaited. Almost always a missed `.catch` on
  // background work, and not evidence that the process's state is wrong — the
  // tool call it belonged to has already answered. Node's own default is to
  // rethrow it as an uncaught exception, which would tear down a server that is
  // still perfectly able to serve the next call; handling it here keeps the
  // session alive and makes the miss visible instead.
  options.source.on("unhandledRejection", (reason: unknown) => {
    const eventId = options.reporter.capture(reason, { component: "process" });
    options.logger.error("unhandled promise rejection", {
      reason: describeDetail(reason),
      ...(eventId ? { event_id: eventId } : {}),
    });
  });

  // An exception that escaped every handler. Unlike a rejection, this one says
  // the process's state is undefined: the stack that threw was abandoned
  // wherever it stood, so a half-read image, a half-written protocol frame or a
  // tool call that will never answer may all be in flight. Swallowing it and
  // carrying on would serve the next tool call from that state and answer the
  // model with whatever fell out — and because the MCP client is holding a
  // stdio pipe, a half-written frame does not heal, it desynchronises the
  // stream. Ending deliberately is the recoverable answer: the client notices
  // the server it launched is gone and starts a fresh one whose state is known.
  options.source.on("uncaughtException", (error: Error) => {
    const eventId = options.reporter.capture(error, { component: "process" });
    options.logger.error("uncaught exception; shutting down", {
      error: describeDetail(error),
      ...(eventId ? { event_id: eventId } : {}),
    });
    void (async () => {
      await flushWithin(options.reporter, flushTimeoutMs);
      options.exit(CRASH_EXIT_CODE);
    })();
  });

  // Deprecations, resource limits and the "too many listeners" warning that
  // precedes a leak. Logged, never reported: they are not failures, they repeat,
  // and most of them belong to the user's Node build rather than to this code.
  options.source.on("warning", (warning: Error) => {
    options.logger.warn("process warning", warning);
  });
}

/**
 * Reports a failure that stopped the server from starting, and gets the event
 * onto the network before the exit.
 *
 * Without this a boot failure is the one class of failure that never reaches a
 * tracker at all: the process is gone before anything is flushed, and from the
 * client's side it looks like a server that simply refused to start.
 */
export async function reportBootFailure(
  error: unknown,
  reporter: Reporter,
  logger: DiagnosticLogger,
  flushTimeoutMs: number = FLUSH_TIMEOUT_MS,
): Promise<void> {
  const eventId = reporter.capture(error, { component: "boot" });
  logger.error("startup failed", {
    error: describeDetail(error),
    ...(eventId ? { event_id: eventId } : {}),
  });
  await flushWithin(reporter, flushTimeoutMs);
}
