// netlify/functions/field-video.mts
// Claim a short MP4 sent in chunks as an attachment to a category's video field.
import type { Config } from "@netlify/functions";
import { randomUUID } from "node:crypto";
import { admittedUser } from "../lib/access.js";
import {
  attachmentKeyFor,
  attachmentNameOf,
  attachmentStore,
  attachmentUrl,
} from "../lib/attachments.js";
import { collectParts, partsFrom } from "../lib/audio-uploads.js";
import { MAX_ITEM_UPLOAD_BYTES } from "../lib/fields.js";
import { badRequest, jsonBody, unauthorized } from "../lib/items.js";
import { throttleUpload } from "../lib/upload-rate.js";

export default async (req: Request) => {
  const user = await admittedUser();
  if (!user) return unauthorized();

  const body = await jsonBody(req);
  if (!body) return badRequest("Expected a JSON body.");
  const upload = partsFrom(body);
  if (!upload) return badRequest("That upload is missing or has too many parts.");

  // A strict first-release format: an MP4 video, not an audio/mp4 recording.
  // MIME alone is not proof of the underlying codec; playback compatibility
  // still needs testing on Android and iPhone.
  const name = attachmentNameOf(body.name, "video.mp4");
  const contentType = String(body.contentType ?? "").split(";")[0].trim().toLowerCase();
  if (!/\.mp4$/i.test(name) || contentType !== "video/mp4") {
    return Response.json({ error: "Please choose an MP4 video." }, { status: 415 });
  }

  const collected = await collectParts(user.id, upload.uploadId, upload.parts, {
    bytes: MAX_ITEM_UPLOAD_BYTES,
    refusal: "That video exceeds the 50 MB limit.",
  });
  if (collected.error) return collected.error;
  const video = collected.audio;
  if (video.byteLength === 0) return badRequest("That video came through empty.");

  // Parts were already metered during upload; do not double-charge.
  const tooFast = await throttleUpload(user, 0);
  if (tooFast) return tooFast;

  const key = attachmentKeyFor(user, randomUUID());
  await attachmentStore().set(key, video.buffer as ArrayBuffer, {
    metadata: { contentType, name },
  });
  return Response.json(
    { file: { key, name, size: video.byteLength, url: attachmentUrl(key) } },
    { status: 201 },
  );
};

export const config: Config = {
  path: "/api/field-video",
  method: ["POST"],
};
