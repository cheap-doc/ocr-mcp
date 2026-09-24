---
title: Handle non-Latin scripts
description: "Read documents printed in Greek, Arabic or Han script: which values are transliterated, which are not, and how to get both spellings."
type: how-to
keyword: non latin script passport ocr
nav: Non-Latin scripts
section: Guides
---

# Handle non-Latin scripts

A document printed in a national script usually prints the holder's name twice:
once in that script, and once transliterated into Latin. This guide covers
getting both spellings and storing them without losing one.

Nothing has to be requested. Both readings are already in the response, and the
work is knowing which entry is which.

## Ask for nothing; read `fields`

Every reading the engine made appears as its own entry of `fields`. A name read
in two scripts is two entries, not one entry with two values.

Two keys tell them apart.

- `language` is `null` on the neutral, transliterated Latin reading, and names
  the language on the other.
- `id` is `name@lcid`, where the number is the language identifier the reading
  was made under. `0` is the neutral one.

```json
[
  {
    "id": "surname@0",
    "name": "surname",
    "label": "Surname",
    "category": "identity",
    "value": "PARADEIGMA",
    "language": null,
    "confidence": "high"
  },
  {
    "id": "surname@1032",
    "name": "surname",
    "label": "Surname",
    "category": "identity",
    "value": "ΠΑΡΑΔΕΙΓΜΑ",
    "language": "Greek",
    "confidence": "high"
  }
]
```

`name` repeats across the pair and `id` does not. Key your own records on `id`.
A list keyed on `name` collapses the two readings into one and keeps whichever
arrived last.

## Group the readings by field

Collect the entries under their `name`, then pick a spelling per reading. The
grouping is three lines in any language.

```bash runnable tab=curl
curl -X POST https://api.doc.cheap/v1/scans \
  -H "Authorization: Bearer sk_sandbox_public" \
  -H "Content-Type: application/json" \
  -d "{\"image\": \"$(base64 < document.jpg | tr -d '\n')\"}"
```

```javascript runnable tab=javascript
import { readFileSync } from "node:fs";

const image = readFileSync("document.jpg").toString("base64");

const response = await fetch("https://api.doc.cheap/v1/scans", {
  method: "POST",
  headers: {
    Authorization: "Bearer sk_sandbox_public",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ image }),
});

const scan = await response.json();
const byName = new Map();

for (const field of scan.fields) {
  const readings = byName.get(field.name) ?? [];
  readings.push({ value: field.value, language: field.language });
  byName.set(field.name, readings);
}

console.log(byName.get("surname"));
```

```python runnable tab=python
import base64
import json
import urllib.request
from collections import defaultdict

with open("document.jpg", "rb") as file:
    image = base64.b64encode(file.read()).decode()

request = urllib.request.Request(
    "https://api.doc.cheap/v1/scans",
    data=json.dumps({"image": image}).encode(),
    headers={
        "Authorization": "Bearer sk_sandbox_public",
        "Content-Type": "application/json",
    },
)

with urllib.request.urlopen(request) as response:
    status = response.status
    scan = json.load(response)

by_name = defaultdict(list)
for field in scan["fields"]:
    by_name[field["name"]].append(
        {"value": field["value"], "language": field["language"]}
    )

print(by_name["surname"])
```

## Know which value each entry carries

The two readings carry different spellings, and the rule is fixed.

| `language` | `value` |
|---|---|
| `null` | The merged Latin value, transliterated where the document was not printed in Latin |
| A language name | The spelling the document prints in that script |

`holder.given_names`, `holder.surname` and `holder.full_name` always carry the
Latin reading. They are the values to index, to compare against a watchlist and
to send to a system that speaks one alphabet.

Read the `fields` entry when you want what the document actually prints. A
receipt, a letter or a screen shown to the holder wants that one.

## Understand how a language is named

The engine reports a language as a number, and it is resolved in three steps
that narrow.

1. **The identifier itself**, looked up in a table of 418 assigned identifiers.
   `1032` resolves to `Greek`.
2. **The primary language family**, when the identifier is not assigned. A
   sublanguage nobody registered still belongs to its family, and there are 135
   of those, so the reading says `Arabic` rather than nothing.
3. **A literal naming the number**, in the hexadecimal the reference is written
   in, when even the family is unknown. A reading then says `Language 0x4C0A`.

Nothing is guessed at any step. A reading never claims a language that the
number does not support.

Branch on the presence of `language`, not on its exact string. The third step
exists so that an unrecognized identifier is still reported honestly, and a
`switch` over language names will meet one eventually.

## Label the readings for a person

Every entry carries a `label` and a `category` beside its value, so a table can
be rendered without a mapping of your own.

- `label` is the human name of the field, such as `Surname`. It is the same for
  both readings of a pair, because they are the same field.
- `category` is one of `identity`, `document`, `dates`, `address`, `visa` and
  `other`. Group by it and the report comes out in the order a person reads a
  document in.

Show the language beside a national-script reading. A reader looking at two
spellings of one name needs to be told which is which, and `language` is the
word to print.

## Know what the transliteration is

The Latin value is the transliteration the recognition made, or the spelling
the document itself printed in Latin.

It is not re-derived by us, and no second transliteration is applied on top.
What you get is one reading per language, as read.

A transliteration is not reversible. `PARADEIGMA` does not carry enough to
reconstruct `ΠΑΡΑΔΕΙΓΜΑ`, which is why both readings are published rather than
one.

`document.country` is the ISO 3166-1 alpha-3 code and is what to key on.
`document.country_name` is a name for a person to read, and a name is not a
stable identifier.

## Render right-to-left values correctly

A value in Arabic or Hebrew script is stored left to right and displayed right
to left. Mixed with a Latin document number, it renders wrongly unless the
direction is set.

Set the direction from the content rather than from the page. In HTML that is
`dir="auto"` on the element carrying the value.

Do not concatenate a right-to-left value with Latin text into one string for
display. Put each in its own element, and let each take its own direction.

## Expect the zone to stay Latin

The machine-readable zone is Latin by definition. Its alphabet is `A-Z`, `0-9`
and the filler `<`.

A national-script reading therefore has nothing in the zone to compare against.
Its entry is never the subject of a cross-zone mismatch. A disagreement between
the zone and the printed page is reported against the Latin reading.

A transliteration that differs from the zone is worth checking. The zone
follows the issuer's own transliteration rules, and a document can print one
spelling on the page and another in the zone.

## Store both spellings

Three habits keep a national-script value intact between our response and your
screen.

1. **Store in a Unicode column and serve UTF-8.** A value that survives our
   response and dies in your database is the usual failure.
2. **Keep the pair together.** Store the Latin reading and the national-script
   reading in two columns, keyed by the field's `id`. Re-deriving one from the
   other is a transliteration you would have to own.
3. **Sort on the Latin reading.** Alphabetical order across scripts is not a
   question with one answer, and the Latin reading is the one every consumer
   can order.

A name never contains a line break in any script. Every break in the source is
replaced by one space before the value reaches you, so a two-line printed name
arrives as one line.

## Next

- [Field languages and scripts](/reference/fields/languages) – the full table
  of identifiers and what each resolves to.
- [Field catalogue](/reference/fields) – every key, its label and its category.
- [Confidence and readings](/concepts/confidence-and-readings) – why two
  readings of one field may disagree.
