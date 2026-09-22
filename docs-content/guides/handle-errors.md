---
title: Handle errors
description: Branch on the error code rather than the status, decide what to retry, and turn the documentation link in every error body into a fix.
type: how-to
keyword: handle document recognition api errors
nav: Handle errors
section: Guides
---

# Handle errors

Every error this API returns has the same body and a stable code. Branch on the
code. The HTTP status groups codes that need different handling: three codes
share `409`, and four share `503`. A handler written against the status alone
will retry what it should fix, and give up on what it should retry.

## The one shape

```json
{
  "error": {
    "code": "validation_failed",
    "message": "/options: Unrecognized key: \"retain_hour\"",
    "docs_url": "https://doc.cheap/docs/errors/validation_failed",
    "request_id": "req_18542f0c-d7cc-400c-976e-6e3b29a07beb",
    "event_id": null
  }
}
```

| Key | What to do with it |
|---|---|
| `code` | Branch on it. It is stable, and it is the only value here you should switch on |
| `message` | Log it, show it to a developer, and do not parse it |
| `docs_url` | The page for this code. Put it in your own log line and a support thread starts with the fix in it |
| `request_id` | Quote it in support. It identifies this one request in our logs |
| `event_id` | See below |

`event_id` is present on every error and non-null only when the failure was
unexpected and the service recorded it as something to look at. It is `null`
for every refusal you are meant to handle: a bad key, an empty balance, a rate
limit. Nothing is wrong on our side in those cases. When it is not `null`,
quoting it resolves to that one recorded failure.

## Trigger one

This call sends a misspelled option. Strict validation rejects unknown keys
rather than ignoring them, and the message names the path that failed.

```bash runnable expect=422 tab=curl
curl -X POST https://api.doc.cheap/v1/scans \
  -H "Authorization: Bearer sk_sandbox_public" \
  -H "Content-Type: application/json" \
  -d '{"image": "aGk=", "options": {"retain_hour": 2}}'
```

```javascript runnable expect=422 tab=javascript
const response = await fetch("https://api.doc.cheap/v1/scans", {
  method: "POST",
  headers: {
    Authorization: "Bearer sk_sandbox_public",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ image: "aGk=", options: { retain_hour: 2 } }),
});

const body = await response.json();

if (!response.ok) {
  console.error(response.status, body.error.code, body.error.docs_url);
}
```

```python runnable expect=422 tab=python
import json
import urllib.error
import urllib.request

request = urllib.request.Request(
    "https://api.doc.cheap/v1/scans",
    data=json.dumps({"image": "aGk=", "options": {"retain_hour": 2}}).encode(),
    headers={
        "Authorization": "Bearer sk_sandbox_public",
        "Content-Type": "application/json",
    },
)

try:
    with urllib.request.urlopen(request) as response:
        status = response.status
        body = json.load(response)
except urllib.error.HTTPError as failure:
    status = failure.code
    body = json.load(failure)

print(status, body["error"]["code"], body["error"]["docs_url"])
```

Note that `fetch` does not raise on a `4xx`, while `urllib` does. Read the body
in both branches: an error body is JSON and carries the code you need.

## What to do with each code

The contract carries 21 codes, and every one of them has a page. Two are
unreachable with an API key, and are listed so that a `docs_url` never points
at nothing.

| Code | HTTP | Do this |
|---|---|---|
| [`invalid_request`](/errors/invalid_request) | 400 | Fix the request. Retrying it unchanged fails again |
| [`validation_failed`](/errors/validation_failed) | 422 | Fix the field the message names. Retrying it unchanged fails again |
| [`unauthorized`](/errors/unauthorized) | 401 | Fix the key or the header. Stop until it is fixed |
| [`registration_required`](/errors/registration_required) | 403 | Register and use your own key. Waiting does not refill the allowance |
| [`insufficient_credits`](/errors/insufficient_credits) | 402 | Top up, then retry. Nothing was charged and the engine never ran |
| [`not_found`](/errors/not_found) | 404 | Stop. No such scan, or its retention window has passed |
| [`idempotency_conflict`](/errors/idempotency_conflict) | 409 | The key was used with a different body. Send this body under a new key |
| [`idempotency_in_progress`](/errors/idempotency_in_progress) | 409 | Wait a moment, then retry the same request with the same key |
| [`idempotency_replay_unavailable`](/errors/idempotency_replay_unavailable) | 409 | The first answer is gone. Send the request again under a new key |
| [`payload_too_large`](/errors/payload_too_large) | 413 | Shrink the image. Retrying it unchanged fails again |
| [`unsupported_media_type`](/errors/unsupported_media_type) | 415 | Send `Content-Type: application/json` |
| [`rate_limited`](/errors/rate_limited) | 429 | Wait the `Retry-After` seconds, then retry the same request |
| [`document_repeated`](/errors/document_repeated) | 429 | Wait the `Retry-After` seconds, or register. The same image went up too often on the free sandbox |
| [`internal_error`](/errors/internal_error) | 500 | Retry once with backoff. Quote `event_id` if it keeps happening |
| [`engine_unavailable`](/errors/engine_unavailable) | 503 | Retry with backoff. Nothing was charged |
| [`service_unavailable`](/errors/service_unavailable) | 503 | Retry after `Retry-After`. A store we depend on is away |
| [`maintenance`](/errors/maintenance) | 503 | Retry after `Retry-After`. Planned work, and nothing is charged |
| [`rate_unavailable`](/errors/rate_unavailable) | 503 | Top-up path only. No price source agreed a rate; retry later |
| [`topup_in_progress`](/errors/topup_in_progress) | 409 | Top-up path only. One is already settling for this account; wait |
| [`impersonation_read_only`](/errors/impersonation_read_only) | 403 | Not reachable with an API key |
| [`payment_driver_unavailable`](/errors/payment_driver_unavailable) | 501 | Not reachable with an API key |

The full table, with the cause behind each, is
[the error reference](/reference/errors).

## Retry the four 503s, and only those

Four codes share `503`, and every one of them is worth retrying with backoff.
`engine_unavailable`, `service_unavailable` and `maintenance` cost nothing. A
credit is reserved before the engine is called, and released when it does not
answer. A failed scan leaves the balance where it was.

Honor `Retry-After` where the response carries it, rather than guessing an
interval. A retry that ignores it arrives inside the same closed window and
spends its attempt on a refusal.

Send an [`Idempotency-Key`](/guides/retry-safely-with-idempotency) on the
original request. A retry after a timeout is the one case where you cannot
tell whether the first call landed. The key is what makes the answer safe.

## The shape of a handler

Every code in the table falls into one of four buckets, and a handler needs one
branch per bucket rather than twenty-one.

| Bucket | Codes | Branch |
|---|---|---|
| Fix the call | `invalid_request`, `validation_failed`, `payload_too_large`, `unsupported_media_type` | Log the message, fail the operation, do not retry |
| Fix the account | `unauthorized`, `registration_required`, `insufficient_credits` | Alert an operator; retry only after somebody acts |
| Wait and retry | `rate_limited`, `document_repeated`, the four 503s, `internal_error` | Back off, honor `Retry-After`, cap the attempts |
| Arbitrate a replay | the three `idempotency_` codes | Keep the key, or take a new one, per the table above |

`not_found` is outside all four: it is an answer about a scan that is not
there, and the caller decides what that means.

## Reading `Retry-After`

The header carries whole seconds. Parse it as an integer and clamp it to
something your own system can wait for. Fall back to your own backoff when the
header is absent.

```bash runnable expect=401 tab=curl
curl -sS -D - -o /dev/null -X POST https://api.doc.cheap/v1/scans \
  -H "Authorization: Bearer sk_live_not_a_real_key" \
  -H "Content-Type: application/json" \
  -d '{"image": "aGk="}'
```

```javascript runnable expect=401 tab=javascript
const response = await fetch("https://api.doc.cheap/v1/scans", {
  method: "POST",
  headers: {
    Authorization: "Bearer sk_live_not_a_real_key",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ image: "aGk=" }),
});

const retryAfter = Number(response.headers.get("Retry-After") ?? 0);
const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 1;

console.log(response.status, wait);
```

```python runnable expect=401 tab=python
import json
import urllib.error
import urllib.request

request = urllib.request.Request(
    "https://api.doc.cheap/v1/scans",
    data=json.dumps({"image": "aGk="}).encode(),
    headers={
        "Authorization": "Bearer sk_live_not_a_real_key",
        "Content-Type": "application/json",
    },
)

try:
    with urllib.request.urlopen(request) as response:
        status = response.status
        headers = response.headers
except urllib.error.HTTPError as failure:
    status = failure.code
    headers = failure.headers

wait = int(headers.get("Retry-After") or 1)

print(status, wait)
```

Those three send a key that does not exist, so they answer `401` and carry no
`Retry-After`. The fallback is what runs, which is the branch worth proving.

## A `200` that recognized nothing is not an error

`no_document_found`, `unreadable`, `unsupported_document` and `rejected` come
back with HTTP `200` and a complete body. The engine ran; it found nothing it
could publish. A live key is not charged for any of them.

Branch on `status` for those, and on `error.code` for the table above. A
handler that treats `no_document_found` as a failure retries a photograph that
will never read. One that treats it as a success stores a document with no
fields in it.

## What to log

One line per failure, carrying `code`, `request_id`, `event_id` and `docs_url`.
That is enough for someone else to open the right page and quote the right id.
Leave out the request body: it carries an identity document, which does not
belong in a log.

## Next

- [Retry safely with idempotency](/guides/retry-safely-with-idempotency) — the
  three conflict codes, and what each one arbitrates.
- [The error reference](/reference/errors) — all 21 codes with their causes.
- [HTTP status codes](/reference/http-status-codes) — which codes share a
  status, and why.
