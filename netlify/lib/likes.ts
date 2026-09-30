// netlify/lib/likes.ts
// A plain 👍 on something shared: no comment, no rating, just "this was worth it".
// One row per member per item, so the unique index makes liking idempotent and a
// second tap a removal — nobody can like the same book twice, however many times
// the button is pressed.
//
// Kept generic the way photos are: the story would be identical for every kind of
// thing shared, so the table names its item type rather than being a column on one
// table. Books are the first surface to use it.
import type { User } from "@netlify/identity";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { itemLikes } from "../../db/schema.js";
import type { ItemType } from "./items.js";

/** What a listing shows: how many liked it, and whether the reader is one of them. */
export interface LikeState {
  likeCount: number;
  likedByMe: boolean;
}

const NONE: LikeState = { likeCount: 0, likedByMe: false };

/**
 * Every listed item's likes in two queries: the tally, and the reader's own rows.
 * Counted in Postgres rather than by loading every like, because the count is all
 * anybody reads.
 */
export async function likesByItem(itemType: ItemType, itemIds: number[], user: User | null) {
  const byItem = new Map<number, LikeState>();
  if (itemIds.length === 0) return byItem;

  const counts = await db
    .select({ itemId: itemLikes.itemId, count: sql<number>`count(*)::int` })
    .from(itemLikes)
    .where(and(eq(itemLikes.itemType, itemType), inArray(itemLikes.itemId, itemIds)))
    .groupBy(itemLikes.itemId);
  for (const row of counts) byItem.set(row.itemId, { likeCount: row.count, likedByMe: false });

  if (user) {
    const mine = await db
      .select({ itemId: itemLikes.itemId })
      .from(itemLikes)
      .where(
        and(
          eq(itemLikes.itemType, itemType),
          inArray(itemLikes.itemId, itemIds),
          eq(itemLikes.memberId, user.id),
        ),
      );
    for (const row of mine) {
      byItem.set(row.itemId, {
        likeCount: byItem.get(row.itemId)?.likeCount ?? 1,
        likedByMe: true,
      });
    }
  }

  return byItem;
}

/** Adds `likeCount` and `likedByMe` to every row of a listing. */
export async function withLikes<T extends { id: number }>(
  itemType: ItemType,
  rows: T[],
  user: User | null,
) {
  const byItem = await likesByItem(
    itemType,
    rows.map((row) => row.id),
    user,
  );
  return rows.map((row) => ({ ...row, ...(byItem.get(row.id) ?? NONE) }));
}

export async function likeStateOf(itemType: ItemType, itemId: number, user: User | null) {
  return (await likesByItem(itemType, [itemId], user)).get(itemId) ?? NONE;
}

/** Liking and unliking, both idempotent: pressing twice leaves one row, or none. */
export async function setLike(
  itemType: ItemType,
  itemId: number,
  user: User,
  liked: boolean,
): Promise<LikeState> {
  if (liked) {
    await db
      .insert(itemLikes)
      .values({ itemType, itemId, memberId: user.id })
      .onConflictDoNothing();
  } else {
    await db
      .delete(itemLikes)
      .where(
        and(
          eq(itemLikes.itemType, itemType),
          eq(itemLikes.itemId, itemId),
          eq(itemLikes.memberId, user.id),
        ),
      );
  }
  return likeStateOf(itemType, itemId, user);
}

/** Called when an item is deleted for everyone: its likes go with it. */
export async function clearItemLikes(itemType: ItemType, itemId: number) {
  await db
    .delete(itemLikes)
    .where(and(eq(itemLikes.itemType, itemType), eq(itemLikes.itemId, itemId)));
}
