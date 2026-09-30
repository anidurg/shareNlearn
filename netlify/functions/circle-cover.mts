// netlify/functions/circle-cover.mts
import type { Config, Context } from "@netlify/functions";
import { coverStore } from "../lib/circles.js";
import { recordServed, uploaderOf } from "../lib/usage.js";

/**
 * Serves a circle's cover image. The key is unguessable, and a cover is the face
 * of a circle rather than anything private, so this needs no login — which also
 * lets the browser cache it like any other image.
 *
 * The egress is counted against whoever uploaded the cover, read off the key by
 * `uploaderOf()` — there being no session here to ask — and it is origin egress
 * only, the hard cache header below keeping every read after the first away from
 * this function entirely.
 */
export default async (_req: Request, context: Context) => {
  const key = context.params.key ? decodeURIComponent(context.params.key) : "";
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(key)) {
    return new Response("Invalid cover key", { status: 400 });
  }

  const result = await coverStore().getWithMetadata(key, { type: "arrayBuffer" });
  if (!result) return new Response("Cover not found", { status: 404 });

  const bytes = new Uint8Array(result.data as ArrayBuffer);
  const contentType = (result.metadata?.contentType as string | undefined) || "image/jpeg";

  await recordServed(uploaderOf(key), bytes.byteLength);

  return new Response(bytes, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(bytes.byteLength),
      // The key changes whenever the image does, so this can be cached hard.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};

export const config: Config = {
  path: "/api/circle-covers/:key",
  method: ["GET"],
};
