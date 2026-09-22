---
title: Error rate_unavailable
description: The exchange rate needed to price this top-up could not be read. What raises it, and how to fix it.
type: reference
keyword: rate_unavailable error
nav: rate_unavailable
section: Reference
verified: 1.0.2
---

# rate_unavailable (503)

No corroborated exchange rate could be produced, so nothing was quoted.

## Cause

A crypto top-up is quoted in dollars and paid in coin, so an exchange rate
has to be chosen and stood behind. The rate is taken from three independent
price sources, and is used only when at least two of them agree. A quote that
disagrees with the median by more than the configured tolerance is dropped.
Fewer than two survivors means no rate.

Quoting a price nobody corroborates would fix an amount of money against a
number that may be wrong. A crypto payment cannot be recalled, so the request is
refused instead.

## The message

```text
No corroborated exchange rate is available right now, so no amount can be quoted. Retry shortly.
```

## The fix

Retry with backoff. Nothing partial was created. No intent needs cleaning up
and no address was handed out, so a retry creates exactly one top-up when it
succeeds.

## event_id

`event_id` is present on the first occurrence in a window and `null` on the
ones that follow. The failure is worth recording; one event per request is not.
An afternoon of upstream downtime would cost more events than a month's quota
holds. The rate is what is recorded, not each request.

## Related codes

- [`topup_in_progress`](/errors/topup_in_progress) — a top-up is open and part-paid.
- [`service_unavailable`](/errors/service_unavailable) — a dependency is unreachable.

The whole catalogue, grouped by what a caller does with it, is on
[errors](/reference/errors).

## The response

```json
{
  "error": {
    "code": "rate_unavailable",
    "message": "No corroborated exchange rate is available right now, so no amount can be quoted. Retry shortly.",
    "docs_url": "https://doc.cheap/docs/errors/rate_unavailable",
    "request_id": "req_9e6b1f7c-2d4a-4b83-9c51-7f0ad3e8b642",
    "event_id": null
  }
}
```
