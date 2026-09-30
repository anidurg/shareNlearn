import type { Config, Context } from "@netlify/functions";
import { isPhotoKey, photoStore } from "../lib/photos.js";
import { recordServed, uploaderOf } from "../lib/usage.js";

/**
 * Serves one photo. The key is unguessable and only ever reaches somebody the
 * item itself reached, so — exactly as with a circle's cover — this needs no
 * login, which is also what lets the browser cache it like any other image.
 *
 * Which is also why the egress is written down here and attributed by the key:
 * with no session to read, `uploaderOf()` is the only thing that can say whose
 * bytes these are, and it needs no query to do it. What the counter sees is
 * therefore origin egress alone — the hard cache header below means the second
 * read of a photo is answered by the edge and never reaches this function.
 */
export default async (_req: Request, context: Context) => {
  const key = context.params.key ? decodeURIComponent(context.params.key) : "";
  if (!isPhotoKey(key)) return new Response("Invalid photo key", { status: 400 });

  const result = await photoStore().getWithMetadata(key, { type: "arrayBuffer" });
  if (!result) return new Response("Photo not found", { status: 404 });

  const bytes = new Uint8Array(result.data as ArrayBuffer);
  const contentType = (result.metadata?.contentType as string | undefined) || "image/jpeg";

  await recordServed(uploaderOf(key), bytes.byteLength);

  return new Response(bytes, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(bytes.byteLength),
      // A photo is never edited in place — a new one gets a new key — so this can
      // be cached hard.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};

export const config: Config = {
  path: "/api/photos/:key",
  method: ["GET"],
};
