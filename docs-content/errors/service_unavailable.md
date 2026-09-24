---
title: Error service_unavailable
description: A store this service depends on is unreachable, so the request cannot be served now. What raises it, and how to fix it.
type: reference
keyword: service_unavailable error
nav: service_unavailable
section: Reference
verified: 1.0.2
---

# service_unavailable (503)

A dependency this service needs is unreachable. Nothing was charged.

## Cause

Something the API depends on internally is not answering. It is not a problem
with the request: the same call works again once the dependency is back.

Which dependency is not named. Which of this service's internals is down is not
the caller's business, and naming it is free reconnaissance.

It can also appear on the public sandbox key while an internal counter is
unreadable. The sandbox allowance and the repeated-document guard keep that key
free to publish. A request that cannot consult them is refused rather than waved
through.

## The message

```text
The service is temporarily unable to handle this request; nothing was charged. Retry shortly.
```

## The fix

Retry after the `Retry-After` header says, with backoff; treat its absence as
a few seconds. Nothing was charged and no scan was run, so a retry is safe.

## event_id

`event_id` is present on the first occurrence in a window and `null` on the
ones that follow. The failure is worth recording; one event per request is not.
An afternoon of upstream downtime would cost more events than a month's quota
holds. The rate is what is recorded, not each request.

## Related codes

- [`engine_unavailable`](/errors/engine_unavailable) – the engine did not answer.
- [`maintenance`](/errors/maintenance) – a planned window is open.
- [`internal_error`](/errors/internal_error) – the service failed unexpectedly.

The whole catalogue, grouped by what a caller does with it, is on
[errors](/reference/errors).

## The response

```json
{
  "error": {
    "code": "service_unavailable",
    "message": "The service is temporarily unable to handle this request; nothing was charged. Retry shortly.",
    "docs_url": "https://doc.cheap/docs/errors/service_unavailable",
    "request_id": "req_9e6b1f7c-2d4a-4b83-9c51-7f0ad3e8b642",
    "event_id": null
  }
}
```
