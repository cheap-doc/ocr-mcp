---
title: Error client_token_used_up
description: A client token was used more times than it allows. What raises it, and how to fix it.
type: reference
keyword: client_token_used_up error
nav: client_token_used_up
section: Reference
verified: 1.63.0
---

# client_token_used_up (401)

The client token sent to `POST /v1/scans` has no uses left.

## Cause

A client token allows the `max_uses` scan requests your server asked for when
it issued it: 1 by default, 10 at most. Every request presented with the token
spends one use, whatever its outcome – a refused or failed scan counts the same
as a recognized one.

Spending a use is a single atomic step. Of several requests sent at the same
time with the same token, exactly as many succeed as the token had uses left.

## The message

```text
This client token has no uses left. Ask your server for a new one.
```

## The fix

Have the app ask your server for a fresh token for each upload. Does the app
retry a scan on its own? Then issue the token with a larger `max_uses`, up to
10. A retry then needs no new token.

## event_id

`event_id` is always `null` on this code. It is a refusal the caller is meant
to handle, so nothing is recorded as a failure to look at. The service answers
and writes one log line.

## Related codes

- [`client_token_expired`](/errors/client_token_expired) – the token's time is up.
- [`client_token_not_allowed`](/errors/client_token_not_allowed) – a token sent to the wrong endpoint.
- [`unauthorized`](/errors/unauthorized) – no usable key or token.

The whole catalogue, grouped by what a caller does with it, is on
[errors](/reference/errors).

## The response

```json
{
  "error": {
    "code": "client_token_used_up",
    "message": "This client token has no uses left. Ask your server for a new one.",
    "docs_url": "https://doc.cheap/docs/errors/client_token_used_up",
    "request_id": "req_9e6b1f7c-2d4a-4b83-9c51-7f0ad3e8b642",
    "event_id": null
  }
}
```
