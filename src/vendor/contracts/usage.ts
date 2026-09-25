// Vendored from the private monorepo's @doc-cheap/contracts (src/usage.ts).
// Copied by scripts/sync-mcp-mirror.mjs because that package is not published;
// edit it there, not here.

import { z } from "zod";
import { ScanStatus } from "./reading.ts";

const Count = z.number().int().min(0);

export const Usage = z
  .object({
    balance_credits: z.number().int().nullable().meta({
      description:
        "Credits currently available to the account: this month's free credits plus the paid credits; null for a key with no account (the public sandbox key).",
    }),
    period: z
      .object({
        start: z.iso.datetime(),
        end: z.iso.datetime(),
      })
      .meta({ description: "Bounds of the current usage period (UTC calendar month)." }),
    scans: z.object({
      total: Count,
      billed: Count,
      by_status: z.object(
        Object.fromEntries(ScanStatus.options.map((status) => [status, Count])) as Record<
          z.infer<typeof ScanStatus>,
          typeof Count
        >,
      ),
    }),
    credits_spent: Count.meta({ description: "Credits charged within the period." }),
    free_allowance: z
      .object({
        monthly_credits: Count.meta({
          description:
            "Free credits the account is set back to at the start of each UTC calendar month: 100 every month.",
        }),
        remaining_credits: Count.meta({
          description: "Free credits left this month.",
        }),
        resets_at: z.iso.datetime().nullable().meta({
          description:
            "When the free credits are next set back to the monthly amount (00:00 UTC on the first of the next month); null when there is no next monthly amount.",
        }),
      })
      .nullable()
      .meta({
        description:
          "This month's free credits, drawn before paid credits; null when the account may not draw free credits (its email address is not confirmed, or its free credits were withdrawn) and for a key with no account.",
      }),
    paid_balance_credits: z.number().int().min(0).nullable().meta({
      description:
        "Paid credits: bought or granted to the account, drawn once this month's free credits are used up, and never reset; null only for a key with no account (the public sandbox key).",
    }),
    credits_spent_by_kind: z
      .object({ free: Count, paid: Count })
      .meta({ description: "Credits charged within the period, by the kind that paid." }),
  })
  .meta({ id: "Usage" });
export type Usage = z.infer<typeof Usage>;
