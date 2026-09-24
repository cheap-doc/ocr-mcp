---
title: From the sandbox to a live key
description: Register an account, claim the free documents it comes with, issue your own live key and point an existing integration at it.
type: tutorial
keyword: sandbox key to live api key
nav: From sandbox to live
section: Get started
---

# From the sandbox to a live key

Going from the shared sandbox to a key of your own changes one line of your
code. This page walks the four rungs between them, with the
number attached to each. It ends with what moves in the response once the call
starts billing.

## The ladder

| Rung | Key | What it allows | What a scan costs |
|---|---|---|---|
| Anonymous | `sk_sandbox_public` | 10 free recognitions per client, and 10 requests per hour per client address | Nothing |
| Allowance spent | `sk_sandbox_public` | Every call answers `registration_required` | Nothing to spend |
| Registered | `sk_live_…` | The 20 credits the account is created with | 1 credit each |
| Topped up | `sk_live_…` | Whatever the balance holds | 1 credit each |

One credit is one US cent, so the balance is also the number of documents left
in it. The rule that decides whether a given call draws a credit is on
[what a billed scan is](/concepts/what-a-billed-scan-is).

## 1. Spend the anonymous allowance

The public sandbox key runs on two counters, and both apply. One is a rate
limit of 10 requests per hour, counted per client address rather than per key,
because everyone reading this shares the key. The other is a lifetime allowance
of 10 free recognitions per client, which waiting does not refill.

An attempt is taken before the recognition runs and handed back when the result
turns out not to be billable. A photograph with no document in it therefore
costs you nothing, on this rung or any other.

## 2. Meet `registration_required`

When the allowance is gone, every further call answers `403` with this body.

```json
{
  "error": {
    "code": "registration_required",
    "message": "The free trial without an account is used up; register for your own API key to keep scanning.",
    "docs_url": "https://doc.cheap/docs/errors/registration_required",
    "request_id": "req_9f2a5c7d-4e30-4b8e-9c4d-7a10c3f20199",
    "event_id": null
  }
}
```

`event_id` is `null` because nothing went wrong: this is a refusal you are
meant to handle, not a failure we recorded. The
[`registration_required`](/errors/registration_required) page carries the rest.

## 3. Register

Create an account in the dashboard. The account is credited with 20 credits as
it is created – 20 recognized documents, with no payment and no card.

## 4. Take both keys

An account issues two kinds of key, and they are not two environments of the
same thing.

| Key | Runs recognition on your image | Charges the balance | Stores results |
|---|---|---|---|
| `sk_live_…` | Yes | Yes, 1 credit per billable scan | Yes, for the retention window |
| `sk_sandbox_…` | No – answers from a fixed synthetic specimen | Never | No |

A registered sandbox key is the integration credential. Its answer is the same
every time, so a client can be built against a stable result without spending
anything. It stores nothing, so `GET /v1/scans/{id}` answers
[`not_found`](/errors/not_found) for every sandbox key, live scan or not.

A key is shown once, when it is created. Store it the way you store a password.

## 5. Point the code at it

Only the credential changes. The endpoint, the body and the response shape are
the same, which is what makes the sandbox worth building against.

```bash runnable tab=curl
API_KEY=${API_KEY:-sk_sandbox_public}

curl -X POST https://api.doc.cheap/v1/scans \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"image\": \"$(base64 < document.jpg | tr -d '\n')\"}"
```

```javascript runnable tab=javascript
import { readFileSync } from "node:fs";

const apiKey = process.env.API_KEY ?? "sk_sandbox_public";
const image = readFileSync("document.jpg").toString("base64");

const response = await fetch("https://api.doc.cheap/v1/scans", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ image }),
});

const scan = await response.json();
console.log(scan.meta.status, scan.meta.billed);
```

```python runnable tab=python
import base64
import json
import os
import urllib.request

api_key = os.environ.get("API_KEY", "sk_sandbox_public")

with open("document.jpg", "rb") as file:
    image = base64.b64encode(file.read()).decode()

request = urllib.request.Request(
    "https://api.doc.cheap/v1/scans",
    data=json.dumps({"image": image}).encode(),
    headers={
        "Authorization": "Bearer " + api_key,
        "Content-Type": "application/json",
    },
)

with urllib.request.urlopen(request) as response:
    status = response.status
    scan = json.load(response)

print(scan["meta"]["status"], scan["meta"]["billed"])
```

Export `API_KEY` with your live key and run the same command again.

## 6. Watch what `billed` costs

`billed` means the same thing on every key: `true` when the engine determined
the document type and read something usable off it, and `false` otherwise.
What depends on the key is whether that costs anything.

- On either sandbox key nothing is charged, because neither key has a balance
  to charge. `billed` still says whether the scan would have been charged.
- On a live key a scan with `billed: true` draws one credit.

`recognized` and `billed` answer different questions, and a page that treats
them as one will bill you for the wrong things. Reconcile against `billed`.

## What else a live key unlocks

Billing is not the only difference. Three capabilities exist only on the live
path, because all three depend on a result being stored.

- **History.** `GET /v1/scans` lists the account's recent scans as summary
  rows, most recent first. A sandbox key sees an empty list rather than the
  account's.
- **Reading one back.** `GET /v1/scans/{id}` returns a scan while its retention
  window lasts. The image crops are never stored, so a scan read back carries
  `images: null` whatever it returned the first time.
- **Idempotent retries.** An `Idempotency-Key` replays the first answer instead
  of running and charging a second time, and a replay needs that first answer
  to still be there.

How long a result stays readable is your choice, per call or per account:
[control history retention](/guides/control-history-retention).

## 7. Check the balance

`GET /v1/usage` answers `balance_credits: null` for a key with no account
behind it, and a number for a live key.

```bash runnable tab=curl
API_KEY=${API_KEY:-sk_sandbox_public}

curl https://api.doc.cheap/v1/usage -H "Authorization: Bearer $API_KEY"
```

```javascript runnable tab=javascript
const apiKey = process.env.API_KEY ?? "sk_sandbox_public";

const response = await fetch("https://api.doc.cheap/v1/usage", {
  headers: { Authorization: `Bearer ${apiKey}` },
});

const usage = await response.json();
console.log(usage.balance_credits, usage.scans.billed, usage.credits_spent);
```

```python runnable tab=python
import json
import os
import urllib.request

api_key = os.environ.get("API_KEY", "sk_sandbox_public")

request = urllib.request.Request(
    "https://api.doc.cheap/v1/usage",
    headers={"Authorization": "Bearer " + api_key},
)

with urllib.request.urlopen(request) as response:
    status = response.status
    usage = json.load(response)

print(usage["balance_credits"], usage["scans"]["billed"], usage["credits_spent"])
```

The counters cover the current UTC calendar month. A balance that cannot cover
a scan refuses it with
[`insufficient_credits`](/errors/insufficient_credits) before the engine is
called, so an empty balance costs nothing and breaks nothing.

## Next

- [Handle errors](/guides/handle-errors) – the codes a live integration meets,
  and what to do with each.
- [Retry safely with idempotency](/guides/retry-safely-with-idempotency) – how
  to retry a billing call without paying twice.
- [Control history retention](/guides/control-history-retention) – how long a
  live key's results stay readable.
