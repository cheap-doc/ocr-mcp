---
title: Errors
description: Every error code the recognition API returns, the HTTP status it comes with, and the page that states its cause and its fix.
type: reference
keyword: api error codes
nav: Errors
section: Reference
verified: 1.0.2
---

# Errors

Every error response carries one shape, whatever went wrong.

```json
{
  "error": {
    "code": "not_found",
    "message": "No scan with id 01a0af18-cd8d-7a61-9f2d-4c7b8e105da3 exists or it has expired.",
    "docs_url": "https://doc.cheap/docs/errors/not_found",
    "request_id": "req_9e6b1f7c-2d4a-4b83-9c51-7f0ad3e8b642",
    "event_id": null
  }
}
```

| Key | What it is |
|---|---|
| `code` | A stable, machine-readable string. Branch on this, not on the HTTP status alone |
| `message` | A human-readable explanation. Safe to log, not meant to be parsed |
| `docs_url` | The page for this code, which is one of the 21 below |
| `request_id` | `req_` and a UUID. Quote it in support: it identifies the exact request in the logs |
| `event_id` | Set only for a failure the service recorded as something to look at |

Twenty-one codes exist, and every one of them has a page. A code raised only on
an internal surface still reaches a caller's logs through support. A `docs_url`
that answers 404 is worse than a short page.

## What `event_id` tells you

`event_id` is the one key that says whose problem this is, and its value is
decided per code rather than per request.

| `event_id` | Meaning | Codes |
|---|---|---|
| Always `null` | A refusal the caller is meant to handle. The service answers and writes one log line; nothing is recorded as a failure | 17 of the 21 |
| Present on the first of a window | A dependency is away. Worth recording, but not once per request: an afternoon of downtime would cost more events than a month's quota holds | `engine_unavailable`, `service_unavailable`, `rate_unavailable` |
| Always present | The service did something it did not intend | `internal_error` |

A non-null `event_id` resolves to that one failure, which is faster in support
than a timestamp and a guess.

## The codes you handle

These 17 are the API working. Each is a refusal with a reason, and each carries
`event_id: null`.

| HTTP | Code | Raised when |
|---|---|---|
| 400 | [`invalid_request`](/errors/invalid_request) | The request could not be read at all |
| 401 | [`unauthorized`](/errors/unauthorized) | No usable API key |
| 402 | [`insufficient_credits`](/errors/insufficient_credits) | The balance cannot cover one recognition |
| 403 | [`registration_required`](/errors/registration_required) | The anonymous free allowance is spent |
| 404 | [`not_found`](/errors/not_found) | No scan with that id, or no such route |
| 409 | [`idempotency_conflict`](/errors/idempotency_conflict) | The key was used with a different body |
| 409 | [`idempotency_in_progress`](/errors/idempotency_in_progress) | The first request under the key is still running |
| 409 | [`idempotency_replay_unavailable`](/errors/idempotency_replay_unavailable) | The key's result is no longer there to replay |
| 409 | [`topup_in_progress`](/errors/topup_in_progress) | A top-up for this asset is open and part-paid |
| 413 | [`payload_too_large`](/errors/payload_too_large) | The body is over 36 MiB |
| 415 | [`unsupported_media_type`](/errors/unsupported_media_type) | The body was not sent as JSON, or the image is not a JPEG or PNG |
| 422 | [`validation_failed`](/errors/validation_failed) | A field failed the schema; the message names it |
| 429 | [`document_repeated`](/errors/document_repeated) | The same image, too many times on the free sandbox |
| 429 | [`rate_limited`](/errors/rate_limited) | Over the rate limit for this key kind |
| 503 | [`maintenance`](/errors/maintenance) | A planned window is open |

Two more are refusals as well, and no public call raises them; they are in the
last section.

## The codes that mean we recorded something

These four are not about the request. Three say a dependency is away, and one
says the service failed.

| HTTP | Code | Raised when | `event_id` |
|---|---|---|---|
| 500 | [`internal_error`](/errors/internal_error) | The service did something it did not intend | Always |
| 503 | [`engine_unavailable`](/errors/engine_unavailable) | The recognition engine did not answer in time | First of a window |
| 503 | [`service_unavailable`](/errors/service_unavailable) | A dependency this service needs is unreachable | First of a window |
| 503 | [`rate_unavailable`](/errors/rate_unavailable) | Fewer than two price sources agreed on a rate | First of a window |

None of the four charges for the scan it interrupted. The credit is reserved
before the engine runs and released when it does not answer, so the balance is
unchanged.

`internal_error` can arrive under a 5xx other than 500, when the failure carried
one of its own.

## The codes no public call can raise

Two codes belong to the administrative surface, which is not part of the public
API and is not reachable with an API key. They are listed because the contract
declares them and because a body carrying one links here. An integration does
not have to handle them.

| HTTP | Code | Raised when |
|---|---|---|
| 403 | [`impersonation_read_only`](/errors/impersonation_read_only) | An administrator's view of an account tried to change something |
| 501 | [`payment_driver_unavailable`](/errors/payment_driver_unavailable) | A top-up named a payment driver this deployment does not have |

A call of your own that answers with either went to the wrong host or the wrong
path.

## Branching on the code

The HTTP status groups the codes; it does not identify them. Four codes share
409 and two share 429, and what to do differs inside each group.

- Branch on `code`. It is stable, and a new code is a change to the contract.
- Read `message` for a human, and do not parse it. The wording of a
  `validation_failed` message is the schema's, and it changes with the schema.
- Follow `docs_url` when a person is reading. It is the page for that exact
  code, and it never moves.

Which statuses are shared, and what separates the codes under each, is on
[HTTP status codes](/reference/http-status-codes).
