// netlify/lib/categories.ts
// A circle's categories, and the taxonomy tree inside each of them. Six categories
// mirror the built-in kinds of thing members share; the rest are whatever the
// circle invented, and those belong to the one circle that made them. Everything
// here is scoped to a circle, so two circles never see or affect each other's
// shape.
//
// A category is the root of a tree. Under it, `subcategories` rows each name the
// row above them, so Recipes › Vegetarian › South Indian › Karnataka is a category
// and three nodes, and a branch is as deep as its circle needs. `taxonomy.ts` holds
// everything about the shape — paths, depths, descendants, cycles — and this file
// holds everything that reads or writes it.
import type { User } from "@netlify/identity";
import { and, asc, count, eq, inArray, ne } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  circleCategories,
  circleMembers,
  circles,
  itemCircles,
  posts,
  subcategories,
} from "../../db/schema.js";
import {
  ITEM_TABLES,
  ITEM_TYPES,
  firstGlyph,
  isItemType,
  optionalText,
  text,
  visibleTo,
  type ItemType,
} from "./items.js";
import { fieldResponse, fieldsOf, seedStarterFields, type FieldRow } from "./fields.js";
import {
  MAX_SUBCATEGORY_NAME,
  MAX_TAXONOMY_DEPTH,
  ancestorsOf,
  depthOf,
  descendantsOf,
  nodeAtPath,
  nodeById,
  nodeHidden,
  normalizeName,
  pathOf,
  reparentRefusal,
  siblingsOf,
  similarSubcategory,
  sortNodes,
  splitPath,
  subcategoryNameOf,
  subtreeIds,
  tooDeepFor,
  type ShelfChoice,
} from "./taxonomy.js";

// The naming rules and the tree walk reach here through `taxonomy.ts`, which is
// what scopes them to one category; they are re-exported because every route that
// reshapes a circle reads them from this file.
export {
  MAX_SUBCATEGORY_NAME,
  MAX_TAXONOMY_DEPTH,
  PATH_SEPARATOR,
  ancestorsOf,
  depthOf,
  descendantsOf,
  nodeAtPath,
  nodeById,
  nodeHidden,
  normalizeName,
  pathOf,
  pathText,
  reparentRefusal,
  siblingsOf,
  similarSubcategory,
  sortNodes,
  splitPath,
  subcategoryNameOf,
  subtreeIds,
  tooDeepFor,
  type ShelfChoice,
} from "./taxonomy.js";

export type CategoryRow = typeof circleCategories.$inferSelect;
export type SubcategoryRow = typeof subcategories.$inferSelect;

/** A category invented by an owner holds `post` rows rather than one of the six. */
export const CUSTOM_ITEM_TYPE = "post" as const;
export const DEFAULT_CATEGORY_ICON = "📌";

export const MAX_CATEGORIES_PER_CIRCLE = 24;
export const MAX_SUBCATEGORIES_PER_CATEGORY = 60;
export const MAX_CATEGORY_NAME = 40;

/**
 * The categories a circle can switch on, with the subcategories each one starts
 * with. Seeds are a starting point only — every one of them can be renamed,
 * merged away or deleted, and members add their own from the share form.
 *
 * Fun facts and vocabulary are separate categories rather than one "Learn",
 * because they are two different kinds of thing with two different forms: a word
 * has a meaning and a pronunciation, a fact has a source.
 *
 * Every entry here is offered to every circle — that is what makes a category
 * built-in rather than one a circle invented, which belongs to the one circle
 * that made it. What a circle actually holds is still its owner's decision, and
 * `defaultOn` is how strongly the app suggests it: the original six arrive
 * ticked, Bookmarks arrives unticked.
 */
export const BUILT_INS: {
  itemType: ItemType;
  name: string;
  icon: string;
  seeds: string[];
  /**
   * Whether a circle gets this one without being asked. True for the six kinds
   * the app was built around, and false for Bookmarks, which is offered
   * everywhere and taken up on purpose: it is ticked off in the "start a circle"
   * form rather than on, and a circle that predates it is not given it silently.
   * The owner adds it from "+ Add category" whenever they want it.
   */
  defaultOn?: boolean;
}[] = [
  {
    itemType: "song",
    name: "Songs",
    icon: "🎵",
    seeds: ["Devotional", "Classical", "Film Songs", "Folk", "Children's Songs", "Original Recordings"],
  },
  {
    itemType: "recipe",
    name: "Recipes",
    icon: "🍲",
    seeds: ["Appetizers", "Rice Items", "Curries", "Sweets", "Breads", "Beverages"],
  },
  {
    itemType: "fact",
    name: "Fun Facts",
    icon: "💡",
    seeds: ["History", "Science", "Culture", "Language", "Nature"],
  },
  {
    itemType: "word",
    name: "Word Explorer",
    icon: "🔤",
    seeds: ["Everyday Words", "Idioms and Sayings", "Formal Words"],
  },
  {
    itemType: "book",
    name: "Books",
    icon: "📖",
    seeds: ["Fiction", "History", "Spirituality", "Biography", "Children", "Self-Development"],
  },
  {
    itemType: "remedy",
    name: "Remedies",
    icon: "🌱",
    seeds: [
      "Cold and Cough",
      "Digestion",
      "Skin Care",
      "Hair Care",
      "Seasonal Wellness",
      "General Wellness",
    ],
  },
  {
    itemType: "bookmark",
    name: "Bookmarks",
    icon: "\u{1F517}",
    // 🔖 belongs to My Library in the tab bar, so a link gets the chain instead:
    // two things wearing one mark in the same app is a mark that says nothing.
    seeds: ["Articles", "Videos", "Tools", "Learning", "References"],
    defaultOn: false,
  },
];

export function builtInFor(itemType: string | null) {
  return BUILT_INS.find((entry) => entry.itemType === itemType) ?? null;
}

export function categoryIconOf(value: unknown, fallback = DEFAULT_CATEGORY_ICON) {
  return firstGlyph(value) ?? fallback;
}

export function categoryNameOf(value: unknown) {
  return text(value).slice(0, MAX_CATEGORY_NAME);
}

/**
 * Which of these circles will take this kind of thing right now. A circle that
 * has switched a category off stops receiving new shares of it — that is what
 * ticking the boxes on the circle form means. A circle from before categories
 * existed has no list at all, and goes on accepting everything until it gets one.
 *
 * `categoryId` is the category the author picked, when they picked one. It names
 * one circle's own list, so that circle answers with that category's status
 * rather than with the rule for the kind of thing being shared: a song filed
 * under Events lands in a circle that offers Events, whether or not that circle
 * offers Songs at all.
 *
 * A post is the case where that is the *only* answer. A category a circle
 * invented holds `post` rows and stores no item type, so there is no
 * `itemType === "post"` row to find anywhere and the circle that owns the
 * category is the only one that can take it.
 */
export async function circlesAccepting(
  circleIds: number[],
  itemType: ItemType,
  categoryId?: number | null,
) {
  const accepting = new Set<number>();
  if (circleIds.length === 0) return accepting;

  const chosen = categoryId ? await findCategory(categoryId) : null;
  if (chosen && chosen.status === "active" && circleIds.includes(chosen.circleId)) {
    accepting.add(chosen.circleId);
  }

  if (itemType === CUSTOM_ITEM_TYPE) return accepting;

  const rows = await db
    .select({
      circleId: circleCategories.circleId,
      itemType: circleCategories.itemType,
      status: circleCategories.status,
    })
    .from(circleCategories)
    .where(inArray(circleCategories.circleId, circleIds));

  const listed = new Set(rows.map((row) => row.circleId));
  for (const id of circleIds) if (!listed.has(id)) accepting.add(id);
  for (const row of rows) {
    if (row.itemType === itemType && row.status === "active") accepting.add(row.circleId);
  }
  return accepting;
}

/** Every category a circle has, hidden ones included, in the owner's order. */
export async function categoriesOf(circleId: number) {
  return db
    .select()
    .from(circleCategories)
    .where(eq(circleCategories.circleId, circleId))
    .orderBy(asc(circleCategories.sortOrder), asc(circleCategories.id));
}

export async function categoryById(circleId: number, categoryId: number) {
  const [row] = await db
    .select()
    .from(circleCategories)
    .where(and(eq(circleCategories.id, categoryId), eq(circleCategories.circleId, circleId)));
  return row ?? null;
}

/** A category by id alone, for a post that names its category and nothing else. */
export async function findCategory(categoryId: number) {
  const [row] = await db
    .select()
    .from(circleCategories)
    .where(eq(circleCategories.id, categoryId));
  return row ?? null;
}

/** The circle's category for one built-in kind, or null when it does not have it. */
export async function categoryForItemType(circleId: number, itemType: ItemType) {
  const [row] = await db
    .select()
    .from(circleCategories)
    .where(
      and(eq(circleCategories.circleId, circleId), eq(circleCategories.itemType, itemType)),
    );
  return row ?? null;
}

/**
 * Every node of every one of these categories, hidden ones included. A whole tree
 * in one read: the shape is worked out by walking the rows rather than by asking
 * the database per level, which is what `taxonomy.ts` is for.
 */
export async function subcategoriesOf(categoryIds: number[]) {
  if (categoryIds.length === 0) return [];
  return db
    .select()
    .from(subcategories)
    .where(inArray(subcategories.categoryId, categoryIds))
    .orderBy(asc(subcategories.sortOrder), asc(subcategories.name));
}

export async function subcategoryById(categoryId: number, subcategoryId: number) {
  const [row] = await db
    .select()
    .from(subcategories)
    .where(and(eq(subcategories.id, subcategoryId), eq(subcategories.categoryId, categoryId)));
  return row ?? null;
}

/**
 * Adds a node under one parent, or hands back the one that is already there.
 * Sameness is judged among the parent's own children, because "Karnataka" under
 * Vegetarian and "Karnataka" under Non-Vegetarian are two real shelves; case and
 * spacing are settled by the normalised comparison done here and by the unique
 * index behind it, so two members adding "Sweets" at the same moment end up with
 * one row.
 *
 * Null answers three different noes — a name that was only punctuation, a parent
 * from another category, a tree already as deep or as wide as we allow — and the
 * caller says which, since only it knows what the member was doing.
 */
export async function addSubcategory(
  categoryId: number,
  name: string,
  memberId: string | null,
  parentId: number | null = null,
): Promise<SubcategoryRow | null> {
  const clean = subcategoryNameOf(name);
  if (!clean) return null;

  const existing = await subcategoriesOf([categoryId]);
  const parent = parentId === null ? null : nodeById(existing, parentId);
  if (parentId !== null && !parent) return null;
  if (tooDeepFor(existing, parent)) return null;

  const siblings = siblingsOf(existing, categoryId, parentId);
  const same = siblings.find((row) => normalizeName(row.name) === normalizeName(clean));
  if (same) return same;
  if (existing.length >= MAX_SUBCATEGORIES_PER_CATEGORY) return null;

  const [created] = await db
    .insert(subcategories)
    .values({
      categoryId,
      parentId,
      name: clean,
      sortOrder: siblings.length,
      createdById: memberId,
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  // Lost a race against another member adding the same name; theirs is fine.
  const settled = await db
    .select()
    .from(subcategories)
    .where(and(eq(subcategories.categoryId, categoryId), eq(subcategories.name, clean)));
  return settled.find((row) => (row.parentId ?? null) === parentId) ?? null;
}

/**
 * Where a node sits, moved. The branch under it comes along — a node names its
 * parent and nothing else, so moving Vegetarian moves South Indian and Karnataka
 * with it and there is nothing to rewrite. `reparentRefusal()` is what says no:
 * onto itself, into its own branch, or deeper than the cap.
 */
export async function moveSubcategory(node: SubcategoryRow, parentId: number | null) {
  const rows = await subcategoriesOf([node.categoryId]);
  const refusal = reparentRefusal(rows, node, parentId);
  if (refusal) return refusal;
  if ((node.parentId ?? null) === parentId) return null;

  const siblings = siblingsOf(rows, node.categoryId, parentId, node.id);
  await db
    .update(subcategories)
    .set({ parentId, sortOrder: siblings.length })
    .where(eq(subcategories.id, node.id));
  return null;
}

/**
 * Merging one node into another: everything filed here moves there, the children
 * this node had are handed to it as well, and only then does the node itself go.
 * Nothing is orphaned and nothing anybody wrote is touched — a merge is a change
 * to a list of names.
 */
export async function mergeSubcategory(from: SubcategoryRow, into: SubcategoryRow) {
  await refileSubcategory(from.id, into.id);
  await db
    .update(subcategories)
    .set({ parentId: into.id })
    .where(eq(subcategories.parentId, from.id));
  await db.delete(subcategories).where(eq(subcategories.id, from.id));
}

/**
 * Removing one node. What was filed on it moves up to the node above — which for
 * a node at the top of a category is no shelf at all, exactly what deleting a
 * shelf has always done — and its children move up with it rather than being cut
 * off from the category. Deleting a name never deletes what was filed under it.
 */
export async function deleteSubcategory(node: SubcategoryRow) {
  const up = node.parentId ?? null;
  await refileSubcategory(node.id, up);
  await db
    .update(subcategories)
    .set({ parentId: up })
    .where(eq(subcategories.parentId, node.id));
  await db.delete(subcategories).where(eq(subcategories.id, node.id));
}

/**
 * The path a share is filed under, created as far as it needs to be. A member
 * picks a node in one circle and the same words are found or made in every other
 * circle the share goes to, which is what lets one post carry the same shelf in
 * several circles without asking the same question over and over.
 *
 * `mayCreate` is the circle's own configuration: with member-made nodes switched
 * off, an ordinary member files into the deepest part of the path that already
 * exists and nothing new appears. That is deliberately a landing rather than a
 * refusal — the share itself is not the place to argue about a name.
 */
export async function resolvePath(
  categoryId: number,
  segments: string[],
  memberId: string | null,
  mayCreate: boolean,
): Promise<number | null> {
  if (segments.length === 0) return null;
  const rows = await subcategoriesOf([categoryId]);
  const { node, matched } = nodeAtPath(rows, categoryId, segments);
  if (matched === segments.length) return node?.id ?? null;
  if (!mayCreate) return node?.id ?? null;

  let parentId = node?.id ?? null;
  for (const segment of segments.slice(matched)) {
    const made = await addSubcategory(categoryId, segment, memberId, parentId);
    if (!made) return parentId;
    parentId = made.id;
  }
  return parentId;
}

/**
 * Whether this member may invent a node in this circle. The circle's own
 * configuration is the answer for an ordinary member — "+ Add new subcategory" is
 * part of the share form where it is switched on, and simply not offered where it
 * is not — and whoever looks after the circle may always add one, since the
 * setting exists to keep the tree tidy rather than to tie their hands.
 */
export async function mayAddTaxonomy(circleId: number, user: User) {
  const [circle] = await db
    .select({ memberTaxonomy: circles.memberTaxonomy, ownerId: circles.ownerId })
    .from(circles)
    .where(eq(circles.id, circleId));
  if (!circle) return false;
  if (circle.memberTaxonomy) return true;
  if (circle.ownerId === user.id) return true;
  const [membership] = await db
    .select({ role: circleMembers.role })
    .from(circleMembers)
    .where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.memberId, user.id)));
  return membership?.role === "owner" || membership?.role === "admin";
}

/**
 * The node a share should be filed under in one particular circle.
 *
 * A member picks one node, and a share reaches several circles. So the choice
 * travels as both halves of the same answer: `id` is the node they actually
 * tapped, which belongs to one circle's tree, and `name` is its path written out —
 * "Vegetarian › South Indian" — which is what the other circles are matched on. In
 * the circle the node came from the id is used directly; elsewhere the path is
 * found, or made as far as the circle allows, so one post carries the same shelf
 * in three circles without the form asking three times.
 *
 * `categoryId` names the category directly, which is the only way to find the one
 * a circle invented: those hold `post` rows and store no item type, so looking one
 * up by item type finds nothing and the shelf would quietly go nowhere. It names
 * one circle's list, though, so a category belonging to another circle falls back
 * to the one for the kind of thing being shared: a song filed under Events in one
 * circle is an ordinary Songs entry in the others, filed under whichever category
 * actually holds it there.
 */
export async function resolveSubcategory(
  circleId: number,
  itemType: ItemType,
  choice: ShelfChoice | null,
  user: User,
  categoryId?: number | null,
): Promise<number | null> {
  if (!choice) return null;
  const category =
    (categoryId ? await categoryById(circleId, categoryId) : null) ??
    (itemType === CUSTOM_ITEM_TYPE ? null : await categoryForItemType(circleId, itemType));
  if (!category) return null;

  // The node they tapped, when it is one of this category's own.
  let segments: string[] = [];
  if (choice.id) {
    const [node] = await db
      .select()
      .from(subcategories)
      .where(eq(subcategories.id, choice.id));
    if (node && node.categoryId === category.id) return node.id;
    if (node) {
      // Another circle's node: the same words, wherever they live here.
      const rows = await subcategoriesOf([node.categoryId]);
      segments = pathOf(rows, node);
    }
  }
  if (segments.length === 0) segments = splitPath(choice.name ?? "");
  if (segments.length === 0) return null;

  return resolvePath(category.id, segments, user.id, await mayAddTaxonomy(circleId, user));
}

/**
 * Sets up a new circle's categories. The owner ticks which built-ins the circle
 * uses and may add their own; each one starts with its seed subcategories so the
 * first share has something to choose from.
 */
export async function seedCategories(
  circleId: number,
  chosen: { itemType: string | null; name?: unknown; icon?: unknown; seeds?: string[] }[],
) {
  const wanted = chosen.slice(0, MAX_CATEGORIES_PER_CIRCLE);
  if (wanted.length === 0) return [];

  const seenTypes = new Set<string>();
  const rows: (typeof circleCategories.$inferInsert)[] = [];
  const seeds: string[][] = [];

  for (const entry of wanted) {
    const builtIn = builtInFor(entry.itemType);
    if (builtIn) {
      // A circle holds each built-in at most once, whatever the form sent.
      if (seenTypes.has(builtIn.itemType)) continue;
      seenTypes.add(builtIn.itemType);
      rows.push({
        circleId,
        itemType: builtIn.itemType,
        name: categoryNameOf(entry.name) || builtIn.name,
        icon: categoryIconOf(entry.icon, builtIn.icon),
        sortOrder: rows.length,
      });
      seeds.push(builtIn.seeds);
      continue;
    }
    const name = categoryNameOf(entry.name);
    if (!name) continue;
    rows.push({
      circleId,
      itemType: null,
      name,
      icon: categoryIconOf(entry.icon),
      sortOrder: rows.length,
    });
    // A category a member invents starts empty, because nobody but them knows
    // what its shelves should be. One the app itself sets up — Travelogue in the
    // Discover circle — may name its own, the same way a built-in does.
    seeds.push(entry.seeds ?? []);
  }

  if (rows.length === 0) return [];
  const created = await db.insert(circleCategories).values(rows).returning();

  const seedRows = created.flatMap((category, index) =>
    (seeds[index] ?? []).map((name, order) => ({
      categoryId: category.id,
      name,
      sortOrder: order,
      createdById: null,
    })),
  );
  if (seedRows.length > 0) {
    await db.insert(subcategories).values(seedRows).onConflictDoNothing();
  }
  return created;
}

/**
 * How many entries sit in each subcategory of each category, counted from the
 * items themselves and filtered to what this member is allowed to see. Nothing
 * is stored, so the numbers stay right when something is added, removed, refiled,
 * or when somebody's access changes.
 *
 * The key is `<categoryId>:<subcategoryId>`, with "none" standing in for an entry
 * with no subcategory.
 *
 * A category is where the *filing* says it is, not where the kind of thing would
 * usually go: a null `category_id` means "wherever this kind belongs", and a value
 * is a member having filed it somewhere else in this circle. Which is why a circle
 * with a category of its own has to be asked about every collection rather than
 * only the ones it lists — a song can be an Events entry in a circle that offers
 * no Songs at all.
 */
export async function categoryCounts(
  circleId: number,
  categories: CategoryRow[],
  user: User | null,
) {
  const counts = new Map<string, number>();
  const bump = (categoryId: number, subcategoryId: number | null, total: number) => {
    const key = `${categoryId}:${subcategoryId ?? "none"}`;
    counts.set(key, (counts.get(key) ?? 0) + total);
  };

  const byId = new Map(categories.map((category) => [category.id, category]));
  const builtInByType = new Map<ItemType, CategoryRow>();
  for (const category of categories) {
    if (isItemType(category.itemType ?? "")) {
      builtInByType.set(category.itemType as ItemType, category);
    }
  }
  const hasCustom = categories.some((category) => category.itemType === null);
  const kinds = (
    hasCustom ? ITEM_TYPES.filter((type) => type !== CUSTOM_ITEM_TYPE) : [...builtInByType.keys()]
  ) as ItemType[];

  await Promise.all(
    kinds.map(async (itemType) => {
      const table = ITEM_TABLES[itemType];
      const rows = await db
        .select({
          categoryId: itemCircles.categoryId,
          subcategoryId: itemCircles.subcategoryId,
          total: count(),
        })
        .from(itemCircles)
        .innerJoin(table, eq(table.id, itemCircles.itemId))
        .where(
          and(
            eq(itemCircles.itemType, itemType),
            eq(itemCircles.circleId, circleId),
            visibleTo(table, user, itemType),
          ),
        )
        .groupBy(itemCircles.categoryId, itemCircles.subcategoryId);
      for (const row of rows) {
        // An id naming a category this circle no longer has counts nowhere, which
        // is better than counting it twice or against the wrong tile.
        const category =
          row.categoryId === null ? builtInByType.get(itemType) : byId.get(row.categoryId);
        if (category) bump(category.id, row.subcategoryId, Number(row.total));
      }
    }),
  );

  // Every custom category's posts in one pass — they all live in one table, and
  // their category is on the post itself rather than on the filing.
  if (hasCustom) {
    const rows = await db
      .select({
        categoryId: posts.categoryId,
        subcategoryId: itemCircles.subcategoryId,
        total: count(),
      })
      .from(itemCircles)
      .innerJoin(posts, eq(posts.id, itemCircles.itemId))
      .where(
        and(
          eq(itemCircles.itemType, CUSTOM_ITEM_TYPE),
          eq(itemCircles.circleId, circleId),
          visibleTo(posts, user, CUSTOM_ITEM_TYPE),
        ),
      )
      .groupBy(posts.categoryId, itemCircles.subcategoryId);
    for (const row of rows) bump(row.categoryId, row.subcategoryId, Number(row.total));
  }

  return counts;
}

/**
 * One node of the tree, the way it travels over the API. `parentId` is the whole
 * of the hierarchy — the browser builds the tree from it — and `path` comes along
 * because a breadcrumb is read in a dozen places and deriving it in each of them
 * is a dozen chances to derive it differently.
 *
 * Two counts, because a branch is asked two different questions: `count` is what
 * is filed on this node exactly, and `totalCount` is the branch — which is what a
 * tile or a chip shows, since browsing a node shows its descendants too.
 */
export type TaxonomyNodeResponse = {
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
 * The nodes of one category, depth first, so a list read straight down reads as a
 * tree. Only the shape is worked out here; the totals are rolled up afterwards, so
 * the same rule serves a manager's full list and the shorter one a member sees.
 */
function nodeResponses(
  own: SubcategoryRow[],
  at: (subcategoryId: number | null) => number,
): TaxonomyNodeResponse[] {
  const walk = (parentId: number | null, depth: number, above: string[]): TaxonomyNodeResponse[] =>
    sortNodes(own.filter((row) => (row.parentId ?? null) === parentId)).flatMap((row) => {
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
  return rollUpNodes(walk(null, 1, []));
}

/**
 * What each branch adds up to. Run again whenever nodes are dropped from the list —
 * a member's view leaves the hidden ones out, and a total that still counted them
 * would promise more than the tap delivers.
 */
export function rollUpNodes(nodes: TaxonomyNodeResponse[]) {
  const children = new Map<number, TaxonomyNodeResponse[]>();
  const present = new Set(nodes.map((node) => node.id));
  for (const node of nodes) {
    if (node.parentId === null) continue;
    const list = children.get(node.parentId);
    if (list) list.push(node);
    else children.set(node.parentId, [node]);
  }
  const total = (node: TaxonomyNodeResponse): number => {
    const mine = children.get(node.id) ?? [];
    node.childCount = mine.length;
    node.totalCount = node.count + mine.reduce((sum, child) => sum + total(child), 0);
    return node.totalCount;
  };
  // Top down, so every branch is walked once — and a node whose parent is not in
  // this list is a top of its own here, which is what a filtered list leaves.
  for (const node of nodes) {
    if (node.parentId === null || !present.has(node.parentId)) total(node);
  }
  return nodes;
}

/** How a category, its taxonomy tree and its own extra fields travel over the API. */
export function categoryResponse(
  category: CategoryRow,
  subs: SubcategoryRow[],
  counts: Map<string, number>,
  fields: FieldRow[] = [],
) {
  const own = subs.filter((row) => row.categoryId === category.id);
  const at = (subcategoryId: number | null) =>
    counts.get(`${category.id}:${subcategoryId ?? "none"}`) ?? 0;
  const uncategorized = at(null);
  const filed = nodeResponses(own, at);

  return {
    id: category.id,
    circleId: category.circleId,
    itemType: category.itemType,
    name: category.name,
    icon: category.icon,
    sortOrder: category.sortOrder,
    hidden: category.status === "hidden",
    /** Everything in the category, filed at any depth or not filed at all. */
    count: filed.reduce((total, row) => total + row.count, 0) + uncategorized,
    uncategorizedCount: uncategorized,
    /** The whole tree, flat and depth first; `parentId` is what nests it. */
    subcategories: filed,
    /**
     * The extra questions this category asks on the share form. Empty for the six
     * built-ins, which have hand-built forms of their own.
     */
    fields: fields
      .filter((row) => row.categoryId === category.id)
      .map((row) => fieldResponse(row)),
  };
}

export type CategoryResponse = ReturnType<typeof categoryResponse>;

/**
 * The same list as whoever looks after the circle sees, minus what they have
 * switched off: a hidden category is simply not there, and a hidden node's entries
 * show up under "Everything else" rather than vanishing from the category they are
 * in.
 *
 * Hiding a node hides the branch under it, because there is no longer a way in —
 * so a hidden ancestor takes its children out of the list too, and everything
 * filed anywhere in that branch is counted as unfiled for a member. Nothing is
 * moved and nothing is deleted: ticking the node back on brings the branch back
 * exactly as it was.
 */
export function forMember(categories: CategoryResponse[]) {
  return categories
    .filter((category) => !category.hidden)
    .map((category) => {
      const gone = new Set<number>();
      for (const node of category.subcategories) {
        if (node.hidden || (node.parentId !== null && gone.has(node.parentId))) gone.add(node.id);
      }
      const visible = category.subcategories.filter((node) => !gone.has(node.id));
      const lost = category.subcategories
        .filter((node) => gone.has(node.id))
        .reduce((total, node) => total + node.count, 0);
      return {
        ...category,
        uncategorizedCount: category.uncategorizedCount + lost,
        subcategories: rollUpNodes(visible.map((node) => ({ ...node }))),
        // A field the owner switched off is missing rather than greyed out, so the
        // share form simply stops asking it.
        fields: category.fields.filter((field) => !field.hidden),
      };
    });
}

/**
 * Categories whose label is still an old default get the current one. Vocabulary
 * became Word Explorer, and a circle that never renamed it should read the same
 * as a circle made today; one that chose its own name is left exactly as it is.
 * Idempotent, and only writes when there is something to change.
 */
const RENAMED_BUILT_INS: { itemType: ItemType; was: string; now: string }[] = [
  { itemType: "word", was: "Vocabulary", now: "Word Explorer" },
];

async function upgradeLegacyNames(categories: CategoryRow[]) {
  const stale = categories.filter((category) =>
    RENAMED_BUILT_INS.some(
      (rename) => category.itemType === rename.itemType && category.name === rename.was,
    ),
  );
  if (stale.length === 0) return categories;

  await Promise.all(
    stale.map(async (category) => {
      const rename = RENAMED_BUILT_INS.find((entry) => entry.itemType === category.itemType);
      if (!rename) return;
      await db
        .update(circleCategories)
        .set({ name: rename.now })
        .where(and(eq(circleCategories.id, category.id), eq(circleCategories.name, rename.was)));
      category.name = rename.now;
    }),
  );
  return categories;
}

/**
 * A circle's categories, giving it the standard six if it has none. Circles made
 * before categories existed are the reason: they carry on working, and the first
 * time anybody opens one it takes the shape everything used to have.
 */
export async function ensureCategories(circleId: number) {
  const existing = await categoriesOf(circleId);
  if (existing.length > 0) {
    // Two upgrades a circle made before today's shape gets on the way past: the
    // built-in whose default label changed, and the starter questions a built-in
    // form handed over to the field builder. Both are once-only and both are
    // no-ops for a circle that is already current.
    await seedStarterFields(existing);
    return upgradeLegacyNames(existing);
  }
  try {
    await seedCategories(circleId, allBuiltIns());
  } catch {
    // Two people opened the circle at once; whichever seeded it first is right.
  }
  const seeded = await categoriesOf(circleId);
  await seedStarterFields(seeded);
  return seeded;
}

/** One circle's categories the way its own page wants them: in order, with counts. */
export async function circleCategoryList(
  circleId: number,
  user: User | null,
  options: { counts?: boolean } = {},
) {
  const categories = await ensureCategories(circleId);
  if (categories.length === 0) return [];
  const ids = categories.map((category) => category.id);
  const [subs, fields] = await Promise.all([subcategoriesOf(ids), fieldsOf(ids)]);
  const counts =
    options.counts === false
      ? new Map<string, number>()
      : await categoryCounts(circleId, categories, user);
  return categories.map((category) => categoryResponse(category, subs, counts, fields));
}

/**
 * The shape of several circles at once, without counting anything: two queries
 * however many circles a member belongs to. This is what a share form needs —
 * which shelves exist in each circle it could go to — and counting posts there
 * would be work nobody reads.
 */
/**
 * The questions every one of these circles asks about a built-in kind, as one
 * list. A share reaches several circles at once, and each of them has its own
 * copy of the category with its own fields, so what the form asks is the union of
 * them and an answer is keyed by the field's own id — which is unique across the
 * app, so two circles both asking "Deity" are two questions and two answers.
 *
 * Songs, Books and Recipes are the built-ins that can be asked anything; the other
 * three have forms that are the same in every circle. A category the circle
 * switched off asks nothing, exactly as it accepts nothing.
 */
export async function fieldsForBuiltIn(itemType: ItemType, circleIds: number[]) {
  if (circleIds.length === 0) return [];
  const rows = await db
    .select({ id: circleCategories.id })
    .from(circleCategories)
    .where(
      and(
        inArray(circleCategories.circleId, circleIds),
        eq(circleCategories.itemType, itemType),
        eq(circleCategories.status, "active"),
      ),
    );
  return fieldsOf(rows.map((row) => row.id));
}

export async function activeCategoriesByCircle(circleIds: number[]) {
  const byCircle = new Map<number, CategoryResponse[]>();
  if (circleIds.length === 0) return byCircle;

  const read = async () =>
    db
      .select()
      .from(circleCategories)
      .where(inArray(circleCategories.circleId, circleIds))
      .orderBy(asc(circleCategories.sortOrder), asc(circleCategories.id));

  let categories = await read();
  // A circle from before categories existed gets the standard six, once.
  const shaped = new Set(categories.map((category) => category.circleId));
  const missing = circleIds.filter((circleId) => !shaped.has(circleId));
  if (missing.length > 0) {
    await Promise.all(missing.map((circleId) => ensureCategories(circleId)));
    categories = await read();
  }
  await upgradeLegacyNames(categories);
  await seedStarterFields(categories);

  const subs = await subcategoriesOf(categories.map((category) => category.id));
  const fields = await fieldsOf(categories.map((category) => category.id));
  const empty = new Map<string, number>();

  for (const category of categories) {
    const [response] = forMember([categoryResponse(category, subs, empty, fields)]);
    if (!response) continue;
    const list = byCircle.get(category.circleId);
    if (list) list.push(response);
    else byCircle.set(category.circleId, [response]);
  }
  return byCircle;
}

/**
 * The categories a create-circle form ticked: built-ins by item type, and the
 * owner's own by name and icon. Null when the form said nothing about categories
 * at all, which the caller reads as "give it the usual six".
 */
export function categoriesFrom(body: Record<string, unknown>) {
  if (!Array.isArray(body.categories)) return null;
  const wanted: { itemType: string | null; name?: unknown; icon?: unknown }[] = [];
  for (const entry of body.categories.slice(0, MAX_CATEGORIES_PER_CIRCLE)) {
    if (typeof entry === "string") {
      if (builtInFor(entry)) wanted.push({ itemType: entry });
      continue;
    }
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const itemType = text(row.itemType);
    wanted.push({
      itemType: builtInFor(itemType) ? itemType : null,
      name: row.name,
      icon: row.icon,
    });
  }
  return wanted;
}

/** The six built-ins, for a circle whose form did not mention categories. */
/**
 * What a circle is given when nobody chose for it — a circle made before
 * categories existed, the first time somebody opens it. The ones marked
 * `defaultOn: false` are left out on purpose: giving an old circle a category its
 * owner never asked for is the one thing seeding must not do.
 */
export function allBuiltIns() {
  return BUILT_INS.filter((entry) => entry.defaultOn !== false).map((entry) => ({
    itemType: entry.itemType as string | null,
  }));
}

/**
 * Moves every post filed under one subcategory to another, or to no subcategory
 * at all. This is what merging is, and what deleting a subcategory does — posts
 * are never destroyed by tidying up a list.
 */
export async function refileSubcategory(fromId: number, toId: number | null) {
  await db
    .update(itemCircles)
    .set({ subcategoryId: toId })
    .where(eq(itemCircles.subcategoryId, fromId));
}

/** Puts a set of categories or subcategories in the order the owner dragged them. */
export async function applyOrder(ids: number[], kind: "category" | "subcategory") {
  const table = kind === "category" ? circleCategories : subcategories;
  await Promise.all(
    ids.map((id, index) =>
      db.update(table).set({ sortOrder: index }).where(eq(table.id, id)),
    ),
  );
}

/**
 * Everything a category holds, for the two honest answers when an owner removes
 * one: how many posts are involved, and which of them nobody else can still see.
 *
 * Only the posts, because only they are at risk. A song or a recipe somebody filed
 * in this category has a home of its own to go back to, which is what
 * `releaseFiledItems()` does; a post's category is the whole of where it lives.
 */
export async function postsInCategory(categoryId: number) {
  return db
    .select({ id: posts.id, memberId: posts.memberId, memberName: posts.memberName })
    .from(posts)
    .where(eq(posts.categoryId, categoryId));
}

/**
 * Where a form said the share should sit, as both halves of the one answer: the
 * taxonomy node the member actually tapped (`subcategoryId`) and its path written
 * out (`subcategoryName`, "Vegetarian › South Indian"). The id settles it exactly
 * in the circle whose tree it belongs to, and the words are what the share's other
 * circles are matched on, since a node lives in one circle only.
 *
 * Three answers, and the difference between the last two is what makes editing
 * safe: a choice files the share, null unfiles it, and undefined is a form that
 * never asked, which leaves the filing exactly as it was. A body carrying only the
 * name still works and is what everything sent before nodes had ids.
 */
export function shelfChoiceFrom(body: Record<string, unknown>): ShelfChoice | null | undefined {
  const hasId = "subcategoryId" in body;
  const hasName = "subcategoryName" in body;
  if (!hasId && !hasName) return undefined;

  const id = Number(body.subcategoryId);
  const node = Number.isInteger(id) && id > 0 ? id : null;
  const name = hasName ? optionalText(body.subcategoryName) : null;
  if (!node && !name) return null;
  return { id: node, name };
}

/** Guards against a category id from another circle being passed in. */
export function categoryIdFrom(body: Record<string, unknown>) {
  const id = Number(body.categoryId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * The category one of the six built-in kinds should be filed under, when its
 * author said something other than the obvious. Three answers, and the difference
 * between the last two is what makes editing safe: a number is a category, null is
 * "put it back where its kind belongs", and undefined is a form that never asked —
 * which leaves the filing exactly as it was.
 *
 * It is a separate key from `categoryId`, which a post already uses to mean the
 * category it lives in, so neither route can ever be read as the other.
 */
export function filedCategoryIdFrom(body: Record<string, unknown>) {
  if (!("filedCategoryId" in body)) return undefined;
  const id = Number(body.filedCategoryId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Hands back the built-in shares somebody filed into a category being removed. A
 * song filed under Events is still a song: the circle keeps it, and Songs shows it
 * again — or the category the posts were moved into shows it, so the whole
 * category arrives somewhere in one piece.
 *
 * Nothing here touches the posts, whose own category is moved or released by the
 * caller, and nothing is deleted either way: removing a category is a change to a
 * list, never to what members wrote. Releasing clears the shelf as well, that shelf
 * having belonged to the category going away.
 */
export async function releaseFiledItems(categoryId: number, moveToId: number | null) {
  await db
    .update(itemCircles)
    .set(moveToId ? { categoryId: moveToId } : { categoryId: null, subcategoryId: null })
    .where(
      and(eq(itemCircles.categoryId, categoryId), ne(itemCircles.itemType, CUSTOM_ITEM_TYPE)),
    );
}

/**
 * Only the people who look after a circle may reshape it; members share into
 * what they find. `moderatorOf()` in `moderation.ts` is the test — its owner, an
 * admin they made, or the app admin standing in.
 */
export function notTheManager() {
  return Response.json(
    { error: "Only the circle's owner or one of its admins can change its categories." },
    { status: 403 },
  );
}
