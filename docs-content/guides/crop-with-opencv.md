---
title: Crop a document with OpenCV
description: Find a document's outline in a photo with OpenCV, straighten it, and send the cropped image to doc.cheap from Python.
type: how-to
keyword: opencv document crop python
nav: OpenCV preprocessing
section: Guides
---

# Crop a document with OpenCV

This guide starts with a photo of a document lying on a table. OpenCV finds
the document's four corners and straightens it into a flat rectangle. The
result goes to `POST /v1/scans`. It is all one Python file.

You do not have to do any of this. The API takes an ordinary photo as it is,
in JPEG or PNG. Cropping first is worth it in the cases listed near the end of
this page. When the script finds no outline, it sends the plain photo.

## Install

The script needs Python 3.9 or later and three packages.

```bash
pip install opencv-python numpy requests
```

On a server without a screen, `opencv-python-headless` is the same library
without the window code.

## The script

```python
# crop_and_scan.py
import base64
import os
import sys

import cv2
import numpy as np
import requests

API_URL = "https://api.doc.cheap/v1/scans"
API_KEY = os.environ.get("DOC_CHEAP_KEY", "sk_sandbox_public")


def order_corners(points):
    """Return the four corners as top-left, top-right, bottom-right, bottom-left."""
    points = points.reshape(4, 2).astype("float32")
    sums = points.sum(axis=1)
    diffs = np.diff(points, axis=1).ravel()
    return np.array(
        [
            points[np.argmin(sums)],
            points[np.argmin(diffs)],
            points[np.argmax(sums)],
            points[np.argmax(diffs)],
        ],
        dtype="float32",
    )


def find_document(image):
    """Find the largest four-sided outline that covers a fair part of the photo."""
    scale = 800 / max(image.shape[:2])
    small = cv2.resize(image, None, fx=scale, fy=scale) if scale < 1 else image
    scale = min(scale, 1)

    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(gray, 50, 150)
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=2)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    min_area = 0.2 * small.shape[0] * small.shape[1]

    for contour in sorted(contours, key=cv2.contourArea, reverse=True):
        if cv2.contourArea(contour) < min_area:
            break
        outline = cv2.approxPolyDP(contour, 0.02 * cv2.arcLength(contour, True), True)
        if len(outline) == 4:
            return order_corners(outline) / scale
    return None


def flatten(image, corners):
    """Warp the four corners onto an upright rectangle of the same size."""
    tl, tr, br, bl = corners
    width = int(max(np.linalg.norm(tr - tl), np.linalg.norm(br - bl)))
    height = int(max(np.linalg.norm(bl - tl), np.linalg.norm(br - tr)))
    target = np.array(
        [[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]],
        dtype="float32",
    )
    matrix = cv2.getPerspectiveTransform(corners, target)
    return cv2.warpPerspective(image, matrix, (width, height))


def to_base64_jpeg(image, long_edge=1600, quality=85):
    scale = long_edge / max(image.shape[:2])
    if scale < 1:
        image = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    ok, jpeg = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise RuntimeError("Could not encode the image as JPEG")
    return base64.b64encode(jpeg.tobytes()).decode("ascii")


def main(path):
    photo = cv2.imread(path)
    if photo is None:
        sys.exit(f"Could not read {path}")

    corners = find_document(photo)
    if corners is None:
        print("No document outline found, sending the photo as it is")
        document = photo
    else:
        document = flatten(photo, corners)
        cv2.imwrite("cropped.jpg", document)
        print("Cropped the document, saved to cropped.jpg")

    response = requests.post(
        API_URL,
        headers={"Authorization": f"Bearer {API_KEY}"},
        json={"image": to_base64_jpeg(document)},
        timeout=60,
    )
    body = response.json()

    if response.status_code != 200:
        error = body["error"]
        sys.exit(f"{response.status_code} {error['code']}: {error['message']}")

    meta = body["meta"]
    print("status:", meta["status"], "billed:", meta["billed"])
    if meta["status"] != "recognized":
        return

    document, holder = body["document"], body["holder"]
    if document:
        print("document:", document["type_name"], document["number"])
    if holder:
        print("holder:", holder["full_name"])
    print("mrz:", body["mrz"]["status"])
    for field in body["fields"]:
        print(f"  {field['name']}: {field['value']}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python crop_and_scan.py photo.jpg")
    main(sys.argv[1])
```

Run it on a photo. Without `DOC_CHEAP_KEY` set, it uses the public sandbox key
`sk_sandbox_public`, which allows 10 free recognitions per client and 10
requests per hour.

```bash
python crop_and_scan.py photo.jpg
```

## How it works

**Finding the outline.** `find_document` works on a copy of the photo shrunk
to 800 pixels on its long edge, which is plenty to find edges and much faster.
It turns the copy grey, blurs away fine texture, and marks the edges with
Canny. Dilating the edges joins small gaps, so the border of the document
becomes one closed line. It then takes the largest outline that has four
corners and covers at least a fifth of the picture. The corners are scaled back to the size of the original photo.

**Putting the corners in order.** `order_corners` sorts the four points into
top-left, top-right, bottom-right and bottom-left. The top-left corner has the
smallest sum of x and y, and the bottom-right the largest. The other two are
told apart by the difference between y and x.

**Straightening.** `flatten` measures the longer of each pair of opposite
sides and maps the four corners onto an upright rectangle of that size. A
document photographed at an angle comes out as if it were scanned from above.
It is saved as `cropped.jpg`, so you can look at what was sent.

**Encoding.** `to_base64_jpeg` shrinks a larger image to 1600 pixels on its
long edge. It encodes the image as JPEG at quality 85 and turns the bytes into
base64 text. That is the size [recognize a passport](/guides/recognize-a-passport)
recommends, and it keeps the request in the hundreds of kilobytes. Send the
bare base64 text: a `data:image/jpeg;base64,` prefix is refused with
[`validation_failed`](/errors/validation_failed).

**Reading the answer.** Any status other than 200 carries the same `error`
envelope, and the script prints its `code` and `message`. A 200 is a finished
scan, whatever was in the picture. `meta.status` says what was found, and
`meta.billed` says whether the scan drew a credit. For a `recognized` scan the
script prints the document type and number and the holder's name. It also
prints the result of the machine-readable zone check and every field it read.

A photo with no document in it prints something like this, and costs nothing.

```text
Cropped the document, saved to cropped.jpg
status: unsupported_document billed: False
```

## When cropping helps

Cropping changes the result when the document is a small part of the picture.
That is the case when:

- the photo shows a whole desk, a hand or a busy background, and the document
  fills only part of the frame;
- the camera was held at a strong angle, so the page is a trapezoid rather
  than a rectangle;
- the photos are very large, and cropping lets you send the document at a
  useful size instead of shrinking the whole scene.

It makes little difference when the document already fills most of the frame,
as in a scan or a careful close-up. Then send the photo as it is.

The outline search needs a visible border: a document on a background of a
different brightness. A white page on a white table, or a photo where a finger
covers a corner, finds no four-sided outline. The script then sends the
original photo, which the API reads like any other.

## Next

- [Read a passport in an Ionic app](/guides/read-a-passport-in-an-ionic-app) –
  take the photo on a phone and send it through your own server.
- [Recognize a passport](/guides/recognize-a-passport) – the request and the
  answer in full.
- [Handle errors](/guides/handle-errors) – what each error code means and what
  to do about it.
