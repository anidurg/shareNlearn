// src/item-location.ts
// Where a share *is*, as against what kind of thing it is.
//
// The navigation hierarchy is Circle → Folder → Subfolder → Item, and the content
// type — song, recipe, book, bookmark, remedy — says which fields an item has and
// nothing whatever about where it lives. So an item's own page derives its
// breadcrumb and its way back from the folder it sits in, and never from the
// per-type listing it happens to belong to: "← All recipes" was the location of a
// recipe back when Recipes was a page, and a recipe in the Madhwa Festivals folder
// has not been in that place since.
//
// A share reaches several circles and has one filing per circle, so "where is it?"
// has as many answers as it has audiences. That is what `ItemOrigin` is for: the
// circle and folder the reader actually came through, carried in the route so
// Back returns them there rather than to whichever answer happened to be first.
//
// This file is the model and holds no callbacks and no JSX — `ItemTrail` in
// `src/components/ItemLocation.tsx` is the one surface that draws it.

import type { CircleFiling, Folder } from "./api";
import { folderById } from "./folders";

/**
 * Anything shared, as far as its location is concerned. Every content type
 * carries these two, so nothing here needs to know which one it is looking at.
 */
export interface Placeable {
  circleIds?: number[];
  filings?: CircleFiling[];
}

/**
 * The circle and folder a reader came through, parsed off the route. Both are
 * null for a link opened cold — a shared URL, a notification, a bookmark — which
 * is not a failure: the item's own filing still says where it sits, and that is
 * the answer such a reader wants.
 */
export interface ItemOrigin {
  circleId: number | null;
  folderId: number | null;
}

export const NO_ORIGIN: ItemOrigin = { circleId: null, folderId: null };

/**
 * One step of the breadcrumb. A null `id` is a step whose *name* is known but
 * which cannot be opened — the ancestors of a folder read off the filing's stored
 * path, on a surface that never loaded the circle's folder tree. Naming it and
 * not linking it is better than either hiding the walk or offering a button that
 * cannot answer.
 */
export interface PlaceStep {
  id: number | null;
  name: string;
}

/** Where an item sits, and where its Back goes. */
export interface ItemPlace {
  /** The circle this reading of the item is in, or null for one in no circle. */
  circleId: number | null;
  /** The folders from the top of that circle down to the one holding the item. */
  trail: PlaceStep[];
  /** One step back: the folder to return to, or null for the circle itself. */
  backFolderId: number | null;
  /** The folder the item is filed in, whether or not the reader came through it. */
  folderId: number | null;
}

export const NOWHERE: ItemPlace = {
  circleId: null,
  trail: [],
  backFolderId: null,
  folderId: null,
};

/** This item's filing in one circle, which is where it sits *there*. */
function filingIn(item: Placeable | undefined, circleId: number): CircleFiling | null {
  return item?.filings?.find((filing) => filing.circleId === circleId) ?? null;
}

/**
 * Which circle to read the item in.
 *
 * The circle the reader came through wins, because that is the place they mean
 * and the place their Back has to return to. Failing that the circle in view,
 * which is the header's answer to the same question, and failing that the first
 * circle the item reaches — a link opened cold has to land somewhere, and any
 * audience of the item is a truthful answer. Both candidates are checked against
 * the item's own circles, so a stale route or a header pointing elsewhere cannot
 * put an item in a circle it was never shared into.
 */
export function placeCircleFor(
  item: Placeable | undefined,
  origin: ItemOrigin,
  circleInView: number | null,
): number | null {
  const reaches = item?.circleIds ?? [];
  if (origin.circleId !== null && reaches.includes(origin.circleId)) return origin.circleId;
  if (circleInView !== null && reaches.includes(circleInView)) return circleInView;
  return reaches[0] ?? null;
}

/**
 * Where one item is, worked out from the route it was opened through and the
 * folder trees already in hand.
 *
 * The trail is the item's *own* folder path rather than the walk the reader took,
 * so a reader who opened it from three folders up still reads where the thing
 * actually sits — and every step of it is clickable, the folder they came from
 * among them. Back is the narrower question and keeps the walk: the origin folder
 * when the reader came through this same circle, and otherwise the item's own.
 */
export function itemPlace(
  item: Placeable | undefined,
  origin: ItemOrigin,
  circleInView: number | null,
  foldersByCircle: Record<number, Folder[]>,
): ItemPlace {
  const circleId = placeCircleFor(item, origin, circleInView);
  if (circleId === null) return NOWHERE;

  const filing = filingIn(item, circleId);
  const folderId = filing?.folderId ?? null;
  const backFolderId = origin.circleId === circleId ? origin.folderId : folderId;
  const place: ItemPlace = { circleId, trail: [], backFolderId, folderId };
  if (folderId === null) return place;

  /* The tree, where the circle's own page has been visited: every ancestor is a
     row with an id, so the whole walk is navigable. */
  const folders = foldersByCircle[circleId] ?? [];
  const here = folderById(folders, folderId);
  if (here) {
    const trail: PlaceStep[] = [];
    const seen = new Set<number>();
    let step: Folder | null = here;
    while (step && !seen.has(step.id)) {
      seen.add(step.id);
      trail.unshift({ id: step.id, name: step.name });
      step = folderById(folders, step.parentId);
    }
    return { ...place, trail };
  }

  /* No tree in hand — a deep link, or My Library, which loads none. The filing
     carries the path as names, so the walk can still be read; only the folder the
     item is actually in has an id to open, the ancestors having none to give. */
  const path = filing?.folderPath ?? null;
  if (!path || path.length === 0) return place;
  return {
    ...place,
    trail: path.map((name, index) => ({
      id: index === path.length - 1 ? folderId : null,
      name,
    })),
  };
}

/**
 * Whether this reading needs a folder tree fetched before the trail can be walked
 * rather than merely read. The names are already on the filing, so this is an
 * upgrade rather than a prerequisite: the breadcrumb draws either way and gains
 * its clickable ancestors when the answer lands.
 */
export function needsFolders(
  item: Placeable | undefined,
  place: ItemPlace,
  foldersByCircle: Record<number, Folder[]>,
): number | null {
  if (place.circleId === null || place.folderId === null) return null;
  const folders = foldersByCircle[place.circleId];
  if (folders && folderById(folders, place.folderId)) return null;
  return place.circleId;
}
