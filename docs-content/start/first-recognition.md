---
title: Your first recognition
description: Send one image to the recognition API with the public sandbox key, read the extracted fields, and check what the call cost you.
type: tutorial
keyword: first document recognition call
nav: Your first recognition
section: Get started
---

# Your first recognition

One HTTP call turns a photograph of a passport or an ID card into fields you
can store. This page walks that call end to end, then reads every part of the
answer. You need no account and no key of your own.

## Before you start

You need three things.

1. A photograph of a document, as JPEG or PNG. Save it as `document.jpg` in the
   directory you run the commands from. Your own passport works, and so does a
   specimen page from an issuer's website.
2. curl, Node.js or Python 3 – whichever you already have.
3. The public sandbox key, `sk_sandbox_public`. It is published, it costs
   nothing, and it runs the same engine a paying call runs.

If the photograph came straight off a phone, shrink it first. Around 1600 px on
the long edge at JPEG quality 85 is what our own upload pages send. That is
enough for the engine to read the print.

## Send the document

The endpoint is `POST /v1/scans`. The body carries the image, base64-encoded,
and nothing else is required.

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
console.log(scan.meta.status, scan.holder?.full_name);
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

print(scan["meta"]["status"], scan["holder"]["full_name"])
```

The call is synchronous. Nothing is queued and no webhook is registered: the
recognition happens inside the request, and the fields come back in its
response.

## What comes back

A recognized document answers `200` with a body like this one. The holder is an
invented specimen, and the long base64 crops are elided.

```json
{
  "meta": {
    "schema_version": "1.0",
    "id": "01a0af18-cd8d-7a61-9f2d-4c7b8e105da3",
    "status": "recognized",
    "billed": false,
    "confidence": "high",
    "timing": { "upload_ms": 214, "processing_ms": 843, "total_ms": 1074 },
    "created_at": "2026-09-17T09:41:12Z",
    "reference": null
  },
  "document": {
    "kind": "passport",
    "country": "GRC",
    "country_name": "Greece",
    "issuing_state": "GRC",
    "type_name": "Greece - Passport",
    "type_confidence": "high",
    "number": "AM7304518",
    "series": null,
    "issue_date": "2022-03-10",
    "expiry_date": "2032-03-10",
    "is_expired": false,
    "days_remaining": 2001
  },
  "holder": {
    "given_names": "ELENI SOFIA",
    "surname": "PARADEIGMA",
    "full_name": "PARADEIGMA ELENI SOFIA",
    "birth_date": "1994-03-08",
    "sex": "F",
    "nationality": "GRC"
  },
  "fields": [],
  "mrz": {
    "status": "passed",
    "reason": null,
    "lines": [
      "P<GRCPARADEIGMA<<ELENI<SOFIA<<<<<<<<<<<<<<<<",
      "AM73045184GRC9403084F3203101PN48291630<<<<72"
    ],
    "text": "P<GRCPARADEIGMA<<ELENI<SOFIA<<<<<<<<<<<<<<<<AM73045184GRC9403084F3203101PN48291630<<<<72"
  },
  "images": {
    "document_crop": "data:image/jpeg;base64,…",
    "rear": null,
    "main_photo": "data:image/jpeg;base64,…",
    "signature": "data:image/jpeg;base64,…",
    "watermark_face": null,
    "barcode": null,
    "chip": null
  },
  "quality": { "overall": "pass" },
  "authenticity": { "overall": "not_checked", "checks": [] }
}
```

Eight groups, and every key inside them is always present. A value that is not
known is `null`, never an absent key, so your parser never has to ask whether a
field exists.

`fields` is elided above and is not empty in a real answer. It carries every
field the engine read off the printed page, one entry per language.
[The response](/reference/response) is where that list is worth opening.

## The outcome

Three keys of `meta` say how the call went.

- `status` is one of `recognized`, `no_document_found`, `unreadable`,
  `unsupported_document` and `rejected`. The set is exactly those five strings.
- `billed` says whether this scan is a billed one: `true` when the engine
  determined the document type and read something usable from it. On a live
  key that is a charge. On either sandbox key nothing is charged, and `billed`
  says whether the same scan would have been charged on a live key.
- `confidence` is `high`, `medium` or `low` – a band rather than a number,
  because a recognition probability is not a calibrated percentage.

`recognized` and `billed` are not the same question, and a scan can be one
without the other. [What a billed scan is](/concepts/what-a-billed-scan-is)
holds the rule.

## The scan id

`meta.id` is a UUID version 7 in canonical lower-case form. Its leading 48 bits
are the millisecond the scan was made. A column of ids therefore sorts in the
order the scans happened, and an index on it stays compact.

Treat the value as opaque otherwise. Nothing else about it is part of the
contract, and it is the id `GET /v1/scans/{id}` takes.

`meta.reference` is whatever string you sent, echoed back, up to 128 characters.
`meta.created_at` is an ISO-8601 timestamp in UTC.

## The data

`document` and `holder` carry the curated values, and each is `null` as a whole
when the scan produced nothing for it, rather than an object of nulls.

`document.number`, `document.issue_date` and `document.expiry_date` are the
document's own number and dates. `document.series` is `null` here because a
Greek passport prints no separate series.

Dates are ISO 8601 (`YYYY-MM-DD`). Countries are ISO 3166-1 alpha-3, with
`country_name` beside the code for display. `document.days_remaining` counts
from the day of the scan and goes negative once the document has expired.

Everything the engine read off the page is in `fields`, one entry per reading.
A document printed in two scripts yields one entry per script, so a Greek
passport carries both `PARADEIGMA` and `ΠΑΡΑΔΕΙΓΜΑ`.

## The machine-readable zone

`mrz` is a verdict with the zone beside it. `status` is `passed`, `failed` or
`absent`; `reason` names what did not check out when it failed.

`lines` is the lines in order, exactly as read – two for a passport, three for
an ID card. `text` is those lines run together with nothing between them: one
unbroken string, with no newlines and no spaces. The zone's alphabet is `A-Z`,
`0-9` and the filler `<`, so nothing is lost by joining them. Hand the value to
a check-digit routine unchanged. [Check an MRZ](/guides/check-an-mrz) walks
that.

## What the call took

`meta.timing` splits the wait into the half you control and the half we do.

| Key | Measures | Who can shrink it |
|---|---|---|
| `upload_ms` | The request arriving and being validated, with your key resolved and its rate limit checked | You, by sending a smaller picture from closer by |
| `processing_ms` | The recognition itself, and nothing else | Us |
| `total_ms` | The whole request, from arrival to a complete result | Both |

`total_ms` is at least `upload_ms + processing_ms`. The remainder is the
allowance and credit gates, preparing the result images, and mapping the
engine's output into this body. That work is deliberately outside
`processing_ms`, so the number stays a measurement of recognition rather than
of our own bookkeeping.

A first call over a slow link is often more `upload_ms` than `processing_ms`.
Shrink the image before you conclude the API is slow.

## The crops

`images` carries seven slots of pictures the engine cut out of your photograph,
each a `data:` URL or `null`. They are returned by this call and never written
down, so a scan read back later carries every slot `null`. Send
`"options": {"return_portrait": false}` to leave the holder's photograph out.

## If it did not recognize anything

A failure to read is a `200`, not an error. `status` says how far the engine
got, and the body is complete either way.

| `status` | What happened | What to do |
|---|---|---|
| `no_document_found` | Nothing document-shaped was in the frame | Re-frame and photograph again |
| `unreadable` | A document was there, and no usable text came off it | Improve the light, the focus or the angle |
| `unsupported_document` | The document was found, and its type is not one we know | Stop; a retry reads the same |
| `rejected` | Recognition failed on our side | Retry once |

None of the four is charged on a live key. An HTTP error is a different thing,
and [handle errors](/guides/handle-errors) has the table for those.

## Check the account

`GET /v1/usage` reports the balance and the counters for the current calendar
month.

```bash runnable tab=curl
curl https://api.doc.cheap/v1/usage \
  -H "Authorization: Bearer sk_sandbox_public"
```

```javascript runnable tab=javascript
const response = await fetch("https://api.doc.cheap/v1/usage", {
  headers: { Authorization: "Bearer sk_sandbox_public" },
});

const usage = await response.json();
console.log(usage.balance_credits, usage.scans.total);
```

```python runnable tab=python
import json
import urllib.request

request = urllib.request.Request(
    "https://api.doc.cheap/v1/usage",
    headers={"Authorization": "Bearer sk_sandbox_public"},
)

with urllib.request.urlopen(request) as response:
    status = response.status
    usage = json.load(response)

print(usage["balance_credits"], usage["scans"]["total"])
```

The public sandbox key carries no account, so `balance_credits` comes back
`null` and the counters stay at zero. A key of your own reports real figures.

## Next

- [From the sandbox to a live key](/start/from-sandbox-to-live) – what changes
  when the call starts billing.
- [Recognize a passport](/guides/recognize-a-passport) – the options, the ID
  card layouts and the two-sided case.
- [Handle errors](/guides/handle-errors) – what to retry, what to fix and what
  to surface.
