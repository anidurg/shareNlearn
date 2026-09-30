// netlify/lib/tree.ts
// A tree of rows, and nothing else: no database, no table, no idea what the tree
// is a tree of.
//
// Two things in this app are the same tree twice over. A category's
// subcategories hang off a category; a circle's folders hang off a circle. Both
// are an adjacency list — a row names the row above it and nothing else — so both
// want the same dozen answers: the children of a level, the path down to a node,
// how deep it sits, everything under it, whether an ancestor has switched it off,
// and whether a move would make a cycle or push a branch past the ceiling. That
// arithmetic is written once here and scoped by its callers, because a node's
// parent is the whole of what a tree needs to know and the column naming its
// owner is somebody else's business.
//
// Everything works on rows already read, which is the point: one read of a
// scope's rows settles paths, depths, descendants and cycles at once, rather than
// asking the database one question per level.

/**
 * What any row has to carry to be a node of a tree. Both tables satisfy this
 * structurally, so neither has to be imported here — `TaxonomyNode` and a folder
 * row are each accepted as themselves and handed back as themselves.
 */
export interface TreeRow {
  id: number;
  parentId: number | null;
  name: string;
  sortOrder: number;
  status: string;
}

/**
 * How deep a branch may go, counting the nodes and not whatever they hang off:
 * Vegetarian is 1, South Indian is 2. The column itself has no ceiling, and this
 * is a guard rail rather than a shape — deep enough that no circle organising
 * recipes or festivals will ever meet it, shallow enough that a script cannot
 * build a thousand-link chain nothing can draw or read.
 */
export const MAX_TREE_DEPTH = 12;

/** What a breadcrumb is joined with, here and on screen: Recipes › Vegetarian. */
export const PATH_SEPARATOR = "›";

/**
 * A name, tidied to the caller's own length limit. The separator is taken out
 * rather than escaped, because a path is written with it and a name containing
 * one would read as two nodes.
 */
export function cleanName(value: string, limit: number) {
  return value.replaceAll(PATH_SEPARATOR, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

/**
 * Two names count as the same when they differ only in case, spacing,
 * punctuation, or a trailing plural: "Sweets", "sweets" and "Sweet" all reduce to
 * the same key. This is what stops the obvious duplicates. It does *not* know
 * that "Dessert" and "Sweets" mean the same thing — no string comparison does,
 * which is why merging exists.
 */
export function normalizeName(value: string) {
  const base = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  return base.replace(/\b(\w{3,}?)(ies|es|s)\b/gu, (_match, stem: string, ending: string) =>
    ending === "ies" ? `${stem}y` : stem,
  );
}

/** Levenshtein distance, capped: only used on short names against short lists. */
function editDistance(a: string, b: string) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  let previous = Array.from({ length: b.length + 1 }, (_unused, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

/**
 * The existing node a new name probably means, or null when it looks new.
 * Exact-after-normalising first, then one typo's worth of distance for names long
 * enough that a single letter is unlikely to be meaningful.
 *
 * Callers pass the *siblings* rather than the whole scope: "Karnataka" under
 * Vegetarian and "Karnataka" under Non-Vegetarian are two real places, and
 * offering the first when somebody is filling in the second would be wrong.
 */
export function similarNode<T extends TreeRow>(name: string, existing: T[]) {
  const needle = normalizeName(name);
  if (!needle) return null;
  const exact = existing.find((row) => normalizeName(row.name) === needle);
  if (exact) return exact;
  if (needle.length < 5) return null;
  return (
    existing.find((row) => {
      const other = normalizeName(row.name);
      return other.length >= 5 && editDistance(needle, other) <= 1;
    }) ?? null
  );
}

/** The order every surface draws a level in: what the manager dragged, then name. */
export function sortNodes<T extends TreeRow>(rows: T[]) {
  return [...rows].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id - b.id,
  );
}

export function nodeById<T extends TreeRow>(rows: T[], id: number | null | undefined) {
  if (!id) return null;
  return rows.find((row) => row.id === id) ?? null;
}

/**
 * Siblings in the order they are shown, optionally leaving one row out. The rows
 * handed in are already the one scope's — a category's nodes, or a circle's — so
 * a shared parent is the whole of what makes two rows siblings.
 */
export function siblingsOf<T extends TreeRow>(rows: T[], parentId: number | null, exceptId?: number) {
  return sortNodes(rows.filter((row) => (row.parentId ?? null) === parentId && row.id !== exceptId));
}

/** The nodes directly under this one, or the top level for null. */
export function childrenOf<T extends TreeRow>(rows: T[], parentId: number | null) {
  return siblingsOf(rows, parentId);
}

/**
 * The nodes above this one, the top end first, so a path reads the way it is
 * written. Stops at a missing parent rather than looping, so a row orphaned by a
 * half-finished delete still answers.
 */
export function ancestorsOf<T extends TreeRow>(rows: T[], node: T) {
  const chain: T[] = [];
  const seen = new Set<number>([node.id]);
  let parent = nodeById(rows, node.parentId);
  while (parent && !seen.has(parent.id)) {
    chain.unshift(parent);
    seen.add(parent.id);
    parent = nodeById(rows, parent.parentId);
  }
  return chain;
}

/** The names from the top of the tree down to and including this node. */
export function pathOf<T extends TreeRow>(rows: T[], node: T) {
  return [...ancestorsOf(rows, node), node].map((row) => row.name);
}

/** How far below the top this node sits: 1 for a node at the top level. */
export function depthOf<T extends TreeRow>(rows: T[], node: T) {
  return ancestorsOf(rows, node).length + 1;
}

/** Everything under this node, in the order a tree is drawn: depth first. */
export function descendantsOf<T extends TreeRow>(rows: T[], id: number): T[] {
  const children = sortNodes(rows.filter((row) => (row.parentId ?? null) === id));
  return children.flatMap((child) => [child, ...descendantsOf(rows, child.id)]);
}

/** The node and everything under it, which is what browsing a branch means. */
export function subtreeIds<T extends TreeRow>(rows: T[], id: number) {
  return [id, ...descendantsOf(rows, id).map((row) => row.id)];
}

/** How many levels the deepest branch under this node adds. A leaf answers 0. */
export function heightOf<T extends TreeRow>(rows: T[], id: number): number {
  const children = rows.filter((row) => (row.parentId ?? null) === id);
  if (children.length === 0) return 0;
  return 1 + Math.max(...children.map((child) => heightOf(rows, child.id)));
}

/**
 * The four sentences a refused move can say. They are the caller's words because
 * a member reads about the thing they were actually moving — a subcategory or a
 * folder — and a shared "node cannot sit inside itself" would be nobody's
 * vocabulary.
 */
export interface ReparentWords {
  /** Onto itself. */
  self: string;
  /** Onto something that is not in this tree at all. */
  elsewhere: string;
  /** Onto one of its own descendants. */
  inside: string;
  /** Under a parent deep enough that the branch would not fit. */
  tooDeep: string;
  /** To the top level, where only the branch's own height can refuse it. */
  branchTooDeep: string;
}

/**
 * Whether a node may be moved under this parent. Three ways it may not, and each
 * of them is a real mistake somebody can make in a tree: onto itself, onto one of
 * its own descendants — which would cut the branch off from the top altogether —
 * or somewhere the branch it carries would not fit under the cap.
 *
 * A parent of null is the top level, which is always allowed as long as the
 * branch fits. A parent outside the rows handed in is `elsewhere` by construction,
 * which is how a subcategory is stopped from moving into another category.
 */
export function reparentRefusal<T extends TreeRow>(
  rows: T[],
  node: T,
  parentId: number | null,
  words: ReparentWords,
): string | null {
  if (parentId === null) {
    return heightOf(rows, node.id) + 1 > MAX_TREE_DEPTH ? words.branchTooDeep : null;
  }
  if (parentId === node.id) return words.self;
  const parent = nodeById(rows, parentId);
  if (!parent) return words.elsewhere;
  if (subtreeIds(rows, node.id).includes(parent.id)) return words.inside;
  if (depthOf(rows, parent) + 1 + heightOf(rows, node.id) > MAX_TREE_DEPTH) return words.tooDeep;
  return null;
}

/** Whether a new child may be added under this parent at all. */
export function tooDeepFor<T extends TreeRow>(rows: T[], parent: T | null) {
  if (!parent) return false;
  return depthOf(rows, parent) + 1 > MAX_TREE_DEPTH;
}

/**
 * A node is only reachable when it and every node above it is switched on: hiding
 * Vegetarian takes South Indian with it, because there is no longer a way in.
 * Nothing is moved or deleted by that — ticking it back on brings the branch back
 * exactly as it was.
 */
export function nodeHidden<T extends TreeRow>(rows: T[], node: T) {
  if (node.status === "hidden") return true;
  return ancestorsOf(rows, node).some((row) => row.status === "hidden");
}

/** A path written out: ["Vegetarian", "South Indian"] → "Vegetarian › South Indian". */
export function pathText(names: string[]) {
  return names.join(` ${PATH_SEPARATOR} `);
}

/** The other direction, for a share form that names a path rather than an id. */
export function splitPath(value: string, limit: number) {
  return value
    .split(PATH_SEPARATOR)
    .map((part) => cleanName(part, limit))
    .filter((part) => part.length > 0);
}

/**
 * The node one path names inside one scope, or the deepest node it does name.
 * `matched` is how many segments were found, so a caller resolving a share's
 * filing knows whether the rest has to be created or whether it must give up.
 */
export function nodeAtPath<T extends TreeRow>(rows: T[], segments: string[]) {
  let parentId: number | null = null;
  let node: T | null = null;
  let matched = 0;
  for (const segment of segments) {
    const key = normalizeName(segment);
    const found: T | undefined = rows.find(
      (row) => (row.parentId ?? null) === parentId && normalizeName(row.name) === key,
    );
    if (!found) break;
    node = found;
    parentId = found.id;
    matched += 1;
  }
  return { node, matched };
}
