---
title: Field catalogue
description: Every field key the result publishes, with its label and category, and the rules that decide what appears in the list and what does not.
type: reference
keyword: document field catalogue
nav: Field catalogue
section: Reference
verified: 0.67.0
---

# Field catalogue

`fields` in [the response](/reference/response) is every field read off the
printed document, re-keyed to this API's own vocabulary. This page is that
vocabulary: the keys, their labels, their categories, and the rules that decide
what is in the list.

The table below is rendered from the code that resolves a field at run time. A
key on this page is a key the service publishes.

## The shape of an entry

| Key | Type | Meaning |
|---|---|---|
| `id` | string | Identity of this entry, unique across the array |
| `name` | string | The stable snake_case key catalogued below |
| `label` | string | The human label catalogued below |
| `category` | string | One of the six below |
| `value` | string or null | The value of this reading |
| `language` | string or null | The language this reading was made in |
| `confidence` | band | `high`, `medium` or `low` |

## The identity rule

**`name` repeats. `id` does not.**

A document that prints a field in two scripts is returned as one entry per
script, and every one of those entries carries the same `name`. A consumer that
keys a list on `name` collides, and a keyed user interface built on it breaks
outright.

`id` is `name@lcid`: the key, an `@`, and the numeric language identifier the
reading was made under. The same key and language may legitimately appear
twice, on a second page or in a re-read of one zone. A repeat therefore takes
an occurrence counter.

```json
[
  { "id": "given_names@0", "name": "given_names", "language": null },
  { "id": "given_names@1032", "name": "given_names", "language": "Greek" },
  { "id": "given_names@0#2", "name": "given_names", "language": null }
]
```

Neither `@` nor `#` can occur in a key. A curated key is snake_case, and a
passed-through key is slugged to `[a-z0-9_]`, so a suffixed id can never
collide with a plain one.

## The six categories

| Category | What belongs to it |
|---|---|
| `identity` | The holder: names, birth date, sex, nationality, personal numbers |
| `document` | The document itself: its number, series, class name, issuing authority and state |
| `dates` | Issue, expiry and the derived countdown |
| `address` | The address and its parts |
| `visa` | Visa class, type, validity and entries |
| `other` | Everything else, including every passed-through field |

## The catalogue

These keys are curated. Each has a stable name, a label and a category that do
not change with the document, the country or the engine's own naming.

<!-- generated: field-vocabulary -->

## The set is open

The catalogue is not the whole of what can appear. A field the vocabulary does
not name is still published, never dropped:

- the key is the engine's own field name, lower-cased with every run of
  non-alphanumeric characters collapsed to one underscore;
- the label is the engine's own name, unchanged;
- the category is `other`.

A passed-through key that would collide with a curated one takes an `x_`
prefix. A curated key therefore always means what this page says it means. A
field with no usable name at all falls back to `field_<n>`.

The practical consequence: match on the keys below where a key matters, and
render the rest generically from `label` and `category`. A list that assumes
the catalogue is exhaustive drops data the recognition produced.

## The two derived keys

Two entries are minted rather than read, and both come after the engine's own
order.

| Key | Category | What it is |
|---|---|---|
| `days_to_expire` | `dates` | The expiry countdown in days, as a string |
| `mrz` | `document` | The whole machine-readable zone as one entry |

`days_to_expire` is negative once the document has expired and `null` when the
document carries no date of expiry. It is **absent entirely** when the scan
produced no validity data at all: a countdown derived from nothing is not a
countdown. Its confidence is that of the expiry-date reading it came from.

`mrz` carries the zone's whole text as its value, with `language: null`. The
zone is defined over a restricted Latin alphabet and has no language of its
own. The formats are on [the MRZ reference](/reference/mrz).

## What is left out of the list

### Fields that belong to the machine-readable zone

Three kinds of entry are the zone's own plumbing rather than facts about the
holder: its raw lines, its type designation, its check digits. Each is mapped
so the zone's verdict can be derived from it, then left out of the published
list. A field the engine only ever read out of that zone is left out for the
same reason: the printed page already states it.

What the zone says is published as one verdict, `mrz`, and as its own entry in
`fields`.

### Two field types withheld on purpose

Two of the engine's field types are withheld from every response. Each is a
decision, and each has a reason a reader can check.

| Withheld | Why |
|---|---|
| `0`, the document class code | The one-letter class designation, `P` on a passport. `document.kind` publishes the same fact in words, so the letter would make a reader carry a code table to learn what the result already told them |
| `364`, the remainder term | A countdown to expiry in whole **months**, derived by the engine from the expiry date it already reports. Among a row of dates, a bare number reads as days – wrong by a factor of about thirty, with nothing to signal it. The same fact is published as `days_to_expire`, in the unit its label promises |

Neither exclusion loses a fact. Both replace a reading that would be read
wrongly with one that says the same thing unambiguously.

## Name normalization

A holder's name never contains a line break.

A document that runs the holder's names across two printed lines makes the
engine report a value with a break inside it. A name is a name whether or not
the page ran out of room. Consumers put these values straight into a field, a
label or a CSV cell, where a break is a broken row.

The rule applies to `surname`, `given_names` and `full_name`, in every script:

- every line break becomes exactly one space, including the two Unicode line
  separators a national-script reading can carry;
- runs of spaces collapse to one;
- the ends are trimmed;
- a value with nothing left comes back `null`, because an empty string is not a
  name.

A scan **stored before this rule existed is repaired when it is read back**.
The same normalization runs over a field list replayed out of storage, so
`GET /v1/scans/{id}` never returns a name the current rule would not have
produced.

Other values are not reflowed. Only the three name fields are, because only
they are printed as a person's name across a line break.

## What a reading's value is

`value` is the value of **this** reading, not of the field as a whole.

| `language` | `value` carries |
|---|---|
| `null` | The neutral reading: the transliterated Latin value the engine merged across sources |
| A language name | The national-script spelling, as the document prints it |

A document that prints the surname in two scripts yields two entries. They
share a `name` and carry two different values, one Latin and one not. Neither
is a translation of the other. Both are readings of the same printed page.

A value the engine produced nothing for is `null` rather than an empty string.
An entry with a null value is still published, because the absence of a value
is itself a fact about the document.

## Which keys a document carries

No document carries every key, and nothing in the contract promises a
particular key for a particular document. The recognition reports what it read.
The groupings below are what the common documents print, not a guarantee.

| Document | Keys it usually carries |
|---|---|
| Passport | `surname`, `given_names`, `document_number`, `passport_number`, `birth_date`, `sex`, `nationality`, `issuing_state_name`, `expiry_date`, `issue_date`, `birth_place`, `authority`, `mrz` |
| ID card | The same identity and document keys, plus `personal_number`, `address` and its parts, and `document_series` where the country prints one |
| Driving licence | `surname`, `given_names`, `birth_date`, `document_number`, `dl_class` or `permit_class`, `issue_date`, `expiry_date`, `address`, `authority` |
| Visa | `visa_id`, `visa_type`, `visa_class`, `visa_valid_from`, `visa_valid_until`, `visa_duration_of_stay`, `visa_number_of_entries` |

A key that a document does not print is absent from `fields` altogether. It is
not published with a null value: the array carries readings, and a reading that
was never made is not one.

The safe shape for a consumer is a lookup over the array rather than a
positional read. Find the entry whose `name` matches; its absence means the
document did not print it.

## Where a key appears twice

A value legitimately appears twice in one response: once in the curated block
(`holder`, `document`) and once in `fields`. They are not copies of one another.

The curated block carries the merged best reading in a fixed set of keys.
`fields` carries one entry per language, so a national-script spelling is
visible beside the transliterated one.

The language a reading was made under is on
[field languages and scripts](/reference/fields/languages).
