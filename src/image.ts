import { lookup as dnsLookup } from "node:dns/promises";
import { readFile, realpath } from "node:fs/promises";
// Every throw below is a message for the caller to act on — a missing source, a
// body over the ceiling, a server that answered badly — so all of them carry the
// expected-failure marker and none of them becomes a report.
import { ExpectedFailure } from "./errors.ts";
import {
  type AddressLookup,
  assertAllowedImageUrl,
  IMAGE_ROOT_ENV,
  MAX_IMAGE_BYTES,
  MAX_REDIRECTS,
  resolveImagePathWithinRoot,
} from "./image-guard.ts";

export interface ImageInput {
  readonly image_base64?: string | undefined;
  readonly image_path?: string | undefined;
  readonly image_url?: string | undefined;
}

/** The I/O this module performs, injectable so the guards can be tested dry. */
export interface ImageFetchDeps {
  readonly lookup: AddressLookup;
  readonly fetchImpl: typeof globalThis.fetch;
}

const defaultDeps: ImageFetchDeps = {
  lookup: (hostname) => dnsLookup(hostname, { all: true }),
  fetchImpl: (...args) => globalThis.fetch(...args),
};

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

// Unwraps a `data:` URL to its raw base64 payload; leaves plain base64 as is.
function stripDataUrl(value: string): string {
  const match = /^data:[^;]+;base64,(.*)$/s.exec(value.trim());
  return (match?.[1] ?? value).trim();
}

// Reads the body while counting bytes. `content-length` is a claim by the
// remote server, so it is checked when present but never trusted: the stream is
// cut off at the same ceiling whether the header was absent, wrong or lying.
async function readCappedBody(response: Response): Promise<Buffer> {
  const tooLarge = new ExpectedFailure(
    `image_url body is larger than the ${MAX_IMAGE_BYTES} byte limit this server accepts.`,
  );
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) throw tooLarge;

  const body = response.body;
  if (body === null) return Buffer.alloc(0);
  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw tooLarge;
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

/**
 * Fetches an image over https from a public address.
 *
 * Redirects are followed by hand rather than by `fetch`, because the default
 * automatic follow would let a URL that passes the check hand off to one that
 * never could — a public host answering `302 Location: http://169.254.169.254/`
 * is the whole attack. Every hop goes through the same scheme and address
 * check as the original URL.
 */
export async function fetchImageBytes(
  rawUrl: string,
  deps: ImageFetchDeps = defaultDeps,
): Promise<Buffer> {
  let target = await assertAllowedImageUrl(rawUrl, deps.lookup);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await deps.fetchImpl(target, { redirect: "manual" });
    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get("location");
      if (location === null) {
        throw new ExpectedFailure(
          `image_url answered HTTP ${response.status} with no Location header to follow.`,
        );
      }
      target = await assertAllowedImageUrl(new URL(location, target).href, deps.lookup);
      continue;
    }
    if (!response.ok) {
      throw new ExpectedFailure(
        `Could not fetch image_url (HTTP ${response.status} ${response.statusText}).`,
      );
    }
    return readCappedBody(response);
  }
  throw new ExpectedFailure(`image_url redirected more than ${MAX_REDIRECTS} times; giving up.`);
}

/**
 * Turns whichever image field the caller gave into base64. Exactly one source
 * is used, in priority order; a missing source is a clear tool error.
 *
 * `image_path` and `image_url` are chosen by the model, not by the person at
 * the keyboard, and this process runs with that person's privileges and network
 * reach — so both are narrowed to what an image source legitimately needs: a
 * file under one configured directory, or an https address on the public
 * internet. See `./image-guard.ts` for the rules and why they are drawn there.
 */
export async function resolveImage(input: ImageInput): Promise<string> {
  if (input.image_base64) return stripDataUrl(input.image_base64);
  if (input.image_path) {
    const path = await resolveImagePathWithinRoot(
      input.image_path,
      process.env[IMAGE_ROOT_ENV],
      realpath,
    );
    const bytes = await readFile(path);
    return bytes.toString("base64");
  }
  if (input.image_url) {
    const bytes = await fetchImageBytes(input.image_url);
    return bytes.toString("base64");
  }
  throw new ExpectedFailure("Provide the image as one of image_base64, image_path or image_url.");
}
