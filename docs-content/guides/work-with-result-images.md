---
title: Work with result images
description: Ask for the portrait and the cropped document image, read them out of the response, and know how long each stays available.
type: how-to
keyword: scan result portrait image api
nav: Result images
section: Guides
---

# Work with result images

A recognition returns crops of what it found: the document itself, the holder's
photograph, the signature and a few more. This guide covers asking for them,
reading them, and the properties that decide how you can use them.

Every crop is small on purpose. They identify and illustrate a result; they are
not a scan of the document.

## Read them out of the response

`images` carries seven slots, and each one is either a `data:` URL or null. A
slot is null when the document carried nothing for it.

| Slot | What it is |
|---|---|
| `document_crop` | The document, cropped out of your picture and deskewed |
| `rear` | The reverse side, when the picture carried one |
| `main_photo` | The holder's photograph as printed |
| `signature` | The printed signature |
| `watermark_face` | The faint second copy of the face printed as a security feature |
| `barcode` | The barcode region |
| `chip` | The chip region |

```bash runnable tab=curl
curl -X POST https://api.doc.cheap/v1/scans \
  -H "Authorization: Bearer sk_sandbox_public" \
  -H "Content-Type: application/json" \
  -d "{\"image\": \"$(base64 < document.jpg | tr -d '\n')\"}" \
  --output scan.json
```

```javascript runnable tab=javascript
import { readFileSync, writeFileSync } from "node:fs";

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
const crop = scan.images.document_crop;

if (crop !== null) {
  const payload = crop.slice(crop.indexOf(",") + 1);
  writeFileSync("document-crop.jpg", Buffer.from(payload, "base64"));
}

console.log(Object.entries(scan.images).filter(([, value]) => value !== null).length);
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

crop = scan["images"]["document_crop"]
if crop is not None:
    payload = crop.split(",", 1)[1]
    with open("document-crop.jpg", "wb") as out:
        out.write(base64.b64decode(payload))

print(len([value for value in scan["images"].values() if value is not None]))
```

The curl block saves the whole body. Decode the payload after the comma of the
`data:` URL to get the bytes; the two blocks beside it do exactly that.

The specimen passport of Eleni Sofia Paradeigma fills four of the seven slots.
The payloads are elided here after their first bytes.

```json
{
  "meta": { "id": "01a0af18-cd8d-7a61-9f2d-4c7b8e105da3", "status": "recognized" },
  "images": {
    "document_crop": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD…",
    "rear": null,
    "main_photo": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD…",
    "signature": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD…",
    "watermark_face": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD…",
    "barcode": null,
    "chip": null
  }
}
```

Check for null before you decode. A passport carries no barcode, and a picture
of one side carries no `rear`.

## Turn the portrait off

Send `return_portrait: false` when you do not want the holder's face in the
response at all. The slot comes back null, and nothing was kept anywhere.

```bash runnable tab=curl
curl -X POST https://api.doc.cheap/v1/scans \
  -H "Authorization: Bearer sk_sandbox_public" \
  -H "Content-Type: application/json" \
  -d "{\"image\": \"$(base64 < document.jpg | tr -d '\n')\",
       \"options\": {\"return_portrait\": false}}"
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
  body: JSON.stringify({ image, options: { return_portrait: false } }),
});

const scan = await response.json();
console.log(scan.images.main_photo, scan.meta.billed);
```

```python runnable tab=python
import base64
import json
import urllib.request

with open("document.jpg", "rb") as file:
    image = base64.b64encode(file.read()).decode()

body = {"image": image, "options": {"return_portrait": False}}

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

print(scan["images"]["main_photo"], scan["meta"]["billed"])
```

It changes nothing about the price. The engine still ran, and the scan is
billed on what it read.

## Size your layout for the caps

Every crop is scaled down by height to a cap before it is published.

| Slot | Height cap |
|---|---|
| `document_crop` | 250 px |
| Every other slot | 100 px |

The scaling is proportional and by height only, and nothing is ever scaled up.
A crop the engine produced below its cap is published at the size it came out.

Lay out for the cap rather than for a measured sample. A 100 px face in a
120 px box is the case to design for.

Do not plan to enlarge these for display. They are sized to identify a result,
and a `document_crop` blown up to full width is a blurred document.

## Know what the re-encode does

A PNG source is written back as PNG. Everything else is written as JPEG at
quality 90.

The re-encode works from decoded pixels and nothing is copied across, so **EXIF,
ICC and every other metadata block is dropped**. No camera model, no timestamp
and no GPS tag reaches a published crop.

The orientation tag is not applied either. A crop is the stored pixel grid,
which is what the height cap is computed over.

## Nothing here can fail your scan

Image processing never turns a recognition into an error. An undecodable blob,
a format the encoder will not write, or a source with no readable size all
answer with the original bytes.

A crop that came back uncapped is that path. You still get an image, and the
recognition you paid for is still the recognition you get.

## Budget for the body they add

Every crop travels base64-encoded inside the JSON body, which makes it about a
third larger than the bytes.

The caps keep that small. A 250 px document crop and a handful of 100 px
illustrations are tens of kilobytes, against a request body that carried the
whole photograph.

Turn off what you do not render. `return_portrait: false` is the one switch,
and the other slots are filled only when the document carried them.

## Know what these crops are not

They are illustrations of a result, and three uses they do not support are
worth naming.

- **Not a source to re-recognize from.** A 100 px face and a 250 px document
  have lost the print the engine read. Re-send the original photograph.
- **Not an archival copy of the document.** They are capped by height and
  re-encoded, so they are smaller than what you sent in every dimension.
- **Not proof of what was uploaded.** Every metadata block is dropped, so a
  crop cannot be tied back to one camera or one file.

Keep your own original if your process needs one. What you sent is yours, and
it is not kept here.

## Remember they are not stored

The crops travel in the response of the call that produced them, and nowhere
else. Read them back later with `GET /v1/scans/{id}` and every slot is null,
whatever the original call returned.

Save what you need at the moment you receive it. What we keep beside a retained
scan is a 96 px thumbnail of at most 16 KiB. It is shown in the dashboard's
operations log and is not readable through the API.

## Next

- [Result images](/reference/images) – the slots, the caps and the re-encode as
  reference.
- [Data retention and privacy](/concepts/data-retention-and-privacy) – why no
  crop is written down.
- [Scan options](/reference/scan-options) – `return_portrait` and the rest.
