---
title: Error payload_too_large
description: The request body is over the size the endpoint accepts. What raises it, and how to fix it.
type: reference
keyword: payload_too_large error
nav: payload_too_large
section: Reference
verified: 1.0.2
---

# payload_too_large (413)

The request body is over the ceiling, and was refused before it was read.

## Cause

A scan carries its image inline as base64, which is about a third larger than
the file on disk. The ceiling is 36 MiB, enforced before the body is read into
memory and before the engine is called.

## The message

```text
The request body is larger than this endpoint accepts.
```

## The fix

Send a smaller image. A document photograph does not need full sensor
resolution. Re-encode it as JPEG at a lower quality, or downscale it so the
document occupies about 1500–2000 pixels on its long edge.

Recognition quality depends on how many pixels cover the document itself, not on
the size of the frame around it.

## event_id

`event_id` is always `null` on this code. It is a refusal the caller is meant
to handle, so nothing is recorded as a failure to look at. The service answers
and writes one log line.

## Related codes

- [`unsupported_media_type`](/errors/unsupported_media_type) – the body was not JSON.
- [`invalid_request`](/errors/invalid_request) – the request could not be read.

The whole catalogue, grouped by what a caller does with it, is on
[errors](/reference/errors).

## The response

```json
{
  "error": {
    "code": "payload_too_large",
    "message": "The request body is larger than this endpoint accepts.",
    "docs_url": "https://doc.cheap/docs/errors/payload_too_large",
    "request_id": "req_9e6b1f7c-2d4a-4b83-9c51-7f0ad3e8b642",
    "event_id": null
  }
}
```
