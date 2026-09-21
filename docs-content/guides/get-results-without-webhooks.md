---
title: Get results without webhooks
description: The API answers in the same response, so there is no callback to register. This is how to fit that into a queue or a background worker.
type: how-to
keyword: synchronous document recognition no webhook
nav: Without webhooks
section: Guides
---

# Get results without webhooks

Recognition is synchronous. `POST /v1/scans` returns the finished result in the
response of the call that started it. This guide covers what that means for a
worker, a queue and a timeout.

If you came looking for a callback URL to register, that is the answer: none
exists, because nothing is ever delivered later.

## Read the result from the response

The call returns 200 with the whole result. No job id is handed out, nothing is
queued on our side, and no second request is needed.

```bash runnable tab=curl
curl -X POST https://api.doc.cheap/v1/scans \
  -H "Authorization: Bearer sk_sandbox_public" \
  -H "Content-Type: application/json" \
  -d "{\"image\": \"$(base64 < document.jpg | tr -d '\n')\"}"
```

```javascript runnable tab=javascript
import { readFileSync } from "node:fs";

const image = readFileSync("document.jpg").toString("base64");

const response = await fetch("https://api.doc.cheap/v1/scans", {
  method: "POST",
  headers: {
    Authorization: "Bearer sk_sandbox_public",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ image }),
});

const scan = await response.json();
console.log(scan.meta.status, scan.meta.timing);
```

```python runnable tab=python
import base64
import json
import urllib.request

with open("document.jpg", "rb") as file:
    image = base64.b64encode(file.read()).decode()

request = urllib.request.Request(
    "https://api.doc.cheap/v1/scans",
    data=json.dumps({"image": image}).encode(),
    headers={
        "Authorization": "Bearer sk_sandbox_public",
        "Content-Type": "application/json",
    },
)

with urllib.request.urlopen(request) as response:
    status = response.status
    scan = json.load(response)

print(scan["meta"]["status"], scan["meta"]["timing"])
```

`GET /v1/scans/{id}` exists for reading a result back later, while its
retention window lasts. It is a history lookup, not a way of collecting an
answer that was not ready.

## Put the call on a worker

A synchronous call that takes a second does not belong on the thread serving
your own users. Move it behind your own queue.

1. Accept the upload from your user and store the image where your worker can
   reach it.
2. Answer your own user at once with an identifier of your own.
3. Have a worker make the scan call, and write the result against that
   identifier.
4. Let your user poll your own endpoint, or push to them over whatever channel
   you already have.

Your queue does the waiting, which is what a webhook would have bought you.
What it also buys is retry control and a place to put a failure, both of which
stay inside your system.

Put your own identifier in `reference`. It is echoed back in `meta.reference`,
so the worker's result carries the job it belongs to.

## Bound your concurrency

A registered key is allowed 60 requests per minute. Size the worker pool so the
fleet stays under that, and treat 429
[`rate_limited`](/errors/rate_limited) as back-pressure rather than as an
error.

The response carries `Retry-After` on a 429. Wait that many seconds and send
the same request again.

## Size the timeout from the published figures

Set a client timeout from what the service actually takes, not from a round
number.

`meta.timing` splits the wait into three numbers, and they measure different
things.

| Key | Covers |
|---|---|
| `upload_ms` | Your bytes arriving and being validated, with your key resolved and its rate limit checked |
| `processing_ms` | The recognition call itself, and nothing else |
| `total_ms` | The whole request, from the first byte to the finished result |

Our own post-processing sits deliberately outside `processing_ms`. The crops
are resized and re-encoded after the engine has answered. Counting that as
recognition time would make the number say something it does not.

The allowance and credit gates sit outside `upload_ms` for the same reason:
they are ours, not your link. They fall under `total_ms`.

A recognition of the specimen passport of Eleni Sofia Paradeigma reports the
three like this.

```json
{
  "id": "01a0af18-cd8d-7a61-9f2d-4c7b8e105da3",
  "status": "recognized",
  "timing": { "upload_ms": 118, "processing_ms": 684, "total_ms": 826 }
}
```

Use `total_ms` to size a timeout and `upload_ms` to tell your own link from our
service. A large `upload_ms` on a small image is your network, not our engine.

The live percentiles are published. `GET https://api.doc.cheap/status/summary.json`
carries `recognition_ms`, a true p50 and p95 over the last 24 hours, taken over
a synthetic recognition run once a minute over the real path.

```text
"recognition_ms": { "p50": 612, "p95": 1144, "samples": 1437, "window_hours": 24 }
```

Set the timeout above the published p95 and well above it for a retry budget.
The route needs no key and answers every origin, so a deployment script can
read it. The rest of what that document carries is on
[service levels](/reference/service-levels).

## Make the retry safe

A client timeout does not mean the scan did not run. The work may have
completed after your socket gave up, and the credit with it.

Send an `Idempotency-Key` on every scan a worker makes. A retry under the same
key returns the first result instead of charging a second time.

Three separate 409 codes arbitrate that replay, and which one you get says what
to do next:
[retry safely with idempotency](/guides/retry-safely-with-idempotency).

## Give your own caller something to poll

Your users still want the pattern a webhook would have given them, and your own
queue is where it belongs.

1. Return your own job id when you accept the upload.
2. Expose a status endpoint of your own that answers `pending`, `done` or
   `failed` for that id.
3. Write the scan result against the id the moment the worker has it.

Poll your own endpoint from your own client. Do not poll
`GET /v1/scans/{id}` waiting for a result to appear. A scan that was never made
is a 404 for ever, and a scan that was made was already in the response your
worker received.

## Treat 503 as a wait, not a failure

Two codes say the service cannot run your scan right now, and both carry
`Retry-After`.

- [`engine_unavailable`](/errors/engine_unavailable) — recognition is not
  reachable. Nothing was charged.
- [`service_unavailable`](/errors/service_unavailable) — a store the request
  needed is unreachable.

Requeue the job rather than failing it to your user. The decision table over
all 21 codes is on [handle errors](/guides/handle-errors).

## Next

- [Retry safely with idempotency](/guides/retry-safely-with-idempotency) — a
  retry that cannot charge twice.
- [Service levels](/reference/service-levels) — what the published percentiles
  are a percentile of.
- [Reliability](/concepts/reliability) — what is measured, and what is
  promised.
