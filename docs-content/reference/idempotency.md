---
title: Idempotency
description: What makes two scan requests the same request, how long a key is remembered, and the three codes that arbitrate a replay.
type: reference
keyword: api idempotency key
nav: Idempotency
section: Reference
verified: 1.0.2
---

# Idempotency

`POST /v1/scans` accepts an `Idempotency-Key` request header. A retry under the
same key returns the first request's result instead of running recognition and
charging a second time.

```bash
curl -X POST https://api.doc.cheap/v1/scans \
  -H "Authorization: Bearer sk_sandbox_public" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 8f3c2a1b-5d4e-4f60-9a7b-3c2d1e0f9a8b" \
  -d '{"image":"<base64>"}'
```

## The header

| Property | Value |
|---|---|
| Name | `Idempotency-Key` |
| Length | 1 to 255 characters |
| Endpoint | `POST /v1/scans` only |
| Scope | The account. Two accounts may use the same string without meeting |
| Required | No |

A key outside the length is 422
[`validation_failed`](/errors/validation_failed). Nothing constrains the
characters. A UUID is the usual choice because it is unique without
coordination; an order id works as well when one order is one scan.

The header has no effect on a sandbox key that is not billed, because there is
nothing to charge twice.

## What makes two requests the same request

**The key, and a fingerprint of the whole request body.** The fingerprint is a
SHA-256 over the body with its object keys sorted. Two bodies that differ only
in the order they were serialized in are therefore the same request.

Everything in the body is part of it: the image, the `reference` and every
option. Changing `retain_hours` under a reused key is a different request, not
the same one twice.

The image itself is part of the fingerprint. Sending a different photograph
under a reused key is what
[`idempotency_conflict`](/errors/idempotency_conflict) exists for.

## The four outcomes

| The claim | What happens | Answer |
|---|---|---|
| The key is new | The scan runs, and the key is claimed before it does | The result, 200 |
| The key was used with this body, and its result is stored | The stored result is returned. Recognition does not run, and nothing is charged | The first result, 200 |
| The key was used with a different body | Refused | 409 [`idempotency_conflict`](/errors/idempotency_conflict) |
| The key was used, and no result was kept | Refused | 409 [`idempotency_replay_unavailable`](/errors/idempotency_replay_unavailable) |

A fifth case is timing rather than state: the key's first request is **still
running**.

## A key whose first request is still in flight

The claim is taken before the work runs. A second caller arriving while the
first is in the engine therefore finds a claim with no result attached.

It must not redo the work: that is the double charge the key exists to prevent.
It waits briefly for the first request to land, then replays its result. The
wait is 2 seconds by default, re-checked every 100 ms.

Past the wait, the answer is 409
[`idempotency_in_progress`](/errors/idempotency_in_progress). A retry in a
moment finds the result.

A claim whose request died mid-flight would otherwise hold the key forever.
Past **10 minutes** with no result attached, it counts as abandoned and the next
caller takes it over. That is far longer than any request can legitimately run,
so a slow scan is never mistaken for a dead one.

## How long a key is remembered

A key is remembered while the result it points at is stored. A key whose first
request stored nothing is remembered for **24 hours** from when that request
finished. Once a key is forgotten, a retry under it is a new request. The scan
runs again, and a billable result is charged again.

That makes `retain_hours` the control:

| The first request asked for | A later retry under the same key |
|---|---|
| `retain_hours: 0` | For 24 hours, 409 [`idempotency_replay_unavailable`](/errors/idempotency_replay_unavailable). The result was returned once and never written down. After that, a new scan, charged again |
| A window that is still open | The stored result, 200 |
| A window that has since closed | 409 [`idempotency_replay_unavailable`](/errors/idempotency_replay_unavailable). Once the retention sweep removes the scan and its key, a new scan, charged again |

**A zero-retention scan and a replayable key are mutually exclusive.** For 24
hours the key is still recorded as used, so a retry is refused rather than run
twice. Nothing is left to hand back. A client that may retry more than 24
hours later should keep the first result itself, or ask for a retention window.

The retention sweep runs every hour. It removes an expired scan and its key
together, and a zero-retention key once its 24 hours have passed.

## The three codes, and what each one says to do

| Code | What it says | What to do |
|---|---|---|
| [`idempotency_conflict`](/errors/idempotency_conflict) | This key belongs to a different request | Send the new body under a new key |
| [`idempotency_in_progress`](/errors/idempotency_in_progress) | The first request has not finished | Retry the same key and body in a moment |
| [`idempotency_replay_unavailable`](/errors/idempotency_replay_unavailable) | The key is spent and its result is gone | Send the request under a new key |

Two of the three call for a new key and one calls for a retry of this one.
Branching on the code is what tells them apart; the shared 409 does not.

## What is not idempotent

- **`GET` requests.** They change nothing, so nothing needs a key.
- **Crypto top-ups.** A part-paid top-up is arbitrated by
  [`topup_in_progress`](/errors/topup_in_progress) rather than by a key.
- **A scan on a key that is not billed.** The header is accepted and has nothing
  to protect.

## What a key does not do

It does not make a failed request succeed. An engine that did not answer
releases the reservation and frees the key. A retry under the same key then runs
the scan properly, rather than replaying a failure.

It does not make a retry free. A retry that replays a stored result costs
nothing because nothing ran. A retry that runs recognition is billed by its own
outcome, like any other scan.
