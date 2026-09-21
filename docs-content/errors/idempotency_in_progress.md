---
title: Error idempotency_in_progress
description: The first request carrying this idempotency key has not finished yet. What raises it, and how to fix it.
type: reference
keyword: idempotency_in_progress error
nav: idempotency_in_progress
section: Reference
verified: 1.0.2
---

# idempotency_in_progress (409)

The first request under this key is still running.

## Cause

A key whose first request is still in flight is waited on, not raced. Running
the work a second time is the double charge the key exists to prevent.

The wait is short. A request that outlasts it is told to retry rather than
served twice.

## The message

```text
Idempotency-Key 8f3c2a1b-5d4e-4f60-9a7b-3c2d1e0f9a8b is still being processed; retry in a moment to receive that request's result.
```

## The fix

Retry in a moment with the same key and the same body. Once the first request
finishes, the retry receives its result and not a second charge.

## event_id

`event_id` is always `null` on this code. It is a refusal the caller is meant
to handle, so nothing is recorded as a failure to look at. The service answers
and writes one log line.

## Related codes

- [`idempotency_conflict`](/errors/idempotency_conflict) — the key was used with another body.
- [`idempotency_replay_unavailable`](/errors/idempotency_replay_unavailable) — nothing left to replay.

The whole catalogue, grouped by what a caller does with it, is on
[errors](/reference/errors).

## The response

```json
{
  "error": {
    "code": "idempotency_in_progress",
    "message": "Idempotency-Key 8f3c2a1b-5d4e-4f60-9a7b-3c2d1e0f9a8b is still being processed; retry in a moment to receive that request's result.",
    "docs_url": "https://doc.cheap/docs/errors/idempotency_in_progress",
    "request_id": "req_9e6b1f7c-2d4a-4b83-9c51-7f0ad3e8b642",
    "event_id": null
  }
}
```
