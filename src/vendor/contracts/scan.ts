// Vendored from the private monorepo's @doc-cheap/contracts (src/scan.ts).
// Copied by scripts/sync-mcp-mirror.mjs because that package is not published;
// edit it there, not here.

import { z } from "zod";
import { ScanId, ScanStatus, ScanTiming } from "./reading.ts";

// The recognition result. There is one response shape and every scan answers
// in it: no negotiation, no per-call selection, no second body to keep working.
// `meta.schema_version` is the literal "1.0" and the only thing that can move
// it is a new major, which would be a new path rather than a second shape here.
//
// The shape answers the question a caller actually has — "what does this
// document say, and can I trust it?" — rather than handing over the engine's
// working notes. So the body is eight stable groups; every extracted field is
// re-keyed to our own vocabulary and carries one value, one language and one
// confidence band; and the machine-readable zone is a verdict with a sentence,
// not a pile of raw lines, check digits and per-zone comparisons for the caller
// to interpret. Every key is present; an absent scalar is null and an absent
// collection is empty, never a missing key.

const CountryCode = z
  .string()
  .regex(/^[A-Z]{3}$/)
  .meta({ description: "ISO 3166-1 alpha-3 country code.", example: "GRC" });

const IsoDate = z.iso.date().meta({ description: "Calendar date, ISO-8601 (`YYYY-MM-DD`)." });
const IsoDateTime = z.iso
  .datetime()
  .meta({ description: "Timestamp, ISO-8601 in UTC (`YYYY-MM-DDTHH:MM:SSZ`)." });

const DataImageUrl = z
  .string()
  .regex(/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/)
  .meta({ description: "Image as a `data:` URL with base64 payload." });

// Confidence as a band, never a number. A recognition probability is not a
// calibrated percentage, and a caller who sees `97` builds a threshold on it
// that means nothing; three bands say what the number can honestly support.
export const ConfidenceBand = z.enum(["low", "medium", "high"]).meta({
  id: "ConfidenceBand",
  description:
    "How strongly the recognition backs this value: `high`, `medium` or `low`. " +
    "An unknown or missing probability reads as `low`.",
});
export type ConfidenceBand = z.infer<typeof ConfidenceBand>;

export const FieldCategory = z
  .enum(["identity", "document", "dates", "address", "visa", "other"])
  .meta({
    id: "FieldCategory",
    description: "Which group of the report a field belongs to.",
  });
export type FieldCategory = z.infer<typeof FieldCategory>;

// One extracted field, re-keyed to our vocabulary. Any engine field the
// vocabulary does not map still appears here, slugged — the field set is open,
// never a fixed list. Fields that exist only inside the machine-readable zone
// are not listed: the zone's verdict is `mrz`.
export const ScanField = z
  .object({
    id: z
      .string()
      .min(1)
      .meta({
        description:
          "Identity of this entry, unique across `fields`: the key and the language " +
          "identifier the value was read as, plus an occurrence counter when the same " +
          "pair is reported twice. `name` is the semantic key and repeats — a " +
          "document that carries a field in two scripts yields one entry per language — " +
          "so use `id`, not `name`, to address or key a single entry.",
        example: "surname@1032",
      }),
    name: z.string().min(1).meta({ description: "Our stable snake_case key.", example: "surname" }),
    label: z.string().min(1).meta({ description: "Our human label.", example: "Surname" }),
    category: FieldCategory,
    value: z
      .string()
      .nullable()
      .meta({
        description:
          "The value of this reading: the national-script spelling when `language` names " +
          "one, the transliterated Latin value otherwise. Null when the field is empty.",
      }),
    language: z
      .string()
      .nullable()
      .meta({
        description:
          "The language this reading was made in, e.g. `Greek`; null for the neutral, " +
          "transliterated Latin reading.",
        example: "Greek",
      }),
    confidence: ConfidenceBand,
  })
  .meta({ id: "ScanField" });
export type ScanField = z.infer<typeof ScanField>;

export const ScanMeta = z
  .object({
    // The revision of this body. A removal or a rename moves the major
    // segment, so a consumer that pins the value fails loudly instead of
    // quietly reading a key that no longer means what it did.
    schema_version: z.literal("1.0"),
    id: ScanId,
    status: ScanStatus,
    billed: z.boolean().meta({ description: "Whether this scan was charged to the balance." }),
    confidence: ConfidenceBand,
    timing: ScanTiming.nullable(),
    created_at: IsoDateTime,
    reference: z
      .string()
      .nullable()
      .meta({ description: "The request's `reference`, echoed back." }),
  })
  .meta({ id: "ScanMeta" });
export type ScanMeta = z.infer<typeof ScanMeta>;

export const ScanDocument = z
  .object({
    kind: z.string().min(1).meta({ description: "Document type, e.g. `passport`." }),
    country: CountryCode.nullable(),
    country_name: z.string().nullable().meta({ example: "Greece" }),
    issuing_state: CountryCode.nullable(),
    type_name: z.string().nullable().meta({ example: "Greece - Passport" }),
    type_confidence: ConfidenceBand.meta({
      description: "How strongly the document-type match is backed.",
    }),
    is_expired: z.boolean().nullable(),
    days_remaining: z.number().int().nullable().meta({
      description: "Days until expiry at the time of the scan; negative once expired.",
    }),
  })
  .meta({ id: "ScanDocument" });
export type ScanDocument = z.infer<typeof ScanDocument>;

export const ScanHolder = z
  .object({
    given_names: z.string().nullable(),
    surname: z.string().nullable(),
    full_name: z.string().nullable(),
    birth_date: IsoDate.nullable(),
    sex: z.enum(["M", "F", "X"]).nullable(),
    nationality: CountryCode.nullable(),
  })
  .meta({ id: "ScanHolder" });
export type ScanHolder = z.infer<typeof ScanHolder>;

export const MrzStatus = z.enum(["passed", "failed", "absent"]).meta({
  id: "MrzStatus",
  description:
    "Verdict on the machine-readable zone: `passed` (present, every check digit valid and " +
    "nothing contradicting the printed page), `failed` (present but something did not check " +
    "out) or `absent` (the document carries none).",
});
export type MrzStatus = z.infer<typeof MrzStatus>;

// The machine-readable zone as a verdict. The raw lines, the per-digit results
// and the zone-by-zone comparisons are the working material behind it; what a
// caller acts on is whether the zone agrees with the document and, when it does
// not, what disagreed.
export const ScanMrz = z
  .object({
    status: MrzStatus,
    reason: z.string().nullable().meta({
      description:
        "One plain sentence naming what did not check out, for `failed`; null otherwise.",
      example: "Check digit failed for: document number, date of birth",
    }),
    // The lines themselves, alongside the verdict rather than instead of it.
    // They are the only part of the response a caller can independently
    // re-verify, and nothing else here can be turned back into them.
    lines: z
      .array(z.string())
      .nullable()
      .meta({
        description:
          "The zone's lines in order, exactly as read — two for a TD3 passport, three " +
          "for a TD1 card. The zone's alphabet is `A-Z`, `0-9` and the filler `<`, so " +
          "a line carries no whitespace. Null when the document carries none.",
      }),
    text: z
      .string()
      .nullable()
      .meta({
        description:
          "The same lines run together with nothing between them: one unbroken string, " +
          "with no newlines and no spaces. Null when there are none.",
      }),
  })
  .meta({ id: "ScanMrz" });
export type ScanMrz = z.infer<typeof ScanMrz>;

export const ScanImages = z
  .object({
    document_crop: DataImageUrl.nullable().meta({
      description:
        "The document itself, cropped out of the uploaded picture and deskewed — the " +
        "front side of a card, the data page of a booklet.",
    }),
    rear: DataImageUrl.nullable(),
    main_photo: DataImageUrl.nullable().meta({
      description: "The holder's photograph as printed on the document.",
    }),
    signature: DataImageUrl.nullable(),
    watermark_face: DataImageUrl.nullable().meta({
      description:
        "The faint second copy of the holder's face printed into the page as a security " +
        "feature — a different image from `main_photo`, and the one a verifier compares " +
        "against it. Null when the document carries none.",
    }),
    barcode: DataImageUrl.nullable(),
    chip: DataImageUrl.nullable(),
  })
  .meta({
    id: "ScanImages",
    description:
      "Image crops, returned in the recognition response only. Each is scaled down by " +
      "height, proportionally and never upwards, to at most 250 px for `document_crop` " +
      "and 100 px for every other crop, then re-encoded with every metadata block " +
      "dropped.",
  });
export type ScanImages = z.infer<typeof ScanImages>;

export const CheckResult = z.enum(["pass", "warn", "fail"]).meta({
  id: "CheckResult",
  description: "Outcome of a single check.",
});
export type CheckResult = z.infer<typeof CheckResult>;

export const ScanCheck = z
  .object({
    name: z.string().min(1),
    label: z.string().min(1),
    result: CheckResult,
    detail: z.string().nullable(),
  })
  .meta({ id: "ScanCheck" });
export type ScanCheck = z.infer<typeof ScanCheck>;

// Image quality as one verdict and nothing else.
//
// The per-check list this replaced named checks by the engine's own check-type
// integers, which have no verified name map: a reader was handed `check_7:
// fail` and could act on none of it. `not_checked` is a distinct answer from
// `pass` on purpose — a stored result read back carries no engine output, and
// reporting that as a pass would vouch for a picture this process never saw.
export const ScanQuality = z
  .object({
    overall: z.enum(["not_checked", "pass", "warn", "fail"]).meta({
      description:
        "Whether the uploaded picture was good enough to recognize from. " +
        "`not_checked` when nothing measured it — a scan read back from storage, " +
        "which keeps no engine output.",
    }),
  })
  .meta({ id: "ScanQuality" });
export type ScanQuality = z.infer<typeof ScanQuality>;

export const ScanAuthenticity = z
  .object({
    overall: z.enum(["not_checked", "pass", "warn", "fail"]).meta({
      description:
        "`not_checked` under the recognition-only scenario; populated by authenticity verification later.",
    }),
    checks: z.array(ScanCheck),
  })
  .meta({ id: "ScanAuthenticity" });
export type ScanAuthenticity = z.infer<typeof ScanAuthenticity>;

export const Scan = z
  .object({
    meta: ScanMeta,
    document: ScanDocument.nullable(),
    holder: ScanHolder.nullable(),
    fields: z.array(ScanField).meta({
      description:
        "Every field the engine extracted off the printed document, re-keyed to our " +
        "vocabulary — the open set. Always present; empty when nothing was extracted. A " +
        "field read in more than one language appears once per language, so `name` repeats " +
        "and only `id` is unique.",
    }),
    mrz: ScanMrz,
    images: ScanImages,
    quality: ScanQuality,
    authenticity: ScanAuthenticity,
  })
  .meta({ id: "Scan" });
export type Scan = z.infer<typeof Scan>;
