---
title: Error idempotency_conflict
description: The idempotency key was reused with a different request body. What raises it, and how to fix it.
type: reference
keyword: idempotency_conflict error
nav: idempotency_conflict
section: Reference
verified: 1.0.2
---

# idempotency_conflict (409)

The idempotency key was used before, with a different request.

## Cause

A key is matched against a fingerprint of the body it was first used with.
Two different bodies under one key is the one case a key cannot arbitrate.
Returning the first result would answer a question nobody asked. Running the
second would charge twice for a key that promised it would not.

## The message

```text
Idempotency-Key 8f3c2a1b-5d4e-4f60-9a7b-3c2d1e0f9a8b was already used with a different body.
```

## The fix

Send the new body under a new key. A key belongs to one request, not to one
retry loop.

## event_id

`event_id` is always `null` on this code. It is a refusal the caller is meant
to handle, so nothing is recorded as a failure to look at. The service answers
and writes one log line.

## Related codes

- [`idempotency_in_progress`](/errors/idempotency_in_progress) – the first request is still running.
- [`idempotency_replay_unavailable`](/errors/idempotency_replay_unavailable) – nothing left to replay.

The whole catalogue, grouped by what a caller does with it, is on
[errors](/reference/errors).

## The response

```json
{
  "error": {
    "code": "idempotency_conflict",
    "message": "Idempotency-Key 8f3c2a1b-5d4e-4f60-9a7b-3c2d1e0f9a8b was already used with a different body.",
    "docs_url": "https://doc.cheap/docs/errors/idempotency_conflict",
    "request_id": "req_9e6b1f7c-2d4a-4b83-9c51-7f0ad3e8b642",
    "event_id": null
  }
}
```
