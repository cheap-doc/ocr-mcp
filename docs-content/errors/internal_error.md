---
title: Error internal_error
description: An unexpected failure; nothing was charged and the response carries an event id. What raises it, and how to fix it.
type: reference
keyword: internal_error error
nav: internal_error
section: Reference
verified: 1.0.2
---

# internal_error (500)

The service did something it did not intend.

## Cause

The one code that means a bug rather than a refusal. Two paths reach it: a
failure nobody modelled, and a response that did not match its own schema.

It is the only code in the catalogue that is always recorded as a failure to
look at.

The status is 500, or another 5xx where the failure carried one.

## The message

The wording depends on which of the cases above it was.

```text
Unexpected error.
The response could not be produced.
```

## The fix

Retry once — most are transient. Quote the `event_id` if the response carries
one, and the `request_id` otherwise, when you report it.

Nothing is charged for a scan that ended here: the reservation is released
before the error leaves.

## event_id

`event_id` is **always present** on this code. It is the one code that means a
bug, so every occurrence is recorded. Quote the value in a support request and
it resolves to that one failure.

## Related codes

- [`service_unavailable`](/errors/service_unavailable) — a dependency is unreachable.
- [`engine_unavailable`](/errors/engine_unavailable) — the engine did not answer.

The whole catalogue, grouped by what a caller does with it, is on
[errors](/reference/errors).

## The response

```json
{
  "error": {
    "code": "internal_error",
    "message": "Unexpected error.",
    "docs_url": "https://doc.cheap/docs/errors/internal_error",
    "request_id": "req_9e6b1f7c-2d4a-4b83-9c51-7f0ad3e8b642",
    "event_id": "e3b0c44298fc1c14"
  }
}
```
