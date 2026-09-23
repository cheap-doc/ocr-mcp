---
title: Recognize a driver licence
description: Send a driver licence to the recognition API, read the vehicle categories and dates, and handle the layouts that vary by country.
type: how-to
keyword: driver licence ocr api
nav: Recognize a driver licence
section: Guides
---

# Recognize a driver licence

A driver licence goes to the same endpoint as a passport, with the same body.
What differs is where the data is printed. Most issuers put no
machine-readable zone on a licence at all. The answer is then assembled from
the visual zone and, where one is printed, a barcode.

## Send it

The call is the same one every document takes. The response reports the zone as
a single verdict, so a missing zone is one branch rather than a walk through
nulls.

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
const classes = scan.fields.filter((field) =>
  ["dl_class", "permit_class"].includes(field.name),
);

console.log(scan.document?.kind, scan.mrz.status, classes.map((f) => f.value));
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

classes = [f["value"] for f in scan["fields"] if f["name"] in ("dl_class", "permit_class")]

print(scan["document"]["kind"], scan["mrz"]["status"], classes)
```

## No machine-readable zone is not a failure

Treat `absent` as an ordinary outcome, not an error.

`mrz.status` reads `absent`, and `reason`, `lines` and `text` are all `null`.
The group itself is present, as every group always is.

`absent` and `failed` are different answers. `absent` means no zone was read, so
there was nothing to check. `failed` means a zone was read and something in it
did not check out, which is worth acting on.

The rest of the document is unaffected. A licence is recognized off its printed
face like any other document, and `meta.status` comes back `recognized`.

```json
{
  "mrz": { "status": "absent", "reason": null, "lines": null, "text": null },
  "quality": { "overall": "pass" },
  "fields": [
    { "id": "dl_class@0", "name": "dl_class", "label": "Driving-licence class",
      "category": "document", "value": "B, BE", "language": null, "confidence": "high" },
    { "id": "authority@0", "name": "authority", "label": "Issuing authority",
      "category": "document", "value": "THESSALONIKI REGIONAL OFFICE", "language": null, "confidence": "medium" }
  ]
}
```

## Photographing a card

A licence is a glossy plastic card, and it is harder to photograph than a
passport page.

1. Fill the frame with the card, square on. A card at an angle loses the
   characters nearest the far edge.
2. Turn the flash off. A direct flash reflects off the laminate and erases
   whatever is under the highlight.
3. Light it from the side, not from behind the camera.
4. Send both sides when the barcode matters, as two calls.

## What makes the scan billable without a zone

A live key is charged when the engine determined the document type **and** one
of three things is true.

1. A machine-readable zone was read and its check digits passed.
2. Five or more fields of the visual zone were read.
3. A barcode was decoded.

A licence therefore bills on the second or third of those. A photograph too
poor to yield five fields and no barcode is free, whatever else went right.
[What a billed scan is](/concepts/what-a-billed-scan-is) holds the whole rule.

## The barcode

A decoded barcode gets no group of its own. Its values arrive in `fields`
beside everything else, and `images.barcode` carries a crop of it when the
engine cut one out.

Issuers that print a barcode usually put it on the back of the card, and this
endpoint reads one image per call. Send the back as its own scan when you need
what the barcode carries, and merge the two results yourself.

## The fields a licence fills

Licence layouts vary by issuer more than passports do, so the field list is
open rather than fixed. Any field the engine reads is published, whether or not
we have a curated key for it. These are the ones worth looking for by name.

| `name` | Label | Category |
|---|---|---|
| `dl_class` | Driving-licence class | `document` |
| `permit_class` | Permit / licence class | `document` |
| `authority` | Issuing authority | `document` |
| `document_number` | Document number | `document` |
| `issue_date` | Date of issue | `dates` |
| `expiry_date` | Date the licence runs out | `dates` |
| `address`, `address_street`, `address_city`, `address_state`, `address_postal_code` | Address, and its parts | `address` |
| `height`, `eyes_color` | Height, Eye colour | `other` |

Address parts are published separately as well as whole, because an issuer may
print only some of them. Read whichever your own model needs, and do not assume
`address` is the sum of the parts.

Key on `id`, not on `name`. A licence printed in two scripts returns one entry
per language under the same `name`, and only `id` is unique across the array.

## Dates and the countdown to the end of validity

Every date is ISO 8601. A licence that names the date it runs out carries it as
`document.expiry_date`, and the date it was issued as `document.issue_date`. It
also gets `document.days_remaining` and a derived `days_to_expire` field. Both count from
the day of the scan and go negative once the licence has run out. The field
carries its value as a string, the way every entry of `fields[]` does.

## Next

- [The response](/reference/response) — every group, key by key.
- [Recognize a passport](/guides/recognize-a-passport) — the zone layouts, for
  the licences that do carry one.
- [Handle errors](/guides/handle-errors) — what an HTTP error means here, as
  against a `200` that recognized nothing.
