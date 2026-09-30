// netlify/functions/audio.mts
import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { and, eq } from "drizzle-orm";
import { admittedUser } from "../lib/access.js";
import { db } from "../../db/index.js";
import { songs } from "../../db/schema.js";
import { visibleTo } from "../lib/items.js";
import { bytesResponse, servedByteCount } from "../lib/ranges.js";
import { recordServed } from "../lib/usage.js";

export default async (req: Request, context: Context) => {
  const id = Number(context.params.id);
  if (!Number.isInteger(id)) {
    return new Response("Invalid song id", { status: 400 });
  }

  const user = await admittedUser();
  if (!user) {
    return new Response("You must be logged in to listen to this.", { status: 401 });
  }

  // A song id is a small number, so the audio route is the one place a recording
  // could be reached by counting rather than by being shown it. The same rule the
  // listing uses decides here too, which is why it is the predicate rather than a
  // second copy of the reasoning: a recording the caller cannot see is a recording
  // that does not exist.
  const [existing] = await db
    .select()
    .from(songs)
    .where(and(eq(songs.id, id), visibleTo(songs, user, "song")));
  if (!existing) {
    return new Response("Song not found", { status: 404 });
  }
  // A song may be words alone — a stotra somebody knows and cannot sing today — in
  // which case there is nothing to stream and never was.
  if (!existing.blobKey) {
    return new Response("This song has no recording", { status: 404 });
  }

  const result = await getStore("song-audio").getWithMetadata(existing.blobKey, { type: "arrayBuffer" });
  if (!result) {
    return new Response("Audio not found", { status: 404 });
  }

  const audio = new Uint8Array(result.data as ArrayBuffer);
  const contentType = (result.metadata?.contentType as string | undefined) || "audio/mpeg";

  // The slicing, the streaming and the 416 all live in `netlify/lib/ranges.ts`,
  // because an audio answer to a category's own upload field is served by
  // `file.mts` and needs exactly the same two things: a bounded buffered slice,
  // and a `Range` answer at all, without which Safari will not play a note.
  //
  // And the browser is allowed to keep what it gets, which is the whole of why
  // this route is not the most expensive one in the app any more. `audioUrl()`
  // stamps the song's own blob key onto the address, so these bytes can never
  // change under it — re-recording a song mints a new key and therefore a new
  // URL — and without that header every play, every seek and every scrub back to
  // the beginning ran this function again and streamed the whole recording again.
  //
  // Two things about the header are deliberate. It is `private`, unlike the
  // `public` a photo gets, because a song id is a small number and the
  // `visibleTo()` read above is the only thing standing between a stranger and a
  // recording: a shared cache holding one answer and handing it to the next
  // caller would undo that read, so the browser is the only cache invited to keep
  // it, and Netlify's own edge is told so in its own header rather than left to a
  // default. And the lifetime is a week rather than the year a photo gets,
  // because this is the one cached route where permission can be taken away — a
  // song made private, or taken out of the last circle it was in — and a year of
  // somebody's cache is a long time to go on playing something that has been
  // withdrawn. A week costs nothing anybody notices and still answers the case
  // that matters, which is the same member listening again.

  // The egress, charged to whoever shared the recording. This is the one serving
  // route that needs no key parsing to know who that is, the `visibleTo()` read
  // above having already fetched the row — and the one whose counter is close to
  // the whole truth, since `private` caching plus the CDN's `no-store` means every
  // play that is not the same member's own repeat comes through this function.
  await recordServed(existing.memberId, servedByteCount(audio, req.headers.get("range")));

  return bytesResponse(audio, contentType, req.headers.get("range"), {
    "Cache-Control": "private, max-age=604800, immutable",
    "Netlify-CDN-Cache-Control": "no-store",
  });
};

export const config: Config = {
  path: "/api/audio/:id",
  method: ["GET"],
};
