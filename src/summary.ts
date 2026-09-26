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

// A one-line human summary of balance and usage counters. The balance is split
// into its two parts when the API reports them, because they behave differently:
// the free credits come back on the first of the month by themselves, and only
// the paid credits need a top-up.
export function summarizeUsage(usage: Usage): string {
  const parts: string[] = [
    usage.balance_credits === null
      ? "Balance: no balance"
      : `Balance: ${usage.balance_credits} credits`,
  ];
  const free = usage.free_allowance;
  if (free) {
    parts.push(`${free.remaining_credits} free credits left this month`);
  }
  if (usage.paid_balance_credits !== null) parts.push(`${usage.paid_balance_credits} paid credits`);
  parts.push(
    `${usage.scans.total} scans this period ` +
      `(${usage.scans.billed} billed, ${usage.credits_spent} credits spent).`,
  );
  return parts.join(" · ");
}
