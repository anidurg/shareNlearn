// netlify/lib/taxonomy.ts
// A category's subcategories, which is one particular tree.
//
// A circle's taxonomy is a category — one of the six built-in kinds, or one the
// circle invented — with a tree of nodes hanging under it. A node names the node
// above it and nothing else, so Recipes › Vegetarian › South Indian › Karnataka is
// one category row and three node rows, and a branch grows to whatever depth its
// circle finds useful. Null as a parent means "directly under the category", which
// is what every row said before nesting existed: the flat two-level shape everybody
// already had is simply the shallow case of this one.
//
// The arithmetic itself is not here. Walking a tree of rows — paths, depths,
// descendants, cycles, the duplicate rule — is the same job whatever the rows
// hang off, so it lives in `tree.ts` and this file is what makes it a *category's*
// tree: every function below narrows the rows to one `categoryId` first, and the
// refusals are worded for a member who was moving a subcategory. Everything still
// works on rows already read, because a tree is answered by walking a list rather
// than by asking the database one question per level: one read of a category's
// nodes settles paths, depths, descendants and cycles at once.
import { text } from "./items.js";
import {
  cleanName,
  MAX_TREE_DEPTH,
  nodeAtPath as nodeAtPathIn,
  reparentRefusal as reparentRefusalIn,
  similarNode,
  siblingsOf as siblingsIn,
  splitPath as splitPathIn,
} from "./tree.js";
import type { subcategories } from "../../db/schema.js";

export type TaxonomyNode = typeof subcategories.$inferSelect;

/**
 * The tree walk, re-exported unchanged: these ask nothing about a category, only
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
  normalizeName,
  pathOf,
  pathText,
  PATH_SEPARATOR,
  sortNodes,
  subtreeIds,
  tooDeepFor,
} from "./tree.js";

/**
 * What a share form sends about where the share should sit: the node the member
 * tapped and that node's path written out. Both halves travel because a node
 * belongs to one circle's tree and a share reaches several — the id answers its
 * own circle exactly, and the words answer the rest.
 */
export type ShelfChoice = { id?: number | null; name?: string | null };

export const MAX_SUBCATEGORY_NAME = 40;

/**
 * How deep a branch may go, counting the nodes and not the category above them:
 * Vegetarian is 1, South Indian is 2. It is the tree's own ceiling — a guard rail
 * rather than a shape, deep enough that no circle organising recipes or stotras
 * will ever meet it, shallow enough that a script cannot build a thousand-link
 * chain nothing can draw or read.
 */
export const MAX_TAXONOMY_DEPTH = MAX_TREE_DEPTH;

/**
 * A node's name, tidied. The separator is taken out rather than escaped, because a
 * path is written with it and a name containing one would read as two nodes.
 */
export function subcategoryNameOf(value: unknown) {
  return cleanName(text(value), MAX_SUBCATEGORY_NAME);
}

/**
 * The existing node a new name probably means, or null when it looks new.
 *
 * Callers pass the *siblings* rather than the whole category: "Karnataka" under
 * Vegetarian and "Karnataka" under Non-Vegetarian are two real shelves, and
 * offering the first when somebody is filling in the second would be wrong.
 */
export function similarSubcategory(name: string, existing: TaxonomyNode[]) {
  return similarNode(name, existing);
}

/** The rows of one category, which is the scope every question below is asked in. */
function inCategory(rows: TaxonomyNode[], categoryId: number) {
  return rows.filter((row) => row.categoryId === categoryId);
}

/** Siblings in the order they are shown, optionally leaving one row out. */
export function siblingsOf(
  rows: TaxonomyNode[],
  categoryId: number,
  parentId: number | null,
  exceptId?: number,
) {
  return siblingsIn(inCategory(rows, categoryId), parentId, exceptId);
}

export function childrenOf(rows: TaxonomyNode[], categoryId: number, parentId: number | null) {
  return siblingsOf(rows, categoryId, parentId);
}

/**
 * Whether a node may be moved under this parent. Three ways it may not, and each
 * of them is a real mistake somebody can make in a tree: onto itself, onto one of
 * its own descendants — which would cut the branch off from the category
 * altogether — or somewhere the branch it carries would not fit under the cap.
 * A parent in another category is refused for the same reason as one that does not
 * exist: it is not in this tree.
 *
 * A parent of null is the top of the category, which is always allowed as long as
 * the branch fits.
 */
export function reparentRefusal(
  rows: TaxonomyNode[],
  node: TaxonomyNode,
  parentId: number | null,
): string | null {
  return reparentRefusalIn(inCategory(rows, node.categoryId), node, parentId, {
    self: "A subcategory cannot sit inside itself.",
    elsewhere: "Choose a subcategory in this category to move it under.",
    inside: "A subcategory cannot be moved inside one of its own children.",
    tooDeep: `Subcategories go ${MAX_TAXONOMY_DEPTH} levels deep at most.`,
    branchTooDeep: "That branch is too deep to sit there.",
  });
}

/** The other direction, for a share form that names a path rather than an id. */
export function splitPath(value: string) {
  return splitPathIn(value, MAX_SUBCATEGORY_NAME);
}

/**
 * The node one path names inside one category, or the deepest node it does name.
 * `matched` is how many segments were found, so a caller resolving a share's
 * filing knows whether the rest has to be created or whether it must give up.
 */
export function nodeAtPath(rows: TaxonomyNode[], categoryId: number, segments: string[]) {
  return nodeAtPathIn(inCategory(rows, categoryId), segments);
}
