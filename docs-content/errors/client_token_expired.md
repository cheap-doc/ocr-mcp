---
title: Error client_token_expired
description: A client token was used after its expiry. What raises it, and how to fix it.
type: reference
keyword: client_token_expired error
nav: client_token_expired
section: Reference
verified: 1.63.0
---

# client_token_expired (401)

The client token sent to `POST /v1/scans` has passed its expiry.

## Cause

A client token lives for the `expires_in` seconds your server asked for when it
issued it: 300 by default, 10 to 900 at most. The time is counted from the
moment the token was issued, not from its first use.

Expiry is checked before the remaining uses. A token that has run out of both
gets this code.

A token whose issuing key was revoked or deleted is not reported as expired. It
answers [`unauthorized`](/errors/unauthorized), the same as a token that never
existed.

## The message

```text
This client token has expired. Ask your server for a new one.
```

## The fix

Have the app ask your server for a fresh token and send the scan again with
it. A token is meant for one upload: issue it right before the app needs it,
not when the app starts.

If uploads on slow connections run out of time, raise `expires_in` on
`POST /v1/client-tokens`, up to 900 seconds.

## event_id

`event_id` is always `null` on this code. It is a refusal the caller is meant
to handle, so nothing is recorded as a failure to look at. The service answers
and writes one log line.

## Related codes

- [`client_token_used_up`](/errors/client_token_used_up) – the token has no uses left.
- [`client_token_not_allowed`](/errors/client_token_not_allowed) – a token sent to the wrong endpoint.
- [`unauthorized`](/errors/unauthorized) – no usable key or token.

The whole catalogue, grouped by what a caller does with it, is on
[errors](/reference/errors).

## The response

```json
{
  "error": {
    "code": "client_token_expired",
    "message": "This client token has expired. Ask your server for a new one.",
    "docs_url": "https://doc.cheap/docs/errors/client_token_expired",
    "request_id": "req_9e6b1f7c-2d4a-4b83-9c51-7f0ad3e8b642",
    "event_id": null
  }
}
```
