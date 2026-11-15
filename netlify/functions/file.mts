import type { Config, Context } from "@netlify/functions";
import { and, eq, like } from "drizzle-orm";
import { db } from "../../db/index.js";
import { postFieldValues, posts, savedItems } from "../../db/schema.js";
import { admittedAccess } from "../lib/access.js";
import { ITEM_TABLES, isItemType, visibleTo, savedVisibleTo } from "../lib/items.js";
import { parseAttachments } from "../lib/attachments.js";
import { attachmentDisposition, attachmentStore, isAttachmentKey } from "../lib/attachments.js";
import { bytesResponse, servedByteCount } from "../lib/ranges.js";
import { recordServed, uploaderOf } from "../lib/usage.js";

/**
 * Serves one uploaded answer back — a document, or a recording where the field
 * asked for audio. The key is unguessable and only ever reaches somebody the
 * share itself reached, so — exactly as with a photo or a circle's cover — this
 * needs no login, which is also what lets a member open it in whatever their
 * device uses to read a spreadsheet.
 *
 * A PDF opens in the browser's own viewer and a recording plays where it sits; a
 * Word or Excel file has nothing to open in, so it downloads. Either way the
 * bytes are served as the type they were uploaded as and never sniffed into
 * something else.
 *
 * Everything goes back through `bytesResponse()`, which is the same answer
 * `audio.mts` gives a song: a `Range` request is answered with a bounded slice
 * and a whole file too big to buffer is streamed. Both halves earn their keep — a
 * document runs to 10 MB and an audio answer to the recording ceiling of 20 MB,
 * so neither is buffered whole, and Safari will not play a note from a route that
 * ignores `Range`.
 *
 * The name it is offered under goes through `attachmentDisposition()` rather than
 * straight into the header, because a header is Latin-1 and the names in this group
 * are frequently not.
 *
 * The egress is counted against the member who uploaded the document, read off
 * the key, and it is counted as `servedByteCount()` rather than as the size of the
 * file: a recording answered a slice at a time sends a fraction of itself per
 * request, and bandwidth is charged on what went out.
 */
export default async (req: Request, context: Context) => {
  const key = context.params.key ? decodeURIComponent(context.params.key) : "";
  if (!isAttachmentKey(key)) return new Response("Invalid file key", { status: 400 });

  const access = await admittedAccess();
  if (!access) return new Response("Unauthorized", { status: 401 });

  // The uploader can preview a file before saving the form. Everyone else
  // must be able to read a share that actually references this exact blob key.
  {
    const references = await db.select({
      itemType: postFieldValues.itemType,
      itemId: postFieldValues.itemId,
      postId: postFieldValues.postId,
      value: postFieldValues.value,
    }).from(postFieldValues).where(like(postFieldValues.value, `%${key}%`));
    let allowed = false;
    for (const ref of references) {
      if (!parseAttachments(ref.value).some((file) => file.key === key)) continue;
      if (!isItemType(ref.itemType)) continue;
      const id = ref.itemId ?? (ref.itemType === "post" ? ref.postId : null);
      if (id === null) continue;
      const table = ITEM_TABLES[ref.itemType];
      const [visible] = await db.select({ id: table.id })
        .from(table as typeof posts)
        .where(and(eq(table.id, id), visibleTo(table, access.user, ref.itemType)))
        .limit(1);
      if (visible) { allowed = true; break; }
      // Saving a share in one's library keeps access after leaving its Circle.
      const [saved] = await db.select({ id: savedItems.id }).from(savedItems)
        .where(and(eq(savedItems.memberId, access.user.id),
          eq(savedItems.itemType, ref.itemType), eq(savedItems.itemId, id)))
        .limit(1);
      if (!saved) continue;
      const [readableSaved] = await db.select({ id: table.id })
        .from(table as typeof posts)
        .where(and(eq(table.id, id), savedVisibleTo(table, access.user, ref.itemType)))
        .limit(1);
      if (readableSaved) { allowed = true; break; }
    }
    // A newly uploaded file has no answer row yet; its uploader may preview it.
    // Once attached to a share, the share permissions always take precedence.
    if (!allowed && !(references.length === 0 && key.startsWith(`${access.user.id}_`))) {
      return new Response("File not found", { status: 404 });
    }
  }

  const result = await attachmentStore().getWithMetadata(key, { type: "arrayBuffer" });
  if (!result) return new Response("File not found", { status: 404 });

  const bytes = new Uint8Array(result.data as ArrayBuffer);
  const contentType =
    (result.metadata?.contentType as string | undefined) || "application/octet-stream";
  const inline = contentType === "application/pdf" || contentType.startsWith("audio/") || contentType === "video/mp4";

  const range = req.headers.get("range");
  await recordServed(uploaderOf(key), servedByteCount(bytes, range));

  return bytesResponse(bytes, contentType, range, {
    "Content-Disposition": attachmentDisposition(result.metadata?.name, inline),
    "X-Content-Type-Options": "nosniff",
    // A file is never edited in place — a new one gets a new key — so this can
    // be cached hard.
    "Cache-Control": "private, no-store",
  });
};

export const config: Config = {
  path: "/api/files/:key",
  method: ["GET"],
};
