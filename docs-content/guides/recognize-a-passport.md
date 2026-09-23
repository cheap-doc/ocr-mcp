---
title: Recognize a passport
description: Send a passport photo to the recognition API, choose the options that matter, and read the machine-readable zone and the visual fields.
type: how-to
keyword: passport ocr api
nav: Recognize a passport
section: Guides
---

# Recognize a passport

The whole task is one `POST /v1/scans`. This guide covers the image to send, the
options worth setting, and the blocks you read the answer out of. The ID-card
layouts are at the end.

## Prepare the image

The endpoint takes JPEG or PNG, base64-encoded in the JSON body. Before you
encode, do two things to the picture.

1. Crop to the document. A data page filling most of the frame reads better
   than one in the corner of a desk.
2. Resize the long edge to about 1600 px and re-encode as JPEG at quality 85.
   That is what our own upload pages send, and it keeps the print well above
   the size the engine needs.

The body ceiling is 36 MiB by default. A body over it answers
[`payload_too_large`](/errors/payload_too_large) before it is read into memory,
and before the engine is called. Base64 makes a file about a third larger, so
that ceiling covers a 25 MiB photograph sent unchanged. Resizing first keeps an
ordinary call in the hundreds of kilobytes.

## Send it

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
console.log(scan.document.kind, scan.holder.full_name, scan.mrz.status);
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

print(scan["document"]["kind"], scan["holder"]["full_name"], scan["mrz"]["status"])
```

## Set the options that matter

Send an `options` object when a default does not suit you. Unknown keys are
rejected rather than ignored, so a typo answers
[`validation_failed`](/errors/validation_failed) with the offending path in the
message.

| Option | Values | Default | Use it when |
|---|---|---|---|
| `expect_country` | ISO 3166-1 alpha-3, or `null` | `null` | You already know the issuer and want the hint carried in |
| `return_portrait` | boolean | `true` | You do not want the holder's face in the response at all |
| `retain_hours` | 0–8760, or `null` | `null` | This one result must be kept, or must not be |
| `reference` | string up to 128 characters | `null` | You want your own order id echoed back |

`retain_hours: 0` writes no row at all, rather than a row that expires early.
The full list, with every default, is on
[scan options](/reference/scan-options).

```bash runnable tab=curl
curl -X POST https://api.doc.cheap/v1/scans \
  -H "Authorization: Bearer sk_sandbox_public" \
  -H "Content-Type: application/json" \
  -d "{\"image\": \"$(base64 < document.jpg | tr -d '\n')\",
       \"reference\": \"order-1042\",
       \"options\": {\"expect_country\": \"GRC\", \"return_portrait\": false, \"retain_hours\": 0}}"
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
  body: JSON.stringify({
    image,
    reference: "order-1042",
    options: { expect_country: "GRC", return_portrait: false, retain_hours: 0 },
  }),
});

const scan = await response.json();
console.log(scan.meta.reference, scan.images.main_photo);
```

```python runnable tab=python
import base64
import json
import urllib.request

with open("document.jpg", "rb") as file:
    image = base64.b64encode(file.read()).decode()

body = {
    "image": image,
    "reference": "order-1042",
    "options": {"expect_country": "GRC", "return_portrait": False, "retain_hours": 0},
}

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

print(scan["meta"]["reference"], scan["images"]["main_photo"])
```

## Read the result

`document` and `holder` carry the curated values, and each is `null` as a whole
when the scan produced nothing for it.

- `document` — `kind`, `country`, `country_name`, `issuing_state`, `type_name`,
  `type_confidence`, `number`, `series`, `issue_date`, `expiry_date`,
  `is_expired` and `days_remaining`.
- `holder` — `given_names`, `surname`, `full_name`, `birth_date`, `sex` and
  `nationality`.

Everything the engine read off the printed page is in `fields`, one entry per
reading. The document number is there too, under `document_number`, beside
`document.number`; the personal number is only there, under
`personal_number`. The whole shape is laid out on
[the response](/reference/response).

## Read the same fact in two scripts

A passport printed in a national script carries the holder's name twice: once
in that script and once transliterated into Latin. `fields` publishes both,
one entry each, rather than choosing for you.

```json
[
  {
    "id": "surname@0",
    "name": "surname",
    "label": "Surname",
    "category": "identity",
    "value": "PARADEIGMA",
    "language": null,
    "confidence": "high"
  },
  {
    "id": "surname@1032",
    "name": "surname",
    "label": "Surname",
    "category": "identity",
    "value": "ΠΑΡΑΔΕΙΓΜΑ",
    "language": "Greek",
    "confidence": "high"
  }
]
```

- `name` repeats across the two entries; `id` does not. Key your own list on
  `id`.
- `language` is `null` on the neutral, transliterated reading and names the
  language on the other.
- `confidence` is a band — `high`, `medium` or `low` — never a number.

`holder.surname` carries the Latin reading. Read the `fields` entry when you
want the spelling the document prints.

## Check the machine-readable zone

A passport data page carries the zone at the bottom, and the response publishes
it verbatim beside a verdict.

- `mrz.status` is `passed`, `failed` or `absent`.
- `mrz.reason` names what did not check out, and is `null` unless the status is
  `failed`.
- `mrz.lines` is the lines in order, exactly as read, each one free of
  whitespace.
- `mrz.text` is those lines run together with nothing between them: one
  unbroken string, no newlines and no spaces. The zone's alphabet is `A-Z`,
  `0-9` and the filler `<`, so nothing is lost by joining them. Hand it to a
  check-digit routine unchanged.

Re-running the digits yourself is [check an MRZ](/guides/check-an-mrz).

## ID cards and the three layouts

`POST /v1/scans` reads whatever document is in the frame, so an ID card needs
no different call. What differs is the layout of its zone, and how many lines
come back.

| Layout | Lines | Where you meet it |
|---|---|---|
| TD1 | 3 lines of 30 characters | ID cards, residence permits |
| TD2 | 2 lines of 36 characters | Older ID cards and some travel documents |
| TD3 | 2 lines of 44 characters | Passport booklets |

Whichever layout it is, the zone fills the same values once it is read:
`holder.surname`, `holder.given_names`, `holder.birth_date`, `holder.sex`,
`holder.nationality`, `document.issuing_state`, `document.number`,
`document.expiry_date` with the `document.days_remaining` computed from it, and
the `document_number` entry of `fields`. The
`personal_number` entry comes from the zone's optional-data field, which TD2
does not carry.

No layout encodes a date of issue. `document.issue_date` and the `issue_date`
field are therefore a reading of the printed page. It is absent on a document whose visual zone was
not read, even when the zone's check digits passed.

A card prints its zone on the back, and this endpoint takes one image per call.
Send each side as its own scan and merge the two results in your own code:
[recognize an ID card](/guides/recognize-an-id-card) walks that.

### Sending both sides

1. Photograph the front and the back as separate images.
2. Send each as its own `POST /v1/scans`. Give both the same `reference` so
   your own records can join them.
3. Merge in your code. The side carrying the zone fills `mrz`; the other side
   usually carries the holder's photograph and the printed fields.
4. Reconcile `meta.billed` per call. Two calls on a live key are two credits
   when both produce a billable result.

## When it does not come back recognized

`meta.status` says how far the engine got, and a failure to recognize is a `200`
rather than an error. Re-photograph and retry on `no_document_found` or
`unreadable`; there is nothing to retry on `unsupported_document`. An HTTP
error is a different thing entirely, and
[handle errors](/guides/handle-errors) has the table.

## Next

- [Work with result images](/guides/work-with-result-images) — the crops this
  call returns and their sizes.
- [Control history retention](/guides/control-history-retention) — reading a
  scan back later, and keeping nothing at all.
