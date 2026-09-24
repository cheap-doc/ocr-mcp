---
title: Error engine_unavailable
description: The recognition engine did not answer within its timeout; nothing was charged. What raises it, and how to fix it.
type: reference
keyword: engine_unavailable error
nav: engine_unavailable
section: Reference
verified: 1.0.2
---

# engine_unavailable (503)

The recognition engine did not answer within its timeout. Nothing was charged.

## Cause

A scan is billed around the engine call. A credit is reserved before the
image is sent, and committed only when a billable result comes back. When the
engine does not answer in time the reservation is released. The balance is
unchanged and no result was produced.

## The message

```text
The recognition engine did not answer in time; nothing was charged. Retry shortly.
```

## The fix

Retry. The condition is transient, so an ordinary retry with backoff is the
right response. Wait a second or two, then a few seconds, then surface the
failure.

Sending an `Idempotency-Key` on the original request makes the retry safe, even
if the first call turns out to have landed.

## event_id

`event_id` is present on the first occurrence in a window and `null` on the
ones that follow. The failure is worth recording; one event per request is not.
An afternoon of upstream downtime would cost more events than a month's quota
holds. The rate is what is recorded, not each request.

## Related codes

- [`service_unavailable`](/errors/service_unavailable) – a dependency is unreachable.
- [`internal_error`](/errors/internal_error) – the service failed unexpectedly.

The whole catalogue, grouped by what a caller does with it, is on
[errors](/reference/errors).

## The response

```json
{
  "error": {
    "code": "engine_unavailable",
    "message": "The recognition engine did not answer in time; nothing was charged. Retry shortly.",
    "docs_url": "https://doc.cheap/docs/errors/engine_unavailable",
    "request_id": "req_9e6b1f7c-2d4a-4b83-9c51-7f0ad3e8b642",
    "event_id": null
  }
}
```
