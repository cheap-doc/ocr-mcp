---
title: Result images
description: The seven image crops a recognition returns, their height caps, and the rules the re-encode follows.
type: reference
keyword: document scan result images
nav: Result images
section: Reference
verified: 0.67.0
---

# Result images

A recognition returns the pictures it cut out of the image it was sent. The
document itself, the holder's photograph, the signature and a few more. Every
one of them is a `data:` URL in the response body.

They are returned by the call that produced them and **never stored**, so a
scan read back later through `GET /v1/scans/{id}` carries no images at all.

## The seven slots

| Key | What it is |
|---|---|
| `document_crop` | The document cut out of the uploaded picture and deskewed |
| `main_photo` | The holder's photograph as printed |
| `rear` | The rear side, when one is in the frame |
| `signature` | The signature strip |
| `watermark_face` | The faint second copy of the holder's face printed into the page as a security feature |
| `barcode` | The barcode region |
| `chip` | The chip symbol |

Every slot is present as a key, and a slot with nothing in it is `null`.

`watermark_face` is a different picture from `main_photo`. It is the one a
verifier compares against it.

`main_photo` is `null` when the request sent `return_portrait: false`. The
other six slots are unaffected by that option.

## The height caps

Every crop is scaled down by height, proportionally.

| Slot | Cap |
|---|---|
| `document_crop` | 250 px |
| Every other slot | 100 px |

The document crop is the one a person actually looks at, so it gets the larger
box. Everything else is an illustration beside the extracted fields.

Two rules apply to all of them:

- **Proportional.** Only the height is set; the width follows.
- **Never upwards.** A crop already inside its cap is published at the size the
  recognition produced it.

A slot with no cap of its own takes the 100 px default rather than being
published uncapped. That includes any crop a future recognition adds.

## What the re-encode does

| Rule | What happens |
|---|---|
| Format | The source format is kept. A PNG is written back as PNG; everything else is written as JPEG |
| JPEG quality | Fixed at 90 |
| Metadata | Dropped entirely |
| Orientation tag | Not applied |

**Every metadata block is dropped**: EXIF, ICC and the rest. No camera model,
no timestamp and no GPS tag survives into a published crop.

The format is kept because a consumer sniffing the bytes would otherwise see a
different one from the picture it asked for. The JPEG quality is fixed because
the quantization quality of a source JPEG is not recoverable. It is set high
enough that the loss is not the visible change, rather than guessed at.

The orientation tag is deliberately not applied. A crop is published as the
stored pixel grid, so its dimensions are the ones the caps above produce rather
than a rotated pair.

## Image processing never fails a scan

A recognition that has already been paid for is never turned into a failure.
An image library disliking one of the crops it was given does not change that.

Every failure answers with the original bytes instead:

- an undecodable blob;
- a format the encoder will not write back;
- a source with no readable size.

A merely warning-worthy source — a truncated scan line, a bad marker — still
produces a picture rather than an exception.

Such a failure is not reported anywhere and does not appear in the response. It
says nothing an operator can act on, and the image itself is never logged.

## Size, and what to expect in a body

A crop capped at 250 px in height is a few kilobytes of JPEG; the 100 px ones
are smaller. Seven of them add tens of kilobytes to a response, as base64 inside
JSON.

A caller that does not need them can send `return_portrait: false`, which drops
the largest of the personal ones. The other six have no per-slot switch. They
are what the recognition produced.

## What a stored scan keeps instead

No crop is stored, so `GET /v1/scans/{id}` answers with all seven slots
`null`.

A scan that was retained keeps a **thumbnail of at most 96 px**, generated from
the bytes the caller uploaded rather than from any crop. It is readable in the
dashboard and not through this API. A scan created with `retain_hours: 0` keeps
nothing at all, thumbnail included.

The reasons behind that split are on
[data retention and privacy](/concepts/data-retention-and-privacy).
