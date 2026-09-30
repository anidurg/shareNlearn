import type { Config } from "@netlify/functions";
import { randomUUID } from "node:crypto";
import { admittedUser } from "../lib/access.js";
import {
  ATTACHMENT_REFUSAL,
  MAX_SINGLE_UPLOAD_BYTES,
  attachmentKeyFor,
  attachmentNameOf,
  attachmentStore,
  attachmentTypeFor,
  attachmentUrl,
} from "../lib/attachments.js";
import { unauthorized } from "../lib/items.js";
import { throttleUpload } from "../lib/upload-rate.js";

/**
 * The name as the browser encoded it. A name may hold anything a member typed —
 * Kannada, an emoji, a stray `%` — so the browser sends it percent-encoded and it
 * is read back here; a header that was not encoded at all is taken as it stands
 * rather than being allowed to throw, since a badly named file is still a file.
 */
function decodedName(raw: string | null): string {
  const value = raw ?? "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * One document, one request — the same shape a photo takes, and for the same
 * reason: a file uploaded the moment it is picked lets the member see it on the
 * form before they save anything.
 *
 * It is the shorter of the two ways in. A function receives at most 6 MB, so this
 * one carries a document up to `MAX_SINGLE_UPLOAD_BYTES` and anything larger goes
 * up in slices instead and is claimed by `POST /api/field-files`. The browser
 * decides which of the two a file takes, so the refusal below is the guard rather
 * than a sentence a member is expected to read.
 *
 * The name travels in a header rather than in a multipart body, because a
 * document is the whole of the payload and parsing a form to recover one string
 * would be the only reason to have one.
 */
export default async (req: Request) => {
  const user = await admittedUser();
  if (!user) return unauthorized();

  const name = attachmentNameOf(decodedName(req.headers.get("x-file-name")), "document");
  const kind = attachmentTypeFor(req.headers.get("content-type") ?? "", name);
  if (!kind) return Response.json({ error: ATTACHMENT_REFUSAL }, { status: 415 });

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength === 0) return Response.json({ error: "That file is empty." }, { status: 400 });
  if (bytes.byteLength > MAX_SINGLE_UPLOAD_BYTES) {
    return Response.json(
      { error: "A file this size has to be uploaded in parts." },
      { status: 413 },
    );
  }

  // Charged on the bytes actually about to be stored, after every refusal above.
  const tooFast = await throttleUpload(user, bytes.byteLength);
  if (tooFast) return tooFast;

  // One path segment, and it carries who uploaded it: only that member may put it
  // on a share of their own.
  const key = attachmentKeyFor(user, randomUUID());
  await attachmentStore().set(key, bytes, {
    metadata: { contentType: kind.contentType, name },
  });

  return Response.json(
    {
      file: { key, name, size: bytes.byteLength, url: attachmentUrl(key) },
    },
    { status: 201 },
  );
};

export const config: Config = {
  path: "/api/files",
  method: ["POST"],
};
