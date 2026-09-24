// Entry point of the hosted server: the same tools as `index.ts`, served over
// Streamable HTTP on PORT (default 8080) instead of over stdio.
//
// Unlike the stdio entry, stdout is free here — no protocol runs over it — so
// every line this process writes goes to stdout as one JSON object, which is
// what the container's log collector reads.
import { readRelease } from "./vendor/observability/release.ts";
import { createSharedAppendLog } from "./vendor/observability/append-log.ts";
import { loadConfig } from "./config.ts";
import { createMcpHttpServer, MCP_PATH } from "./http.ts";
import {
  CRASH_EXIT_CODE,
  createStderrLogger,
  installCrashHandlers,
  reportBootFailure,
} from "./observability/process-handlers.ts";
import { createSentryReporter } from "./observability/reporter.ts";
import { mcpRequestLogRecord, readRequestLogPath } from "./request-log.ts";
import { SERVER_VERSION } from "./version.ts";

const writeLine = (line: string): void => {
  process.stdout.write(line);
};
const logger = createStderrLogger(writeLine);
const release = readRelease(process.env, SERVER_VERSION);
const environment = process.env.SENTRY_ENVIRONMENT?.trim() || "production";

const reporter = await createSentryReporter({ warn: logger.warn });

installCrashHandlers({
  source: process,
  reporter,
  logger,
  exit: (code) => process.exit(code),
});

function parsePort(value: string | undefined): number {
  const port = Number(value ?? "8080");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT=${value} is not a TCP port`);
  }
  return port;
}

// The MCP traffic report's file (request-log.ts decides what is in a line).
// Unset, nothing is written. Bounded like every file on the production host,
// and a failure to write is counted and logged, never a failed request.
const requestLogPath = readRequestLogPath(process.env);
const requestLog = requestLogPath
  ? createSharedAppendLog({
      path: requestLogPath,
      maxBytes: 64 * 1024 * 1024,
      keep: 3,
      onError: (error) =>
        logger.warn("the MCP request log is not being written", { error: String(error) }),
    })
  : null;

try {
  const port = parsePort(process.env.PORT?.trim() || undefined);
  const host = process.env.HOST?.trim() || "0.0.0.0";
  const server = createMcpHttpServer({
    config: loadConfig(),
    reporter,
    release,
    log: (line) => {
      const at = new Date();
      writeLine(
        `${JSON.stringify({ time: at.toISOString(), level: "info", release, environment, ...line })}\n`,
      );
      if (requestLog !== null) {
        const record = mcpRequestLogRecord(line, at, MCP_PATH);
        if (record !== null) requestLog.write(record);
      }
    },
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  writeLine(
    `${JSON.stringify({ time: new Date().toISOString(), level: "info", msg: "listening", port, release, environment })}\n`,
  );

  // A stop signal lets the requests in progress finish before the process ends,
  // bounded so a stuck one cannot hold a deploy.
  const stop = (): void => {
    server.close(() => process.exit(0));
    server.closeIdleConnections();
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
} catch (error) {
  await reportBootFailure(error, reporter, logger);
  process.exit(CRASH_EXIT_CODE);
}
