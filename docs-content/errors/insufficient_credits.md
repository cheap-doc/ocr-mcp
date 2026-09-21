---
title: Error insufficient_credits
description: The balance cannot cover the reservation this recognition needs. What raises it, and how to fix it.
type: reference
keyword: insufficient_credits error
nav: insufficient_credits
section: Reference
verified: 1.0.2
---

# insufficient_credits (402)

The balance cannot cover one recognition.

## Cause

A credit is reserved before the image reaches the engine. When the balance
cannot cover the reservation the call is refused there, so nothing is
recognized and nothing is charged.

A balance can never go negative: the refusal is the only outcome.

## The message

```text
The balance is too low to run this scan; top up to continue.
```

## The fix

Top up, then retry. `GET /v1/usage` reports the balance, and the balance is
also the number of documents left — one credit is one US cent, and one
recognized document draws one.

## event_id

`event_id` is always `null` on this code. It is a refusal the caller is meant
to handle, so nothing is recorded as a failure to look at. The service answers
and writes one log line.

## Related codes

- [`registration_required`](/errors/registration_required) — the anonymous allowance is spent.
- [`topup_in_progress`](/errors/topup_in_progress) — a top-up is open and part-paid.

The whole catalogue, grouped by what a caller does with it, is on
[errors](/reference/errors).

## The response

```json
{
  "error": {
    "code": "insufficient_credits",
    "message": "The balance is too low to run this scan; top up to continue.",
    "docs_url": "https://doc.cheap/docs/errors/insufficient_credits",
    "request_id": "req_9e6b1f7c-2d4a-4b83-9c51-7f0ad3e8b642",
    "event_id": null
  }
}
```
