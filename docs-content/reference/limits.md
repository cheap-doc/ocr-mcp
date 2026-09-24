---
title: Limits
description: "The limits a caller meets: request rate, image size, request body size, idempotency key length and the retention windows on offer."
type: reference
keyword: document recognition api limits
nav: Limits
section: Reference
verified: 1.0.2
---

# Limits

Every ceiling a caller can meet, the code it answers with, and whether it moves.

The figures below are the defaults a deployment ships with. Several are
configurable by whoever runs the service. The right number depends on how much
recognition capacity sits behind it, which is not a property of the contract.
The ones that are not configurable say so.

## The rate limits

| Caller | Limit | Window | Keyed by |
|---|---|---|---|
| `sk_sandbox_public` | 10 requests | 1 hour | The client's IP address |
| A registered key | 60 requests | 1 minute | The key |

The two tiers are different animals. The public sandbox key is unregistered and
shared by everyone, so its bucket is per address and its window is long. It
exists to keep one visitor from consuming the demo for the rest. A registered
key is metered by its own balance, so its limit only keeps a runaway client from
flooding the service.

Over either, the answer is 429
[`rate_limited`](/errors/rate_limited).

**The sandbox bucket is keyed by address, not by key.** Everyone shares one
credential there, so counting per key would count everybody as one caller.

## The free allowances

Two separate allowances govern the public sandbox key, and both apply.

| Allowance | Figure | Answered with |
|---|---|---|
| Lifetime free recognitions, per anonymous client | 10 | 403 [`registration_required`](/errors/registration_required) |
| The same image, on the free sandbox | 5 submissions per hour | 429 [`document_repeated`](/errors/document_repeated) |

The repeat guard keeps only a digest of the image bytes, and only for the window
– neither the image nor a durable record of it. It runs before the engine, so a
refused repeat costs neither recognition time nor one of the free attempts.

A registered account arrives with 20 free documents credited to its balance, and
neither of these two walls applies to its keys.

## Sizes

| Limit | Figure | Answered with |
|---|---|---|
| Request body | 36 MiB | 413 [`payload_too_large`](/errors/payload_too_large) |
| Image, on either web surface | 25 MiB | Refused in the browser, before any request |
| `reference` | 128 characters | 422 [`validation_failed`](/errors/validation_failed) |
| `Idempotency-Key` | 1 to 255 characters | 422 [`validation_failed`](/errors/validation_failed) |

**The body ceiling is derived, not chosen.** The largest image either web
surface accepts is 25 MiB; base64 makes that about 33.4 MiB, and the rest is the
JSON envelope. It is sized for the worst case on purpose. Normally the browser
re-encodes the photograph first and the body is a few hundred kilobytes. A
browser that cannot decode the image sends the original bytes, and a direct API
caller sends whatever it likes.

The ceiling is enforced **before the body is read into memory**. An oversized
request costs nothing and reaches no engine.

## Retention

| Limit | Figure |
|---|---|
| `retain_hours` | 0 to 8760, one year |
| The windows the dashboard offers for the account setting | 24 hours, 7 days, 1 month, 1 year |
| A new account's setting | 1 year |

A value outside the range is 422
[`validation_failed`](/errors/validation_failed). The API accepts any integer
inside it, so a window the dashboard does not offer is still a valid
`retain_hours`.

`0` is not a short window. It writes no row at all, so nothing exists that a
later read could find.

## Result images

| Slot | Height cap |
|---|---|
| `document_crop` | 250 px |
| Every other slot | 100 px |

Scaled by height, proportionally, and never upwards. A crop already inside its
cap is published at the size the recognition produced it. The rest of what the
re-encode does is on [result images](/reference/images).

A retained scan keeps a thumbnail of at most 96 px and 16 KiB, readable in the
dashboard rather than through this API.

## Time

| Limit | Figure | What happens past it |
|---|---|---|
| The recognition engine's deadline | 15 s | 503 [`engine_unavailable`](/errors/engine_unavailable); nothing is charged |
| The wait for an in-flight idempotent request | 2 s | 409 [`idempotency_in_progress`](/errors/idempotency_in_progress) |
| The age at which an unfinished idempotency claim is reclaimable | 10 minutes | The next caller takes the key over |

The engine deadline is far longer than a recognition takes, which is about a
second. It exists so a request cannot hang on an engine that has stopped
answering.

## What is not limited

- **The number of scans an account may make.** The balance is the limit, and it
  is the caller's own.
- **The number of API keys**, beyond a per-account ceiling the dashboard
  enforces.
- **Concurrency.** Nothing caps parallel requests beyond the rate limit above.
- **Reads.** `GET /v1/scans/{id}` and `GET /v1/usage` are never billed, and are
  bounded only by the rate limit for the key.

## Which limits move

| Limit | Configurable |
|---|---|
| Both rate limits, and their windows | Yes, per deployment |
| The free-recognition allowance | Yes |
| The repeat-document threshold and window | Yes |
| The request body ceiling | Yes |
| The engine deadline and the idempotency waits | Yes |
| `retain_hours`' range, `reference`'s length, the key's length | **No** – they are the contract |
| The image height caps | **No** |

A deployment that changes a configurable figure changes what its own API
answers. The figures on this page are the ones `api.doc.cheap` runs.
