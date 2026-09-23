// The one HTTP client `image_url` is fetched with, and why it is not `fetch`.
//
// The address rule in `image-guard.ts` resolves a name and refuses it when any
// answer is not a public internet address. `fetch` then resolves the same name a
// second time when it connects, and a name whose answer changes between those
// two moments — public when checked, private when connected — walks straight
// past the rule. Hosted, that second answer could be a service on the same
// private network as this server.
//
// So the check is made where the connection is made: this client hands Node's
// socket a lookup function that resolves the name, refuses the connection when
// any answer is not public, and otherwise connects to exactly the addresses it
// just checked. There is no second resolution to disagree with the first.
import { lookup as dnsLookup, type LookupAddress, type LookupAllOptions } from "node:dns";
import { request as httpsRequest } from "node:https";
import type { LookupFunction } from "node:net";
import { Readable } from "node:stream";
import { ExpectedFailure } from "./errors.ts";
import { refuseAddress } from "./image-guard.ts";
import { SERVER_NAME, SERVER_VERSION } from "./version.ts";

// How long fetching one image may take, connection and body together. A host
// that trickles bytes would otherwise hold the call — and, hosted, a request
// slot — for as long as it liked.
export const IMAGE_FETCH_TIMEOUT_MS = 30_000;

/** Resolves every address of a name, like `dns.lookup` with `all: true`. */
export type ResolveAll = (
  hostname: string,
  callback: (error: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void,
) => void;

const resolveAllDefault: ResolveAll = (hostname, callback) => {
  const options: LookupAllOptions = { all: true };
  dnsLookup(hostname, options, callback);
};

/**
 * A socket lookup that refuses to connect to anything but public internet
 * addresses. Every address the name resolves to is checked, and one non-public
 * answer refuses the connection, for the same reason `assertAllowedImageUrl`
 * refuses the URL.
 */
export function createGuardedLookup(resolveAll: ResolveAll = resolveAllDefault): LookupFunction {
  return ((
    hostname: string,
    options: { all?: boolean },
    callback: (...args: unknown[]) => void,
  ) => {
    resolveAll(hostname, (error, addresses) => {
      if (error) {
        callback(error);
        return;
      }
      if (addresses.length === 0) {
        callback(new ExpectedFailure(`image_url host "${hostname}" resolved to no addresses.`));
        return;
      }
      for (const entry of addresses) {
        const reason = refuseAddress(entry.address);
        if (reason !== null) {
          callback(
            new ExpectedFailure(
              `image_url host "${hostname}" resolves to ${entry.address}, which is ${reason}; only ` +
                "public internet addresses may be fetched. Pass the image as image_base64 instead.",
            ),
          );
          return;
        }
      }
      if (options?.all) {
        callback(null, addresses);
        return;
      }
      const first = addresses[0] as LookupAddress;
      callback(null, first.address, first.family);
    });
  }) as unknown as LookupFunction;
}

// Statuses whose response may not carry a body; `Response` refuses one for them.
const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304]);

/**
 * A `fetch`-shaped GET over https whose every connection goes through the
 * guarded lookup. Redirects are never followed here; the caller follows them by
 * hand and re-checks each hop.
 */
export function createPinnedFetch(
  options: { readonly lookup?: LookupFunction; readonly timeoutMs?: number } = {},
): typeof globalThis.fetch {
  const lookup = options.lookup ?? createGuardedLookup();
  const timeoutMs = options.timeoutMs ?? IMAGE_FETCH_TIMEOUT_MS;
  return ((input: string | URL) =>
    new Promise<Response>((resolve, reject) => {
      const url = new URL(String(input));
      if (url.protocol !== "https:") {
        reject(
          new ExpectedFailure(`image_url must be an https: URL; "${url.protocol}" is refused.`),
        );
        return;
      }
      const request = httpsRequest(
        url,
        {
          method: "GET",
          lookup,
          signal: AbortSignal.timeout(timeoutMs),
          headers: {
            accept: "image/*",
            "user-agent": `${SERVER_NAME}/${SERVER_VERSION}`,
          },
        },
        (incoming) => {
          const headers = new Headers();
          for (const [name, value] of Object.entries(incoming.headers)) {
            if (value === undefined) continue;
            for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item);
          }
          const status = incoming.statusCode ?? 502;
          const body = NULL_BODY_STATUSES.has(status)
            ? null
            : (Readable.toWeb(incoming) as ReadableStream<Uint8Array>);
          if (body === null) incoming.resume();
          resolve(
            new Response(body, { status, statusText: incoming.statusMessage ?? "", headers }),
          );
        },
      );
      request.on("error", reject);
      request.end();
    })) as typeof globalThis.fetch;
}
