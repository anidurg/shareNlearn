// netlify/lib/admin.ts
// What the app admin can see and put right across the whole group, as opposed to
// what a circle's own people decide inside it.
//
// Everything here exists for a failure a circle cannot fix from the inside: a
// circle nobody is left to delete, and — the one that actually bites — two rows
// both marked as the default circle. Discover is created lazily on the first
// request that needs it, so two members arriving at once could each create one,
// and every check afterwards asks "is this member in *a* default circle?" rather
// than "in *the* one". Two members then read and post in two different circles
// that are both called Discover, cannot see each other, and nothing on screen
// says why.
import { and, count, desc, eq, inArray, notExists, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  circleMembers,
  circles,
  contentReports,
  itemCircles,
  notifications,
} from "../../db/schema.js";
import { deleteCircle } from "./circles.js";
import { ITEM_TABLES, ITEM_TYPES } from "./items.js";

export type CircleRollEntry = {
  id: number;
  name: string;
  icon: string;
  privacy: string;
  isDefault: boolean;
  ownerId: string;
  ownerName: string;
  memberCount: number;
  shareCount: number;
  createdAt: Date;
};

/** Every circle in the group, with enough beside it to decide what to do. */
export async function circleRoll(): Promise<CircleRollEntry[]> {
  const rows = await db.select().from(circles).orderBy(desc(circles.isDefault), circles.name);
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);

  const memberRows = await db
    .select({ circleId: circleMembers.circleId, total: count() })
    .from(circleMembers)
    .where(inArray(circleMembers.circleId, ids))
    .groupBy(circleMembers.circleId);
  const memberCounts = new Map(memberRows.map((row) => [row.circleId, Number(row.total)]));

  const shareRows = await db
    .select({ circleId: itemCircles.circleId, total: count() })
    .from(itemCircles)
    .where(inArray(itemCircles.circleId, ids))
    .groupBy(itemCircles.circleId);
  const shareCounts = new Map(shareRows.map((row) => [row.circleId, Number(row.total)]));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    icon: row.icon,
    privacy: row.privacy,
    isDefault: row.isDefault,
    ownerId: row.ownerId,
    ownerName: row.ownerName,
    memberCount: memberCounts.get(row.id) ?? 0,
    shareCount: shareCounts.get(row.id) ?? 0,
    createdAt: row.createdAt,
  }));
}

/**
 * The extra default circles, if a race ever left any: everything marked default
 * except the lowest id, which is the one every read canonicalises on. An empty
 * list is the healthy answer and the ordinary one.
 */
export function duplicateDefaults(roll: CircleRollEntry[]) {
  const defaults = roll.filter((entry) => entry.isDefault).sort((a, b) => a.id - b.id);
  return defaults.length > 1 ? defaults.slice(1) : [];
}

/** Which circle the rest of the app treats as Discover. */
export function canonicalDefault(roll: CircleRollEntry[]) {
  return roll.filter((entry) => entry.isDefault).sort((a, b) => a.id - b.id)[0] ?? null;
}

/**
 * Folds one circle into another and then deletes it: its members join the
 * target, and everything shared into it is shared into the target instead.
 *
 * The order matters. `deleteCircle()` calls `closeCircleContent()`, which makes
 * private anything left with no circles at all — right when a circle is being
 * deleted outright, and wrong here, where the whole point is that the posts
 * survive. So the `item_circles` rows are moved first, and by the time the
 * source is deleted there is nothing hanging off it to close.
 *
 * Filing is dropped on the way across. A subcategory belongs to one circle's own
 * category, so a shelf id from the source names a shelf the target does not
 * have; unfiled is the honest answer, and any member can file it again.
 */
export async function mergeCircleInto(fromId: number, intoId: number) {
  if (fromId === intoId) return { members: 0, shares: 0 };

  const joining = await db
    .select({
      memberId: circleMembers.memberId,
      memberName: circleMembers.memberName,
      role: circleMembers.role,
    })
    .from(circleMembers)
    .where(eq(circleMembers.circleId, fromId));

  // Owners and admins of the circle being folded away arrive as plain members:
  // the target has its own people, and merging is not a way to be given a role.
  const plain = joining.filter((row) => row.role !== "owner");
  if (plain.length > 0) {
    await db
      .insert(circleMembers)
      .values(
        plain.map((row) => ({
          circleId: intoId,
          memberId: row.memberId,
          memberName: row.memberName,
          role: "member",
        })),
      )
      .onConflictDoNothing();
  }

  const shares = await db
    .select({ id: itemCircles.id, itemType: itemCircles.itemType, itemId: itemCircles.itemId })
    .from(itemCircles)
    .where(eq(itemCircles.circleId, fromId));

  if (shares.length > 0) {
    await db
      .insert(itemCircles)
      .values(
        shares.map((row) => ({
          itemType: row.itemType,
          itemId: row.itemId,
          circleId: intoId,
          subcategoryId: null,
        })),
      )
      .onConflictDoNothing();
    await db.delete(itemCircles).where(eq(itemCircles.circleId, fromId));
  }

  // A report was raised about a post in a circle; the post is now in the target,
  // so that is where the report belongs and whose admins should answer it.
  await db
    .update(contentReports)
    .set({ circleId: intoId })
    .where(eq(contentReports.circleId, fromId));

  // A notification limited to a circle is read by that circle's members. Point
  // them at the surviving circle rather than losing them with the row.
  await db.update(notifications).set({ circleId: intoId }).where(eq(notifications.circleId, fromId));

  // Anything still waiting in the source's doorway goes with it. `deleteCircle()`
  // clears the invitations and requests, which is right: an invitation into a
  // circle that no longer exists has nothing left to accept, and the people
  // themselves have already been moved across as members.
  await deleteCircle(fromId);

  return { members: plain.length, shares: shares.length };
}

/**
 * Repairs a duplicated Discover: every extra default circle is folded into the
 * canonical one. Nobody is left outside afterwards — a member who was only ever
 * in a stray now has no default circle at all, which is exactly the condition
 * `accessOf()` already watches for, so their next request joins them to the one
 * that survived.
 */
export async function mergeDuplicateDefaults() {
  const roll = await circleRoll();
  const canonical = canonicalDefault(roll);
  if (!canonical) return { merged: 0, members: 0, shares: 0 };

  let merged = 0;
  let movedMembers = 0;
  let movedShares = 0;
  for (const extra of duplicateDefaults(roll)) {
    const result = await mergeCircleInto(extra.id, canonical.id);
    merged += 1;
    movedMembers += result.members;
    movedShares += result.shares;
  }

  return { merged, members: movedMembers, shares: movedShares, circleId: canonical.id };
}

/** Which circles one member is actually in — the other half of "why can't they see it?". */
export async function memberCircleList(memberId: string) {
  return db
    .select({
      circleId: circleMembers.circleId,
      name: circles.name,
      icon: circles.icon,
      isDefault: circles.isDefault,
      role: circleMembers.role,
    })
    .from(circleMembers)
    .innerJoin(circles, eq(circles.id, circleMembers.circleId))
    .where(eq(circleMembers.memberId, memberId))
    .orderBy(desc(circles.isDefault), circles.name);
}

/**
 * Whether a member is missing from the circle everybody is supposed to be in.
 * Kept beside the block list because the two are the only reasons two members of
 * the same group cannot read each other.
 */
export async function outsideDefault(memberId: string) {
  const [row] = await db
    .select({ id: circles.id })
    .from(circles)
    .where(eq(circles.isDefault, true))
    .orderBy(circles.id)
    .limit(1);
  if (!row) return false;
  const [joined] = await db
    .select({ one: sql<number>`1` })
    .from(circleMembers)
    .where(and(eq(circleMembers.circleId, row.id), eq(circleMembers.memberId, memberId)))
    .limit(1);
  return !joined;
}

/**
 * Shares this member marked as shared that name no circle at all.
 *
 * These are not invisible — an item with no `item_circles` rows reaches the whole
 * group, which is what everything did before circles existed and is deliberately
 * still true. But every circle-shaped surface asks the opposite question, "does
 * this name my circle?", so a share like this appears in the group-wide feed and
 * on no category page anywhere: shared with everybody and findable under nothing.
 * That is worth telling an admin who has been sent looking for a word somebody
 * insists they posted, and the fix is the author's own Edit rather than anything
 * here.
 */
export async function sharesWithoutCircles(memberId: string) {
  const counts = await Promise.all(
    ITEM_TYPES.map(async (itemType) => {
      const table = ITEM_TABLES[itemType];
      const [row] = await db
        .select({ total: count() })
        .from(table)
        .where(
          and(
            eq(table.memberId, memberId),
            eq(table.visibility, "shared"),
            notExists(
              db
                .select({ one: sql<number>`1` })
                .from(itemCircles)
                .where(
                  and(eq(itemCircles.itemType, itemType), eq(itemCircles.itemId, table.id)),
                ),
            ),
          ),
        );
      return { itemType, total: Number(row?.total ?? 0) };
    }),
  );
  return counts.filter((row) => row.total > 0);
}
