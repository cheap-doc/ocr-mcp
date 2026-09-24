---
title: Service levels
description: What this service measures, what it targets for latency and uptime, how incidents are published, and where the live figures come from.
type: reference
keyword: api service levels uptime
nav: Service levels
section: Reference
verified: 1.0.2
---
# Service levels

The full status page is at **<https://doc.cheap/status>**. It is the page to
open when something looks wrong. It carries the current state of each part of
the service and ninety days of history, day by day. It also carries recognition
processing times, past incidents and anything scheduled. The two tiles at the bottom of this page
are a short extract of it.

## The JSON behind it

The same numbers the page draws are served as JSON by the API. The routes need
no key, no session and no cookie, and they carry nothing about anybody. They
answer every origin (`access-control-allow-origin: *`), so a dashboard of your
own may read them straight from a browser.

| Route | What it returns |
|---|---|
| `GET https://api.doc.cheap/status/summary.json` | The whole document. The headline state; every component with its 30- and 90-day uptime and a day-by-day strip; recognition percentiles, open incidents and scheduled maintenance. |
| `GET https://api.doc.cheap/status/history.json?component=<id>&days=<n>` | One component's daily history: color, uptime, downtime and maintenance minutes, and the day's recognition percentiles. |
| `GET https://api.doc.cheap/status/incidents.json?days=<n>` | Incidents that started in the window, with their updates. |

An **Atom feed** at **<https://doc.cheap/status/feed.xml>** carries one entry
per incident, with its impact, its state and every update newest first. That
feed is the subscription channel. Point a feed reader at it and you hear about
an incident without anybody holding your email address, and with nothing to
unsubscribe from.

`component` is one of `api`, `recognition`, `dashboard`, `docs`, `topups`
(default `api`); `days` defaults to 90 and is capped at 400.

Caching, so polling is cheap:

- `summary.json` – `cache-control: public, max-age=30, stale-while-revalidate=300`
  and a strong `ETag`. The document is rebuilt once a minute, so a poller that
  sends `If-None-Match` gets `304 Not Modified` most of the time.
- `history.json` – `public, max-age=300`, also with an `ETag`.
- `incidents.json` – `public, max-age=60`.

Every document starts with a `schema` number: branch on it before parsing the
rest, because it changes when the shape does. One address may make 60 requests a
minute across these routes; past that they answer `429`. If the document cannot
be rebuilt, the last good copy is served with `"stale": true` rather than an
error. A reader then sees figures that are explicitly out of date, instead of a
page that will not load.

## What is measured

Five components, each judged by its own evidence.

| Component | Judged by | Core |
|---|---|---|
| Recognition API | The share of `/v1` requests that failed, and whether the instances were in rotation | Yes |
| Document recognition | The canary below | Yes |
| Dashboard and website | The web app's own probe | Yes |
| Documentation | The documentation probe | Yes |
| Crypto top-ups | The deposit watch | **No** |

A non-core component is hidden while it is healthy. A green row for a path most
visitors never take spends attention for nothing.

### The canary

Availability of recognition is measured by a **synthetic recognition, once a
minute**, not by a port check.

The canary sends a generated passport image, made for the purpose and belonging
to nobody. It is posted to the service's own `POST /v1/scans` over loopback,
with `retain_hours: 0`, under a deadline of the engine's own timeout plus five
seconds. It goes through the routing, the maintenance gate, the authentication
guard, the rate limiter and the engine – the same path a customer's call takes.

Only a scan proves a scan works. Three consecutive failures mark recognition
down.

The canary carries a credential of its own with its own rate bucket, and it
records nothing while a maintenance window is open.

**The document it sends is synthetic, and under a real engine it is not
recognized.** The figures prove the path is alive; they do not prove a
customer's document reads correctly.
**Planned maintenance** is announced before it starts and is not counted as
downtime. The page lists what is scheduled for the next 30 days, and anything in
progress now.

## The two latency figures, and what each one is

They are not the same measurement, and neither is a substitute for the other.

| Figure | What it is | Over |
|---|---|---|
| `recognition_ms` | **True** p50 and p95, computed over the canary's individual durations | The last 24 hours |
| `engine_typical_slow_minute_ms` | The **median of the per-minute p95 samples** over all customer scans | The published window |

`recognition_ms` is a percentile: the raw durations are kept and the percentile
is taken over them. The figure beside its `samples` and `window_hours` says how
many runs it is a percentile of.

`engine_typical_slow_minute_ms` is **not a percentile**, and it is never called
one. Each minute's own p95 is sampled, and the median of those samples is
published. It answers what a slow minute looks like. A percentile over a whole
day cannot answer that: a day's p95 is dominated by whichever minute was worst.

The page labels it "a typical slow minute" for that reason.

## Incidents

An incident is opened automatically after five minutes of a major outage on a
component, with a fixed sentence that names nothing about the cause. A second
component that goes down joins that incident rather than starting another one.
Fifteen minutes after everything it names is working again it moves to
`monitoring`, and it is resolved by a person. The vocabulary is the one other
status pages use – `investigating`, `identified`, `monitoring`, `resolved`, with
an impact of `none`, `minor`, `major` or `critical`.

The headline at the top of the page is derived from the components, never set
by hand, and it treats them differently on purpose. An outage of the API,
recognition, the dashboard or the documentation is the product not working, and
the banner says so. An outage of crypto top-ups is named in the banner and
capped at "degraded," while its own row still reports the outage in full. A
banner that shouts about a path most readers never take is a banner people learn
to ignore.

## How uptime is counted

Atlassian Statuspage's formula, carried out unchanged, so the figure means the
same thing as on the other status pages you read:

```text
counted  = total minutes − maintenance minutes
downtime = major-outage minutes + 0.3 × partial-outage minutes
uptime   = (1 − downtime ÷ counted) × 100
```

Three consequences worth knowing before you compare numbers:

- **Degraded is not downtime.** A service that was slow was serving. Counting it
  as downtime would make "uptime" mean "was never less than perfect."
- **Maintenance leaves the denominator.** Announced work is removed from the
  counted minutes, not moved into the up column: it neither helps nor hurts the
  figure.
- **A partial-outage minute is worth 0.3 of a lost one.** Some callers got
  through, so the minute was not lost; some did not, so it was not whole.

Over a longer period the sums are carried, not the ratios. The 30- and 90-day
figures are minute-weighted, never the average of the daily percentages. A day
with four minutes of traffic does not get the same say as a day with fourteen
hundred.

## The windows and the error budget

Three windows are published, and each answers a different question.

| Window | What it is for |
|---|---|
| 24 hours | The recognition percentiles. Recent enough to describe today |
| 30 days | The headline uptime figure, and the error budget |
| 90 days | The history strip, one column per day |

The availability target is published beside the figures, and so is the **error
budget**. That is the number of downtime minutes the target allows over 30 days,
and the share of them the period has spent. A target of 99.9% over 30 days is
about 43 minutes.

Where a deployment publishes a speed target, the page also reports the share of
recognitions that came in under it. With no target set, the durations are
reported and nothing is claimed about them.

Daily rows are kept for 400 days, so a 90-day window always has a full year
behind it.

## The per-process snapshot

`GET https://api.doc.cheap/status.json` is a different and much smaller thing.
It carries one API process's request latency – p50, p95 and p99 over a rolling
window of recent requests. It also reports how long that process has been up
since its last restart. It is useful for looking at a single instance, and it
says nothing about the service over time. For that, read the status page above.

## If something looks wrong

Retry first: most `500`s are transient. The code in the body says which failure
it was, and [errors](/reference/errors) has a page for each.

For anything persistent, quote the `request_id` from the failing response, and
the `event_id` where the body carries one. Both identify the exact request in
the logs.
