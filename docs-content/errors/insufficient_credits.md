---
title: Error insufficient_credits
description: This month's free credits and the paid credits are both used up, so the recognition cannot be reserved. What raises it, and how to fix it.
type: reference
keyword: insufficient_credits error
nav: insufficient_credits
section: Reference
verified: 1.45.0
---

# insufficient_credits (402)

This month's free credits and the paid credits are both used up, so neither
can cover one recognition.

## Cause

A credit is reserved before the image reaches the engine. It comes from this
month's free credits first, and from the paid credits once those are used up.
When neither can cover the reservation, the call is refused there. Nothing is
recognized and nothing is charged.

An account whose email address is not yet confirmed cannot draw its free
credits. It meets this code as soon as its paid credits are gone.

A balance can never go negative: the refusal is the only outcome.

## The message

```text
This month's free credits and your paid balance are both used up; top up to continue. Free credits return on 2026-10-01T00:00:00.000Z.
```

The last sentence names the next reset: 00:00 UTC on the first of the next
month.

## The fix

Top up, then retry, or wait for the first of the month, when the free credits
are set back to 100. `GET /v1/usage` reports both balances:
`free_allowance.remaining_credits` and `paid_balance_credits`. Together they
are the number of documents left – one credit is one US cent, and one
recognized document draws one.

## event_id

`event_id` is always `null` on this code. It is a refusal the caller is meant
to handle, so nothing is recorded as a failure to look at. The service answers
and writes one log line.

## Related codes

- [`registration_required`](/errors/registration_required) – the anonymous allowance is spent.
- [`topup_in_progress`](/errors/topup_in_progress) – a top-up is open and part-paid.

The whole catalogue, grouped by what a caller does with it, is on
[errors](/reference/errors).

## The response

```json
{
  "error": {
    "code": "insufficient_credits",
    "message": "This month's free credits and your paid balance are both used up; top up to continue. Free credits return on 2026-10-01T00:00:00.000Z.",
    "docs_url": "https://doc.cheap/docs/errors/insufficient_credits",
    "request_id": "req_9e6b1f7c-2d4a-4b83-9c51-7f0ad3e8b642",
    "event_id": null
  }
}
```
