// netlify/lib/folders.ts
// A circle's folders: where a share belongs, as against what kind of thing it is.
//
// A circle organises what its members share into folders — "Madhwa Festivals ›
// Krishna Janmashtami" — and a folder holds anything: a song, a recipe, a book and
// a bookmark sit in one place because they are about one thing. That is the whole
// difference between this tree and the one in `taxonomy.ts`: a subcategory hangs
// off a *category*, so it can only ever hold one kind of thing, while a folder
// hangs off the **circle** and holds every kind at once. Neither replaces the
// other and neither is derived from the other.
//
// The arithmetic is `tree.ts`, exactly as it is for subcategories: paths, depths,
// descendants, cycles and the duplicate rule are the same job whatever the rows
// hang off. This file is what makes it a *circle's* tree — every function narrows
// the rows to one `circleId` first, and the refusals are worded for a keeper who
// was moving a folder.
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { folders, itemCircles } from "../../db/schema.js";
import type { User } from "@netlify/identity";
import {
  ITEM_TABLES,
  ITEM_TYPES,
  optionalText,
  text,
  visibleTo,
  type ItemType,
} from "./items.js";
import {
  cleanName,
  MAX_TREE_DEPTH,
  normalizeName,
  pathOf,
  reparentRefusal as reparentRefusalIn,
  similarNode,
  siblingsOf as siblingsIn,
  sortNodes,
  tooDeepFor as tooDeepForIn,
} from "./tree.js";

export type FolderRow = typeof folders.$inferSelect;

/**
 * The tree walk, re-exported unchanged: these ask nothing about a circle, only
 * about the rows they are given, so a caller reading them from here is reading
 * them from `tree.ts`.
 */
export {
  ancestorsOf,
  depthOf,
  descendantsOf,
  heightOf,
  nodeById,
  nodeHidden,
  pathOf,
  pathText,
  PATH_SEPARATOR,
  sortNodes,
  subtreeIds,
} from "./tree.js";

export { normalizeName };

export const MAX_FOLDER_NAME = 60;
/** Far enough that no circle meets it, near enough that a loop cannot run away. */
export const MAX_FOLDER_DEPTH = MAX_TREE_DEPTH;
/** A ceiling on the whole tree, so one circle cannot make the read unbounded. */
export const MAX_FOLDERS_PER_CIRCLE = 200;

export function folderNameOf(value: unknown) {
  return cleanName(text(value), MAX_FOLDER_NAME);
}

/** Every folder of a circle, in reading order within each level. */
export async function foldersOf(circleId: number) {
  return db
    .select()
    .from(folders)
    .where(eq(folders.circleId, circleId))
    .orderBy(asc(folders.sortOrder), asc(folders.name));
}

export async function folderById(circleId: number, folderId: number) {
  const [row] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.circleId, circleId)));
  return row ?? null;
}

/** One folder by id alone, for checking which circle a chosen folder belongs to. */
export async function findFolder(folderId: number) {
  const [row] = await db.select().from(folders).where(eq(folders.id, folderId));
  return row ?? null;
}

/** The folders of one level, which is where a name has to be unique. */
export function siblingsOf(rows: FolderRow[], parentId: number | null, exceptId?: number) {
  return siblingsIn(rows, parentId, exceptId);
}

/** A folder in this level whose name is close enough to be the same folder. */
export function similarFolder(name: string, existing: FolderRow[]) {
  return similarNode(name, existing);
}

export function tooDeepFor(rows: FolderRow[], parent: FolderRow | null) {
  return tooDeepForIn(rows, parent);
}

/**
 * Why a folder cannot go where it was dropped, worded for somebody moving one.
 * The rules themselves are the tree's: nothing inside itself, nothing from
 * another circle, nothing past the depth cap.
 */
export function reparentRefusal(rows: FolderRow[], node: FolderRow, parentId: number | null) {
  return reparentRefusalIn(rows, node, parentId, {
    self: "A folder cannot sit inside itself.",
    elsewhere: "Choose a folder in this circle to move it into.",
    inside: "A folder cannot be moved inside one of its own subfolders.",
    tooDeep: `Folders go ${MAX_FOLDER_DEPTH} levels deep at most.`,
    branchTooDeep: "That folder holds too many levels to sit there.",
  });
}

/**
 * Adds a folder under one parent, or hands back the one that is already there.
 * Sameness is judged among the parent's own subfolders, because "Songs" under
 * Janmashtami and "Songs" under Rathotsava are two real places; case and spacing
 * are settled by the normalised comparison here and by the unique index behind it,
 * so two admins adding the same name at once end up with one row.
 *
 * Null answers three different noes — a name that was only punctuation, a parent
 * from another circle, a tree already as deep or as wide as we allow — and the
 * caller says which, since only it knows what the member was doing.
 */
export async function addFolder(
  circleId: number,
  name: string,
  memberId: string | null,
  parentId: number | null = null,
): Promise<FolderRow | null> {
  const clean = folderNameOf(name);
  if (!clean) return null;

  const existing = await foldersOf(circleId);
  const parent = parentId === null ? null : existing.find((row) => row.id === parentId) ?? null;
  if (parentId !== null && !parent) return null;
  if (tooDeepFor(existing, parent)) return null;

  const siblings = siblingsOf(existing, parentId);
  const same = siblings.find((row) => normalizeName(row.name) === normalizeName(clean));
  if (same) return same;
  if (existing.length >= MAX_FOLDERS_PER_CIRCLE) return null;

  const [created] = await db
    .insert(folders)
    .values({
      circleId,
      parentId,
      name: clean,
      sortOrder: siblings.length,
      createdById: memberId,
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  // Lost a race against another keeper adding the same name; theirs is fine.
  const settled = await db
    .select()
    .from(folders)
    .where(and(eq(folders.circleId, circleId), eq(folders.name, clean)));
  return settled.find((row) => (row.parentId ?? null) === parentId) ?? null;
}

/**
 * Where a folder sits, moved. Everything inside it comes along — a folder names
 * its parent and nothing else, so moving Madhwa Festivals moves Janmashtami and
 * everything filed in it and there is nothing to rewrite.
 */
export async function moveFolder(node: FolderRow, parentId: number | null) {
  const rows = await foldersOf(node.circleId);
  const refusal = reparentRefusal(rows, node, parentId);
  if (refusal) return refusal;
  if ((node.parentId ?? null) === parentId) return null;

  const siblings = siblingsOf(rows, parentId, node.id);
  await db
    .update(folders)
    .set({ parentId, sortOrder: siblings.length })
    .where(eq(folders.id, node.id));
  return null;
}

/**
 * Merging one folder into another: everything in here moves there, the subfolders
 * this one had are handed over as well, and only then does the folder itself go.
 * Nothing is orphaned and nothing anybody shared is touched — a merge is a change
 * to a list of names.
 */
export async function mergeFolder(from: FolderRow, into: FolderRow) {
  await refileFolder(from.id, into.id);
  await db.update(folders).set({ parentId: into.id }).where(eq(folders.parentId, from.id));
  await db.delete(folders).where(eq(folders.id, from.id));
}

/**
 * Removing one folder. What was in it moves up to the folder above — which at the
 * top of a circle is no folder at all, so the shares land back in the circle
 * itself — and its subfolders move up with it rather than being cut off. Deleting
 * a folder never deletes what was in it.
 */
export async function deleteFolder(node: FolderRow) {
  const up = node.parentId ?? null;
  await refileFolder(node.id, up);
  await db.update(folders).set({ parentId: up }).where(eq(folders.parentId, node.id));
  await db.delete(folders).where(eq(folders.id, node.id));
}

/** Moves everything filed in one folder to another, or out of folders entirely. */
export async function refileFolder(fromId: number, toId: number | null) {
  await db
    .update(itemCircles)
    .set({ folderId: toId })
    .where(eq(itemCircles.folderId, fromId));
}

/** Puts one level's folders in the order a keeper moved them into. */
export async function applyFolderOrder(ids: number[]) {
  await Promise.all(
    ids.map((id, index) =>
      db.update(folders).set({ sortOrder: index }).where(eq(folders.id, id)),
    ),
  );
}

/**
 * How much is in each folder, derived from the shares the caller can actually see
 * rather than stored — the same rule the category counts follow, so a count is
 * never a promise a tap cannot keep.
 *
 * The key is the folder's id, with "none" for the shares that went into the circle
 * without a folder. Every kind is counted the same way, because a folder holds
 * every kind: that is the whole point of it.
 */
export async function folderCounts(circleId: number, user: User | null) {
  const counts = new Map<string, number>();
  const bump = (folderId: number | null, total: number) => {
    const key = folderId === null ? "none" : String(folderId);
    counts.set(key, (counts.get(key) ?? 0) + total);
  };

  await Promise.all(
    (ITEM_TYPES as readonly ItemType[]).map(async (itemType) => {
      const table = ITEM_TABLES[itemType];
      const rows = await db
        .select({ folderId: itemCircles.folderId, total: count() })
        .from(itemCircles)
        .innerJoin(table, eq(table.id, itemCircles.itemId))
        .where(
          and(
            eq(itemCircles.itemType, itemType),
            eq(itemCircles.circleId, circleId),
            visibleTo(table, user, itemType),
          ),
        )
        .groupBy(itemCircles.folderId);
      for (const row of rows) bump(row.folderId, Number(row.total));
    }),
  );

  return counts;
}

/**
 * One folder, the way it travels over the API. `parentId` is the whole of the
 * hierarchy — the browser builds the tree from it — and `path` comes along because
 * a breadcrumb is read in a dozen places and deriving it in each of them is a
 * dozen chances to derive it differently.
 *
 * Two counts, because a folder is asked two different questions: `count` is what
 * is in this folder exactly, and `totalCount` is the whole of it — which is what a
 * tile shows, since opening a folder shows what is in its subfolders too.
 */
export type FolderResponse = {
  id: number;
  name: string;
  parentId: number | null;
  path: string[];
  depth: number;
  sortOrder: number;
  hidden: boolean;
  count: number;
  totalCount: number;
  childCount: number;
};

/**
 * A circle's folders, depth first, so a list read straight down reads as a tree.
 * Only the shape is worked out here; the totals are rolled up afterwards, so the
 * same rule serves a keeper's full list and the shorter one a member sees.
 */
export function folderResponses(
  rows: FolderRow[],
  counts: Map<string, number>,
): FolderResponse[] {
  const at = (folderId: number) => counts.get(String(folderId)) ?? 0;
  const walk = (parentId: number | null, depth: number, above: string[]): FolderResponse[] =>
    sortNodes(rows.filter((row) => (row.parentId ?? null) === parentId)).flatMap((row) => {
      const path = [...above, row.name];
      return [
        {
          id: row.id,
          name: row.name,
          parentId,
          path,
          depth,
          sortOrder: row.sortOrder,
          hidden: row.status === "hidden",
          count: at(row.id),
          totalCount: 0,
          childCount: 0,
        },
        ...walk(row.id, depth + 1, path),
      ];
    });
  return rollUpFolders(walk(null, 1, []));
}

/**
 * What each folder adds up to. Run again whenever folders are dropped from the
 * list — a member's view leaves the hidden ones out, and a total that still
 * counted them would promise more than the tap delivers.
 */
export function rollUpFolders(nodes: FolderResponse[]) {
  const children = new Map<number, FolderResponse[]>();
  const present = new Set(nodes.map((node) => node.id));
  for (const node of nodes) {
    if (node.parentId === null) continue;
    const list = children.get(node.parentId);
    if (list) list.push(node);
    else children.set(node.parentId, [node]);
  }
  const total = (node: FolderResponse): number => {
    const mine = children.get(node.id) ?? [];
    node.childCount = mine.length;
    node.totalCount = node.count + mine.reduce((sum, child) => sum + total(child), 0);
    return node.totalCount;
  };
  // Top down, so every branch is walked once — and a folder whose parent is not in
  // this list is a top of its own here, which is what a filtered list leaves.
  for (const node of nodes) {
    if (node.parentId === null || !present.has(node.parentId)) total(node);
  }
  return nodes;
}

/**
 * What a member sees: the hidden folders gone, and anything inside one gone with
 * it, since a folder under a hidden one is not on offer either. The totals are
 * rolled up again afterwards for the same reason.
 */
export function foldersForMember(list: FolderResponse[]) {
  const hidden = new Set(list.filter((node) => node.hidden).map((node) => node.id));
  const dropped = new Set(hidden);
  let grew = true;
  while (grew) {
    grew = false;
    for (const node of list) {
      if (node.parentId !== null && dropped.has(node.parentId) && !dropped.has(node.id)) {
        dropped.add(node.id);
        grew = true;
      }
    }
  }
  return rollUpFolders(list.filter((node) => !dropped.has(node.id)));
}

/** A circle's folders with their counts, ready to travel. */
export async function circleFolderList(
  circleId: number,
  user: User | null,
  canManage: boolean,
): Promise<FolderResponse[]> {
  const [rows, counts] = await Promise.all([foldersOf(circleId), folderCounts(circleId, user)]);
  const list = folderResponses(rows, counts);
  return canManage ? list : foldersForMember(list);
}

/**
 * The folder a share form said it was going into. Three answers, and the
 * difference between the last two is what makes editing safe: a number files the
 * share, null takes it out of every folder, and undefined is a form that never
 * asked, which leaves it exactly where it is.
 *
 * There is no path half to this the way there is for a subcategory, because a
 * folder is per-circle in the same way a category is: the chosen folder names one
 * circle, and every other circle a share reaches simply holds it unfoldered.
 */
export function folderIdFrom(body: Record<string, unknown>): number | null | undefined {
  if (!("folderId" in body)) return undefined;
  const id = Number(body.folderId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** The folder name a form sent, for the "+ New folder" panel on a share form. */
export function folderNameFrom(body: Record<string, unknown>) {
  return optionalText(body.folderName);
}

/** The refusal a member reads when a folder was theirs to browse and not to change. */
export function notTheFolderKeeper() {
  return Response.json(
    { error: "Only the circle's owner or one of its admins can change its folders." },
    { status: 403 },
  );
}

/**
 * The path down to each of a set of folders, by id — "Austin › Thursday Bhajane".
 *
 * A filing carries the folder's id and nothing else, which is all a listing needs
 * to narrow itself; a form asked to *name* where a share already sits needs the
 * words. The tree is loaded per circle on the surfaces that browse it, and an
 * edit form can be opened from anywhere — the songs tab, My Library, a
 * notification — so the answer travels with the share instead.
 *
 * Two reads: the folders asked about, then the whole tree of whichever circles
 * they turned out to belong to, since a path is made of ancestors the caller
 * never named. Both are bounded by `MAX_FOLDERS_PER_CIRCLE`.
 */
export async function folderPathsFor(folderIds: number[]) {
  const paths = new Map<number, string[]>();
  if (folderIds.length === 0) return paths;

  const named = await db
    .select({ circleId: folders.circleId })
    .from(folders)
    .where(inArray(folders.id, folderIds));
  const circleIds = [...new Set(named.map((row) => row.circleId))];
  if (circleIds.length === 0) return paths;

  const rows = await db.select().from(folders).where(inArray(folders.circleId, circleIds));
  const wanted = new Set(folderIds);
  for (const row of rows) {
    if (wanted.has(row.id)) paths.set(row.id, pathOf(rows, row));
  }
  return paths;
}

/** Which folders exist in a circle, as ids, for validating what a form sent. */
export async function folderIdsOf(circleIds: number[]) {
  if (circleIds.length === 0) return new Map<number, number>();
  const rows = await db
    .select({ id: folders.id, circleId: folders.circleId })
    .from(folders)
    .where(inArray(folders.circleId, circleIds));
  return new Map(rows.map((row) => [row.id, row.circleId]));
}
