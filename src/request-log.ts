// One line per protocol request to the hosted endpoint, for the MCP traffic
// report — a separate file from the API's, read by a reader of its own.
//
// Built from the request-log line the server already writes (http.ts), so there
// is one decision about what a request was rather than two that can disagree.
// Only POSTs to the MCP endpoint are written: the health check the watchdog
// polls, the discovery document on `/`, a browser's preflight and a scanner's
// guess at some other path are not somebody using the tools.
//
// WHAT IS WRITTEN. The caller is the kind of key the request carried — the
// caller's own, the public sandbox, or none because it was refused before the
// key was read — never the key and never the address: this server does not know
// the account behind a key, and the API's own report is where the account of a
// call made through here appears. The call is the protocol method and, for a
// tool call, the tool, each from a fixed list so a caller cannot write text of
// its choosing into the file.

import type { RequestLogLine } from "./http.ts";

/** The protocol methods a client of this server sends. */
export const KNOWN_METHODS: readonly string[] = [
  "initialize",
  "notifications/initialized",
  "notifications/cancelled",
  "ping",
  "tools/list",
  "tools/call",
  "prompts/list",
  "prompts/get",
  "resources/list",
  "resources/read",
  "resources/templates/list",
  "completion/complete",
  "logging/setLevel",
];

/** The tools this server registers (server.ts). */
export const KNOWN_TOOLS: readonly string[] = ["scan_document", "check_balance", "search_docs"];

export type McpCaller = "own-key" | "sandbox" | "none";

export interface McpRequestLogRecord {
  readonly ts: string;
  readonly caller: McpCaller;
  readonly method: string;
  readonly call: string;
  readonly status: number;
  readonly outcome: "ok" | "refused" | "failed";
  readonly duration_ms: number;
}

function callFor(line: RequestLogLine): string {
  if (line.rpc === undefined) return "/(none)";
  if (!KNOWN_METHODS.includes(line.rpc)) return "/(other)";
  if (line.rpc !== "tools/call") return `/${line.rpc}`;
  const tool = line.tool !== undefined && KNOWN_TOOLS.includes(line.tool) ? line.tool : "(other)";
  return `/tools/call/${tool}`;
}

function callerFor(line: RequestLogLine): McpCaller {
  if (line.key === "own") return "own-key";
  if (line.key === "sandbox") return "sandbox";
  return "none";
}

/**
 * The report's line for one request, or null when it was not a protocol request
 * to the MCP endpoint. Pure, so the rule is a table.
 */
export function mcpRequestLogRecord(
  line: RequestLogLine,
  at: Date,
  mcpPath: string,
): McpRequestLogRecord | null {
  if (line.method !== "POST" || line.path !== mcpPath) return null;
  return {
    ts: at.toISOString(),
    caller: callerFor(line),
    method: line.method,
    call: callFor(line),
    status: line.status,
    outcome: line.status >= 500 ? "failed" : line.status >= 400 ? "refused" : "ok",
    duration_ms: Math.max(0, Math.round(line.duration_ms)),
  };
}

/** Where the lines go, or null when the deployment asked for none. */
export function readRequestLogPath(
  env: Readonly<Record<string, string | undefined>>,
): string | null {
  const value = env.MCP_REQUEST_LOG_PATH?.trim() ?? "";
  return value === "" ? null : value;
}
