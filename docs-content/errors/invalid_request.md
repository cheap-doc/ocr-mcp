---
title: Error invalid_request
description: The request was malformed or an argument was outside the range the endpoint accepts. What raises it, and how to fix it.
type: reference
keyword: invalid_request error
nav: invalid_request
section: Reference
verified: 1.0.2
---

# invalid_request (400)

The request could not be read at all.

## Cause

The web framework refused the request before any handler ran, and the refusal
was not one of the cases with a code of its own. A body that is not valid JSON
is the common one; a method the route does not serve is another.

The message is deliberately fixed, and what threw stays in the service's own
log. Echoing a framework's internal phrasing back to a caller says something
about this service's plumbing, not about their request.

## The message

```text
The request could not be read. Check the method, headers and body.
```

## The fix

Check three things, in this order: the method and the path, the
`Content-Type` header, the body. A body that parses but fails the schema is
[`validation_failed`](/errors/validation_failed), and that code names the
field.

## event_id

`event_id` is always `null` on this code. It is a refusal the caller is meant
to handle, so nothing is recorded as a failure to look at. The service answers
and writes one log line.

## Related codes

- [`validation_failed`](/errors/validation_failed) — a field failed the schema.
- [`unsupported_media_type`](/errors/unsupported_media_type) — the body was not JSON.
- [`payload_too_large`](/errors/payload_too_large) — the body is over the ceiling.

The whole catalogue, grouped by what a caller does with it, is on
[errors](/reference/errors).

## The response

```json
{
  "error": {
    "code": "invalid_request",
    "message": "The request could not be read. Check the method, headers and body.",
    "docs_url": "https://doc.cheap/docs/errors/invalid_request",
    "request_id": "req_9e6b1f7c-2d4a-4b83-9c51-7f0ad3e8b642",
    "event_id": null
  }
}
```
