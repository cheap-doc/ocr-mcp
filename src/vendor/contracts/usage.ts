// Vendored from the private monorepo's @doc-cheap/contracts (src/usage.ts).
// Copied by scripts/sync-mcp-mirror.mjs because that package is not published;
// edit it there, not here.

import { z } from "zod";
import { ScanStatus } from "./reading.ts";

const Count = z.number().int().min(0);

export const Usage = z
  .object({
    balance_credits: z.number().int().nullable().meta({
      description: "Credits currently available to the account; null for keys without a balance.",
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
  })
  .meta({ id: "Usage" });
export type Usage = z.infer<typeof Usage>;
