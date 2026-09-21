---
title: Error validation_failed
description: The request parsed but a field failed validation; the body names the field. What raises it, and how to fix it.
type: reference
keyword: validation_failed error
nav: validation_failed
section: Reference
verified: 1.0.2
---

# validation_failed (422)

The body parsed as JSON, and a field failed the schema.

## Cause

Every request is validated against the published contract before anything
runs. A field of the wrong type, a value outside its range, or a key `options`
does not declare is refused here. `options` is a strict object, so a misspelled
option is never silently ignored.

The message names the offending path and what was expected.

## The message

The wording depends on which of the cases above it was.

```text
/options/mode: Invalid option: expected one of "full"
The accept-version header is not part of this API. There is one response shape; remove the header.
```

## The fix

Read the path in the message and fix that field. The types, the defaults and
the ranges are on [scan options](/reference/scan-options) and in the generated
[endpoint reference](/reference/endpoints/create-a-scan).

Several issues are reported at once, joined by `; `.

## event_id

`event_id` is always `null` on this code. It is a refusal the caller is meant
to handle, so nothing is recorded as a failure to look at. The service answers
and writes one log line.

## Related codes

- [`invalid_request`](/errors/invalid_request) — the request could not be read.
- [`payload_too_large`](/errors/payload_too_large) — the body is over the ceiling.

The whole catalogue, grouped by what a caller does with it, is on
[errors](/reference/errors).

## The response

```json
{
  "error": {
    "code": "validation_failed",
    "message": "/options/mode: Invalid option: expected one of \"full\"",
    "docs_url": "https://doc.cheap/docs/errors/validation_failed",
    "request_id": "req_9e6b1f7c-2d4a-4b83-9c51-7f0ad3e8b642",
    "event_id": null
  }
}
```
