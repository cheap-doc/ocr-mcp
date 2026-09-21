---
title: Recognize a document without code
description: Upload a document in the dashboard, read the extracted fields on screen, and decide whether the API fits before writing an integration.
type: tutorial
keyword: recognize a passport without code
nav: Without writing code
section: Get started
---

# Recognize a document without code

The dashboard reads a document for you in a browser. It is the fastest way to
see what this API returns for the documents you actually handle, before you
write anything against it.

The upload page is not a separate product with its own recognition. It is a
client of `POST /v1/scans`, the endpoint an integration calls, so what you see
on screen is what your code will receive.

## Upload one document

1. Sign in and open the upload page.
2. Choose a PNG or JPEG of the document. The page accepts files up to 25 MiB.
3. Recognition starts as soon as the file arrives. No button, no queue.
4. The result appears on the same page: the document and holder blocks, the
   field list, the verdict on the machine-readable zone, and the crops.

The browser re-encodes the picture before it is sent, to at most 1600 px on the
long edge at JPEG quality 85. An accepted 25 MiB photograph leaves as a few hundred
kilobytes, which is the single biggest thing anyone can do for latency. When
the browser cannot decode the file, the original bytes go up unchanged.

## What the page is doing

The upload posts the image to `POST /v1/scans` and sets no options at all. It
names no `retain_hours`, which hands the decision to the account's own
history-retention setting. An upload made here is kept exactly as long as the
account says.

That call is this one, and you can make it yourself with the same key.

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
console.log(scan.meta.status, scan.mrz.status, scan.fields.length);
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

print(scan["meta"]["status"], scan["mrz"]["status"], len(scan["fields"]))
```

The screen is a rendering of that body. Nothing on the page is computed a
second way, and no field shown there is unavailable to a caller.
[The response](/reference/response) maps the groups you see.

## What the pictures on the screen are

Two things are worth knowing, and both are about pictures rather than data.

The crops on the screen are the ones the response carries. Neither is the
picture you uploaded. Each is scaled down by height: at most 250 px for the
document crop, 100 px for every other kind. It is then re-encoded without any
of its metadata. The fields do not change; only the pictures are smaller.

The small picture beside a row in your history is not a crop at all. A retained
scan keeps a thumbnail of at most 96 px and 16 KiB, made from the bytes you
uploaded. It is readable in the dashboard rather than through the API. The
crops themselves are never stored: a scan read back through
`GET /v1/scans/{id}` carries `images: null`, whatever it returned the first
time.

## The history behind it

Every upload made with an account is a row in the account's history, for as
long as the retention setting keeps it. The row carries the outcome fields, the
thumbnail, and the `reference` if one was sent.

The same history is readable through the API with a live key. `GET /v1/scans`
lists the rows, and `GET /v1/scans/{id}` returns one whole result. A sandbox
key reads neither. Set the window to zero and nothing is written at all: the
dashboard shows the upload's result, and no row survives it.

## Decide from it

Upload the documents that actually give you trouble: the worn ones, the ones
photographed at an angle, the issuers you have most of. Then read three fields
in the result.

- `meta.status` — whether the engine got far enough to return data.
- `meta.billed` — whether a live key would have been charged for it.
- `mrz.status` — `passed`, `failed` or `absent`, which is the difference
  between a document that vouches for itself and one you must check by hand.

A sandbox key answers from a fixed synthetic specimen, so run this judgement on
the public sandbox key or a live one.

## Next

- [Your first recognition](/start/first-recognition) — the same task in code,
  field by field.
- [Recognize a passport](/guides/recognize-a-passport) — the options and the
  layouts.
- [Control history retention](/guides/control-history-retention) — what the
  account setting the upload inherits actually does.
