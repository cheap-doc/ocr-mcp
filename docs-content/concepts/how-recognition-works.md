---
title: How recognition works
description: "What happens between sending an image and getting fields back: detection, classification, zone reading and the checks that follow."
type: explanation
keyword: how passport recognition works
nav: How recognition works
section: Concepts
---

# How recognition works

A scan is one HTTP request that goes out with a photograph in it and comes
back with the document's contents. Between those two moments the service does
five distinct things. Knowing where one ends and the next begins explains most
of what the response says.

The whole of it happens inside the request. Nothing is queued, nothing is
deferred, and the answer a caller reads is the answer that was computed while
the connection was open.

## The bytes arrive

The image travels base64-encoded inside the JSON body. Base64 is about a third
larger than the bytes it carries, which is why the body ceiling is larger than
the image ceiling behind it.

The ceiling is enforced before the body is read into memory. A request over it
is refused without ever being assembled, which costs nothing and reaches no
recognition.

Then come the gates that decide whether this caller may run a scan at all. The
key is resolved, the rate bucket is consulted, and the free allowances on the
public sandbox key are claimed. All of it happens before any recognition,
because a caller who cannot be served should not consume recognition capacity
to find that out.

The balance is the last of those gates on a live key. A credit is put on hold
before the engine is called. An account that cannot pay is turned away at that
point rather than after the work.

`meta.timing.upload_ms` covers the first part of that and not the rest. It is
taken once the body has arrived and been validated, with the key resolved and
the rate bucket consulted. The free allowances and the credit hold are claimed
after it, so they fall under `total_ms` instead.

The number is therefore the caller's own link, the parsing of their bytes, and
the key check. It is reported separately because a caller with a slow
integration needs to know which half to attack.

## The engine reads the document

The recognition itself is one call to the Engine, and it is the part that
takes the time.

Four things happen inside it, and each one can be the point at which the
answer stops improving.

**Locating the document.** The picture is searched for something
document-shaped. A data page filling most of the frame is found immediately. A
card lying on a patterned desk under a lamp is the case that fails. When
nothing is located, no later stage has anything to work on.

**Deciding what it is.**

A located document is matched against a catalogue of document types. The match
fills `document.kind`, `document.country` and `document.type_name`. It carries
its own confidence, reported as `document.type_confidence`. Being sure that a
page is a passport and being sure of the surname on it are two different kinds
of sure.

**Reading the zones.** A document carries its contents in more than one place,
and each place is read on its own terms. The machine-readable zone is a fixed
grid of characters printed to be read by a machine. The visual zone is
everything else the page prints, read as text. A barcode, where one exists, is
decoded. Every field the engine produces names the zone it came from, and a
field printed in two scripts is read once per script.

**Checking what it read.** The zone's check digits are recomputed and compared
against the digits the zone prints. Where a field appears in two zones, the
two readings are compared with each other. The picture itself is assessed for
whether it was good enough to read from at all.

`meta.timing.processing_ms` is that call and nothing else. It is the figure to
watch when comparing our service against another. It is also the figure that
moves when a photograph is larger or worse than usual.

## The answer is turned into a response

What the engine returns is its own working material: containers, numeric field
types, per-zone values and integer check results. The response is a
translation of it, and the translation is deliberate rather than mechanical.

Field types become our own stable keys, so a consumer reads `surname` rather
than an integer. Numeric language identifiers become language names. A
probability becomes a band. A pile of per-digit results becomes one verdict
with a sentence. Two field types the engine reports are deliberately withheld,
because each would hand a reader something they could not act on.

The image crops are resized to their caps and re-encoded without any of their
metadata. What is published illustrates the result; it is not a copy of the
picture that was sent.

That work sits **outside** `processing_ms` on purpose. It is our own
post-processing, not recognition, and counting it as recognition would make
the number say something it does not. It is still inside `total_ms`, which
covers the whole request from the first byte to the finished answer.

## The scan is settled

On a live key, the credit held before the engine call is now resolved. A
billable result commits the hold; anything else releases it and the balance is
untouched. The rule that decides which is on [what a billed scan
is](/concepts/what-a-billed-scan-is).

The result is written down in the same transaction as that ledger move, when
the retention window resolved for the request is above zero. When the window
is zero, no row is written at all — not a row that expires early, no row.

The uploaded image is not part of any of that. It was decoded in memory,
handed to the engine, and is gone when the request ends.

## Why the status has five values

`meta.status` is one of five strings, and they are not a severity scale. Each
one names how far the sequence above got.

A scan is `recognized` when the type was determined, at least one zone was
read, and the engine reported success. It is `no_document_found` when nothing
document-shaped was located, and `unsupported_document` when something was
located whose type is not in the catalogue. It is `unreadable` when the type
was determined and no zone could be read off the page. It is `rejected` when
recognition ran to the end and the engine did not call the result a success.

None of these is an HTTP error. All five arrive with a `200`, because the
request was well formed and the service did the work it was asked to do. The
document did not yield what the caller hoped for, which is a fact about the
photograph rather than about the call.

That separation is worth holding on to. An HTTP error means the call could not
be processed; a status means it was processed and this is what came out.

## Why the call is synchronous

A recognition takes well under a second in the ordinary case. That number is
what makes the whole design possible.

The alternative is a job: the caller posts an image, gets an identifier, and
learns the answer later. It buys nothing here and costs a great deal.

It costs a delivery contract. A callback has to be registered, authenticated,
retried, de-duplicated and monitored, by us and by every caller. An
integration that wanted a result now would still poll for it.

It costs a second store. A queued job is a row that exists between the request
and the answer. That row is a copy of an identity document's contents, sitting
somewhere waiting. The synchronous design has no such row.

And it costs clarity. A failure inside a job is reported into a channel the
caller has to build. A failure inside a request is an HTTP status the caller
already handles.

What the caller gives up is the ability to fire a call and forget it. That is
recovered with a worker of their own, which is where the waiting belongs
anyway.

## Why the picture decides the result

Almost nothing a caller can configure changes what comes out. `expect_country`
carries a hint, and the rest of the options decide what is returned and kept
rather than what is read.

The photograph decides. A data page that fills the frame, is in focus, is lit
without glare and is not cropped through the zone reads correctly. One that is
none of those does not, and no option compensates.

That is worth knowing because it puts the improvement where it can be made. A
poor recognition rate is usually a capture problem, and it is fixed on the
device holding the camera rather than in the request body.

## What the service does not do

It does not make a second attempt on a bad picture. One call is one
recognition of one image, and a retry is a new call the caller decides to
make.

It does not read more than one document per call. A picture containing two
cards is a picture with one document located in it, and the other is ignored.

It does not put a person in the path. Nothing is reviewed, corrected or
re-typed between the engine and the response. A reading that disagrees with
the page therefore arrives as a disagreement rather than as a fix.

It does not keep the picture. That is the subject of [data retention and
privacy](/concepts/data-retention-and-privacy).
