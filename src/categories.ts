import { pathText, treeOptions, type TreeOption } from "./tree";
import type { CircleCategory, ItemType, ShelfChoice, Subcategory } from "./api";

/** Everything except a post, which is what a category a circle invented holds. */
export type BuiltInType = Exclude<ItemType, "post">;

/**
 * The kinds of thing the app itself knows how to share, in the order a circle form
 * offers them. This mirrors `BUILT_INS` in `netlify/lib/categories.ts`; the server
 * decides what a circle actually gets, and this list is only what the checkboxes
 * say.
 *
 * Bookmarks is last and `defaultOn: false`, which is the one thing the tick-list
 * reads off this table: the original six are ticked when a circle is started and
 * Bookmarks is offered unticked, because a circle that wants to collect links is
 * making a decision rather than accepting a default.
 */
export const BUILT_IN_CATEGORIES: {
  itemType: BuiltInType;
  name: string;
  icon: string;
  defaultOn?: boolean;
}[] = [
  { itemType: "song", name: "Songs", icon: "🎵" },
  { itemType: "recipe", name: "Recipes", icon: "🍲" },
  { itemType: "fact", name: "Fun Facts", icon: "💡" },
  { itemType: "word", name: "Word Explorer", icon: "🔤" },
  { itemType: "book", name: "Books", icon: "📖" },
  { itemType: "remedy", name: "Remedies", icon: "🌱" },
  // 🔗 rather than 🔖, which is My Library's mark in the tab bar.
  { itemType: "bookmark", name: "Bookmarks", icon: "🔗", defaultOn: false },
];

export const DEFAULT_CATEGORY_ICON = "📌";

/** A starting set for a category somebody invents, so most need no typing. */
export const CATEGORY_ICONS = [
  "📌",
  // A temple and a lamp, for the categories a devotional circle invents.
  "\u{1F6D5}",
  "\u{1FA94}",
  "🎉",
  "✈️",
  "🎬",
  "📷",
  "🏡",
  "🌸",
  "🪔",
  "🙏",
  "⚽",
  "🎨",
  "🧘",
  "💼",
  "🛠️",
  "🌦️",
  "🐾",
];

/** The label a member sees for "filed under nothing in particular". */
export const NO_SUBCATEGORY = "No subcategory";

export function builtInLabel(itemType: BuiltInType) {
  return BUILT_IN_CATEGORIES.find((entry) => entry.itemType === itemType) ?? null;
}

/** The creation forms that add one of the built-in kinds of thing. */
export type ShareFlow = "song" | "recipe" | "fact" | "word" | "book" | "remedy" | "bookmark";

/**
 * How you add to a built-in category: one way in for each of them, including
 * songs, which used to have two. "Record one" and "Upload a file" asked the member
 * to decide *how* before they had decided *what*, and neither of them was an
 * answer for somebody who has the words and no recording — so there is one
 * button, and how it is being shared is a question on the form behind it.
 */
export function shareFlows(itemType: BuiltInType): { flow: ShareFlow; label: string }[] {
  const labels: Record<BuiltInType, string> = {
    song: "+ Add a Song",
    recipe: "+ Add a recipe",
    fact: "+ Add a fun fact",
    word: "+ Add Word",
    book: "+ Add a book",
    remedy: "+ Add a remedy",
    bookmark: "+ Add a bookmark",
  };
  return [{ flow: itemType, label: labels[itemType] }];
}

/**
 * Whether the form behind a category takes pictures, which is the one question an
 * incoming photo share has to ask before offering somewhere to put it.
 *
 * A null `itemType` is a category the circle invented, and `PostModal` carries a
 * `PhotoField` like the rest — so the list is every kind but two. A word is a
 * dictionary entry and has never taken a photo, and a bookmark is an address; both
 * are the same absence server-side, neither of them extending `HasPhotos` in
 * `src/api.ts`, which is what makes this a reading of the model rather than a
 * second opinion about it.
 */
export function takesPhotos(itemType: ItemType | null): boolean {
  return itemType !== "word" && itemType !== "bookmark";
}

/** The circle's category for one of the six, when that circle has it switched on. */
export function categoryFor(categories: CircleCategory[], itemType: BuiltInType) {
  return categories.find((category) => category.itemType === itemType) ?? null;
}

/** A category invented by a circle rather than one of the six. */
export function isCustom(category: CircleCategory) {
  return category.itemType === null;
}

export function sortedCategories(categories: CircleCategory[]) {
  return [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

/**
 * The tree itself lives in `src/tree.ts`, because a category's subcategories and
 * a circle's folders are the same walk over two different tables. These are that
 * walk under the names every subcategory surface already calls it by: the shelf
 * words are what a member reads, and the tree words are what the arithmetic is.
 */
export {
  branchIds as shelfBranchIds,
  childNodes as childShelves,
  descendantsOf as descendantShelves,
  mergeTreeOptions as mergeShelfOptions,
  nodeById as shelfById,
  nodeHidden as shelfHidden,
  normalizeName,
  pathText,
  PATH_SEPARATOR,
  rootNodes as rootShelves,
  similarName,
  sortNodes as sortedShelves,
  splitPathText,
  treeOf,
  type TreeOption as ShelfOption,
} from "./tree";

/**
 * A category's tree as a flat list to draw, with anything switched off left out
 * along with everything under it. Named for the shelf picker it fills; the walk
 * is `treeOptions()`.
 */
export function shelfOptions(nodes: Subcategory[], parentId: number | null = null): TreeOption[] {
  return treeOptions(nodes, parentId);
}

/**
 * Which shelf a post sits on in one circle. A post shared into three circles is
 * one post with three filings, and each circle keeps its own answer.
 */
export function filedIn(
  entry: { filings?: { circleId: number; subcategoryId: number | null }[] },
  circleId: number,
) {
  return entry.filings?.find((filing) => filing.circleId === circleId)?.subcategoryId ?? null;
}

/**
 * Which of a circle's categories a share was filed under there, or null for the
 * obvious one — a song under Songs. An id is its author having said otherwise, so
 * the same song can be an Events entry in one circle and an ordinary song in the
 * next.
 */
export function categoryIn(
  entry: { filings?: { circleId: number; categoryId?: number | null }[] },
  circleId: number,
) {
  return entry.filings?.find((filing) => filing.circleId === circleId)?.categoryId ?? null;
}

/**
 * The category an already-shared item was filed under, for an edit form to open
 * on. A category belongs to one circle, so at most one filing can name one and the
 * first found is the answer.
 */
export function currentFiledCategoryId(
  entry: { filings?: { circleId: number; categoryId?: number | null }[] } | undefined,
) {
  for (const filing of entry?.filings ?? []) {
    if (filing.categoryId) return filing.categoryId;
  }
  return null;
}

/**
 * The categories a share could be filed under instead of the obvious one: the
 * categories the chosen circles invented for themselves. Only those, because the
 * six built-ins are where a kind of thing already goes — offering "Songs" as
 * somewhere to put a song would be the same answer twice.
 *
 * A circle that switched a category off is not offered it, exactly as the circle
 * itself is not offered for a kind it has switched off. `keepId` is the one already
 * chosen, which stays on the list either way, so an existing share can always be
 * seen and undone.
 */
export function filingChoices(
  categories: CircleCategory[],
  circleIds: number[],
  keepId: number | null = null,
) {
  return sortedCategories(
    categories.filter(
      (category) =>
        isCustom(category) &&
        circleIds.includes(category.circleId) &&
        (!category.hidden || category.id === keepId),
    ),
  );
}

/**
 * The path behind a subcategory id — the names from the top of the category down
 * to and including it. The node carries its own path, so this is a lookup rather
 * than a walk, and an unknown id answers an empty path rather than throwing.
 */
export function shelfPath(categories: CircleCategory[], subcategoryId: number | null): string[] {
  if (subcategoryId === null) return [];
  for (const category of categories) {
    const shelf = category.subcategories.find((row) => row.id === subcategoryId);
    if (shelf) return shelf.path.length > 0 ? shelf.path : [shelf.name];
  }
  return [];
}

/**
 * The full breadcrumb a post shows: the category it lives in, then the path down
 * to the node it is filed on — `Recipes › Vegetarian › South Indian › Karnataka`.
 * A post filed on no node at all is just its category, which is the honest answer
 * rather than a made-up "Uncategorized" shelf.
 */
export function breadcrumbOf(
  categories: CircleCategory[],
  categoryId: number | null,
  subcategoryId: number | null,
): string[] {
  const category = categoryId
    ? (categories.find((row) => row.id === categoryId) ?? null)
    : null;
  const rest = shelfPath(categories, subcategoryId);
  return category ? [category.name, ...rest] : rest;
}

/**
 * Where an already-shared item sits, as a choice a form can open on: the node's
 * own id and its path written out. A post in several circles can in principle sit
 * on different nodes; the first one found is what the form starts with, and saving
 * applies it everywhere.
 */
export function currentShelfChoice(
  categories: CircleCategory[],
  entry: { filings?: { circleId: number; subcategoryId: number | null }[] } | undefined,
): ShelfChoice {
  for (const filing of entry?.filings ?? []) {
    const path = shelfPath(categories, filing.subcategoryId);
    if (path.length > 0) return { id: filing.subcategoryId, name: pathText(path) };
  }
  return { id: null, name: null };
}

/**
 * The full breadcrumb one feed row shows, for the circle it is being read in:
 * the category the share sits in there, then the path down to the node it is
 * filed on — `Recipes › Vegetarian › South Indian › Karnataka`.
 *
 * Which category that is comes from the filing where the author named one and
 * from the kind of thing otherwise, which is the same fallback the server makes:
 * a null category means "wherever this kind goes", so a song lands under Songs.
 * A share filed on no node at all is its category and nothing more.
 */
export function entryBreadcrumb(
  categories: CircleCategory[],
  entry: {
    itemType: string;
    filings?: { circleId: number; categoryId?: number | null; subcategoryId: number | null }[];
  },
  circleId: number,
): string[] {
  const here = categories.filter((category) => category.circleId === circleId);
  const filed = categoryIn(entry, circleId);
  const category =
    (filed ? here.find((row) => row.id === filed) : null) ??
    here.find((row) => row.itemType === entry.itemType) ??
    null;
  return breadcrumbOf(categories, category?.id ?? null, filedIn(entry, circleId));
}

/**
 * The part of a trail that sits below where the reader is already standing. A
 * category page prints "Thursday Bhajane › Bookmarks" on every row it lists, and
 * on the Bookmarks page itself that says the same thing the breadcrumb above the
 * list already said — once per entry. So a row shows only what distinguishes it
 * from its neighbours: nothing at all when it is filed exactly here, and the steps
 * below when it came from further down the branch.
 *
 * A trail that does not start where the reader is standing is returned whole,
 * since in that case every step of it is news.
 */
export function trailBelow(trail: string[], base: string[]): string[] {
  const shares = base.every((step, index) => trail[index] === step);
  return shares ? trail.slice(base.length) : trail;
}
