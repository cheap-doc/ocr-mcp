// MCP server entry point: builds the doc-cheap MCP server from the environment
// and serves it over stdio, the transport an MCP client launches it with. The
// executable shebang is added to the bundled build by the build step.
//
// stdout belongs to the protocol from here on. Every diagnostic this process
// produces goes to stderr through the logger below, which is why nothing in
// this app prints directly.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.ts";
import {
  CRASH_EXIT_CODE,
  createStderrLogger,
  installCrashHandlers,
  reportBootFailure,
} from "./observability/process-handlers.ts";
import { createSentryReporter } from "./observability/reporter.ts";
import { buildServer } from "./server.ts";

const logger = createStderrLogger();

// Reporting is opt-in and off unless the user set DOC_CHEAP_SENTRY_DSN
// themselves; with it unset this is the no-op reporter and the tracker SDK is
// never even loaded.
const reporter = await createSentryReporter({ warn: logger.warn });

// Installed before anything else can fail, so a throw during configuration or
// connection is already covered.
installCrashHandlers({
  source: process,
  reporter,
  logger,
  exit: (code) => process.exit(code),
});

try {
  const server = buildServer(loadConfig(), reporter);
  await server.connect(new StdioServerTransport());
} catch (error) {
  // A server that never connected has no way to tell the client what happened —
  // the client sees a process that exited before speaking. So the one account of
  // it is this: reported, flushed, then a deliberate non-zero exit.
  await reportBootFailure(error, reporter, logger);
  process.exit(CRASH_EXIT_CODE);
}
