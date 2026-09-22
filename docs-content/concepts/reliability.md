---
title: Reliability
description: What this service promises when a dependency is away, what it charges in that case, and how a caller can tell a retry is worth making.
type: explanation
keyword: document recognition api reliability
nav: Reliability
section: Concepts
---

# Reliability

A service that recognizes documents synchronously has to answer a hard
question honestly: what happens when the part that does the recognizing is not
there. This page is about what is measured, what the measurement is allowed to
claim, and what a failure costs a caller.

The organizing idea is that a number nobody can check is worth less than a
smaller number that came from somewhere.

## Availability is measured by doing the thing

Uptime here is not a port check, and it is not the share of requests that
happened to succeed while traffic existed.

A synthetic recognition runs once a minute. A drawn specimen is posted to the
service's own scan endpoint over loopback. It travels the whole path a
customer's call travels: the routing, the maintenance gate, the authentication
guard, the rate limiter and the engine.

Only a scan proves a scan works. Everything short of it can be true while
recognition is broken. A process that is alive, a port that accepts a
connection, a health endpoint that answers 200. Each has been somebody's green
dashboard during an outage.

Two consequences follow from doing it this way. Availability is measured on a
quiet night as well as a busy afternoon, because the measurement supplies its
own traffic. The figure is also honest about a partial failure. A specimen
that does not come back recognized is a failure, whatever the process list
says.

The synthetic document is not a real one, and under a real engine it is not
recognized. The run proves the path is alive; it does not prove that a
customer's document reads correctly.

## What a headline is allowed to say

Five components are published, and four of them are core: the recognition API,
document recognition itself, the dashboard and website, and this
documentation. Crypto top-ups is the fifth and is not core.

A core component is one whose failure means the thing a customer bought does
not work. When any of the four is down, the banner says so in the plainest
sentence available.

A non-core component's contribution to that banner is **capped** at degraded
performance, and the sentence names it. Its own row still tells the whole
truth: its state, its uptime, its ninety days. Nothing about the cap can make
a row look better than it was.

The reason is not politeness. A customer whose deposits are stuck still
recognizes documents with the credit they already hold. A page that shouts
"major outage" over a path most readers never take teaches them to discount
the banner. That banner is the one thing on the page that has to be believed
the single time it matters.

The same reasoning hides the non-core row entirely while it is healthy. A
green row for a path a visitor never takes spends their attention on something
that was never going to affect them. It appears the moment it is worth the
space.

## Why maintenance leaves the denominator

Planned work is announced before it starts and is not counted as downtime.
That much is ordinary.

What is less ordinary is that it is not counted as uptime either. A day given
over to planned work reports no value at all, rather than a hundred per cent.

Counting a maintenance window as uptime would let a service improve its
published figure by taking itself down. That is an incentive nobody should
build into a number they publish. Counting it as downtime would punish the
announced work that keeps the service healthy. Leaving it out of both halves
of the fraction is the only arithmetic that neither rewards nor punishes it.

## Why one figure is a percentile and the other is not

Two latency figures are published, and they answer different questions.
Calling both of them percentiles would make one of them a lie.

The recognition figure is a true percentile. The individual durations of the
synthetic runs are kept, and the p50 and p95 are taken over them. The number
of samples is published beside them.

The other figure is the median of each minute's own p95, and it answers what a
slow minute looks like. A percentile taken over a whole day cannot answer
that. A day's p95 is dominated by whichever minute was worst, so one bad
minute makes the day look uniformly slow.

It is labelled as a typical slow minute for exactly that reason, and it is
never called a percentile anywhere.

## Why the per-process status is a flat string

Each API process publishes a small snapshot of itself. It carries the recent
p50, p95 and p99, how long the process has been up, and a `status` of `ok` or
`degraded`.

That status is a **flat string**, not an object, and the flatness is the
useful part. The thing reading it is a monitoring check, and a monitoring
check wants one value to alert on. An object forces every consumer to
re-derive the verdict from the parts, which means every consumer derives it
slightly differently and the alerts disagree.

What the string means is fixed and narrow. The process is `degraded` when its
recent p95 is above the latency target published beside the figure. The target
travels in the same document, so a reader never has to know a number that is
not in front of them.

This snapshot is one process, over a rolling window of recent requests, and it
is cleared by a restart. It is a good way to look at one instance and a bad
way to judge the service over time. The status page is for the second
question.

## What a failure costs you

Nothing, in the ordinary case, and the mechanism is the reservation.

A credit is held before the engine is called and resolved after. When the
engine cannot be reached or does not answer in time, the hold is released and
the balance is untouched. The caller gets an error, and the failure is free.

Failures in front of the engine are free for a simpler reason: the engine
never ran. A refused key, a body over the ceiling, an exhausted allowance, a
rate limit — each of them is decided before any recognition capacity is spent.

The gates that protect the free sandbox fail **closed**. When the store
holding their counters is unreachable, the anonymous path answers a retryable
503 rather than letting unmetered free recognition through. Refusing a caller
who still had attempts left is recoverable; handing out uncounted free
recognition is not.

## How to tell a retry is worth making

Three separate 503 codes exist rather than one, and the separation is what
makes the answer readable.

One says recognition itself is unreachable. One says a store the request
needed is away. One says the service has been deliberately closed for planned
work. They arrive with `Retry-After`, and they are the codes to requeue on
rather than fail on.

An error the caller caused is a different class, and it does not improve with
time. A key that is refused stays refused, and a body over the ceiling is over
it on the second attempt too. A validation failure names the field that has to
change.

The two classes are separated in the error catalogue rather than left to
judgement. [Handle errors](/guides/handle-errors) sorts all 21 codes into
retry, fix, or stop.

## What is promised, and what is only measured

The numbers on the status page are measurements. They say what the service did
over the last thirty and ninety days, day by day. The evidence is the same
document the page itself draws from.

Nothing on this page is a contractual guarantee, and describing a measurement
as a guarantee is the one thing a reliability page must not do. What is
offered instead is a measurement taken over the real path. It is published in
full, including the bad days, and computed by arithmetic that is written down.
