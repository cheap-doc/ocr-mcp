---
title: Control history retention
description: "Choose how long a result is kept: per request, per account, or not at all, and understand what disappears when the window ends."
type: how-to
keyword: scan retention window api
nav: Control retention
section: Guides
---

# Control history retention

A recognition result can be read back later, and how long it stays readable is
your choice. This guide covers the account default, the per-request override,
and what shortening a window does to results you already have.

## Pick the account default

Open the dashboard at <https://doc.cheap/app/settings> and choose one of four
windows.

| Setting | Hours | Pick it when |
|---|---|---|
| 24 hours | 24 | A result is consumed the same day and nothing needs it after that |
| 7 days | 168 | A case is worked within a week |
| 1 month | 720 | A result is evidence for a decision that can be reopened |
| 1 year | 8760 | You want the longest history the service offers |

A new account starts on 1 year. The setting applies to every scan made with a
live key that named no window of its own. Every upload made from the dashboard
is one of those.

## Override it on one request

Send `options.retain_hours` when one request must differ from the account
setting. The value is a whole number of hours from 0 to 8760.

An explicit value always wins, including zero. The account setting decides only
what happens when the request is silent.

```bash runnable tab=curl
curl -X POST https://api.doc.cheap/v1/scans \
  -H "Authorization: Bearer sk_sandbox_public" \
  -H "Content-Type: application/json" \
  -d "{\"image\": \"$(base64 < document.jpg | tr -d '\n')\",
       \"options\": {\"retain_hours\": 24}}"
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
  body: JSON.stringify({ image, options: { retain_hours: 24 } }),
});

const scan = await response.json();
console.log(scan.meta.id, scan.meta.created_at);
```

```python runnable tab=python
import base64
import json
import urllib.request

with open("document.jpg", "rb") as file:
    image = base64.b64encode(file.read()).decode()

body = {"image": image, "options": {"retain_hours": 24}}

request = urllib.request.Request(
    "https://api.doc.cheap/v1/scans",
    data=json.dumps(body).encode(),
    headers={
        "Authorization": "Bearer sk_sandbox_public",
        "Content-Type": "application/json",
    },
)

with urllib.request.urlopen(request) as response:
    status = response.status
    scan = json.load(response)

print(scan["meta"]["id"], scan["meta"]["created_at"])
```

The window runs from `meta.created_at`, not from the last read. Reading a
result does not extend it.

## Keep nothing at all

Send `retain_hours: 0`. No row is written, so nothing expires and nothing has
to be deleted later.

```bash runnable tab=curl
curl -X POST https://api.doc.cheap/v1/scans \
  -H "Authorization: Bearer sk_sandbox_public" \
  -H "Content-Type: application/json" \
  -d "{\"image\": \"$(base64 < document.jpg | tr -d '\n')\",
       \"options\": {\"retain_hours\": 0}}"
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
  body: JSON.stringify({ image, options: { retain_hours: 0 } }),
});

const scan = await response.json();
console.log(scan.meta.billed, scan.holder.full_name);
```

```python runnable tab=python
import base64
import json
import urllib.request

with open("document.jpg", "rb") as file:
    image = base64.b64encode(file.read()).decode()

body = {"image": image, "options": {"retain_hours": 0}}

request = urllib.request.Request(
    "https://api.doc.cheap/v1/scans",
    data=json.dumps(body).encode(),
    headers={
        "Authorization": "Bearer sk_sandbox_public",
        "Content-Type": "application/json",
    },
)

with urllib.request.urlopen(request) as response:
    status = response.status
    scan = json.load(response)

print(scan["meta"]["billed"], scan["holder"]["full_name"])
```

A zero-retention scan is still charged and still counted in usage. What it does
not do is leave a row behind.

> **Warning.** `retain_hours: 0` also removes the replay an
> `Idempotency-Key` would have served. A retry under the same key answers 409
> [`idempotency_replay_unavailable`](/errors/idempotency_replay_unavailable),
> because nothing was kept to replay.

## Read a result back

`GET /v1/scans/{id}` returns a scan while its window lasts, and 404 after it.
Only a live key reads stored scans. A sandbox key answers 404 for every id,
including its own.

```bash runnable expect=404 tab=curl
curl https://api.doc.cheap/v1/scans/01a0af18-cd8d-7a61-9f2d-4c7b8e105da3 \
  -H "Authorization: Bearer sk_sandbox_public"
```

```javascript runnable expect=404 tab=javascript
const response = await fetch(
  "https://api.doc.cheap/v1/scans/01a0af18-cd8d-7a61-9f2d-4c7b8e105da3",
  { headers: { Authorization: "Bearer sk_sandbox_public" } },
);

const body = await response.json();
console.log(body.error.code, body.error.docs_url);
```

```python runnable expect=404 tab=python
import json
import urllib.error
import urllib.request

request = urllib.request.Request(
    "https://api.doc.cheap/v1/scans/01a0af18-cd8d-7a61-9f2d-4c7b8e105da3",
    headers={"Authorization": "Bearer sk_sandbox_public"},
)

try:
    with urllib.request.urlopen(request) as response:
        status = response.status
        body = json.load(response)
except urllib.error.HTTPError as error:
    status = error.code
    body = json.load(error)

print(status, body["error"]["code"])
```

## List what is still readable

`GET /v1/scans` returns the account's history rows, most recent first. A row is
the summary a list view needs, not the whole result.

| Key | Carries |
|---|---|
| `id` | The scan id, which is what `GET /v1/scans/{id}` takes |
| `status` | The recognition status |
| `billed` | Whether the scan drew a credit |
| `duration_ms` | Server-side processing time |
| `reference` | Your own string, echoed back |
| `created_at` | When the scan was made, and what the window runs from |

Only scans made with a live key under a non-zero window are listed, and only
while that window lasts. A sandbox key sees an empty list rather than the
account's.

The extracted data and the crops are not in a row. Read one scan back by id
when you need them.

## Choose a window for the job

Match the window to what the result is for, rather than keeping everything for
a year because that is the default.

- **A result consumed on receipt** needs none. Send `retain_hours: 0` and store
  what you need in your own system.
- **A result a support agent may be asked about** needs the window your support
  promise covers, plus a margin.
- **A result that backs a decision somebody can reopen** needs the window that
  process runs for.

Setting a long window on the account and sending `retain_hours: 0` for the
traffic that does not need it is a working pattern. The override is per
request, so the two do not fight.

Weigh the window against what a stored row is. It is identity-document data
about a real person, and the shortest window that does your job is the one to
pick.

## What is kept, and what is not

A stored scan is the reading, not the picture.

- The image crops are never written down. A scan read back answers with every
  slot of `images` set to null, whatever the original call returned.
- The engine's own quality measurement is not kept either, so `quality.overall`
  reads `not_checked` on a read-back rather than `pass`.
- A 96 px thumbnail of at most 16 KiB is kept beside the row. It shows which
  document a row is about in the dashboard's operations log, and it is not
  readable through the API.
- Everything else comes back as it was sent to you: `meta`, `document`,
  `holder`, `fields` and `mrz`.

## Shortening the window back-dates what you already have

Choosing a shorter setting applies to the results already stored, in the same
step as the choice itself.

Each row is measured from its own `meta.created_at`. A scan made yesterday
under the 1 year setting expires one day after it was made once the setting
becomes 24 hours. It does not get a fresh day.

Rows the change has already pushed past their window go immediately, and their
thumbnails are queued for deletion in the same step. A person who asks for less
history gets less history now.

Lengthening the window never brings anything back. A row already deleted stays
deleted, and a row written under a shorter window keeps the shorter one. The
new setting governs the scans made after it.

## Next

- [Data retention and privacy](/concepts/data-retention-and-privacy) — why the
  image is never stored.
- [Scan options](/reference/scan-options) — every option and its default.
- [Limits](/reference/limits) — the range `retain_hours` accepts.
