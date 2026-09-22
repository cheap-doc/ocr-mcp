---
title: Error maintenance
description: The service is in a planned maintenance window and is refusing requests for its duration. What raises it, and how to fix it.
type: reference
keyword: maintenance error
nav: maintenance
section: Reference
verified: 1.0.2
---

# maintenance (503)

The service is closed for planned maintenance. Nothing was charged.

## Cause

An operator has opened a maintenance window. While one is open, a gate in
front of every route answers before the request reaches its endpoint. The answer
is therefore the same at every address, including one that routes nowhere.

A window has two settings. In the stricter one every request is refused. In the
lighter one reads are still served and anything that would change something is
refused. A caller that only fetches results carries on working.

## The message

```text
The service is closed for maintenance; nothing was charged. Retry shortly.
```

## The fix

Wait and retry. The response carries a `Retry-After` header with the number
of seconds. Honor it rather than retrying on a tighter loop. A maintenance
window does not clear on its own, and a fleet retrying every second arrives all
at once when it does.

Planned windows are announced ahead of time on the
[status page](https://doc.cheap/status).

## event_id

`event_id` is always `null` on this code. It is a refusal the caller is meant
to handle, so nothing is recorded as a failure to look at. The service answers
and writes one log line.

## Related codes

- [`service_unavailable`](/errors/service_unavailable) — a dependency is unreachable.

The whole catalogue, grouped by what a caller does with it, is on
[errors](/reference/errors).

## The response

```json
{
  "error": {
    "code": "maintenance",
    "message": "The service is closed for maintenance; nothing was charged. Retry shortly.",
    "docs_url": "https://doc.cheap/docs/errors/maintenance",
    "request_id": "req_9e6b1f7c-2d4a-4b83-9c51-7f0ad3e8b642",
    "event_id": null
  }
}
```
