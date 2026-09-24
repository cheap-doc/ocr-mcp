---
title: Error rate_limited
description: The caller is over the request rate its key allows; the response says when to retry. What raises it, and how to fix it.
type: reference
keyword: rate_limited error
nav: rate_limited
section: Reference
verified: 1.0.2
---

# rate_limited (429)

The caller is over the rate limit for its key kind.

## Cause

Two tiers, and they are different animals. The public sandbox key is
unregistered and shared, so its bucket is keyed by client address over a long
window. It exists to keep one visitor from consuming the demo for everybody
else. A registered key is metered by its own balance, so its limit only keeps a
runaway client from flooding the service. That one is per key, over a short
window.

The figures are on [limits](/reference/limits).

## The message

The wording depends on which of the cases above it was.

```text
Rate limit exceeded; retry later.
Sandbox limit of 10 requests per hour per IP reached.
```

## The fix

Wait for the window to pass, then retry. Honor the `Retry-After` header where
the response carries one, rather than retrying on a tighter loop.

A registered key has its own, much shorter window than the public sandbox.

## event_id

`event_id` is always `null` on this code. It is a refusal the caller is meant
to handle, so nothing is recorded as a failure to look at. The service answers
and writes one log line.

## Related codes

- [`registration_required`](/errors/registration_required) – the anonymous allowance is spent.
- [`document_repeated`](/errors/document_repeated) – the same image, too many times.

The whole catalogue, grouped by what a caller does with it, is on
[errors](/reference/errors).

## The response

```json
{
  "error": {
    "code": "rate_limited",
    "message": "Rate limit exceeded; retry later.",
    "docs_url": "https://doc.cheap/docs/errors/rate_limited",
    "request_id": "req_9e6b1f7c-2d4a-4b83-9c51-7f0ad3e8b642",
    "event_id": null
  }
}
```
