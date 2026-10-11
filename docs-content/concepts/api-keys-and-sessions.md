---
title: API keys and sessions
description: The two ways a caller is identified – an API key and a dashboard session – what each may do, and why they are kept apart.
type: explanation
keyword: api key versus session auth
nav: Keys and sessions
section: Concepts
---

# API keys and sessions

Two different things call this service. A program sends an API key; a person
signs in to the dashboard and gets a session. They are not two spellings of
one mechanism, and the boundary between them is deliberate.

Within the first of the two there are three kinds of key, and the differences
between those are what most of this page is about.

## Why keys and sessions are separate

An API key identifies a **program**. It is a long-lived bearer credential,
configured once into a deployment. It may recognize documents and read that
account's own results.

A session identifies a **person at a browser**. It is short-lived and bound to
a sign-in. The dashboard uses it to manage the account: issuing and revoking
keys, choosing a retention window, taking a top-up quote.

The two sets of powers do not overlap, and that is the point. A key that could
issue keys would turn one leaked credential into an account nobody can take
back. The attacker mints a second key before the first is revoked. Keeping key
management behind a sign-in means that recovering from a leaked key is always
possible, using something the leak did not contain.

It works in the other direction too. A browser session is exposed to a class
of risk a server-side key is not. It is therefore not the credential that
spends money on recognition at scale.

The account-management routes are therefore outside the versioned API surface
and are not part of the published contract. They are the dashboard's, and the
dashboard is their client.

## What a key is made of

A key looks like `sk_live_9c41ba2e…`: a kind marker, then a body of random
characters carrying 128 bits of entropy.

The kind is **in the prefix** rather than looked up anywhere. A credential
beginning `sk_sandbox_` is never charged, and that is decided by reading those
characters. It cannot drift from a row in a table, because there is no row in
a table saying otherwise.

Only a hash of the key is stored. The service can tell whether a presented key
is one it issued, and it cannot produce the key itself. A key is therefore
shown in full exactly once, at creation. Afterwards it is known by its prefix:
the marker plus the first 8 characters of the body. That is enough to
recognize a key in a list and not enough to use it.

A key can be given an end of validity, and a key past it is refused like an
unknown one. A revoked key is refused the same way. A caller cannot tell an
unknown key from a withdrawn one, which is the answer that reveals least.

## The public sandbox key

`sk_sandbox_public` is printed in this documentation, on the home page and in
every runnable example. Publishing a credential sounds like a mistake, and
here it is the design.

It belongs to **no account**. It has no balance to spend, no history to read
and no settings to change. `GET /v1/usage` answers it with a null balance and
zero counters rather than somebody's figures, and it reads no stored scan.

What it can do is recognize. A document sent on the public key reaches the
real engine and comes back really read. The alternative is a fixed answer for
every image, which makes a product look broken to the person trying it on
their own passport.

Three walls bound that, and all three are keyed to the client rather than to
the key. Everybody shares the credential, so counting per key would count the
world as one caller. The rate bucket is per address. The lifetime free
allowance is per client. And the same image resubmitted past a small threshold
is refused, so one picture cannot be replayed to consume the demo.

Those walls fail **closed**. When the store holding the counters cannot be
reached, the anonymous path answers a retryable 503 rather than letting
unmetered free recognition through. A registered key is unaffected; it is
metered by its own balance.

Every recognition made on the public key **is stored**, for the service's own
log. The scan is written down with no account and with the address it came
from in place of one. The record keeps the result, the `billed` verdict and a
non-readable micro thumbnail of the image. It is kept for **one year**, the
default history window. `retain_hours` is not applied on this key, so `0` does
not turn the record off. The key itself cannot read, list or delete what it
stored, and the retention sweep deletes the record when its year is up. Send
the public key a test image, never a real document.

## An account's own sandbox key

The second kind is a sandbox key an account issues for itself, and it does
something different from the public one.

It is answered from a **fixed synthetic specimen** and never reaches the
Engine at all. Every call returns the same invented holder, the same document,
the same zone. Nothing about the image that was sent affects the answer beyond
being validated and counted.

That is what makes it the integration credential. A client built against it
can assert on exact values in a test, because the values do not move. It
spends no recognition capacity and is never charged. No real identity document
is read on the credential an account is most likely to hand around.

It reads no stored scan either. `GET /v1/scans/{id}` answers 404 for every
sandbox key, including the account's own results. An account's history is a
store of identity data, and this is the low-trust key.

Its usage figures, on the other hand, are the account's real ones. Usage is an
account-level question, and the answer does not change with the key that asked
it.

## The live key

The third kind is the one that does the work. It reaches the engine and draws
credits: the account's 100 free credits every month first, then its paid
credits. Its results are stored under the account's retention window, and it
is the only kind that can read them back.

Everything a live key can do is a reason to treat it as a secret. It spends
money, and it opens a history of identity documents. An account may hold
several, which is what makes it possible to replace one without a gap. [Rotate
API keys](/guides/rotate-api-keys) is that procedure.

## Client tokens: a key's stand-in for one upload

A browser or a mobile app cannot keep a secret. Anything shipped inside it can
be read by whoever installs it, so a key placed there is a key given away.

A client token solves that. Your server calls `POST /v1/client-tokens` with
its key and hands the app the token it gets back. The app sends the scan
straight to this API with the token, and the key never leaves the server.

A token is deliberately small:

- It can call `POST /v1/scans` and nothing else. Any other endpoint answers
  [`client_token_not_allowed`](/errors/client_token_not_allowed).
- It lives 300 seconds unless asked otherwise, anywhere from 10 to 900.
- It allows one scan request unless asked otherwise, at most 10. Every request
  made with it spends a use, whatever the outcome.
- Past its expiry it answers [`client_token_expired`](/errors/client_token_expired);
  with no uses left, [`client_token_used_up`](/errors/client_token_used_up).

Everywhere else it behaves exactly as the key that issued it. Its scans are
billed, stored and rate-limited as that key's own. A sandbox key issues
sandbox tokens, and the public sandbox key issues tokens that keep every wall
of the public key. Revoking or deleting the key ends every token it issued at
once.

A token is returned once, and only a hash of it is kept, as with a key.
[Read a passport in an Ionic app](/guides/read-a-passport-in-an-ionic-app)
shows the whole exchange.

## Why the three exist rather than one

A single key with a test-mode flag is the obvious alternative. It fails at the
first question a developer asks: how do I try this before I sign up.

The three kinds answer three different moments. The public key is for the
minute before an account exists, where the only thing that matters is that a
real document reads correctly. The account's sandbox key is for the weeks of
building against a stable answer. The live key is for production.

Each of them is bounded by what its moment justifies. The public key
recognizes for real and is walled by client. The sandbox key is free and reads
nothing. The live key does everything and is the one worth protecting. A
caller who knows which of the three is in a deployment can predict the whole
of its behavior. That is what a credential ought to make possible.
