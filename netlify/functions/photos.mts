import type { Config } from "@netlify/functions";
import { admittedUser } from "../lib/access.js";
import { randomUUID } from "node:crypto";
import { unauthorized } from "../lib/items.js";
import { MAX_PHOTO_BYTES, PHOTO_TYPES, photoKeyFor, photoStore, photoUrl } from "../lib/photos.js";
import { throttleUpload } from "../lib/upload-rate.js";

/**
 * One photo, one request. The browser scales the picked image down before sending
 * it, which keeps it well inside the 6 MB a function may receive; the blob keeps
 * the bytes and the share keeps only the key.
 *
 * A photo is uploaded as soon as it is picked and attached to the item when the
 * form is saved, so the member sees a thumbnail straight away and adding a second
 * one is just another upload.
 */
export default async (req: Request) => {
  const user = await admittedUser();
  if (!user) return unauthorized();

  const contentType = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!PHOTO_TYPES.includes(contentType)) {
    return Response.json({ error: "A photo has to be a JPEG, PNG, or WebP image." }, { status: 415 });
  }

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength === 0) {
    return Response.json({ error: "That image is empty." }, { status: 400 });
  }
  if (bytes.byteLength > MAX_PHOTO_BYTES) {
    return Response.json(
      { error: `A photo has to be under ${MAX_PHOTO_BYTES / (1024 * 1024)} MB.` },
      { status: 413 },
    );
  }

  /* Charged once the picture is known to be a picture of an acceptable size, so
     a refused upload costs the member nothing of their hour — and before the blob
     is written, so a write that then fails has cost them a little rather than
     nothing at all, which is the right way round for a limit whose whole purpose
     is to bound what reaches Blobs. */
  const tooFast = await throttleUpload(user, bytes.byteLength);
  if (tooFast) return tooFast;

  // One path segment, and it carries who uploaded it: only that member may attach
  // it to something of theirs.
  const key = photoKeyFor(user, randomUUID());
  await photoStore().set(key, bytes, { metadata: { contentType } });

  return Response.json({ photo: { key, url: photoUrl(key) } }, { status: 201 });
};

export const config: Config = {
  path: "/api/photos",
  method: ["POST"],
};
