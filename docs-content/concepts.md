---
title: Concepts
description: "Why the API behaves as it does: what recognition actually does, what confidence means, what is billed, what is kept, and what fails."
type: hub
keyword: how document recognition works
nav: Overview
section: Concepts
---

# Concepts

This section explains the reasoning behind the contract. It answers "why does
it work that way." That is a different question from "what does this field
mean," and it gets a different kind of page.

Nothing here is a set of steps. The tasks are in the [guides](/guides), and the
exact contract is in the [reference](/reference). These pages are what to read
when one of those surprised you.

Each page argues for one decision. Why a credit is one US cent and is reserved
before the engine runs. Why confidence is three bands and not a number. Why the
uploaded image is never written down.

## The recognition itself

- [How recognition works](/concepts/how-recognition-works) – what happens
  between the bytes arriving and the fields coming back, and where our own
  timing boundaries fall.
- [Confidence and readings](/concepts/confidence-and-readings) – why
  confidence is a band, and why one field can be read several ways at once.
- [The MRZ and the visual zone](/concepts/mrz-and-the-visual-zone) – why a
  document says the same thing twice, and which half to believe.

## Money

- [What a billed scan is](/concepts/what-a-billed-scan-is) – the rule that
  decides whether a call costs a credit, and the outcomes it produces.
- [Crypto deposits](/concepts/crypto-deposits) – why an address is permanent,
  why a locked price has bounds, and why a large deposit waits longer.

## Your data and your identity

- [Data retention and privacy](/concepts/data-retention-and-privacy) – what is
  kept, what is never written down, and what deletion removes.
- [API keys and sessions](/concepts/api-keys-and-sessions) – the three kinds of
  key, the dashboard session beside them, and why the two are kept apart.

## When it does not work

- [Reliability](/concepts/reliability) – what is measured, what a headline
  means, and what happens to your credit when a dependency is away.

Each page is bounded on purpose. An explanation that grows a field table has
become a reference page, and it belongs in the other section.
