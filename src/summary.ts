import type { Scan } from "./vendor/contracts/scan.ts";
import type { Usage } from "./vendor/contracts/usage.ts";

// A one-line human summary of a scan, alongside the structured JSON.
export function summarizeScan(scan: Scan): string {
  const parts: string[] = [`Scan ${scan.meta.id}: ${scan.meta.status}`];
  const document = scan.document;
  if (document?.kind) {
    parts.push(document.country ? `${document.kind} (${document.country})` : document.kind);
  }
  if (scan.holder?.full_name) parts.push(scan.holder.full_name);
  parts.push(scan.meta.billed ? "billed" : "not billed");
  const processingMs = scan.meta.timing?.processing_ms;
  if (processingMs !== undefined) parts.push(`${processingMs} ms`);
  return parts.join(" · ");
}

// A one-line human summary of balance and usage counters.
export function summarizeUsage(usage: Usage): string {
  const balance =
    usage.balance_credits === null ? "no balance" : `${usage.balance_credits} credits`;
  return (
    `Balance: ${balance} · ${usage.scans.total} scans this period ` +
    `(${usage.scans.billed} billed, ${usage.credits_spent} credits spent).`
  );
}
