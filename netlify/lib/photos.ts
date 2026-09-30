// netlify/lib/photos.ts
// Photos hung off a share. Every kind of thing a member shares may carry them —
// a recipe filed under Sweets, a remedy, a post in a category the circle
// invented — always optionally, and never limited to one: the form offers a "+"
// so a member can add as many as the thing needs.
//
// The bytes live in Netlify Blobs and only the key is kept in Postgres, the same
// split circle covers use. Rows rather than a column on each item, because the
// number of photos is not fixed and the story is identical for all seven types.
import { getStore } from "@netlify/blobs";
import type { User } from "@netlify/identity";
import { and, asc, eq, inArray, ne, or } from "drizzle-orm";
import { db } from "../../db/index.js";
import { itemPhotos } from "../../db/schema.js";
import type { ItemType } from "./items.js";

/** The blob store for photos; each row keeps only the key into it. */
export function photoStore() {
  return getStore("item-photos");
}

/** Comfortably under the 6 MB a function may receive in one request body. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Enough for a dish from every angle, without letting one share run away. */
export const MAX_PHOTOS_PER_ITEM = 10;

/** Only image types every browser can draw — whatever the camera produced. */
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function photoUrl(key: string) {
  return `/api/photos/${encodeURIComponent(key)}`;
}

/**
 * Keys are minted server-side as `<memberId>_<uuid>`, so they are one path
 * segment, unguessable, and say who uploaded them without a lookup.
 */
export function photoKeyFor(user: User, uuid: string) {
  return `${user.id}_${uuid}`;
}

export function isPhotoKey(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{8,128}$/.test(value);
}

/** How a photo travels over the API: enough to show it and to send it back. */
export function photoResponse(row: { id: number; blobKey: string }) {
  return { id: row.id, key: row.blobKey, url: photoUrl(row.blobKey) };
}

export type PhotoResponse = ReturnType<typeof photoResponse>;

/**
 * The photo keys a form sent, in the order the member arranged them, or null when
 * the form did not mention photos at all — an edit that says nothing about them
 * leaves them exactly as they were.
 */
export function photoKeysFrom(body: Record<string, unknown>): string[] | null {
  if (!("photos" in body)) return null;
  const raw = Array.isArray(body.photos) ? body.photos : [];
  const keys: string[] = [];
  for (const entry of raw) {
    // A form may send back what it was given, so accept both shapes.
    const key = typeof entry === "string" ? entry : (entry as { key?: unknown })?.key;
    if (isPhotoKey(key) && !keys.includes(key)) keys.push(key);
  }
  return keys.slice(0, MAX_PHOTOS_PER_ITEM);
}

/** One item's photos, first one first. */
export async function photosOf(itemType: ItemType, itemId: number): Promise<PhotoResponse[]> {
  const rows = await db
    .select()
    .from(itemPhotos)
    .where(and(eq(itemPhotos.itemType, itemType), eq(itemPhotos.itemId, itemId)))
    .orderBy(asc(itemPhotos.sortOrder), asc(itemPhotos.id));
  return rows.map(photoResponse);
}

/**
 * Points an item at the photos its author uploaded, in the order they arranged
 * them. Only keys the caller uploaded themselves count — or ones already on this
 * very item, which is what lets a circle's moderator edit somebody else's share
 * without silently blanking their pictures — and only ones not already attached to
 * something else, so deleting one item can never blank out another's.
 *
 * A photo taken off an item is gone for good — nothing else refers to it — so its
 * blob goes with the row.
 */
export async function setItemPhotos(
  itemType: ItemType,
  itemId: number,
  keys: string[],
  user: User,
): Promise<PhotoResponse[]> {
  const existing = await db
    .select()
    .from(itemPhotos)
    .where(and(eq(itemPhotos.itemType, itemType), eq(itemPhotos.itemId, itemId)));
  const mine = new Set(existing.map((row) => row.blobKey));

  const wanted = keys.filter(
    (key) => isPhotoKey(key) && (key.startsWith(`${user.id}_`) || mine.has(key)),
  );

  // A key already used by a different item is left where it is: one photo, one
  // owner, so the blob behind it has exactly one row that may delete it.
  const elsewhere = new Set(
    wanted.length === 0 || wanted.every((key) => mine.has(key))
      ? []
      : (
          await db
            .select({ blobKey: itemPhotos.blobKey })
            .from(itemPhotos)
            .where(
              and(
                inArray(itemPhotos.blobKey, wanted),
                or(ne(itemPhotos.itemType, itemType), ne(itemPhotos.itemId, itemId)),
              ),
            )
        ).map((row) => row.blobKey),
  );
  const keep = wanted.filter((key) => mine.has(key) || !elsewhere.has(key));

  const dropped = existing.filter((row) => !keep.includes(row.blobKey));
  if (dropped.length > 0) {
    await db.delete(itemPhotos).where(
      inArray(
        itemPhotos.id,
        dropped.map((row) => row.id),
      ),
    );
    await Promise.all(
      dropped.map(async (row) => {
        try {
          await photoStore().delete(row.blobKey);
        } catch {
          // The row is what the app reads; a blob left behind is harmless.
        }
      }),
    );
  }

  for (const [index, key] of keep.entries()) {
    const row = existing.find((candidate) => candidate.blobKey === key);
    if (row) {
      if (row.sortOrder !== index) {
        await db.update(itemPhotos).set({ sortOrder: index }).where(eq(itemPhotos.id, row.id));
      }
      continue;
    }
    await db
      .insert(itemPhotos)
      .values({ itemType, itemId, blobKey: key, sortOrder: index, memberId: user.id })
      .onConflictDoNothing();
  }

  return photosOf(itemType, itemId);
}

/**
 * Applies an edit's photos. A form that says nothing about them changes nothing,
 * which is what lets a member refile a post without re-sending its pictures.
 */
export async function applyItemPhotos(
  itemType: ItemType,
  itemId: number,
  keys: string[] | null,
  user: User,
): Promise<PhotoResponse[]> {
  if (keys === null) return photosOf(itemType, itemId);
  return setItemPhotos(itemType, itemId, keys, user);
}

/** Called when an item is deleted for everyone: its photos go with it. */
export async function clearItemPhotos(itemType: ItemType, itemId: number) {
  const rows = await db
    .select()
    .from(itemPhotos)
    .where(and(eq(itemPhotos.itemType, itemType), eq(itemPhotos.itemId, itemId)));
  if (rows.length === 0) return;

  await db
    .delete(itemPhotos)
    .where(and(eq(itemPhotos.itemType, itemType), eq(itemPhotos.itemId, itemId)));
  await Promise.all(
    rows.map(async (row) => {
      try {
        await photoStore().delete(row.blobKey);
      } catch {
        // Same as above: the row is the record, the blob is just bytes.
      }
    }),
  );
}

/** Every listed item's photos, in one query. */
export async function photosByItem(itemType: ItemType, itemIds: number[]) {
  const byItem = new Map<number, PhotoResponse[]>();
  if (itemIds.length === 0) return byItem;

  const rows = await db
    .select()
    .from(itemPhotos)
    .where(and(eq(itemPhotos.itemType, itemType), inArray(itemPhotos.itemId, itemIds)))
    .orderBy(asc(itemPhotos.sortOrder), asc(itemPhotos.id));

  for (const row of rows) {
    const list = byItem.get(row.itemId);
    if (list) list.push(photoResponse(row));
    else byItem.set(row.itemId, [photoResponse(row)]);
  }
  return byItem;
}

/**
 * Adds `photos` to every row of a listing, so a feed can show them without a
 * second call. Wraps whatever `withCircleIds()` returned.
 */
export async function withPhotos<T extends { id: number }>(itemType: ItemType, rows: T[]) {
  const byItem = await photosByItem(
    itemType,
    rows.map((row) => row.id),
  );
  return rows.map((row) => ({ ...row, photos: byItem.get(row.id) ?? [] }));
}
