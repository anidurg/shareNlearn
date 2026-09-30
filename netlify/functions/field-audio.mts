// netlify/functions/field-audio.mts
import type { Config } from "@netlify/functions";
import { randomUUID } from "node:crypto";
import { admittedUser } from "../lib/access.js";
import {
  attachmentKeyFor,
  attachmentNameOf,
  attachmentStore,
  attachmentUrl,
} from "../lib/attachments.js";
import { collectParts, uploadFrom } from "../lib/audio-uploads.js";
import { badRequest, jsonBody, unauthorized } from "../lib/items.js";
import { throttleUpload } from "../lib/upload-rate.js";

/**
 * The extension a recording is stored under when the member never named it — a
 * browser recorder hands over bytes and a media type and nothing else. It matters
 * because the name is what a device reads to decide which app opens a download.
 */
const AUDIO_EXTENSIONS: Record<string, string> = {
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/aac": ".aac",
  "audio/wav": ".wav",
  "audio/flac": ".flac",
  "audio/ogg": ".ogg",
  "audio/webm": ".webm",
  "audio/aiff": ".aiff",
  "audio/amr": ".amr",
  "audio/3gpp": ".3gp",
};

/**
 * Claims an audio upload as the answer to one of a category's own upload fields.
 *
 * It is `upload-complete.mts` without the song: the parts were PUT the same way,
 * up to the same 20 MB, by the same route, and `collectParts()` joins and sweeps
 * them exactly as it does for a recording that is about to become a share of its
 * own. What differs is only where the bytes land — the `field-files` store, under
 * an attachment key, with the name and type a document answer carries — so the
 * answer written on the share is the same `{ key, name, size }` envelope every
 * other upload field already stores, and every reader, every My Library copy and
 * `sweepAttachments()` keep working with no idea that this one is audio.
 *
 * `POST /api/files` is the other half of the pair and cannot do this job: it takes
 * the bytes as the request body, which caps at 6 MB, and a sung verse recorded on
 * a phone goes past that in a couple of minutes.
 */
export default async (req: Request) => {
  const user = await admittedUser();
  if (!user) return unauthorized();

  const body = await jsonBody(req);
  if (!body) return badRequest("Expected a JSON body.");

  const upload = uploadFrom(body);
  if (!upload) return badRequest("That upload is missing or has too many parts.");

  const collected = await collectParts(user.id, upload.uploadId, upload.parts);
  if (collected.error) return collected.error;

  const audio = collected.audio;
  if (audio.byteLength === 0) return badRequest("That recording came through empty.");

  /* One request and no bytes, exactly as `field-file.mts` does it: a recording's
     parts were charged on the way up, and a second charge here would bill the same
     twenty megabytes twice against the same hour. */
  const tooFast = await throttleUpload(user, 0);
  if (tooFast) return tooFast;

  const fallback = `recording${AUDIO_EXTENSIONS[upload.contentType] ?? ".mp3"}`;
  const name = attachmentNameOf(body.name, fallback);
  const key = attachmentKeyFor(user, randomUUID());

  await attachmentStore().set(key, audio.buffer as ArrayBuffer, {
    metadata: { contentType: upload.contentType, name },
  });

  return Response.json(
    { file: { key, name, size: audio.byteLength, url: attachmentUrl(key) } },
    { status: 201 },
  );
};

export const config: Config = {
  path: "/api/field-audio",
  method: ["POST"],
};
