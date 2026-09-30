// netlify/functions/upload-part.mts
// One slice of a recording on its way up. The browser cuts the file into parts
// small enough for a Function's 6 MB request body, PUTs each one here, and then
// calls /api/uploads/:uploadId/complete to have them stitched into a single blob.
import type { Config, Context } from "@netlify/functions";
import { admittedUser } from "../lib/access.js";
import {
  MAX_PART_BYTES,
  MAX_PARTS,
  audioPartStore,
  isValidUploadId,
  partKey,
} from "../lib/audio-uploads.js";
import { badRequest, unauthorized } from "../lib/items.js";
import { throttleUpload } from "../lib/upload-rate.js";

export default async (req: Request, context: Context) => {
  const user = await admittedUser();
  if (!user) return unauthorized();

  const { uploadId, index } = context.params;
  if (!isValidUploadId(uploadId)) return badRequest("Invalid upload id.");

  const partIndex = Number(index);
  if (!Number.isInteger(partIndex) || partIndex < 0 || partIndex >= MAX_PARTS) {
    return badRequest("That upload has an unexpected number of parts.");
  }

  const part = await req.arrayBuffer();
  if (part.byteLength === 0) return badRequest("That part of the recording is empty.");
  if (part.byteLength > MAX_PART_BYTES) {
    return Response.json({ error: "That part of the recording is too large." }, { status: 413 });
  }

  /* This is the route the rate limit exists for. Every other ingest path is one
     request per thing shared; this one is called once per 4 MB and is the only
     place in the app where a legal request can be repeated indefinitely at speed.
     The parts carry the real bytes, so they are what is charged — and the two
     claim routes that stitch them, `field-audio.mts` and `field-file.mts`, charge
     nothing but a request, so one recording is never billed twice against the
     same hour. */
  const tooFast = await throttleUpload(user, part.byteLength);
  if (tooFast) return tooFast;

  // Parts are keyed by member, so one member's upload can never overwrite
  // another's, and `complete` only ever reads back its own caller's parts.
  await audioPartStore().set(partKey(user.id, uploadId, partIndex), part);

  return Response.json({ index: partIndex, bytes: part.byteLength });
};

export const config: Config = {
  path: "/api/uploads/:uploadId/parts/:index",
  method: ["PUT"],
};
