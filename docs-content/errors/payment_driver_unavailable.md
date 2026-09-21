---
title: Error payment_driver_unavailable
description: Raised only on an administrative surface when a payment driver is not configured. What raises it, and how to fix it.
type: reference
keyword: payment_driver_unavailable error
nav: payment_driver_unavailable
section: Reference
verified: 1.0.2
---

# payment_driver_unavailable (501)

A top-up was asked for through a payment driver this deployment does not have enabled.

## Cause

The request was well formed. What is missing is a driver able to take the
money, which is deployment configuration rather than anything about the
request.

## The message

```text
Payment driver stripe is not enabled.
```

## The fix

**An API caller does not meet this code.** It is raised only on an
administrative surface, which is not part of the public API and is not reachable
with an API key. A call of your own that returns it went somewhere it was not
meant to go.

Credits are topped up from the dashboard. Crypto deposits go through no payment
driver at all. Each account has its own permanent deposit address, and a
transfer to it becomes credits on its own.

## event_id

`event_id` is always `null` on this code. It is a refusal the caller is meant
to handle, so nothing is recorded as a failure to look at. The service answers
and writes one log line.

## Related codes

- [`topup_in_progress`](/errors/topup_in_progress) — a top-up is open and part-paid.
- [`rate_unavailable`](/errors/rate_unavailable) — no corroborated exchange rate.

The whole catalogue, grouped by what a caller does with it, is on
[errors](/reference/errors).

## The response

```json
{
  "error": {
    "code": "payment_driver_unavailable",
    "message": "Payment driver stripe is not enabled.",
    "docs_url": "https://doc.cheap/docs/errors/payment_driver_unavailable",
    "request_id": "req_9e6b1f7c-2d4a-4b83-9c51-7f0ad3e8b642",
    "event_id": null
  }
}
```
