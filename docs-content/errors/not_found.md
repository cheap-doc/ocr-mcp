---
title: Error not_found
description: No resource matched the request, or the one that did has passed its retention window. What raises it, and how to fix it.
type: reference
keyword: not_found error
nav: not_found
section: Reference
verified: 1.0.2
---

# not_found (404)

No resource matched the request.

## Cause

Three cases share this code.

- No scan was ever stored with that id. It was created with `retain_hours: 0`,
  or it belongs to another account.
- A scan was stored and its retention window has since passed.
- The path is not a route this API serves.

The first two are not distinguished. Telling a caller that an id existed but
has gone is telling them about somebody else's history.

A path parameter that cannot be a valid id answers here rather than 422. An id
that could never exist names a resource that cannot exist.

## The message

The wording depends on which of the cases above it was.

```text
No scan with id 01a0af18-cd8d-7a61-9f2d-4c7b8e105da3 exists or it has expired.
No route for GET /v1/scan/1.
```

## The fix

Check the id and the path. A result is readable only while its retention
window lasts. That window is the `retain_hours` the creating request asked for,
or the account's own setting when it asked for none.

## event_id

`event_id` is always `null` on this code. It is a refusal the caller is meant
to handle, so nothing is recorded as a failure to look at. The service answers
and writes one log line.

## Related codes

- [`idempotency_replay_unavailable`](/errors/idempotency_replay_unavailable) — nothing left to replay.

The whole catalogue, grouped by what a caller does with it, is on
[errors](/reference/errors).

## The response

```json
{
  "error": {
    "code": "not_found",
    "message": "No scan with id 01a0af18-cd8d-7a61-9f2d-4c7b8e105da3 exists or it has expired.",
    "docs_url": "https://doc.cheap/docs/errors/not_found",
    "request_id": "req_9e6b1f7c-2d4a-4b83-9c51-7f0ad3e8b642",
    "event_id": null
  }
}
```
