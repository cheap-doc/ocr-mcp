---
title: Error topup_in_progress
description: A top-up for this account is already being processed. What raises it, and how to fix it.
type: reference
keyword: topup_in_progress error
nav: topup_in_progress
section: Reference
verified: 1.0.2
---

# topup_in_progress (409)

A top-up for this asset is already open and part-paid.

## Cause

A crypto top-up quotes an amount at a price that is locked for the life of
that quote. Whatever the market does while the transaction confirms, the payment
is credited at the price shown when it was made.

A deposit address is permanent and belongs to the account. Two open quotes for
one asset would leave a payment arriving there with two locked prices claiming
it. While a quote has nothing against it, asking for a new one replaces it. Once
part of the payment has arrived, the open quote is carrying money settled at its
price, and it is not replaced.

## The message

```text
A top-up for this asset has already been paid in part; it is settled at the price it locked.
```

## The fix

Finish the open top-up, or wait for its window to close and then create a new
quote. Sending the rest of the quoted amount to the same address credits it at
the same price.

Money already sent is never lost by waiting: a payment that arrives late is
still credited, at the price the quote locked.

## event_id

`event_id` is always `null` on this code. It is a refusal the caller is meant
to handle, so nothing is recorded as a failure to look at. The service answers
and writes one log line.

## Related codes

- [`rate_unavailable`](/errors/rate_unavailable) – no corroborated exchange rate.
- [`insufficient_credits`](/errors/insufficient_credits) – this month's free credits and the paid credits are both used up.

The whole catalogue, grouped by what a caller does with it, is on
[errors](/reference/errors).

## The response

```json
{
  "error": {
    "code": "topup_in_progress",
    "message": "A top-up for this asset has already been paid in part; it is settled at the price it locked.",
    "docs_url": "https://doc.cheap/docs/errors/topup_in_progress",
    "request_id": "req_9e6b1f7c-2d4a-4b83-9c51-7f0ad3e8b642",
    "event_id": null
  }
}
```
