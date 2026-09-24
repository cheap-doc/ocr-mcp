---
title: Error registration_required
description: The public sandbox allowance is spent; an account of your own is needed to continue. What raises it, and how to fix it.
type: reference
keyword: registration_required error
nav: registration_required
section: Reference
verified: 1.0.2
---

# registration_required (403)

The anonymous free allowance on the public sandbox is used up.

## Cause

The public sandbox key runs on a lifetime allowance of free recognitions per
anonymous client. It is separate from the per-window rate limit, and both
apply.

An allowance the service cannot count is treated as spent. Refusing a caller
who still had attempts left is recoverable; handing out uncounted free
recognition is not.

## The message

```text
The free trial without an account is used up; register for your own API key to keep scanning.
```

## The fix

Register and use your own key instead of `sk_sandbox_public`. An account draws
on its own balance rather than the shared anonymous allowance, so this wall does
not apply to it.

The allowance is not refilled by waiting.

## event_id

`event_id` is always `null` on this code. It is a refusal the caller is meant
to handle, so nothing is recorded as a failure to look at. The service answers
and writes one log line.

## Related codes

- [`unauthorized`](/errors/unauthorized) – no usable API key.
- [`rate_limited`](/errors/rate_limited) – over the rate limit.
- [`document_repeated`](/errors/document_repeated) – the same image, too many times.

The whole catalogue, grouped by what a caller does with it, is on
[errors](/reference/errors).

## The response

```json
{
  "error": {
    "code": "registration_required",
    "message": "The free trial without an account is used up; register for your own API key to keep scanning.",
    "docs_url": "https://doc.cheap/docs/errors/registration_required",
    "request_id": "req_9e6b1f7c-2d4a-4b83-9c51-7f0ad3e8b642",
    "event_id": null
  }
}
```
