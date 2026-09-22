---
title: Error idempotency_replay_unavailable
description: The first result for this idempotency key can no longer be replayed. What raises it, and how to fix it.
type: reference
keyword: idempotency_replay_unavailable error
nav: idempotency_replay_unavailable
section: Reference
verified: 1.0.2
---

# idempotency_replay_unavailable (409)

The key was used, and its result is no longer there to replay.

## Cause

Replaying a key returns the stored result of its first request. A result is
written down only when the retention window resolved for that request was above
zero. A request that asked for `retain_hours: 0` therefore returns its result
once and never stores it. A result that was stored also ages out when its window
elapses.

Either way the key is known to have been used, so the request is not run again
and nothing is left to hand back.

## The message

```text
Idempotency-Key 8f3c2a1b-5d4e-4f60-9a7b-3c2d1e0f9a8b was already used and its result is no longer stored, so it cannot be replayed. Send the request with a new key, or ask for retention with options.retain_hours.
```

## The fix

Send the request under a new key. To have a retry replay a stored result, ask
for retention on the original request with `options.retain_hours` above zero and
retry inside that window.

## event_id

`event_id` is always `null` on this code. It is a refusal the caller is meant
to handle, so nothing is recorded as a failure to look at. The service answers
and writes one log line.

## Related codes

- [`idempotency_conflict`](/errors/idempotency_conflict) — the key was used with another body.
- [`not_found`](/errors/not_found) — no scan, or no route.

The whole catalogue, grouped by what a caller does with it, is on
[errors](/reference/errors).

## The response

```json
{
  "error": {
    "code": "idempotency_replay_unavailable",
    "message": "Idempotency-Key 8f3c2a1b-5d4e-4f60-9a7b-3c2d1e0f9a8b was already used and its result is no longer stored, so it cannot be replayed. Send the request with a new key, or ask for retention with options.retain_hours.",
    "docs_url": "https://doc.cheap/docs/errors/idempotency_replay_unavailable",
    "request_id": "req_9e6b1f7c-2d4a-4b83-9c51-7f0ad3e8b642",
    "event_id": null
  }
}
```
