---
title: Retry safely with idempotency
description: Send an idempotency key so a retried recognition returns the first result instead of running and charging a second time.
type: how-to
keyword: idempotency key retry scan
nav: Retry safely
section: Guides
---

# Retry safely with idempotency

A recognition that times out on your side may already have run on ours. Retry
it blind and you pay twice. Send an `Idempotency-Key` with the original request
and the retry returns the first result instead of producing a second one.

## Send a key

`Idempotency-Key` is a request header on `POST /v1/scans`, between 1 and 255
characters. Generate one per logical operation – one document you are trying to
read – and reuse it for every retry of that operation.

```bash runnable tab=curl
curl -X POST https://api.doc.cheap/v1/scans \
  -H "Authorization: Bearer sk_sandbox_public" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 8f3c2a1b-5d4e-4f60-9a7b-3c2d1e0f9a8b" \
  -d "{\"image\": \"$(base64 < document.jpg | tr -d '\n')\", \"reference\": \"order-1042\"}"
```

```javascript runnable tab=javascript
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const image = readFileSync("document.jpg").toString("base64");
const idempotencyKey = randomUUID();

const response = await fetch("https://api.doc.cheap/v1/scans", {
  method: "POST",
  headers: {
    Authorization: "Bearer sk_sandbox_public",
    "Content-Type": "application/json",
    "Idempotency-Key": idempotencyKey,
  },
  body: JSON.stringify({ image, reference: "order-1042" }),
});

const scan = await response.json();
console.log(idempotencyKey, scan.meta.id, scan.meta.billed);
```

```python runnable tab=python
import base64
import json
import urllib.request
import uuid

with open("document.jpg", "rb") as file:
    image = base64.b64encode(file.read()).decode()

idempotency_key = str(uuid.uuid4())

request = urllib.request.Request(
    "https://api.doc.cheap/v1/scans",
    data=json.dumps({"image": image, "reference": "order-1042"}).encode(),
    headers={
        "Authorization": "Bearer sk_sandbox_public",
        "Content-Type": "application/json",
        "Idempotency-Key": idempotency_key,
    },
)

with urllib.request.urlopen(request) as response:
    status = response.status
    scan = json.load(response)

print(idempotency_key, scan["meta"]["id"], scan["meta"]["billed"])
```

A UUID is a good key. A per-document value from your own system is better,
because it survives a process restart that a freshly generated UUID would not.

## Where it applies

Idempotency arbitrates the billing path, which means a live key. Both sandbox
keys run free and store nothing, so a key sent with them is accepted and
decides nothing.

A key is scoped to your account. Two accounts using the same string never
collide.

## What makes two requests the same

The key alone does not. Each claim also carries a fingerprint of the request
body – a digest over `image`, `options` and `reference`, with the keys sorted so
that property order cannot change it.

- Same key, same body: a replay. The first result comes back.
- Same key, different body: a conflict, refused.

Change a single option and the body is different. Reuse the key only for a
retry of the same call.

## The three conflict codes

All three arrive as `409`, and each says something different about the first
request under this key.

| Code | What happened | What to do |
|---|---|---|
| [`idempotency_conflict`](/errors/idempotency_conflict) | The key was already used with a different body | Send this body under a new key |
| [`idempotency_in_progress`](/errors/idempotency_in_progress) | The first request is still running | Wait a moment, then retry the same request with the same key |
| [`idempotency_replay_unavailable`](/errors/idempotency_replay_unavailable) | The first request finished, and its result is no longer stored | Send the request again under a new key |

Never treat `409` as one case. `idempotency_in_progress` means keep the key;
the other two mean take a new one, and retrying either with the same key repeats
the refusal.

## The wait before `idempotency_in_progress`

A claim is taken before the engine runs. A second caller arriving while the
first is still inside recognition therefore finds a claim with no result on
it.

That second caller is not sent away at once. Nor is it allowed to redo the
work: redoing it is the double charge the key exists to prevent. It waits a
short time for the first request to land, re-checking as it waits. It replays
the result when one arrives. Only when the wait runs out does it answer
`idempotency_in_progress`. That wait is deliberately short, because it is held
against the second caller's own request timeout.

A claim whose request died mid-flight would otherwise hold the key forever.
Past a much longer deadline it counts as abandoned, and the next caller takes
it over.

## A retry loop

Retry on a transient refusal, keep the key, and honor `Retry-After` where it is
present. Cap the attempts: a loop with no ceiling turns one slow minute into an
outage of your own.

```bash runnable tab=curl
curl -X POST https://api.doc.cheap/v1/scans \
  --retry 3 \
  -H "Authorization: Bearer sk_sandbox_public" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 8f3c2a1b-5d4e-4f60-9a7b-3c2d1e0f9a8b" \
  -d "{\"image\": \"$(base64 < document.jpg | tr -d '\n')\"}"
```

```javascript runnable tab=javascript
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const image = readFileSync("document.jpg").toString("base64");
const idempotencyKey = randomUUID();
const retryable = new Set([429, 500, 502, 503, 504]);

let response;
for (let attempt = 0; attempt < 4; attempt += 1) {
  response = await fetch("https://api.doc.cheap/v1/scans", {
    method: "POST",
    headers: {
      Authorization: "Bearer sk_sandbox_public",
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ image }),
  });
  if (!retryable.has(response.status)) break;
  const after = Number(response.headers.get("Retry-After") ?? 0);
  const seconds = after > 0 ? after : 2 ** attempt;
  await new Promise((done) => setTimeout(done, seconds * 1000));
}

console.log(response.status);
```

```python runnable tab=python
import base64
import json
import time
import urllib.error
import urllib.request
import uuid

with open("document.jpg", "rb") as file:
    image = base64.b64encode(file.read()).decode()

idempotency_key = str(uuid.uuid4())
retryable = {429, 500, 502, 503, 504}
status = None

for attempt in range(4):
    request = urllib.request.Request(
        "https://api.doc.cheap/v1/scans",
        data=json.dumps({"image": image}).encode(),
        headers={
            "Authorization": "Bearer sk_sandbox_public",
            "Content-Type": "application/json",
            "Idempotency-Key": idempotency_key,
        },
    )
    try:
        with urllib.request.urlopen(request) as response:
            status = response.status
            scan = json.load(response)
        break
    except urllib.error.HTTPError as failure:
        status = failure.code
        if status not in retryable:
            break
        time.sleep(int(failure.headers.get("Retry-After") or 2 ** attempt))

print(status)
```

`curl --retry` retries a transient failure on its own, and since version 7.66
it obeys a `Retry-After` header when the response carries one. The two scripts
do the same thing by hand, because the header has to be read either way.

Do not retry a `409`. The three conflict codes above are answers, not
transients, and two of them say the key itself has to change.

## Why a replay can become unavailable

A replay returns the stored result of the first call. When nothing was stored,
there is nothing to return, and the answer is
`idempotency_replay_unavailable` rather than a silent re-run.

That is what `retain_hours: 0` does: it writes no row at all. If you want
retries to replay, ask for a retention window on the original request, at any
value above zero. Otherwise a replay past it needs a new key, which is what the
message on that code says.

The refusal does not last for ever. A key whose request stored nothing is
remembered for 24 hours. A key whose result has expired goes when the retention
sweep removes that result. A retry under a forgotten key is a new scan, charged
again.

## What a retry costs

Nothing, when it replays. A replay does not call the engine and does not draw a
credit. The credit was drawn by the first call, and `billed` on the replayed
body is the first call's answer.

A failure before the engine ran costs nothing either. When recognition fails
after the credit was reserved, the reservation is released and the claim is
dropped. The key is then free for an honest retry.

## Next

- [Handle errors](/guides/handle-errors) – every code, and what to do with it.
- [Idempotency](/reference/idempotency) – the exact rules, including how long a
  key is remembered.
- [Control history retention](/guides/control-history-retention) – the window a
  replay depends on.
