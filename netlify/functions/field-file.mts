// netlify/functions/field-file.mts
import type { Config } from "@netlify/functions";
import { randomUUID } from "node:crypto";
import { admittedUser } from "../lib/access.js";
import {
  ATTACHMENT_REFUSAL,
  MAX_ATTACHMENT_BYTES,
  attachmentKeyFor,
  attachmentNameOf,
  attachmentStore,
  attachmentTypeFor,
  attachmentUrl,
} from "../lib/attachments.js";
import { collectParts, partsFrom } from "../lib/audio-uploads.js";
import { badRequest, jsonBody, unauthorized } from "../lib/items.js";
import { throttleUpload } from "../lib/upload-rate.js";

/**
 * Claims a document that came up in slices as the answer to one of a category's
 * own upload fields.
 *
 * It is `POST /api/files` for a file too big to be one request body. A field
 * answer may run to `MAX_ATTACHMENT_BYTES`, which is past the 6 MB a function
 * receives, so the browser cuts anything over `MAX_SINGLE_UPLOAD_BYTES` into
 * parts, PUTs them to the route a recording already uses, and asks here for them
 * to be joined — which is exactly what `field-audio.mts` does with a recording,
 * and deliberately the same three calls rather than a second mechanism.
 *
 * What it adds over that one is the pair of questions a document is asked and a
 * recording is not: which of the three formats this actually is, refused by name
 * when it is none of them, and the size it came to, refused against the field
 * ceiling `valueFor()` will check it against again when the share is saved. The
 * answer written on the share is the same `{ key, name, size }` envelope a
 * one-request upload stores, so every reader, every My Library copy and
 * `sweepAttachments()` carry on knowing nothing about how the bytes arrived.
 */
export default async (req: Request) => {
  const user = await admittedUser();
  if (!user) return unauthorized();

  const body = await jsonBody(req);
  if (!body) return badRequest("Expected a JSON body.");

  const upload = partsFrom(body);
  if (!upload) return badRequest("That upload is missing or has too many parts.");

  const name = attachmentNameOf(body.name, "document");
  const kind = attachmentTypeFor(typeof body.contentType === "string" ? body.contentType : "", name);
  if (!kind) return Response.json({ error: ATTACHMENT_REFUSAL }, { status: 415 });

  // The parts are swept up whether they join or come to more than a field answer
  // may hold, so a refused upload leaves nothing behind in the parts store.
  const collected = await collectParts(user.id, upload.uploadId, upload.parts, {
    bytes: MAX_ATTACHMENT_BYTES,
    refusal: `A file has to be under ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB.`,
  });
  if (collected.error) return collected.error;

  const bytes = collected.audio;
  if (bytes.byteLength === 0) return badRequest("That file came through empty.");

  /* One request and no bytes. The parts were charged as they arrived through
     `PUT /api/uploads/:uploadId/parts/:index`, so charging them again here would
     count one document twice; what is left worth counting is the claim itself. */
  const tooFast = await throttleUpload(user, 0);
  if (tooFast) return tooFast;

  // One path segment, and it carries who uploaded it: only that member may put it
  // on a share of their own.
  const key = attachmentKeyFor(user, randomUUID());
  await attachmentStore().set(key, bytes.buffer as ArrayBuffer, {
    metadata: { contentType: kind.contentType, name },
  });

  return Response.json(
    { file: { key, name, size: bytes.byteLength, url: attachmentUrl(key) } },
    { status: 201 },
  );
};

export const config: Config = {
  path: "/api/field-files",
  method: ["POST"],
};
