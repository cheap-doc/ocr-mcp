---
title: Recognize an ID card
description: Send a national ID card to the recognition API, including the two-sided case, and read the identity fields that come back.
type: how-to
keyword: id card ocr api
nav: Recognize an ID card
section: Guides
---

# Recognize an ID card

An ID card prints its data on two sides, and `POST /v1/scans` takes one image
per call. This guide covers the workflow that follows: two calls, how to match
them, and what each side gives you.

The request itself is the same call a passport takes, with the same options.
If you have not made one yet, read
[recognize a passport](/guides/recognize-a-passport) first. The TD1, TD2 and
TD3 layouts are described there and are not repeated here.

## Photograph both sides

Take two pictures, one per side, each cropped to the card. Resize the long edge
to about 1600 px and re-encode as JPEG at quality 85, which is what the upload
pages send.

Do not stack the two sides into one image. The engine locates one document in
the frame, so a collage of two cards reads as one card photographed badly.

## Send each side as its own call

Give both calls the same `reference`. It is echoed back in `meta.reference`,
and it is the value your own records join on.

```bash runnable tab=curl
curl -X POST https://api.doc.cheap/v1/scans \
  -H "Authorization: Bearer sk_sandbox_public" \
  -H "Content-Type: application/json" \
  -d "{\"image\": \"$(base64 < document.jpg | tr -d '\n')\",
       \"reference\": \"card-7781-front\"}" --output front.json

curl -X POST https://api.doc.cheap/v1/scans \
  -H "Authorization: Bearer sk_sandbox_public" \
  -H "Content-Type: application/json" \
  -d "{\"image\": \"$(base64 < document.jpg | tr -d '\n')\",
       \"reference\": \"card-7781-back\"}"
```

```javascript runnable tab=javascript
import { readFileSync } from "node:fs";

const send = (image, reference) =>
  fetch("https://api.doc.cheap/v1/scans", {
    method: "POST",
    headers: {
      Authorization: "Bearer sk_sandbox_public",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ image, reference }),
  });

const image = readFileSync("document.jpg").toString("base64");

const frontResponse = await send(image, "card-7781-front");
const front = await frontResponse.json();

const response = await send(image, "card-7781-back");
const back = await response.json();

console.log(front.meta.id, back.meta.id, back.mrz.status);
```

```python runnable tab=python
import base64
import json
import urllib.request


def send(image, reference):
    request = urllib.request.Request(
        "https://api.doc.cheap/v1/scans",
        data=json.dumps({"image": image, "reference": reference}).encode(),
        headers={
            "Authorization": "Bearer sk_sandbox_public",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(request) as response:
        return response.status, json.load(response)


with open("document.jpg", "rb") as file:
    image = base64.b64encode(file.read()).decode()

_, front = send(image, "card-7781-front")
status, back = send(image, "card-7781-back")

print(front["meta"]["id"], back["meta"]["id"], back["mrz"]["status"])
```

## Match the two results

Two values join the pair, and they answer different questions.

- `meta.reference` is yours. It is echoed back untouched, so it is what your
  own order, case or session record keys on.
- `meta.id` is ours, and it is a UUID version 7. The leading 48 bits are the
  millisecond the scan was made, so two ids sort in the order the two calls
  happened. The front is the smaller id when you sent the front first.

Sorting on `meta.id` is worth knowing when a retry leaves you holding three
results for a two-sided card. The newest id is the one the retry produced.

## What each side gives you

The card decides which side carries what, but the pattern holds across issuers.

| Side | Usually carries | Reads as |
|---|---|---|
| Front | The holder's photograph, the printed name, the number and the dates | `holder`, `document`, the visual entries of `fields`, and the `main_photo` crop |
| Back | The machine-readable zone, the address, the authority | `mrz` with `status: passed`, plus the entries the zone and the reverse print |

The side without a zone answers `mrz.status: absent`, with `reason`, `lines`
and `text` all null. That is an outcome and not a failure: a card front prints
no zone, so no zone was read.

Both calls fill `document.kind` and `document.country` whenever the engine
recognized the side it was given. A front that produced no zone still tells you
which country issued the card.

## Merge in your own code

Nothing on our side joins the two results, and nothing should. Which side wins
a disagreement is a policy question about your own risk, and the API does not
hold your policy.

A merge that works for most integrations takes three rules.

1. Take the identity values from the side whose zone passed. The zone is
   printed to be read by a machine and carries its own check digits.
2. Take everything the zone does not encode – the address, the place of birth,
   the authority – from the side that printed it.
3. Compare the values both sides carry. A surname that differs between the two
   sides is a document to look at by hand, not a value to pick from.

```json
{
  "reference": "card-7781",
  "surname": "PARADEIGMA",
  "given_names": "ELENI SOFIA",
  "number": "AK472913",
  "source_of_identity": "back",
  "source_of_address": "front",
  "front_scan": "01a0af19-8595-7f03-8a15-27e6b9c40f82",
  "back_scan": "01a0af1a-3b55-7c94-b3d8-51f0a6e27c45"
}
```

Keep both scan ids. A support question about one card is answered from the two
scans behind it, and neither id can be derived from the other.

## When one side does not read

Each call is independent, so a bad picture of one side costs you that side and
nothing more.

`meta.status` says how far the engine got on the side it was given.

- `no_document_found` – nothing in the frame was located. Re-photograph that
  side and send it again.
- `unreadable` – the type was determined and no source could be read. Usually
  glare, blur or a crop that cut the zone.
- `unsupported_document` – the card is a type the engine does not read. The
  other side will not help.

Retry the one side that failed. Keep the result you already have for the other,
and keep the same `reference` on the retry.

A card whose back never reads is still usable. The front alone fills `holder`
and `document`, and the identity values then rest on the printed page rather
than on a zone with check digits.

## Two calls cost two credits

Each call is priced on its own. A side that produced a billable result draws
one credit, at one cent, and `meta.billed` on that response says whether it
did.

A card front with no zone is still billable when the engine read at least five
visual fields. A blurred back that produced nothing costs nothing, and its
`meta.billed` reads `false`. What decides it is on
[what a billed scan is](/concepts/what-a-billed-scan-is).

Send both calls with the same `Idempotency-Key`, and the second one replays the
first. Give each side its own key:
[retry safely with idempotency](/guides/retry-safely-with-idempotency).

## Next

- [Check an MRZ](/guides/check-an-mrz) – re-run the check digits of the zone
  the back gave you.
- [Handle non-Latin scripts](/guides/handle-non-latin-scripts) – reading a card
  that prints the name twice.
- [MRZ reference](/reference/mrz) – the three formats and how the digits are
  reported.
