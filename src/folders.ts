// src/folders.ts
// A circle's folders on the browser side: where a share belongs, as against what
// kind of thing it is.
//
// A folder tree hangs off a circle, so it holds songs, recipes and books side by
// side — which is the whole reason it exists beside a category's shelves rather
// than instead of them. The walk itself is `src/tree.ts` and is shared with the
// shelves; this file is that walk named for folders, plus the two answers only a
// folder has: which folder a share sits in in a given circle, and which folders a
// keeper may move one into.
//
// The counterpart on the server is `netlify/lib/folders.ts`, and the split is the
// same as it is for the shelves: over here the limits are a courtesy that warns
// somebody before the round trip, and over there they are the rule.

import type { CircleFiling, Folder } from "./api";
import {
  branchIds,
  childNodes,
  descendantsOf,
  nodeById,
  nodeHidden,
  rootNodes,
  similarName,
  sortNodes,
  treeOf,
  treeOptions,
  type TreeOption,
} from "./tree";

/**
 * Where a share is going, which every share form takes instead of asking.
 *
 * A folder's own page passes its id and its path, so the form states where the
 * member is standing rather than asking a second time. A circle's own page passes
 * `id: null` and an empty path: there is no folder to name, and the point of it is
 * that the form asks nothing either — the content type was chosen in the sheet, so
 * the old cross-category "File under" question has already been answered.
 */
export type ShareTarget = { id: number | null; path: string[] };

/** As deep as a folder may sit, matching `MAX_FOLDER_DEPTH` on the server. */
export const MAX_FOLDER_DEPTH = 12;

/** As long as a folder's name may be, matching `MAX_FOLDER_NAME`. */
export const MAX_FOLDER_NAME = 60;

/** Folders at the top of the circle, in the order their keeper put them. */
export function rootFolders(folders: Folder[]) {
  return rootNodes(folders);
}

/** The folders directly inside one folder — or the top ones, for null. */
export function childFolders(folders: Folder[], parentId: number | null) {
  return childNodes(folders, parentId);
}

export function folderById(folders: Folder[], id: number | null) {
  return nodeById(folders, id);
}

/** The whole tree flattened depth-first, which is what a manager draws. */
export function folderTree(folders: Folder[]) {
  return treeOf(folders);
}

/** Everything inside one folder, at any depth. */
export function subfoldersOf(folders: Folder[], id: number) {
  return descendantsOf(folders, id);
}

/**
 * A folder and everything inside it, by id. Opening "Madhwa Festivals" lists what
 * was shared into it *and* everything in the subfolders under it, because a member
 * standing at the top of a branch still means the branch.
 */
export function folderBranchIds(folders: Folder[], id: number) {
  return branchIds(folders, id);
}

/** Whether a folder is hidden, itself or by one it sits inside. */
export function folderHidden(folders: Folder[], folder: Folder) {
  return nodeHidden(folders, folder);
}

/**
 * The folders a member may actually walk into. A keeper's copy of the tree carries
 * what they have hidden so they can show it again, so any surface that is browsing
 * rather than managing filters it through this.
 */
export function visibleFolders(folders: Folder[]) {
  return folders.filter((folder) => !nodeHidden(folders, folder));
}

/** One folder's own path, which the server already worked out. */
export function folderTrail(folders: Folder[], id: number | null): string[] {
  return folderById(folders, id)?.path ?? [];
}

/**
 * Which folder a share sits in in one circle. A share reaching three circles has
 * three filings and each circle answers for itself, because a folder belongs to
 * one circle: null is the share sitting in the circle rather than in any folder
 * of it.
 */
export function folderIn(
  entry: { filings?: Pick<CircleFiling, "circleId" | "folderId">[] },
  circleId: number,
) {
  return entry.filings?.find((filing) => filing.circleId === circleId)?.folderId ?? null;
}

/**
 * Whether a share belongs on the page for one folder, which is that folder or
 * anything inside it. `ids` is `folderBranchIds()` worked out once for the page
 * rather than per row.
 */
export function inFolderBranch(
  entry: { filings?: Pick<CircleFiling, "circleId" | "folderId">[] },
  circleId: number,
  ids: number[],
) {
  const folderId = folderIn(entry, circleId);
  return folderId !== null && ids.includes(folderId);
}

/**
 * Which folder an already-shared item is in, as a path to state on an edit form:
 * `["Austin", "Thursday Bhajane"]`, or null for a share that sits in no folder of
 * any circle.
 *
 * A share reaching three circles has three filings, so the first folder found is
 * the answer — which is the same rule `currentShelfChoice()` follows, and for the
 * same reason: a form states one place rather than a list. The path travels on the
 * filing itself, so this works on every surface an edit can be opened from,
 * including the ones that never load a circle's folder tree.
 */
export function currentFolderPath(
  entry: { filings?: Pick<CircleFiling, "folderId" | "folderPath">[] } | undefined,
): string[] | null {
  for (const filing of entry?.filings ?? []) {
    if (filing.folderId === null) continue;
    const path = filing.folderPath ?? null;
    if (path && path.length > 0) return path;
  }
  return null;
}

/** Every folder as a choice, indented, for a picker. */
export function folderOptions(folders: Folder[]): TreeOption[] {
  return treeOptions(folders);
}

/**
 * Where a folder may be moved to: the top of the circle, and every folder that is
 * not the one moving and not inside it. Moving a folder into its own branch is the
 * one thing the tree cannot hold, and the server refuses it too — this is so the
 * choice is never offered in the first place.
 */
export function folderMoveTargets(folders: Folder[], id: number): TreeOption[] {
  const forbidden = new Set(folderBranchIds(folders, id));
  return folderOptions(folders).filter(
    (option) => option.id === null || !forbidden.has(option.id),
  );
}

/**
 * A name already used by a folder inside the same parent, which is what a keeper
 * probably meant. Only siblings, because "Songs" inside two different festivals is
 * two real places rather than a duplicate.
 */
export function similarFolder(
  folders: Folder[],
  parentId: number | null,
  name: string,
  exceptId?: number,
) {
  const siblings = sortNodes(
    childFolders(folders, parentId).filter((folder) => folder.id !== exceptId),
  );
  const match = similarName(name, siblings.map((folder) => folder.name));
  return match === null ? null : siblings.find((folder) => folder.name === match) ?? null;
}
