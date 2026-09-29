import type { ScanList } from "./vendor/contracts/reading.ts";
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

// A one-line human summary of a page of stored scans: how many rows, the span
// they cover, and whether there is another page — the three things a model
// needs to decide whether to read on.
export function summarizeScanList(page: ScanList): string {
  const count = page.scans.length;
  if (count === 0) {
    return page.next_cursor === null
      ? "No stored scans."
      : "No stored scans on this page; pass next_cursor for the next one.";
  }
  const newest = page.scans[0]?.created_at;
  const oldest = page.scans[count - 1]?.created_at;
  const parts = [`${count} stored scan${count === 1 ? "" : "s"}`, `newest ${newest}`];
  if (count > 1) parts.push(`oldest ${oldest}`);
  parts.push(
    page.next_cursor === null ? "no more pages" : "more on the next page (pass next_cursor)",
  );
  return parts.join(" · ");
}
