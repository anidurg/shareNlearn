// netlify/functions/shared-audio.mts
import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { admittedUser } from "../lib/access.js";
import { myCircleIds } from "../lib/circles.js";
import { shareByToken, shareTokenFrom, sharedSongAudio } from "../lib/item-shares.js";
import { bytesResponse, servedByteCount } from "../lib/ranges.js";
import { recordServed, uploaderOf } from "../lib/usage.js";

/**
 * The recording behind a shared song, reached by its token rather than by its id.
 *
 * `audio.mts` beside it is member-gated and stays that way: a song id is a small
 * number, so that route is the one place a recording could be found by counting
 * instead of by being shown it. This one cannot be counted at all — the token is
 * unguessable and names exactly one song — which is what lets a shared recording
 * actually play for somebody who has not joined yet. A share nobody can listen to
 * is not a share.
 *
 * `sharedSongAudio()` re-checks the same four things the item read does, so
 * privatising the recording or taking it out of the circle the link names silences
 * this route at the same moment it empties the other one — and the fourth of them
 * is why the caller is read here at all. A recording out of an invite-only circle
 * is withheld from the item payload, and a gate that stopped there would have been
 * undone by the one `<audio src>` on the page, so the same question is asked
 * again of the bytes.
 */
export default async (req: Request, context: Context) => {
  const token = shareTokenFrom(context.params);
  if (token === null) return new Response("Not found", { status: 404 });

  const share = await shareByToken(token);
  if (!share) return new Response("Not found", { status: 404 });

  const user = await admittedUser();
  const blobKey = await sharedSongAudio(share, await myCircleIds(user));
  if (!blobKey) return new Response("Not found", { status: 404 });

  const result = await getStore("song-audio").getWithMetadata(blobKey, { type: "arrayBuffer" });
  if (!result) return new Response("Audio not found", { status: 404 });

  const audio = new Uint8Array(result.data as ArrayBuffer);
  const contentType = (result.metadata?.contentType as string | undefined) || "audio/mpeg";

  /* The same slicing, streaming and 416 the member-facing route uses, because
     Safari will not play a note without a `Range` answer.

     And the same `private` caching, for the same reason — a seek should not
     re-stream a recording — with one difference that decides the number: this
     address carries the share token rather than the song's blob key, so the same
     URL does mean different bytes after the author re-records. An hour is long
     enough to cover somebody listening to a recording twice and short enough
     that a re-recording, or a share withdrawn, is not being served from a cache
     by the end of the afternoon. */
  /* Charged to whoever shared the recording rather than to whoever followed the
     link — which is the only answer available here, the listener frequently having
     no account at all, and the more useful one besides: a recording being passed
     around outside the group is exactly the cost worth attributing to the member
     who shared it. `sharedSongAudio()` answered a blob key rather than a row, so
     the uploader is read off the key the same way the login-free routes do it. */
  await recordServed(uploaderOf(blobKey), servedByteCount(audio, req.headers.get("range")));

  return bytesResponse(audio, contentType, req.headers.get("range"), {
    "Cache-Control": "private, max-age=3600",
    "Netlify-CDN-Cache-Control": "no-store",
  });
};

export const config: Config = {
  path: "/api/shared/:token/audio",
  method: ["GET"],
};
