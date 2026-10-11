---
title: Read a passport in an Ionic app
description: Take a passport photo with the Capacitor Camera plugin, send it through your own small server, and show the holder and document fields in the app.
type: how-to
keyword: ionic capacitor passport scanner
nav: Ionic and Capacitor
section: Guides
---

# Read a passport in an Ionic app

An Ionic app can read a passport in three steps. The phone takes the photo with
the Capacitor Camera plugin. It sends the photo to a small server of your own.
That server calls `POST /v1/scans` with your key and hands the fields back to
the app.

The server in the middle is not optional. The next section says why. Steps 1
to 3 send the photo through it. [The second option](#option-2-the-app-sends-the-photo-with-a-client-token),
further down, keeps the server only for issuing a short-lived token, and the
app sends the photo to this API directly.

## Keep the key off the phone

Never put your API key in the app. Everything inside an app package can be
read. The JavaScript bundle of an Ionic app is a folder of plain files.
Pulling a string out of an APK or an IPA takes minutes with free tools. Once
someone has your key, every recognition they run is charged to your account,
and you cannot tell their calls from yours.

The key lives only on a server you control, read from an environment
variable. The app talks to that server, and the server talks to us. The same
rule holds for a web build of the same app, where the key would sit in a file
any visitor downloads.

The examples use the public sandbox key `sk_sandbox_public`, which is safe to
print because it is shared on purpose. It allows 10 free recognitions per
client and 10 requests per hour. For your own key, with 100 free recognitions
every month, see [from the sandbox to a live key](/start/from-sandbox-to-live).

## 1. The server

This is a complete Express server with one route. Any backend works the same
way: a serverless function, a route in a server you already run, another
language. It needs Node 18 or later, for the built-in `fetch`.

```bash
npm install express cors
DOC_CHEAP_KEY=sk_sandbox_public node server.mjs
```

```js
// server.mjs
import express from "express";
import cors from "cors";

const DOC_CHEAP_KEY = process.env.DOC_CHEAP_KEY;
if (!DOC_CHEAP_KEY) {
  throw new Error("Set DOC_CHEAP_KEY before starting the server");
}

const app = express();

// The origins a Capacitor app sends from: iOS, Android, and `ionic serve`.
app.use(
  cors({
    origin: ["capacitor://localhost", "https://localhost", "http://localhost:8100"],
  }),
);
app.use(express.json({ limit: "10mb" }));

app.post("/scan", async (req, res) => {
  // Check here that the request comes from a signed-in user of your app.
  // Without it, anyone who finds this address spends your recognitions.

  const image = req.body?.image;
  if (typeof image !== "string" || image.length === 0) {
    res.status(400).json({ error: "Send the photo as base64 in `image`." });
    return;
  }

  const upstream = await fetch("https://api.doc.cheap/v1/scans", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DOC_CHEAP_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ image }),
  });
  const scan = await upstream.json();

  if (!upstream.ok) {
    res.status(upstream.status).json({ error: scan.error.code, message: scan.error.message });
    return;
  }

  // Send the app only what it shows.
  res.json({
    status: scan.meta.status,
    document: scan.document,
    holder: scan.holder,
    mrz: scan.mrz.status,
  });
});

app.listen(3000, () => console.log("Listening on http://localhost:3000"));
```

Three things in it are deliberate.

- **It checks who is calling.** The comment marks where your own sign-in check
  goes. A route that forwards anyone's photo with your key is the same leak as a
  key in the app, one step removed.
- **It returns a short answer.** The full [response](/reference/response) also
  carries every printed field, the image crops and the quality checks. The app
  above needs four things, so the server sends four.
- **It passes errors on with their code.** A non-2xx answer from the API always
  has the same `error` envelope, and its `code` is what to branch on. What to do
  with each code is in [handle errors](/guides/handle-errors).

Try it from your computer before the phone is involved. `photo.jpg` is any
picture.

```bash
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -d "{\"image\": \"$(base64 < photo.jpg | tr -d '\n')\"}"
```

A picture without a document answers `200` with `"status": "no_document_found"`
or `"unsupported_document"`. That is a finished scan, not an error, and it
costs nothing.

## 2. Take the photo in the app

Install the Camera plugin in your Ionic project. On iOS, the app's
`Info.plist` also needs `NSCameraUsageDescription`, the sentence the system
shows when it asks for camera access.

```bash
npm install @capacitor/camera
npx cap sync
```

The function below takes the photo, sends it to your server and returns what
the server answered. It does not depend on Angular, React or Vue, so you can
call it from any of them.

```ts
// src/scan.ts
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

// Your own server from step 1. On a phone, `localhost` is the phone itself:
// use your computer's address on the local network while you develop.
const BACKEND_URL = "http://192.168.1.20:3000";

export interface PassportReading {
  status: "recognized" | "no_document_found" | "unreadable" | "unsupported_document" | "rejected";
  document: {
    kind: string | null;
    country: string | null;
    type_name: string | null;
    number: string | null;
    expiry_date: string | null;
    is_expired: boolean | null;
  } | null;
  holder: {
    given_names: string | null;
    surname: string | null;
    full_name: string | null;
    birth_date: string | null;
    nationality: string | null;
  } | null;
  mrz: "passed" | "failed" | "absent";
}

export async function readPassport(): Promise<PassportReading> {
  const photo = await Camera.getPhoto({
    source: CameraSource.Camera,
    resultType: CameraResultType.Base64,
    quality: 85,
    width: 1600,
    correctOrientation: true,
  });

  const response = await fetch(`${BACKEND_URL}/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: photo.base64String }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.message ?? body.error);
  }
  return body as PassportReading;
}
```

The camera options matter.

- `CameraResultType.Base64` gives the bare base64 text the API expects.
  `DataUrl` would add a `data:image/jpeg;base64,` prefix, which the API
  refuses with [`validation_failed`](/errors/validation_failed).
- `width: 1600` and `quality: 85` match the advice in
  [recognize a passport](/guides/recognize-a-passport): print stays sharp, and
  the upload stays in the hundreds of kilobytes instead of several megabytes.
- `correctOrientation: true` turns a photo taken in portrait the right way up
  before it is sent.

Version 8.1 of the Camera plugin marks `getPhoto` as deprecated in favour of
`takePhoto`. It still works in every current version, and it returns the full
photo as base64 in one call.

During development, the phone and the computer must be on the same network, and
Android refuses plain `http` addresses unless you allow them. In production,
put the server behind `https` and use its real address.

## 3. Show the fields

Every key of the answer is always present, and a value that was not read is
`null`. The app checks `status` once, then reads the fields with one null
check on `document` and `holder`.

```ts
// src/show.ts
import { readPassport } from "./scan";

export async function onScanClick(): Promise<string> {
  const reading = await readPassport();

  if (reading.status !== "recognized") {
    return "No passport found in the photo. Try again with the whole page in the frame.";
  }

  const { document, holder } = reading;
  return [
    `Name: ${holder?.full_name ?? "not read"}`,
    `Passport: ${document?.number ?? "not read"}`,
    `Expires: ${document?.expiry_date ?? "not read"}${document?.is_expired ? " (expired)" : ""}`,
    `Machine-readable zone: ${reading.mrz}`,
  ].join("\n");
}
```

Dates arrive as `YYYY-MM-DD` and countries as three-letter codes such as
`GRC`. `mrz` is `passed` only when the machine-readable zone was found and
every check digit in it is valid. That is the strongest sign that the number
and dates were read correctly. The meaning of every field is in the
[response reference](/reference/response).

## Option 2: the app sends the photo with a client token

Steps 1 to 3 send every photo through your server. If you would rather the
photo went straight from the phone to this API, your server can hand the app a
[client token](/reference/endpoints/create-a-client-token) instead. The key
still never leaves the server; only the token reaches the phone.

A client token can call `POST /v1/scans` and nothing else. It lives 300 seconds
and allows one scan request unless your server asks for other limits, up to
900 seconds and 10 requests. Its scans are billed and stored exactly as your
key's own, and revoking the key ends every token it issued.

The server route that replaces `/scan`:

```js
// In server.mjs, beside or instead of the /scan route.
app.post("/scan-token", async (req, res) => {
  // The same sign-in check as /scan: a token is as good as one scan.

  const upstream = await fetch("https://api.doc.cheap/v1/client-tokens", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DOC_CHEAP_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expires_in: 300, max_uses: 1 }),
  });
  const issued = await upstream.json();

  if (!upstream.ok) {
    res.status(upstream.status).json({ error: issued.error.code, message: issued.error.message });
    return;
  }
  res.json({ token: issued.token });
});
```

Check it from your computer. The answer carries a token that starts with `ct_`.

```bash
curl -X POST http://localhost:3000/scan-token
```

In the app, ask your server for a token, then send the photo to this API with
it. The API answers a browser's cross-origin preflight, so the request works
from a Capacitor app and from `ionic serve` alike.

```ts
// src/scan-direct.ts
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

const BACKEND_URL = "http://192.168.1.20:3000";

export async function readPassportDirect() {
  const photo = await Camera.getPhoto({
    source: CameraSource.Camera,
    resultType: CameraResultType.Base64,
    quality: 85,
    width: 1600,
    correctOrientation: true,
  });

  // A fresh token for every photo: it allows one scan request.
  const tokenResponse = await fetch(`${BACKEND_URL}/scan-token`, { method: "POST" });
  const { token } = await tokenResponse.json();

  const response = await fetch("https://api.doc.cheap/v1/scans", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ image: photo.base64String }),
  });

  const scan = await response.json();
  if (!response.ok) {
    throw new Error(`${scan.error.code}: ${scan.error.message}`);
  }
  return scan;
}
```

The full [response](/reference/response) now reaches the phone, so the app
picks out the fields it shows, as `/scan` did on the server in step 1. Every
request made with the token spends a use, whatever its outcome. A token past
its time answers [`client_token_expired`](/errors/client_token_expired), and a
spent one answers [`client_token_used_up`](/errors/client_token_used_up). For
both, ask your server for a new token and try again.

Which option to pick: through your server, you choose exactly what reaches the
phone and you can log every scan. With a token, the photo makes one trip
instead of two, and your server never handles it.

## What to tell the user

All five values of `status` arrive under HTTP 200, and they map to four
messages.

| `status` | What happened | What the app says |
|---|---|---|
| `recognized` | The document was read | Show the fields |
| `no_document_found`, `unsupported_document` | No passport in the frame, or a document type this service does not read | Ask for a new photo of the passport's photo page |
| `unreadable` | A document was found, but no usable text came off it | Ask for a sharper photo, without glare |
| `rejected` | Recognition failed on our side | Ask the user to try again in a moment |

A photo with no document in it costs nothing. Whether a given scan drew a
credit is `meta.billed`, not `status`, and
[what a billed scan is](/concepts/what-a-billed-scan-is) gives the rule.

## Next

- [Crop a document with OpenCV](/guides/crop-with-opencv) – prepare the photo
  on a server before you send it.
- [Handle errors](/guides/handle-errors) – the codes your server can pass on.
- [Create a client token](/reference/endpoints/create-a-client-token) – the
  token's limits and every answer the endpoint can give.
- [Response](/reference/response) – every field in the answer.
