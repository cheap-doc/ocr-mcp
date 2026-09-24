---
title: Error impersonation_read_only
description: "Raised only on an administrative surface: an impersonated session may not write. What raises it, and how to fix it."
type: reference
keyword: impersonation_read_only error
nav: impersonation_read_only
section: Reference
verified: 1.0.2
---

# impersonation_read_only (403)

A session opened by an administrator onto somebody else's account tried to change something.

## Cause

Such a session may read the account and nothing else. An action taken through
it would be recorded as the account holder's own, and nothing afterwards would
show that somebody else pressed the button.

## The message

```text
You are viewing this account as an administrator, so it can only be read. Stop viewing as this account to make changes.
```

## The fix

**An API caller does not meet this code.** It is raised only on an
administrative surface, which is not part of the public API and is not reachable
with an API key. A call of your own that returns it went to the wrong host or
the wrong path.

## event_id

`event_id` is always `null` on this code. It is a refusal the caller is meant
to handle, so nothing is recorded as a failure to look at. The service answers
and writes one log line.

## Related codes

- [`unauthorized`](/errors/unauthorized) – no usable API key.

The whole catalogue, grouped by what a caller does with it, is on
[errors](/reference/errors).

## The response

```json
{
  "error": {
    "code": "impersonation_read_only",
    "message": "You are viewing this account as an administrator, so it can only be read. Stop viewing as this account to make changes.",
    "docs_url": "https://doc.cheap/docs/errors/impersonation_read_only",
    "request_id": "req_9e6b1f7c-2d4a-4b83-9c51-7f0ad3e8b642",
    "event_id": null
  }
}
```
