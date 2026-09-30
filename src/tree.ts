// src/tree.ts
// A tree of nodes on the browser side, and nothing else: no category, no circle,
// no idea what the tree is a tree of.
//
// Two things in this app are the same tree twice over. A category's subcategories
// hang off a category; a circle's folders hang off a circle. Both arrive from the
// server as a flat list where a node names the node above it, so both want the
// same handful of answers — the children of a level, the branch under a node,
// whether an ancestor has switched it off, and the flat indented list a picker or
// a manager draws. That walk is written once here and named by its callers, since
// what a node hangs off is a question this file never asks.
//
// The counterpart on the server is `netlify/lib/tree.ts`. The two are deliberately
// separate rather than shared: this one works on the API's shape, where hiding is
// a boolean and a node carries its own path, and it is a courtesy that warns a
// member before the round trip rather than the rule that decides anything.

/**
 * What any node has to carry to be part of a tree. The API's `Subcategory` and a
 * folder both satisfy this structurally, so neither type is imported here.
 */
export interface TreeNode {
  id: number;
  name: string;
  /** Null for a node at the top level. */
  parentId: number | null;
  sortOrder: number;
  /** Switched off by a manager: reversible, and the branch under it goes too. */
  hidden: boolean;
}

/**
 * A node the server has already told the path and the depth of, which is what a
 * picker needs in order to offer one tree's node as a choice in another's.
 */
export interface PathedTreeNode extends TreeNode {
  /** The names from the top of the tree down to and including this one. */
  path: string[];
  /** 1 for a node at the top level. */
  depth: number;
}

/** What separates the names of a path, on screen and in what a form sends. */
export const PATH_SEPARATOR = "›";

/** A path written out: `Recipes › Vegetarian › South Indian`. */
export function pathText(names: string[]) {
  return names.join(` ${PATH_SEPARATOR} `);
}

/** The other direction: "Vegetarian › South Indian" back into its two names. */
export function splitPathText(value: string) {
  return value
    .split(PATH_SEPARATOR)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Siblings in their own order. A tree is drawn a level at a time, so this sorts
 * one row of it rather than the whole thing — `treeOf()` is the walk.
 */
export function sortNodes<T extends TreeNode>(nodes: T[]) {
  return [...nodes].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

/** The nodes directly under one node — or at the top level, for null. */
export function childNodes<T extends TreeNode>(nodes: T[], parentId: number | null) {
  return sortNodes(nodes.filter((node) => (node.parentId ?? null) === parentId));
}

/** The nodes at the top, which is where the tree starts. */
export function rootNodes<T extends TreeNode>(nodes: T[]) {
  return childNodes(nodes, null);
}

export function nodeById<T extends TreeNode>(nodes: T[], id: number | null) {
  if (id === null) return null;
  return nodes.find((node) => node.id === id) ?? null;
}

/**
 * The whole tree flattened depth-first, which is the order a picker and a manager
 * both read it in: a node, then its branch, then its next sibling. The server
 * already answers in this order; doing it again here means a list edited in place
 * stays right without a reload.
 */
export function treeOf<T extends TreeNode>(nodes: T[], parentId: number | null = null): T[] {
  return childNodes(nodes, parentId).flatMap((node) => [node, ...treeOf(nodes, node.id)]);
}

/** Everything under one node, at any depth. */
export function descendantsOf<T extends TreeNode>(nodes: T[], id: number): T[] {
  return childNodes(nodes, id).flatMap((node) => [node, ...descendantsOf(nodes, node.id)]);
}

/**
 * A node and its branch by id, which is what a listing asks for: opening
 * "Vegetarian" shows what is filed there *and* everything filed further down it,
 * because a member who chose the shallower level still meant this part of the tree.
 */
export function branchIds<T extends TreeNode>(nodes: T[], id: number) {
  return [id, ...descendantsOf(nodes, id).map((node) => node.id)];
}

/**
 * Whether a node is switched off, itself or by an ancestor. Hiding cascades as it
 * is read rather than by writing anything down, so showing a branch again is one
 * update and nothing under it has to be remembered.
 */
export function nodeHidden<T extends TreeNode>(nodes: T[], node: T) {
  if (node.hidden) return true;
  let parent = nodeById(nodes, node.parentId);
  const seen = new Set<number>([node.id]);
  while (parent && !seen.has(parent.id)) {
    if (parent.hidden) return true;
    seen.add(parent.id);
    parent = nodeById(nodes, parent.parentId);
  }
  return false;
}

/**
 * The same two names, near enough to be worth asking about: case, spacing,
 * punctuation and a trailing plural all ignored. The server decides for real —
 * this is only so the form can warn before the round trip.
 */
export function normalizeName(value: string) {
  const base = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  return base.endsWith("es") && base.length > 4
    ? base.slice(0, -2)
    : base.endsWith("s") && base.length > 3
      ? base.slice(0, -1)
      : base;
}

/** One insertion, deletion or substitution at a time — enough to catch a typo. */
function editDistance(a: string, b: string) {
  if (a === b) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(
        previous[j] + 1,
        row[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = row;
  }
  return previous[b.length];
}

/**
 * The name on the list that a newly typed one probably means, or null when it
 * looks genuinely new. The same rule the server applies before creating a node,
 * repeated here so the form can ask before making the round trip.
 */
export function similarName(name: string, existing: string[]) {
  const needle = normalizeName(name);
  if (!needle) return null;
  const exact = existing.find((other) => normalizeName(other) === needle);
  if (exact) return exact;
  if (needle.length < 5) return null;
  return (
    existing.find((other) => {
      const key = normalizeName(other);
      return key.length >= 5 && editDistance(needle, key) <= 1;
    }) ?? null
  );
}

/**
 * One offer in a tree picker: the node's id where the offer came from one tree,
 * its path from the top down to it, and how deep it sits so a list can be
 * indented into a tree.
 *
 * The id is what a form sends first, because it names exactly one node in exactly
 * one circle. The path is what makes the same choice mean something in the other
 * circles a share is going to, where "Vegetarian › South Indian" is a different
 * row with the same words.
 */
export type TreeOption = { id: number | null; path: string[]; depth: number };

/**
 * A tree as a flat list to draw, depth-first, with anything switched off left out
 * along with everything under it — a hidden branch has no way in, so offering its
 * children would be offering somewhere a share cannot be read.
 */
export function treeOptions<T extends PathedTreeNode>(
  nodes: T[],
  parentId: number | null = null,
): TreeOption[] {
  return childNodes(nodes, parentId)
    .filter((node) => !node.hidden)
    .flatMap((node) => [
      { id: node.id, path: node.path.length > 0 ? node.path : [node.name], depth: node.depth },
      ...treeOptions(nodes, node.id),
    ]);
}

/**
 * The same offers gathered from several circles. Two circles with a Sweets node
 * are one choice rather than two, and the first id found is the one that travels —
 * the server resolves the path in every other circle, creating it there when the
 * circle allows that and leaving the share unfiled there when it does not.
 */
export function mergeTreeOptions(lists: TreeOption[][]): TreeOption[] {
  const byPath = new Map<string, TreeOption>();
  for (const option of lists.flat()) {
    const key = option.path.map((name) => normalizeName(name)).join(PATH_SEPARATOR);
    if (key && !byPath.has(key)) byPath.set(key, option);
  }
  // Depth-first again, so a child always follows its own parent however many
  // circles the two of them came from.
  return [...byPath.values()].sort((a, b) => pathText(a.path).localeCompare(pathText(b.path)));
}
