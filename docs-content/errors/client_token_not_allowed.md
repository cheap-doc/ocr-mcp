---
title: Error client_token_not_allowed
description: A client token was sent to an endpoint other than POST /v1/scans, or a token was requested without an API key. What raises it, and how to fix it.
type: reference
keyword: client_token_not_allowed error
nav: client_token_not_allowed
section: Reference
verified: 1.63.0
---

# client_token_not_allowed (403)

The credential is valid, but not for this endpoint.

## Cause

One of two things:

- A client token was sent to an endpoint other than `POST /v1/scans`. A token
  can run a scan and nothing else: it cannot read, list or delete scans, read
  the balance, or issue another token. The endpoint is checked before the
  token, so the answer is the same whatever state the token is in.
- `POST /v1/client-tokens` was called with something other than an API key –
  a dashboard login. Tokens are issued with an API key only.

## The message

The wording depends on which of the cases above it was.

```text
A client token can only call POST /v1/scans.
Client tokens are issued with an API key.
```

## The fix

Make every call other than the scan itself from your server, with the API
key. Send only `POST /v1/scans` from the app with the token.

## event_id

`event_id` is always `null` on this code. It is a refusal the caller is meant
to handle, so nothing is recorded as a failure to look at. The service answers
and writes one log line.

## Related codes

- [`client_token_expired`](/errors/client_token_expired) – the token's time is up.
- [`client_token_used_up`](/errors/client_token_used_up) – the token has no uses left.
- [`unauthorized`](/errors/unauthorized) – no usable key or token.

The whole catalogue, grouped by what a caller does with it, is on
[errors](/reference/errors).

## The response

```json
{
  "error": {
    "code": "client_token_not_allowed",
    "message": "A client token can only call POST /v1/scans.",
    "docs_url": "https://doc.cheap/docs/errors/client_token_not_allowed",
    "request_id": "req_9e6b1f7c-2d4a-4b83-9c51-7f0ad3e8b642",
    "event_id": null
  }
}
```
