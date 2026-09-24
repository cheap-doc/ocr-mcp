---
title: Error unauthorized
description: The API key was missing, malformed, revoked or not valid for this endpoint. What raises it, and how to fix it.
type: reference
keyword: unauthorized error
nav: unauthorized
section: Reference
verified: 1.0.2
---

# unauthorized (401)

The request carried no usable API key.

## Cause

One of three things: no `Authorization` header, a header that is not
`Bearer <key>`, or a key this service does not know. A revoked key is an unknown
key.

Which of the three it was is not distinguished in the code. Telling an
unauthenticated caller whether a key exists is telling them something about
somebody else's account.

## The message

The wording depends on which of the cases above it was.

```text
Send your API key as `Authorization: Bearer <key>`.
Unknown API key.
```

## The fix

Send the header as `Authorization: Bearer sk_live_…`, or
`Bearer sk_sandbox_public` to call without an account. A key is shown once when
it is created; a key nobody has any more is replaced rather than recovered.

## event_id

`event_id` is always `null` on this code. It is a refusal the caller is meant
to handle, so nothing is recorded as a failure to look at. The service answers
and writes one log line.

## Related codes

- [`registration_required`](/errors/registration_required) – the anonymous allowance is spent.
- [`impersonation_read_only`](/errors/impersonation_read_only) – an administrator's view may only read.

The whole catalogue, grouped by what a caller does with it, is on
[errors](/reference/errors).

## The response

```json
{
  "error": {
    "code": "unauthorized",
    "message": "Send your API key as `Authorization: Bearer <key>`.",
    "docs_url": "https://doc.cheap/docs/errors/unauthorized",
    "request_id": "req_9e6b1f7c-2d4a-4b83-9c51-7f0ad3e8b642",
    "event_id": null
  }
}
```
