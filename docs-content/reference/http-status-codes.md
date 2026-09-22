---
title: HTTP status codes
description: Every HTTP status this API answers with, the error codes that share it, and what separates them.
type: reference
keyword: api http status codes
nav: HTTP status codes
section: Reference
verified: 1.0.2
---

# HTTP status codes

The status groups a failure; it does not identify one. Four error codes share
409, three share 503 and two share 429, and what to do differs inside each
group.

Branch on `error.code`, which is stable and named in the contract. The status is
what a proxy, a load balancer and a metrics dashboard read.

## The statuses

| Status | Codes | Retry? |
|---|---|---|
| 200 | — | Not an error; `meta.status` says how far recognition got |
| 400 | [`invalid_request`](/errors/invalid_request) | No, until the request changes |
| 401 | [`unauthorized`](/errors/unauthorized) | No |
| 402 | [`insufficient_credits`](/errors/insufficient_credits) | After a top-up |
| 403 | [`registration_required`](/errors/registration_required), [`impersonation_read_only`](/errors/impersonation_read_only) | No |
| 404 | [`not_found`](/errors/not_found) | No |
| 409 | [`idempotency_conflict`](/errors/idempotency_conflict), [`idempotency_in_progress`](/errors/idempotency_in_progress), [`idempotency_replay_unavailable`](/errors/idempotency_replay_unavailable), [`topup_in_progress`](/errors/topup_in_progress) | Depends on the code |
| 413 | [`payload_too_large`](/errors/payload_too_large) | No, until the image is smaller |
| 415 | [`unsupported_media_type`](/errors/unsupported_media_type) | No, until the header changes |
| 422 | [`validation_failed`](/errors/validation_failed) | No, until the field is fixed |
| 429 | [`rate_limited`](/errors/rate_limited), [`document_repeated`](/errors/document_repeated) | After the window |
| 500 | [`internal_error`](/errors/internal_error) | Once |
| 501 | [`payment_driver_unavailable`](/errors/payment_driver_unavailable) | No |
| 503 | [`engine_unavailable`](/errors/engine_unavailable), [`service_unavailable`](/errors/service_unavailable), [`maintenance`](/errors/maintenance), [`rate_unavailable`](/errors/rate_unavailable) | Yes, with backoff |

## 200 is not always a recognition

A failure to recognize is a `200`. `meta.status` carries one of `recognized`,
`no_document_found`, `unreadable`, `unsupported_document` and `rejected`, and
the body is complete in all five cases.

A consumer that treats every `200` as a recognized document reports a blank
holder where the answer was that nothing was in the frame. Read `meta.status`
first.

## The three 503s answer three different questions

They share a status because a proxy should treat all three the same way. A
caller should not.

| Code | What is away | What to do |
|---|---|---|
| [`engine_unavailable`](/errors/engine_unavailable) | The recognition engine did not answer inside its deadline | Retry with backoff. Nothing was charged |
| [`service_unavailable`](/errors/service_unavailable) | A dependency this service needs is unreachable | Retry after `Retry-After`, with backoff. Nothing was charged |
| [`maintenance`](/errors/maintenance) | Nothing. An operator closed the service on purpose | Wait out the window. It does not clear on its own, so honor `Retry-After` rather than polling |

The difference that matters: the first two clear when something comes back, and
a retry loop finds the moment it does. The third clears when a person reopens
the service. A fleet polling every second buys nothing there, and arrives all at
once when it does.

`rate_unavailable` is a fourth 503, and it belongs to crypto top-ups rather
than to recognition. Fewer than two price sources agreed, so no amount could be
quoted.

## The four 409s

| Code | What happened | What to do |
|---|---|---|
| [`idempotency_conflict`](/errors/idempotency_conflict) | The key was used with a different body | Use a new key |
| [`idempotency_in_progress`](/errors/idempotency_in_progress) | The first request under the key is still running | Retry the same key and body in a moment |
| [`idempotency_replay_unavailable`](/errors/idempotency_replay_unavailable) | The key's first result was not retained | Use a new key |
| [`topup_in_progress`](/errors/topup_in_progress) | A crypto top-up for this asset is open and part-paid | Finish it, or wait for its window |

Three of the four are about an `Idempotency-Key`. Which one arrives is what
says whether to retry the same key or mint a new one. The rules are on
[idempotency](/reference/idempotency).

## The two 429s

| Code | The limit | Keyed by |
|---|---|---|
| [`rate_limited`](/errors/rate_limited) | Requests per window | The key, or the client address on the public sandbox |
| [`document_repeated`](/errors/document_repeated) | The same image, too many times on the free sandbox | A digest of the image bytes |

A caller that meets `document_repeated` while looping over one test image has
met the wrong limit for the wrong reason. The request rate is fine; the picture
is the problem. The figures are on [limits](/reference/limits).

## Retry-After

A response carries `Retry-After`, in seconds, where the service can estimate a
wait: the maintenance gate, a store outage, and the sandbox guards. Where it is
absent, a few seconds of backoff is the right default.

Nothing in this API sends a `Retry-After` in the HTTP-date form.

## What is never returned

- **3xx.** The API answers no redirect on any versioned route.
- **204.** Every response carries a body.
- **418, 451, and the rest.** The list above is the whole set; a status outside
  it is a proxy in front of the service rather than the service.

The whole catalogue, grouped by what a caller does with it, is on
[errors](/reference/errors).
