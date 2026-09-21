---
title: Error document_repeated
description: The same document was sent again within the window that guards against a duplicate charge. What raises it, and how to fix it.
type: reference
keyword: document_repeated error
nav: document_repeated
section: Reference
verified: 1.0.2
---

# document_repeated (429)

The same image was sent too many times on the free sandbox.

## Cause

On the unauthenticated sandbox path the API refuses an image it has already
seen past a small threshold. Only a digest of the image bytes is kept, and only
for a short lifetime. The guard stores neither the image nor a durable record of
it.

The check runs before the engine is called, so a refused repeat costs neither
recognition time nor one of the free attempts.

Registered keys are exempt. They draw on their own metered balance, which bounds
them already.

## The message

```text
This document has been submitted too many times on the free sandbox; register for an API key or wait before retrying.
```

## The fix

Send a different document, or wait for the window to pass. The response
carries a `Retry-After` header with the number of seconds. A loop under test
against one image belongs on a registered key, which this guard does not
apply to.

## event_id

`event_id` is always `null` on this code. It is a refusal the caller is meant
to handle, so nothing is recorded as a failure to look at. The service answers
and writes one log line.

## Related codes

- [`rate_limited`](/errors/rate_limited) — over the rate limit.
- [`registration_required`](/errors/registration_required) — the anonymous allowance is spent.

The whole catalogue, grouped by what a caller does with it, is on
[errors](/reference/errors).

## The response

```json
{
  "error": {
    "code": "document_repeated",
    "message": "This document has been submitted too many times on the free sandbox; register for an API key or wait before retrying.",
    "docs_url": "https://doc.cheap/docs/errors/document_repeated",
    "request_id": "req_9e6b1f7c-2d4a-4b83-9c51-7f0ad3e8b642",
    "event_id": null
  }
}
```
