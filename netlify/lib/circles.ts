// netlify/lib/circles.ts
// Circles are the groups members share into: "Book Club", "Travel lovers",
// "Music Lovers". Everything about who may see, join, or change a circle lives
// here, alongside the rules for linking a shared item to one or more of them.
import { getStore } from "@netlify/blobs";
import type { User } from "@netlify/identity";
import { and, count, eq, inArray, notInArray, sql, type InferSelectModel } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  circleCategories,
  circleInvites,
  circleMembers,
  circles,
  itemCircles,
  members,
  notifications,
  subcategories,
} from "../../db/schema.js";
import {
  circlesAccepting,
  findCategory,
  resolveSubcategory,
  type ShelfChoice,
} from "./categories.js";
import { clearCategoryFields } from "./fields.js";
import { findFolder, folderPathsFor } from "./folders.js";
import { ITEM_TABLES, firstGlyph, isItemType, memberNameOf, text, type ItemType } from "./items.js";
import { contactNames } from "./members.js";

export type Circle = InferSelectModel<typeof circles>;
export type CircleMember = InferSelectModel<typeof circleMembers>;

/**
 * The three doors a circle can have. "private" is invite only; "discoverable" is
 * listed and joined by asking its owner, which the app calls **Ask to Join**; and
 * "public" is listed and joined on the spot, which the app calls **Open to All**.
 *
 * An open circle is the one door nobody has to answer, which is what makes a new
 * member's first circle findable without anybody being around to let them in — so
 * it is offered again, and `CHOOSABLE_PRIVACIES` is now the whole list.
 */
export const PRIVACIES = ["private", "discoverable", "public"] as const;
export type Privacy = (typeof PRIVACIES)[number];

export const CHOOSABLE_PRIVACIES = PRIVACIES;

export function privacyOf(value: unknown): Privacy {
  return (CHOOSABLE_PRIVACIES as readonly string[]).includes(String(value))
    ? (value as Privacy)
    : "private";
}

export const DEFAULT_ICON = "👥";

/** Enough circles for one item to reach every group a member belongs to. */
export const MAX_CIRCLES_PER_ITEM = 12;
/** A ceiling on how many circles one member may own, so nothing runs away. */
export const MAX_CIRCLES_OWNED = 40;
/** How many people an owner may invite into a circle in one go. */
export const MAX_INVITES_PER_CALL = 50;

/**
 * An icon is one glyph, not a sentence — see `firstGlyph()` for why that is not
 * the same as one character.
 */
export function iconOf(value: unknown) {
  return firstGlyph(value) ?? DEFAULT_ICON;
}

/**
 * Whether a plain member may add to this circle's taxonomy, as a form said it.
 * Undefined is a form that never asked, which on a create means the default and
 * on an edit means leave it exactly as it is — the same three-state read filing
 * and photos use.
 */
export function memberTaxonomyFrom(body: Record<string, unknown>) {
  if (!("memberTaxonomy" in body)) return undefined;
  return body.memberTaxonomy !== false;
}

/**
 * The circle this one is a branch of, as a form said it.
 *
 * The same three-state read filing and photos use, and all three states are
 * meaningful: a number attaches the circle under that one, an explicit null
 * makes it independent again, and the key being absent says nothing at all — so
 * an edit that never asked the question leaves the answer alone.
 *
 * "Branch of" is what a member reads; `parent_circle_id` is what it is called
 * underneath, and this is the seam between the two.
 */
export function parentCircleIdFrom(body: Record<string, unknown>) {
  if (!("parentCircleId" in body)) return undefined;
  const value = body.parentCircleId;
  if (value === null || value === "" || value === "none") return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** One circle by id, or null. */
export async function circleById(id: number): Promise<Circle | null> {
  const [row] = await db.select().from(circles).where(eq(circles.id, id));
  return row ?? null;
}

/**
 * Whether a circle may be made a branch of another one — the structural half of
 * the question, the permission half being `moderatorOf()` on the proposed parent
 * in the route.
 *
 * The hierarchy is deliberately one level deep: an organisation and the places
 * it happens in. So a branch may not be a branch of a branch, and a circle that
 * already has branches of its own may not be tucked under a third — either would
 * make a chain nothing in the app draws, and a chain is one bad `PATCH` away
 * from a cycle no listing could escape. Discover stands outside it in both
 * directions, being the circle every account is joined to.
 *
 * Answers a refusal naming the rule that was met, or null when the move is fine.
 */
export async function branchRefusal(
  parentId: number,
  circle: { id: number; name: string; isDefault: boolean } | null,
): Promise<Response | null> {
  if (circle?.isDefault) {
    return Response.json(
      { error: "Discover is the circle everybody is in, so it cannot be a branch of another one." },
      { status: 403 },
    );
  }
  if (circle && parentId === circle.id) {
    return Response.json({ error: "A circle cannot be a branch of itself." }, { status: 400 });
  }

  const parent = await circleById(parentId);
  if (!parent) return Response.json({ error: "That circle no longer exists." }, { status: 400 });
  if (parent.isDefault) {
    return Response.json(
      { error: "Discover is the circle everybody is in, so nothing is a branch of it." },
      { status: 400 },
    );
  }
  if (parent.parentCircleId !== null) {
    return Response.json(
      {
        error: `${parent.name} is itself a branch, and a branch cannot have branches of its own. Pick the circle above it.`,
      },
      { status: 400 },
    );
  }

  if (circle) {
    const [own] = await db
      .select({ count: count() })
      .from(circles)
      .where(eq(circles.parentCircleId, circle.id));
    if ((own?.count ?? 0) > 0) {
      return Response.json(
        {
          error: `${circle.name} has branches of its own, so it cannot become a branch. Detach those first.`,
        },
        { status: 400 },
      );
    }
  }

  return null;
}

/**
 * The name and icon of every parent named by the circles given, so a branch can
 * say what it is a branch of.
 *
 * It travels with the branch rather than being looked up in the browser's own
 * circle list because the two are different questions: somebody can be a member
 * of Austin and not of SVKV, and their Austin page still has to read "Branch of
 * SVKV". One read whatever the number of circles.
 */
export async function parentsOf(rows: Circle[]): Promise<Map<number, Circle>> {
  const ids = [...new Set(rows.map((row) => row.parentCircleId).filter((id): id is number => !!id))];
  if (ids.length === 0) return new Map();
  const parents = await db.select().from(circles).where(inArray(circles.id, ids));
  return new Map(parents.map((parent) => [parent.id, parent]));
}

export function circleIdFrom(params: Record<string, string | undefined>) {
  const id = Number(params.circleId ?? params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** The blob store for cover images; the row keeps only the key. */
export function coverStore() {
  return getStore("circle-covers");
}

/** Comfortably under the 6 MB a function may receive in one request body. */
export const MAX_COVER_BYTES = 5 * 1024 * 1024;

export function coverUrl(key: string | null) {
  return key ? `/api/circle-covers/${encodeURIComponent(key)}` : null;
}

/** How a circle travels over the API: the row, plus what it means to the caller. */
export function circleResponse(
  circle: Circle,
  extra: {
    memberCount?: number;
    /** "owner" or "member" when the caller is in the circle, otherwise null. */
    role?: string | null;
    /** "invited" when the caller has been asked in, "requested" when they asked. */
    standing?: "invited" | "requested" | null;
    /**
     * The circle this one is a branch of, when it is one — the row itself, so
     * the branch can be drawn under its organisation's name and icon without
     * the reader having to be a member of that organisation.
     */
    parent?: Circle | null;
  } = {},
) {
  return {
    id: circle.id,
    name: circle.name,
    description: circle.description,
    icon: circle.icon,
    coverUrl: coverUrl(circle.coverKey),
    privacy: circle.privacy,
    ownerId: circle.ownerId,
    ownerName: circle.ownerName,
    /** Discover, the one circle everybody is in. Marked by the column, never the name. */
    isDefault: circle.isDefault,
    /**
     * Whether a plain member may add to this circle's taxonomy while posting. The
     * circle's one piece of configuration, and on by default — inventing a shelf
     * mid-post is how filing has always worked here, and switching it off is the
     * decision rather than switching it on.
     */
    memberTaxonomy: circle.memberTaxonomy,
    /**
     * The circle this one is a branch of, or null when it stands on its own.
     * Organisational only: nothing about membership, roles, categories or
     * content follows the link, which is why the response carries the parent's
     * name and icon and nothing else about it.
     */
    parentCircleId: circle.parentCircleId,
    parentName: extra.parent?.name ?? null,
    parentIcon: extra.parent?.icon ?? null,
    memberCount: extra.memberCount ?? 0,
    role: extra.role ?? null,
    standing: extra.standing ?? null,
    createdAt: circle.createdAt,
  };
}

export type CircleResponse = ReturnType<typeof circleResponse>;

/** Every circle the caller belongs to, with the role they hold in it. */
export async function myCircleRows(user: User | null) {
  if (!user) return [];
  return db
    .select({ circle: circles, role: circleMembers.role })
    .from(circleMembers)
    .innerJoin(circles, eq(circles.id, circleMembers.circleId))
    .where(eq(circleMembers.memberId, user.id))
    .orderBy(circles.name);
}

export async function myCircleIds(user: User | null): Promise<number[]> {
  if (!user) return [];
  const rows = await db
    .select({ circleId: circleMembers.circleId })
    .from(circleMembers)
    .where(eq(circleMembers.memberId, user.id));
  return rows.map((row) => row.circleId);
}

/**
 * One member of the group as the caller meets them: their name, and every circle
 * the two of them share.
 *
 * This is the roll for **All circles**, which is where the app opens. A circle's
 * own roll is a list of people in one room and carries that room's roles and its
 * waiting list; this one is the people the caller actually shares a circle with,
 * across all of them, so it answers "who is here?" without first asking "here
 * where?". It is deliberately not the whole `members` directory: the directory is
 * everybody the app knows about, which is a larger and different claim.
 */
export interface GroupMember {
  memberId: string;
  memberName: string;
  /** The shared circles, by the caller's own ordering of them. */
  circles: { circleId: number; circleName: string; circleIcon: string; role: string }[];
}

/**
 * Everybody in the circles named, once each, with the circles they were found in
 * hanging off them. Two reads whatever the number of circles: the memberships
 * themselves, and the display names, because `circle_members.member_name` is
 * frozen at the moment somebody joined and a member who has since renamed
 * themselves should not read as two different people across two circles.
 */
export async function groupRoll(circleIds: number[]): Promise<GroupMember[]> {
  if (circleIds.length === 0) return [];
  const rows = await db
    .select({
      memberId: circleMembers.memberId,
      memberName: circleMembers.memberName,
      role: circleMembers.role,
      circleId: circles.id,
      circleName: circles.name,
      circleIcon: circles.icon,
    })
    .from(circleMembers)
    .innerJoin(circles, eq(circles.id, circleMembers.circleId))
    .where(inArray(circleMembers.circleId, circleIds))
    .orderBy(circles.name);

  const current = await currentNames([...new Set(rows.map((row) => row.memberId))]);

  const byMember = new Map<string, GroupMember>();
  for (const row of rows) {
    const found = byMember.get(row.memberId);
    const entry =
      found ??
      ({
        memberId: row.memberId,
        memberName: current.get(row.memberId) || row.memberName || "A member",
        circles: [],
      } satisfies GroupMember);
    entry.circles.push({
      circleId: row.circleId,
      circleName: row.circleName,
      circleIcon: firstGlyph(row.circleIcon) || row.circleIcon,
      role: row.role,
    });
    if (!found) byMember.set(row.memberId, entry);
  }

  return [...byMember.values()].sort((a, b) => a.memberName.localeCompare(b.memberName));
}

/** Display names as the members themselves keep them, for the ids given. */
async function currentNames(memberIds: string[]) {
  const names = new Map<string, string>();
  if (memberIds.length === 0) return names;
  const rows = await db
    .select({ id: members.id, name: members.name })
    .from(members)
    .where(inArray(members.id, memberIds));
  for (const row of rows) if (row.name) names.set(row.id, row.name);
  return names;
}

/** The caller's membership row for one circle, or null when they are not in it. */
export async function membershipOf(circleId: number, user: User | null) {
  if (!user) return null;
  const [row] = await db
    .select()
    .from(circleMembers)
    .where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.memberId, user.id)));
  return row ?? null;
}

/** Head counts for a set of circles, in one query. */
export async function memberCounts(circleIds: number[]) {
  const counts = new Map<number, number>();
  if (circleIds.length === 0) return counts;
  const rows = await db
    .select({ circleId: circleMembers.circleId, total: count() })
    .from(circleMembers)
    .where(inArray(circleMembers.circleId, circleIds))
    .groupBy(circleMembers.circleId);
  for (const row of rows) counts.set(row.circleId, Number(row.total));
  return counts;
}

/** Adds someone to a circle. Idempotent, so a double tap cannot join them twice. */
export async function joinCircle(
  circleId: number,
  member: { id: string; name: string },
  role: "owner" | "member" = "member",
) {
  await db
    .insert(circleMembers)
    .values({ circleId, memberId: member.id, memberName: member.name, role })
    .onConflictDoNothing();
}

/** A pending invitation or join request for one member of one circle. */
export async function pendingFor(circleId: number, memberId: string, kind: "invite" | "request") {
  const [row] = await db
    .select()
    .from(circleInvites)
    .where(
      and(
        eq(circleInvites.circleId, circleId),
        eq(circleInvites.memberId, memberId),
        eq(circleInvites.kind, kind),
        eq(circleInvites.status, "pending"),
      ),
    );
  return row ?? null;
}

/** The list of circle ids a form sent, or null when it did not mention circles. */
export function circleIdsFrom(body: Record<string, unknown>): number[] | null {
  if (!("circleIds" in body)) return null;
  const raw = Array.isArray(body.circleIds) ? body.circleIds : [];
  const ids: number[] = [];
  for (const entry of raw) {
    const id = Number(entry);
    if (Number.isInteger(id) && id > 0 && !ids.includes(id)) ids.push(id);
  }
  return ids.slice(0, MAX_CIRCLES_PER_ITEM);
}

/**
 * Points an item at the circles its author chose. Only circles the author belongs
 * to count — you cannot post into a room you are not in — and links to circles
 * the author cannot see are left untouched rather than silently dropped.
 *
 * `shelf` is the one taxonomy node the member picked, as both halves of the same
 * answer: the node's own id and its path written out. It is resolved separately in
 * each chosen circle — by id in the circle that owns the node, by path everywhere
 * else, created there when the circle allows it — because a tree belongs to a
 * circle: the same post can be "Rice Items › Pulao" in one and unfiled in
 * another. Leaving it undefined files nothing and disturbs nothing.
 *
 * Returns the circles the item now reaches, for the notifications that follow.
 *
 * `categoryId` is the category the share is filed under, when its author chose one
 * rather than letting it land where its kind usually does. It names one circle's
 * own list — categories belong to a circle — so it is stored against that circle
 * and nowhere else, and every other circle files the share under its own category
 * for this kind of thing, which is what a null in the column means. A post always
 * sends one, its category being where it lives rather than a second opinion about it.
 *
 * `folderId` is the folder the member shared into, which is a circle's own
 * structure rather than a category's: it names one circle, so it is written on
 * that circle's row and left null on every other circle the share reaches. There
 * is no path half to it the way there is for a shelf, because two circles' folder
 * trees are two different things and nothing should be invented in one of them
 * because somebody posted into the other. Undefined says nothing and leaves
 * whatever is already there.
 */
export async function setItemCircles(
  itemType: ItemType,
  itemId: number,
  requested: number[],
  user: User,
  shelf?: ShelfChoice | null,
  categoryId?: number | null,
  folderId?: number | null,
) {
  const mine = await myCircleRows(user);
  const mineIds = mine.map((row) => row.circle.id);

  // A circle that has switched this category off takes nothing new of the kind.
  // Somewhere it is already posted is a different matter: hiding a category never
  // reaches back and removes what is already in it, and neither does an edit.
  const asked = mine.filter((row) => requested.includes(row.circle.id)).map((row) => row.circle);
  const already = new Set(
    (
      await db
        .select({ circleId: itemCircles.circleId })
        .from(itemCircles)
        .where(and(eq(itemCircles.itemType, itemType), eq(itemCircles.itemId, itemId)))
    ).map((row) => row.circleId),
  );
  const accepting = await circlesAccepting(
    asked.map((circle) => circle.id),
    itemType,
    categoryId,
  );
  const chosen = asked.filter(
    (circle) => accepting.has(circle.id) || already.has(circle.id),
  );
  const chosenIds = chosen.map((circle) => circle.id);

  if (mineIds.length > 0) {
    await db.delete(itemCircles).where(
      and(
        eq(itemCircles.itemType, itemType),
        eq(itemCircles.itemId, itemId),
        inArray(itemCircles.circleId, mineIds),
        chosenIds.length > 0 ? notInArray(itemCircles.circleId, chosenIds) : undefined,
      ),
    );
  }

  if (chosenIds.length > 0) {
    // The chosen category counts only in the circle that owns it, and so does the
    // chosen folder: both belong to one circle rather than to the share.
    const filed = categoryId ? await findCategory(categoryId) : null;
    const folder = folderId ? await findFolder(folderId) : null;
    const values = await Promise.all(
      chosenIds.map(async (circleId) => ({
        itemType,
        itemId,
        circleId,
        categoryId: filed && filed.circleId === circleId ? filed.id : null,
        folderId: folder && folder.circleId === circleId ? folder.id : null,
        subcategoryId:
          shelf === undefined
            ? null
            : await resolveSubcategory(circleId, itemType, shelf, user, categoryId),
      })),
    );

    const insert = db.insert(itemCircles).values(values);
    // A form that said nothing about filing leaves whatever is already there, and
    // each half of filing is left alone on its own: an edit that only moves a share
    // to another category keeps the shelf, and one that only reshelves it keeps the
    // category.
    const set = {
      ...(shelf === undefined ? {} : { subcategoryId: sql`excluded.subcategory_id` }),
      ...(categoryId === undefined ? {} : { categoryId: sql`excluded.category_id` }),
      ...(folderId === undefined ? {} : { folderId: sql`excluded.folder_id` }),
    };
    await (Object.keys(set).length === 0
      ? insert.onConflictDoNothing()
      : insert.onConflictDoUpdate({
          target: [itemCircles.itemType, itemCircles.itemId, itemCircles.circleId],
          set,
        }));
  }

  return chosen;
}

/** Called when an item is deleted for everyone: its circle links go with it. */
export async function clearItemCircles(itemType: ItemType, itemId: number) {
  await db
    .delete(itemCircles)
    .where(and(eq(itemCircles.itemType, itemType), eq(itemCircles.itemId, itemId)));
}

/**
 * Applies an edit's "Share with" choice and reports the circles the item now
 * shows to its author. A form that says nothing about circles leaves them alone,
 * and turning an item private takes it out of every circle it was in.
 *
 * Refiling works on its own: a member can change only the subcategory of a post
 * and its circles stay exactly as they were, which is what makes "post now,
 * classify later" possible.
 */
export async function applyItemCircles(
  itemType: ItemType,
  itemId: number,
  requested: number[] | null,
  visibility: string,
  user: User,
  shelf?: ShelfChoice | null,
  categoryId?: number | null,
  folderId?: number | null,
): Promise<number[]> {
  if (visibility === "private") {
    await clearItemCircles(itemType, itemId);
    return [];
  }
  if (requested === null) {
    const current = (await circleIdsByItem(itemType, [itemId], user)).get(itemId) ?? [];
    if (shelf !== undefined || categoryId !== undefined || folderId !== undefined) {
      const filed = categoryId ? await findCategory(categoryId) : null;
      const folder = folderId ? await findFolder(folderId) : null;
      await Promise.all(
        current.map(async (circleId) => {
          const set: {
            categoryId?: number | null;
            subcategoryId?: number | null;
            folderId?: number | null;
          } = {};
          if (categoryId !== undefined) {
            set.categoryId = filed && filed.circleId === circleId ? filed.id : null;
          }
          if (folderId !== undefined) {
            set.folderId = folder && folder.circleId === circleId ? folder.id : null;
          }
          if (shelf !== undefined) {
            set.subcategoryId = await resolveSubcategory(
              circleId,
              itemType,
              shelf,
              user,
              categoryId,
            );
          }
          await db
            .update(itemCircles)
            .set(set)
            .where(
              and(
                eq(itemCircles.itemType, itemType),
                eq(itemCircles.itemId, itemId),
                eq(itemCircles.circleId, circleId),
              ),
            );
        }),
      );
    }
    return current;
  }
  const chosen = await setItemCircles(
    itemType,
    itemId,
    requested,
    user,
    shelf,
    categoryId,
    folderId,
  );
  return chosen.map((circle) => circle.id);
}

/**
 * Where each item sits, limited to circles the caller is in — an item may also
 * sit in circles that are none of their business. Each entry carries the circle,
 * the category it was filed under there and the subcategory within it, both of
 * which are per-circle because categories and their shelves are.
 *
 * A null `categoryId` is the ordinary case and means "wherever this kind of thing
 * goes in that circle" — a song under Songs. An id is the author having said
 * otherwise, which is how a song comes to be an Events entry in one circle and an
 * ordinary song in the next.
 *
 * `folderId` is the circle's own folder the share was put into, which is
 * per-circle for the same reason: a folder tree belongs to a circle, so the
 * answer differs from one to the next and a null means the share sits in the
 * circle itself rather than in any folder of it. `folderPath` is that folder
 * written out — "Austin › Thursday Bhajane" — and it travels with the filing
 * because a form asked to state where a share already sits can be opened from
 * anywhere, including surfaces that never load a circle's folder tree. The extra
 * read is skipped entirely when nothing listed is in a folder.
 *
 * A visitor with no account is in no circle and yet is reading one: Discover is
 * the only thing `visibleTo()` will have let through for them, so that is the
 * filing they get, and a feed row still names the circle it came from and the
 * shelf it sits on there.
 */
export async function circleFilingsByItem(
  itemType: ItemType,
  itemIds: number[],
  user: User | null,
) {
  const byItem = new Map<
    number,
    {
      circleId: number;
      categoryId: number | null;
      subcategoryId: number | null;
      folderId: number | null;
      folderPath: string[] | null;
    }[]
  >();
  if (itemIds.length === 0) return byItem;

  const columns = {
    itemId: itemCircles.itemId,
    circleId: itemCircles.circleId,
    categoryId: itemCircles.categoryId,
    subcategoryId: itemCircles.subcategoryId,
    folderId: itemCircles.folderId,
  };
  const where = and(eq(itemCircles.itemType, itemType), inArray(itemCircles.itemId, itemIds));

  const rows = user
    ? await db
        .select(columns)
        .from(itemCircles)
        .innerJoin(
          circleMembers,
          and(
            eq(circleMembers.circleId, itemCircles.circleId),
            eq(circleMembers.memberId, user.id),
          ),
        )
        .where(where)
    : await db
        .select(columns)
        .from(itemCircles)
        .innerJoin(
          circles,
          and(eq(circles.id, itemCircles.circleId), eq(circles.isDefault, true)),
        )
        .where(where);

  const paths = await folderPathsFor([
    ...new Set(rows.map((row) => row.folderId).filter((id): id is number => id !== null)),
  ]);

  for (const row of rows) {
    const filing = {
      circleId: row.circleId,
      categoryId: row.categoryId,
      subcategoryId: row.subcategoryId,
      folderId: row.folderId,
      folderPath: row.folderId === null ? null : (paths.get(row.folderId) ?? null),
    };
    const list = byItem.get(row.itemId);
    if (list) list.push(filing);
    else byItem.set(row.itemId, [filing]);
  }
  return byItem;
}

/**
 * The circle ids to show against each item, limited to circles the caller is in.
 */
export async function circleIdsByItem(itemType: ItemType, itemIds: number[], user: User | null) {
  const filings = await circleFilingsByItem(itemType, itemIds, user);
  const byItem = new Map<number, number[]>();
  for (const [itemId, list] of filings) {
    byItem.set(
      itemId,
      list.map((filing) => filing.circleId),
    );
  }
  return byItem;
}

/**
 * The circles a share already reaches, named. `setItemCircles()` hands these back
 * when something is created, but news that arrives later — a discussion opened on
 * a book somebody else shared — has to look them up.
 */
export async function circlesOfItem(itemType: ItemType, itemId: number) {
  return db
    .select({ id: circles.id, name: circles.name, icon: circles.icon })
    .from(itemCircles)
    .innerJoin(circles, eq(circles.id, itemCircles.circleId))
    .where(and(eq(itemCircles.itemType, itemType), eq(itemCircles.itemId, itemId)));
}

/** One item's circles and shelves, for the response to a create or an edit. */
export async function filingsOf(itemType: ItemType, itemId: number, user: User | null) {
  return (await circleFilingsByItem(itemType, [itemId], user)).get(itemId) ?? [];
}

/**
 * Adds `circleIds` to every row of a listing, so each post can name its circle,
 * and `filings` so a circle's category pages can tell which shelf it is on.
 */
export async function withCircleIds<T extends { id: number }>(
  itemType: ItemType,
  rows: T[],
  user: User | null,
) {
  const byItem = await circleFilingsByItem(
    itemType,
    rows.map((row) => row.id),
    user,
  );
  return rows.map((row) => {
    const filings = byItem.get(row.id) ?? [];
    return {
      ...row,
      circleIds: filings.map((filing) => filing.circleId),
      filings,
    };
  });
}

/**
 * The activity feed for a share. With circles, one row per circle, so a member
 * only ever hears about circles they are in; with none, the group-wide row the
 * app has always written.
 */
export async function announceShare(share: {
  itemType: ItemType;
  message: string;
  link?: string | null;
  circles: { id: number; name: string; icon: string }[];
}) {
  const rows =
    share.circles.length > 0
      ? share.circles.map((circle) => ({
          message: `${circle.icon} ${share.message} in ${circle.name}`,
          itemType: share.itemType,
          circleId: circle.id,
          link: share.link ?? null,
        }))
      : [{ message: share.message, itemType: share.itemType, link: share.link ?? null }];

  await db.insert(notifications).values(rows);
}

/**
 * Deleting a circle must not widen anything: an item that was only ever shared
 * into that circle would otherwise fall back to "everyone in the group". Those
 * items become private to their author instead, and the rest keep the circles
 * they still have.
 */
export async function closeCircleContent(circleId: number) {
  const links = await db
    .select({ itemType: itemCircles.itemType, itemId: itemCircles.itemId })
    .from(itemCircles)
    .where(eq(itemCircles.circleId, circleId));

  await db.delete(itemCircles).where(eq(itemCircles.circleId, circleId));

  const byType = new Map<ItemType, number[]>();
  for (const link of links) {
    if (!isItemType(link.itemType)) continue;
    const list = byType.get(link.itemType);
    if (list) list.push(link.itemId);
    else byType.set(link.itemType, [link.itemId]);
  }

  for (const [itemType, itemIds] of byType) {
    const stillLinked = await db
      .select({ itemId: itemCircles.itemId })
      .from(itemCircles)
      .where(and(eq(itemCircles.itemType, itemType), inArray(itemCircles.itemId, itemIds)));
    const keep = new Set(stillLinked.map((row) => row.itemId));
    const orphans = itemIds.filter((id) => !keep.has(id));
    if (orphans.length === 0) continue;

    const table = ITEM_TABLES[itemType];
    await db.update(table).set({ visibility: "private" }).where(inArray(table.id, orphans));
  }
}

/** Everything a circle owns, gone: its content links, its members, its waiting room. */
export async function deleteCircle(circleId: number) {
  await closeCircleContent(circleId);
  const categories = await db
    .select({ id: circleCategories.id })
    .from(circleCategories)
    .where(eq(circleCategories.circleId, circleId));
  if (categories.length > 0) {
    await db.delete(subcategories).where(
      inArray(
        subcategories.categoryId,
        categories.map((category) => category.id),
      ),
    );
    await clearCategoryFields(categories.map((category) => category.id));
  }
  await db.delete(circleCategories).where(eq(circleCategories.circleId, circleId));
  await db.delete(circleInvites).where(eq(circleInvites.circleId, circleId));
  await db.delete(circleMembers).where(eq(circleMembers.circleId, circleId));
  // Anything that was a branch of this one stands on its own now. Closing an
  // organisation is not a way to close the places under it: each of those is a
  // full circle with its own members, categories and shares, and it keeps every
  // one of them — it simply stops being drawn under a circle that has gone.
  await db
    .update(circles)
    .set({ parentCircleId: null })
    .where(eq(circles.parentCircleId, circleId));
  await db.delete(circles).where(eq(circles.id, circleId));
}

/** The name to store for the caller, matching how items record their author. */
export function memberOf(user: User) {
  return { id: user.id, name: memberNameOf(user) };
}

/**
 * The owner asks people in. Anyone already in the circle is skipped, a previously
 * declined invitation re-opens rather than duplicating, and each invitee gets a
 * notification addressed to them alone.
 */
export async function inviteMembers(
  circle: Circle,
  inviter: { id: string; name: string },
  memberIds: string[],
) {
  const wanted = [...new Set(memberIds.map((id) => text(id)).filter(Boolean))].slice(
    0,
    MAX_INVITES_PER_CALL,
  );
  if (wanted.length === 0) return [];

  const already = await db
    .select({ memberId: circleMembers.memberId })
    .from(circleMembers)
    .where(
      and(eq(circleMembers.circleId, circle.id), inArray(circleMembers.memberId, wanted)),
    );
  const inCircle = new Set(already.map((row) => row.memberId));
  const names = await contactNames();

  const invitees = wanted.filter((id) => !inCircle.has(id) && id !== inviter.id);
  if (invitees.length === 0) return [];

  const rows = invitees.map((memberId) => ({
    circleId: circle.id,
    kind: "invite",
    memberId,
    memberName: names.get(memberId) ?? "A member",
    invitedById: inviter.id,
    invitedByName: inviter.name,
    status: "pending",
    respondedAt: null,
  }));

  const invited = await db
    .insert(circleInvites)
    .values(rows)
    .onConflictDoUpdate({
      target: [circleInvites.circleId, circleInvites.memberId, circleInvites.kind],
      set: {
        status: "pending",
        respondedAt: null,
        invitedById: inviter.id,
        invitedByName: inviter.name,
      },
    })
    .returning();

  await db.insert(notifications).values(
    invited.map((row) => ({
      message: `${inviter.name} invited you to ${circle.icon} ${circle.name}`,
      itemType: null,
      memberId: row.memberId,
      link: "#/circles",
    })),
  );

  return invited;
}

