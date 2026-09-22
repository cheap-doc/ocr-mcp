---
title: Error unsupported_media_type
description: The content type or the image format is not one this endpoint reads. What raises it, and how to fix it.
type: reference
keyword: unsupported_media_type error
nav: unsupported_media_type
section: Reference
verified: 1.0.2
---

# unsupported_media_type (415)

The body was sent under a content type this API does not accept.

## Cause

Every endpoint takes JSON. A request sent as `text/plain`,
`multipart/form-data`, `application/x-www-form-urlencoded` or with no
`Content-Type` at all is refused here, before the body is parsed.

The image travels as a base64 string inside a JSON object, never as a file
upload.

## The message

```text
Send the request body as `Content-Type: application/json`.
```

## The fix

Send `Content-Type: application/json` and put the base64 image in the `image`
field of the JSON body.

## event_id

`event_id` is always `null` on this code. It is a refusal the caller is meant
to handle, so nothing is recorded as a failure to look at. The service answers
and writes one log line.

## Related codes

- [`invalid_request`](/errors/invalid_request) — the request could not be read.
- [`payload_too_large`](/errors/payload_too_large) — the body is over the ceiling.

The whole catalogue, grouped by what a caller does with it, is on
[errors](/reference/errors).

## The response

```json
{
  "error": {
    "code": "unsupported_media_type",
    "message": "Send the request body as `Content-Type: application/json`.",
    "docs_url": "https://doc.cheap/docs/errors/unsupported_media_type",
    "request_id": "req_9e6b1f7c-2d4a-4b83-9c51-7f0ad3e8b642",
    "event_id": null
  }
}
```
