// netlify/lib/attachments.ts
// The documents a category asks for. A field of kind "file" is the one question
// whose answer is not something the member types: the circle asks for the recipe
// sheet, the trip itinerary or the accounts, and the member picks a PDF, a Word
// document or an Excel workbook off their device.
//
// The split is the one photos already use — the bytes live in Netlify Blobs and
// only the key travels in Postgres — with one difference: a document is nobody's
// idea of a thumbnail, so the answer also carries the name it was uploaded under.
// That is what a reader sees on the post, so it is stored beside the key rather
// than looked up from the blob.
import { getStore } from "@netlify/blobs";
import type { User } from "@netlify/identity";

/** The blob store for documents attached as field answers. */
export function attachmentStore() {
  return getStore("field-files");
}

/**
 * The most one answer may hold. It is deliberately past the 6 MB a function may
 * receive in one request body, which is why a document no longer always arrives
 * in one: anything bigger than `MAX_SINGLE_UPLOAD_BYTES` is sliced by the browser
 * and PUT the way a recording is, then claimed by `POST /api/field-files`. Serving
 * one back needed nothing — `bytesResponse()` already streams anything too big to
 * buffer, which is how a 20 MB audio answer goes out through the same route.
 */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/**
 * What `POST /api/files` may be handed in one go, and the size the browser slices
 * at. It sits under the platform's 6 MB request body with room to spare, because
 * the whole file is the body and being refused by the platform rather than by the
 * app would cost the member the sentence saying what happened.
 */
export const MAX_SINGLE_UPLOAD_BYTES = 4 * 1024 * 1024;

/** How long a stored file name may be, which is a label rather than an essay. */
export const MAX_ATTACHMENT_NAME = 120;

/**
 * The three kinds of document a circle may ask for, each with the extensions a
 * browser might hand over for it. Both halves matter: a browser handed a `.docx`
 * or an `.xlsx` from some devices reports `application/octet-stream` and nothing
 * more, so the extension is what says what it really is.
 */
export const ATTACHMENT_TYPES = [
  { id: "pdf", contentType: "application/pdf", extensions: [".pdf"], label: "PDF" },
  { id: "word", contentType: "application/msword", extensions: [".doc"], label: "Word" },
  {
    id: "word",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extensions: [".docx"],
    label: "Word",
  },
  { id: "excel", contentType: "application/vnd.ms-excel", extensions: [".xls"], label: "Excel" },
  {
    id: "excel",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extensions: [".xlsx"],
    label: "Excel",
  },
] as const;

/**
 * The three as a circle chooses between them: one id per kind rather than one per
 * media type, since "Word" is two of the rows above and a circle asking for a Word
 * document means either. This is the vocabulary a field's own `file_types` holds.
 */
export const ATTACHMENT_TYPE_IDS = ["pdf", "word", "excel"] as const;

export type AttachmentTypeId = (typeof ATTACHMENT_TYPE_IDS)[number];

export function isAttachmentTypeId(value: unknown): value is AttachmentTypeId {
  return typeof value === "string" && (ATTACHMENT_TYPE_IDS as readonly string[]).includes(value);
}

/** The word a member reads for one of the three. */
export function attachmentTypeLabel(id: AttachmentTypeId): string {
  return id === "pdf" ? "PDF" : id === "word" ? "Word document" : "Excel workbook";
}

/** What a member reads when the file they picked is not one of the three. */
export const ATTACHMENT_REFUSAL = "A file has to be a PDF, a Word document, or an Excel workbook.";

/**
 * The same sentence for a field that narrowed the list — "This field takes a PDF."
 * A refusal names what was actually asked for, since "not one of the three" is a
 * puzzle on a field that only ever wanted one of them.
 */
export function attachmentRefusalFor(ids: readonly AttachmentTypeId[]): string {
  if (ids.length === 0 || ids.length >= ATTACHMENT_TYPE_IDS.length) return ATTACHMENT_REFUSAL;
  const words = ids.map(attachmentTypeLabel);
  const list = words.length === 1 ? words[0] : `${words.slice(0, -1).join(", ")} or ${words.at(-1)}`;
  return `This field takes ${words.length === 1 && ids[0] === "pdf" ? "a PDF" : `a ${list}`}.`;
}

/**
 * Which of the three this upload is, judged by what the browser said and by what
 * the file is called — either alone is enough, since the two disagree often. Null
 * when it is neither, which is the refusal.
 */
export function attachmentTypeFor(contentType: string, name: string) {
  const declared = contentType.split(";")[0].trim().toLowerCase();
  const byType = ATTACHMENT_TYPES.find((entry) => entry.contentType === declared);
  if (byType) return byType;

  const lower = name.trim().toLowerCase();
  return (
    ATTACHMENT_TYPES.find((entry) => entry.extensions.some((ext) => lower.endsWith(ext))) ?? null
  );
}

/**
 * The name a document is stored and offered back under: the member's own, with
 * anything that could make it more than a name taken out. A path separator would
 * turn a download into a directory, and a control character has no business in a
 * header.
 */
export function attachmentNameOf(raw: unknown, fallback = "document"): string {
  const clean = String(raw ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[\\/]+/g, " ")
    .replace(/["']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ATTACHMENT_NAME);
  return clean || fallback;
}

/**
 * The extension a name ends with, lowercased, and empty for anything that is not
 * plainly one — it is the half of a file name that has to survive being rewritten,
 * since it is what tells a device which app opens the download.
 */
function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "";
  const ext = name.slice(dot);
  return /^\.[A-Za-z0-9]{1,8}$/.test(ext) ? ext.toLowerCase() : "";
}

/**
 * The same name with nothing in it a header cannot hold: every character outside
 * printable ASCII becomes a space, and a name that was *entirely* outside it — a
 * PDF called ಕನ್ನಡ.pdf, which is the ordinary case in this group rather than the odd
 * one — falls back to "document" while keeping its extension.
 */
function asciiNameOf(name: string): string {
  const ext = extensionOf(name);
  const stem = ext ? name.slice(0, name.length - ext.length) : name;
  const readable = stem
    .replace(/[^\x20-\x7e]+/g, " ")
    .replace(/["'\\;]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${readable || "document"}${ext}`;
}

/**
 * Percent-encoded the way RFC 5987 wants it, which is `encodeURIComponent` plus the
 * four characters it leaves alone and the grammar does not allow.
 */
function encodeHeaderName(name: string): string {
  return encodeURIComponent(name).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * The `Content-Disposition` a document is served with, and the one header in the app
 * that cannot simply carry what a member typed: a header value is Latin-1, so a file
 * called ಕನ್ನಡ.pdf throws on the way out rather than downloading — which is exactly
 * what RFC 6266 exists for. It gives the name twice: a rewritten ASCII `filename`
 * for anything that only understands that, and `filename*` holding the real one
 * percent-encoded as UTF-8. Every browser worth the name prefers the second, so the
 * member gets the name they chose and nobody gets an error instead of their file.
 */
export function attachmentDisposition(raw: unknown, inline: boolean): string {
  const name = attachmentNameOf(raw);
  return [
    inline ? "inline" : "attachment",
    `filename="${asciiNameOf(name)}"`,
    `filename*=UTF-8''${encodeHeaderName(name)}`,
  ].join("; ");
}

/**
 * Keys are minted server-side as `<memberId>_<uuid>`, exactly as a photo's are:
 * one path segment, unguessable, and saying who uploaded it without a lookup —
 * which is what lets an answer refuse a key the member did not upload themselves.
 */
export function attachmentKeyFor(user: User, uuid: string) {
  return `${user.id}_${uuid}`;
}

export function isAttachmentKey(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{8,128}$/.test(value);
}

export function attachmentUrl(key: string) {
  return `/api/files/${encodeURIComponent(key)}`;
}

/** A document as the browser and the reader both see it. */
export interface Attachment {
  key: string;
  name: string;
  size: number;
}

/**
 * What is actually stored in the answer column: the key, the name and the size,
 * as one short piece of JSON. A column rather than a table of its own because an
 * answer is one file and the row it sits on is already the record — and JSON
 * rather than a delimiter because a file name may hold anything a member typed.
 */
export function encodeAttachment(file: Attachment): string {
  return JSON.stringify({ key: file.key, name: file.name, size: file.size });
}

/** One parsed envelope checked over, and null for anything that is not one. */
function attachmentFrom(parsed: unknown): Attachment | null {
  if (!parsed || typeof parsed !== "object") return null;
  const entry = parsed as Record<string, unknown>;
  if (!isAttachmentKey(entry.key)) return null;
  const size = Number(entry.size);
  return {
    key: entry.key,
    name: attachmentNameOf(entry.name),
    size: Number.isFinite(size) && size > 0 ? Math.round(size) : 0,
  };
}

/** Reads one back, and answers null for anything that is not one. */
export function parseAttachment(value: string): Attachment | null {
  const raw = value.trim();
  if (!raw.startsWith("{")) return null;
  try {
    return attachmentFrom(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Several documents as one stored answer, which is what a field set to take more
 * than one holds. A JSON array rather than a second table for the same reason a
 * single one is JSON: the row it sits on is already the record, and the unique
 * index is one answer per field per share.
 *
 * One file is still stored as the bare object it always was, so nothing written
 * before a field could take several has to be rewritten to be read.
 */
export function encodeAttachments(files: Attachment[]): string {
  if (files.length === 0) return "";
  if (files.length === 1) return encodeAttachment(files[0]);
  return JSON.stringify(files.map((file) => ({ key: file.key, name: file.name, size: file.size })));
}

/**
 * Reads either shape back — the one object and the array — so every caller can
 * ask the same question of a stored answer whatever the field was set to when it
 * was written. Empty for anything that is neither.
 */
export function parseAttachments(value: string): Attachment[] {
  const raw = value.trim();
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      const files: Attachment[] = [];
      for (const entry of parsed) {
        const file = attachmentFrom(entry);
        if (file && !files.some((kept) => kept.key === file.key)) files.push(file);
      }
      return files;
    } catch {
      return [];
    }
  }
  const one = parseAttachment(raw);
  return one ? [one] : [];
}

/** Every key named by these stored answers, for a sweep after they are gone. */
export function attachmentKeysIn(values: string[]): string[] {
  const keys: string[] = [];
  for (const value of values) {
    for (const file of parseAttachments(value)) {
      if (!keys.includes(file.key)) keys.push(file.key);
    }
  }
  return keys;
}

/** Drops the bytes behind a document nothing points at any more. */
export async function deleteAttachment(key: string) {
  try {
    await attachmentStore().delete(key);
  } catch {
    // The row is what the app reads; a blob left behind is only wasted bytes.
  }
}
