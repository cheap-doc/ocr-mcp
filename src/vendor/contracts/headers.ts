// Vendored from the private monorepo's @doc-cheap/contracts (src/headers.ts).
// Copied by scripts/sync-mcp-mirror.mjs because that package is not published;
// edit it there, not here.

import { z } from "zod";

export const BEARER_PREFIX = "Bearer ";

// API keys: sk_live_<key> for an account, sk_sandbox_public for the docs.
export const ApiKey = z.string().regex(/^sk_(live|sandbox)_[A-Za-z0-9]+$/);
export type ApiKey = z.infer<typeof ApiKey>;

// The public, unregistered sandbox key. It is part of the documented API
// surface — printed in the docs, in the copy-paste examples and embedded in the
// landing demo's client JavaScript — so it is a contract value, declared once
// here and read by every caller instead of repeated as a literal. It carries no
// account: the recognitions it runs are real but free, capped by a lifetime
// allowance and rate limited per client address.
export const SANDBOX_PUBLIC_KEY = "sk_sandbox_public";

export const AuthorizationHeader = z
  .string()
  .startsWith(BEARER_PREFIX)
  .transform((value) => value.slice(BEARER_PREFIX.length))
  .pipe(ApiKey);

export const IdempotencyKey = z.string().min(1).max(255).meta({
  description:
    "Caller-chosen key that makes a retried request return the first result instead of running and charging again.",
  example: "8f3c2a1b-5d4e-4f60-9a7b-3c2d1e0f9a8b",
});
export type IdempotencyKey = z.infer<typeof IdempotencyKey>;

// The one header a scan request carries. There is no content-negotiation
// header beside it: this API has one response shape, and a request that tries
// to select another is refused rather than quietly served the only one there
// is.
export const ScanRequestHeaders = z.object({
  "idempotency-key": IdempotencyKey.optional(),
});
export type ScanRequestHeaders = z.infer<typeof ScanRequestHeaders>;
