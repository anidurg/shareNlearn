// netlify/lib/audio-uploads.ts
// Shared helpers for the chunked audio upload flow. A whole recording rarely fits
// in one request — Functions cap a buffered request body at 6 MB — so the browser
// slices the file and PUTs each part, then asks the API to stitch the parts into a
// single blob. Playback streams back through a Function, and a streamed response
// caps out at 20 MB, so that is the ceiling for a single recording.
import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

export const MAX_PART_BYTES = 5 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_PARTS = 24;

/** Finished recordings, one blob per song, referenced by `songs.blob_key`. */
export function audioStore() {
  return getStore("song-audio");
}

/** Parts of an in-flight upload; deleted once the parts are stitched together. */
export function audioPartStore() {
  return getStore("song-audio-parts");
}

export function partKey(memberId: string, uploadId: string, index: number) {
  return `${memberId}/${uploadId}/${String(index).padStart(4, "0")}`;
}

/** Upload ids come from `crypto.randomUUID()` in the browser. */
export function isValidUploadId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9-]{8,64}$/.test(value);
}

export function normalizeContentType(value: unknown) {
  // Browser recorders report types like "audio/webm;codecs=opus" — keep the type
  // itself and drop the parameters.
  const type = typeof value === "string" ? value.split(";")[0].trim().toLowerCase() : "";
  return /^audio\/[a-z0-9.+-]+$/.test(type) ? type : "audio/mpeg";
}

/** How long the browser measured the recording to be, or null when it could not. */
export function durationFrom(value: unknown) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : null;
}

/**
 * What a body says about parts already PUT and waiting to be stitched, or null when
 * it says nothing at all.
 *
 * Two routes ask this now — the one that finishes a new share, and the PATCH that
 * swaps the recording on a song already shared — so an upload waiting to be claimed
 * is a shape rather than a set of loose fields read twice.
 */
export function uploadFrom(value: unknown) {
  const parts = partsFrom(value);
  if (!parts) return null;
  const body = value as Record<string, unknown>;
  return {
    ...parts,
    contentType: normalizeContentType(body.contentType),
    durationSeconds: durationFrom(body.durationSeconds),
  };
}

/**
 * The half of that which is not about audio at all: which parts were PUT and how
 * many of them.
 *
 * It is its own export because a document now goes up in slices as well — a field
 * answer may run to 10 MB, which is past what one request body carries — and what
 * a document adds is a media type of its own and a filename rather than a
 * recording's. So the two claim routes read the same parts and differ only in what
 * they make of them.
 */
export function partsFrom(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const uploadId = body.uploadId;
  if (!isValidUploadId(uploadId)) return null;
  const parts = Number(body.parts);
  if (!Number.isInteger(parts) || parts < 1 || parts > MAX_PARTS) return null;
  return { uploadId, parts };
}

/**
 * Reads back the parts one member PUT and joins them in order, answering the whole
 * recording — or the refusal to send back.
 *
 * Parts are keyed by member, so this only ever reads its own caller's, and they are
 * deleted whether the join succeeded or the recording turned out to be over the
 * ceiling: an abandoned upload should not be left sitting in the parts store.
 *
 * It is separate from the store it ends up in because what goes up in slices is no
 * longer only a song: a category can invent an upload field that takes audio, and
 * one that takes a document over `MAX_SINGLE_UPLOAD_BYTES` sends it this way too.
 * The chunking and the sweeping up are identical for all three, and doing them
 * three times is how they would drift apart. Only the ceiling differs, so it is
 * asked for — a recording's 20 MB is the default and a document's is smaller.
 */
export async function collectParts(
  memberId: string,
  uploadId: string,
  partCount: number,
  ceiling: { bytes: number; refusal: string } = {
    bytes: MAX_UPLOAD_BYTES,
    refusal: "That recording is larger than the 20 MB limit.",
  },
): Promise<{ audio: Uint8Array; error?: undefined } | { audio?: undefined; error: Response }> {
  const partStore = audioPartStore();
  const keys = Array.from({ length: partCount }, (_, i) => partKey(memberId, uploadId, i));

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (const key of keys) {
    const chunk = (await partStore.get(key, { type: "arrayBuffer" })) as ArrayBuffer | null;
    if (!chunk) {
      return {
        error: Response.json(
          { error: "Part of that upload is missing. Please try uploading again." },
          { status: 400 },
        ),
      };
    }
    total += chunk.byteLength;
    if (total > ceiling.bytes) {
      await Promise.all(keys.map((k) => partStore.delete(k)));
      return { error: Response.json({ error: ceiling.refusal }, { status: 413 }) };
    }
    chunks.push(new Uint8Array(chunk));
  }

  const audio = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    audio.set(chunk, offset);
    offset += chunk.byteLength;
  }

  await Promise.all(keys.map((key) => partStore.delete(key)));
  return { audio };
}

/**
 * The same thing for a song: the parts joined and stored as the one blob
 * `songs.blob_key` points at, answering the new key or the refusal.
 */
export async function stitchParts(
  memberId: string,
  uploadId: string,
  partCount: number,
  contentType: string,
): Promise<{ blobKey: string; error?: undefined } | { blobKey?: undefined; error: Response }> {
  const collected = await collectParts(memberId, uploadId, partCount);
  if (collected.error) return { error: collected.error };

  const blobKey = `${memberId}/${randomUUID()}`;
  await audioStore().set(blobKey, collected.audio.buffer, { metadata: { contentType } });

  return { blobKey };
}
