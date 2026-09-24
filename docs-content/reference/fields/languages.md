---
title: Field languages and scripts
description: How a reading's language is reported, the three steps that resolve it, and the full table of assigned language identifiers.
type: reference
keyword: document field language identifier
nav: Languages and scripts
section: Reference
verified: 0.67.0
---

# Field languages and scripts

A document prints what it says in one script or in several. A Greek passport
prints the holder's surname in Greek and again in Latin; a Kazakh one does the
same in Cyrillic and Latin. Each of those is a separate **reading**,
and every reading carries the language it was made in.

This page states where that language appears, how it is resolved, and every
identifier it can be resolved from.

## Where the language appears

| Key | Carries |
|---|---|
| `fields[].language` | The language name, for example `Greek`; `null` for the neutral Latin reading |
| `fields[].id` | `name@lcid` – the numeric identifier is the part after the `@` |

The response carries the same fact twice, deliberately. `language` is the name
the identifier resolves to, which is what a reader renders. The identifier
itself stays in the entry's `id`, so two readings of one field stay
distinguishable however their names are spelled.

```json
[
  { "id": "surname@0", "name": "surname", "value": "PARADEIGMA", "language": null },
  { "id": "surname@1032", "name": "surname", "value": "ΠΑΡΑΔΕΙΓΜΑ", "language": "Greek" }
]
```

## The neutral identifier

`0` is not a language. It is the neutral, transliterated Latin reading – the
value the engine merged across sources, spelled in the alphabet the
machine-readable zone uses.

It is reported as `language: null`, because the absence of a language is not a
language of its own. Its entries still carry the `@0` suffix in their id, so a
neutral reading and a national-script reading of one field never collide.

## The three steps that resolve it

The recognition engine reports a language as one of these integers and nothing
else. Resolving it narrows in three steps, and nothing is guessed at any of
them.

1. **The identifier itself.** A value present in the table below resolves to
   its language, its full name and its IETF tag. `1032` is Greek.
2. **The primary language.** Failing that, the low 10 bits of the value name a
   primary language, and the rest select a sublanguage – a region or a script.
   A sublanguage nobody has assigned still belongs to its language, and saying
   so is true. 135 primary languages are tabulated for this step.
3. **A literal.** When even the family is unknown, the answer is
   `Language 0x0ABC`, naming the identifier in the hexadecimal the reference is
   written in.

Step 3 exists because the alternative is worse. An identifier the code did not
know used to reach a reader as the bare integer it arrived as. A bare integer
is not a language, and cannot be looked up.

| Step | Example input | `language` |
|---|---|---|
| Exact | `1032` | `Greek` |
| Family | An unassigned sublanguage of `0x0009` | `English` |
| Literal | An identifier in no family | `Language 0x0ABC` |

## What the language is not

- **Not the language of the document.** It is the language of one reading of
  one field. A single document commonly produces readings in two.
- **Not a translation.** A national-script reading is what the document prints,
  and the Latin reading is what the engine transliterated. Neither was
  translated from the other.
- **Not a locale to format with.** The identifier's IETF tag is published below
  as reference, but the value in a result is the language alone.

## Every assigned identifier

418 identifiers, from the published [MS-LCID] reference as it stood on
2026-09-17. The table is generated from the same module the service resolves a
reading through, so a row here is a row the running service uses.

**Identifier** is the integer an entry's `id` ends with. **Language** is what
that entry's `language` reports. **Full name** is the identifier's own name in
the reference, which names the region as well. **IETF tag** is the BCP 47 tag of
the identifier.

<!-- generated: lcid-table -->

## The value a language selects

The language on an entry decides which spelling its `value` carries.

| `language` | `value` |
|---|---|
| `null` | The merged Latin value: the transliterated spelling |
| A language name | The national-script spelling, as printed |

A reading whose national-script spelling matches its transliterated one – a
document printed only in Latin – produces one entry, not two.

## The identifiers a document most often carries

Nothing restricts which identifier appears on which document. The pairs below
are the ones a European or Central Asian travel document commonly produces
beside its Latin reading.

| Script on the page | Identifier | `language` |
|---|---|---|
| Greek | 1032 | `Greek` |
| Cyrillic, Bulgarian | 1026 | `Bulgarian` |
| Cyrillic, Kazakh | 1087 | `Kazakh` |
| Cyrillic, Serbian | 3098 | `Serbian (Cyrillic)` |
| Arabic, Egypt | 3073 | `Arabic` |
| Hebrew | 1037 | `Hebrew` |
| Georgian | 1079 | `Georgian` |
| Armenian | 1067 | `Armenian` |

A reading in any of them appears beside the neutral one, not instead of it. A
consumer that wants the Latin spelling reads the entry whose `language` is
`null`; one that wants the printed spelling reads the entry that names a
language.
