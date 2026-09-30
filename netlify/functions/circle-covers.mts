// netlify/functions/circle-covers.mts
import type { Config } from "@netlify/functions";
import { admittedUser } from "../lib/access.js";
import { randomUUID } from "node:crypto";
import { coverStore, MAX_COVER_BYTES } from "../lib/circles.js";
import { unauthorized } from "../lib/items.js";
import { throttleUpload } from "../lib/upload-rate.js";

/** Only real image types, and only ones every browser can draw. */
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

/**
 * A cover image goes up as one request — the browser scales it down first, which
 * keeps it well inside the 6 MB a function may receive. The blob keeps the bytes
 * and the circle row keeps only the key.
 */
export default async (req: Request) => {
  const user = await admittedUser();
  if (!user) return unauthorized();

  const contentType = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED.includes(contentType)) {
    return Response.json({ error: "A cover has to be a JPEG, PNG, or WebP image." }, { status: 415 });
  }

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength === 0) {
    return Response.json({ error: "That image is empty." }, { status: 400 });
  }
  if (bytes.byteLength > MAX_COVER_BYTES) {
    return Response.json(
      { error: `A cover image has to be under ${MAX_COVER_BYTES / (1024 * 1024)} MB.` },
      { status: 413 },
    );
  }

  // Charged like every other upload, small though a cover is: a circle can be
  // edited as often as anybody likes, so this route is as loopable as the rest.
  const tooFast = await throttleUpload(user, bytes.byteLength);
  if (tooFast) return tooFast;

  // One path segment, so the key can be read straight back out of the URL.
  const key = `${user.id}_${randomUUID()}`;
  await coverStore().set(key, bytes, { metadata: { contentType } });

  return Response.json({ coverKey: key, coverUrl: `/api/circle-covers/${key}` }, { status: 201 });
};

export const config: Config = {
  path: "/api/circle-covers",
  method: ["POST"],
};
