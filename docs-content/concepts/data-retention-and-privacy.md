---
title: Data retention and privacy
description: What this service stores, for how long, what it never stores at all, and what zero retention means for a request and its result.
type: explanation
keyword: document api data retention privacy
nav: Retention and privacy
section: Concepts
---

# Data retention and privacy

The payload of a scan is an identity document, which is the most sensitive
thing this service will ever be handed. What is kept of it, and for how long,
is therefore a design decision rather than an operational detail. This page is
the reasoning behind the one that was taken.

The short version. The picture is never written down. The extracted result is
kept for as long as the request asked for, and a request may ask for nothing.

## The image is never stored

The uploaded image lives in memory for the duration of the request. It is
decoded, handed to the recognition engine, and gone when the response is
written.

Nothing writes it to a disk, an object store or a log. No bucket of customer
documents exists, no retention tier over one, and no procedure for deleting
one. None of those would have anything to operate on.

The reasoning is that an image that exists somewhere is an obligation that
exists somewhere. A store of identity documents has to be encrypted, access
controlled, audited, backed up, and eventually deleted. Every one of those is
a thing that can be got wrong. Not having the store is the only version of
that work that cannot fail.

A consequence worth stating plainly: a scan cannot be re-run on our side. If
you need the same document recognized again, the picture has to be sent again,
because we do not have it.

## The crops are not stored either

A recognition returns crops: the document, the holder's photograph, the
signature. They travel in the response of the call that produced them, and
nowhere else.

A scan read back later through `GET /v1/scans/{id}` comes back with every
image slot null, whatever the original call returned. That is not a permission
being withheld; the bytes do not exist to return.

The same is true of the engine's own assessment of the picture. A stored scan
reads `quality.overall: not_checked` rather than `pass`, because the picture
it would have been a verdict about was never kept.

Whatever your integration needs from a crop, it needs at the moment of the
response.

## What a retained scan actually is

What is written down, when a retention window is asked for, is the
**reading**. That is the extracted values, the document and holder blocks, the
zone's lines and verdict, the timing, and the outcome flags.

Beside the row sits one picture: a thumbnail at most 96 px on its longest side
and at most 16 KiB encoded. It exists so that the operations log in the
dashboard shows which document a row is about instead of an opaque identifier.
It is small enough to identify a row and not a person, and it is readable in
the dashboard rather than through the API. The re-encode drops every metadata
block the source carried: no camera, no timestamp, no location.

A row is readable by the account that made it, through a live key. A sandbox
key of the same account reads nothing. An account's history is a store of
identity data, and the key handed to a contractor is not the key that opens
it.

## Zero retention writes nothing

A request carrying `retain_hours: 0` produces no row at all.

That is a stronger statement than a row that expires immediately. Nothing is
left to expire, nothing for a sweep to find, nothing in a backup taken that
minute, and nothing to appear in an export. The result was computed, returned
and forgotten.

It costs one thing, and the cost is worth knowing before it surprises anybody.
An `Idempotency-Key` sent with a zero-retention scan has no stored result to
replay. For 24 hours a retry under that key is refused with
`idempotency_replay_unavailable` rather than answered twice. The refusal is
the correct one: a replay that invented an answer would be worse. After those
24 hours the key is forgotten, and a retry under it is a new scan, charged
again.

## The window runs from the scan

A retention window is counted from the moment the scan was made, not from the
last time it was read. Reading a result does not extend it, and there is no
way to extend it.

An account chooses a default window, and a request may name its own. An
explicit `retain_hours` always wins, including zero. The account setting
decides what happens when the request says nothing, which is every upload from
the dashboard.

**Shortening the window applies to what is already stored.** That is the part
people expect least and want most. Choosing a shorter setting re-dates the
existing rows in the same step, each measured from its own creation time. A
scan made yesterday under a year-long window expires a day after it was made,
once the window becomes a day. It does not get a fresh day.

Lengthening never resurrects anything. A row already gone stays gone, and a
row written under a shorter window keeps the shorter one. The longer window
governs what comes after it.

## What deletion removes

Expiry is not a filter over reads. A background sweep physically deletes the
rows whose window has passed, in bounded batches so the deletion never takes a
long lock over a backlog.

What goes with the row is everything that was kept of the scan: the extracted
result and the thumbnail beside it. A thumbnail held outside the database
follows through a tombstone. It is queued in the same statement that deletes
the row, so the object does not outlive it.

A shortened window is the case that makes the tombstone necessary. A row the
change has pushed past its window is deleted now, and its picture is enqueued
for deletion now. Neither waits out the tier the object was written under.

## Why the default is long and the override is short

The account default is the longest window the service offers, and a request
can name a shorter one. That combination looks backwards until the two
audiences are separated.

The default serves the dashboard. Somebody who uploads a document in a browser
opened the dashboard to see their history. A default that threw it away after
a day would make that page empty.

The override serves the integration. A program knows what it is doing with
each result, and it is the only party that can say whether this one needs
keeping. An explicit value wins for that reason: the caller who named it knows
more than the setting does.

The pattern that follows is worth naming. A long account window with
`retain_hours: 0` on the traffic that does not need it keeps the dashboard
useful while storing almost nothing.

## What never leaves the process

A recognition service has two ways of leaking what it was given: its logs and
its failure reports. Both are constrained rather than trusted to discipline.

Bodies, payloads, files, images, secrets, tokens and personal data do not
reach either. A failure reported for diagnosis carries the shape of what went
wrong. Where, in which release, under which request identifier, and not the
thing it went wrong on. The subject of a report is an internal identifier, and
the scrubbing is a hook rather than a rule each caller has to remember.

The free sandbox has one more store, and it is the smallest one in the
service. To stop one image being replayed endlessly on a free key, a digest of
the image bytes is held briefly. A digest is not the image and cannot be
turned back into one. It lives in an in-memory store with a short expiry, and
no durable row is written for it.

## What this is not

This page describes what the service does with your data. It is not a legal
document, and it does not say which obligations apply to you.

The design above is meant to make those obligations smaller. The fewer copies
of an identity document exist, the fewer places have to be described, secured
and emptied. Where your own process sits is yours to decide. [Control history
retention](/guides/control-history-retention) shows how to configure the part
that is ours.
