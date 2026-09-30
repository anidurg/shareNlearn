import { useEffect, useMemo } from "react";
import { folderById } from "../folders";
import {
  itemPlace,
  needsFolders,
  type ItemOrigin,
  type ItemPlace,
  type Placeable,
} from "../item-location";
import type { ShareAndLearn } from "../store";

/**
 * Where an item is, ready to draw: the place worked out from the route it was
 * opened through, plus the one fetch that can improve it.
 *
 * A circle's folder tree is loaded by that circle's own page, so an item reached
 * any other way — a link, a notification, My Library, a per-type listing — has
 * none in hand. The names are on the item's own filing either way, so the trail
 * reads immediately and simply gains its clickable ancestors when the tree lands.
 */
export function useItemPlace(
  store: ShareAndLearn,
  item: Placeable | undefined,
  origin: ItemOrigin,
  circleInView: number | null,
): ItemPlace {
  const foldersByCircle = store.circleFolders;
  const place = useMemo(
    () => itemPlace(item, origin, circleInView, foldersByCircle),
    [item, origin.circleId, origin.folderId, circleInView, foldersByCircle],
  );

  const wanted = needsFolders(item, place, foldersByCircle);
  const loadCircleFolders = store.loadCircleFolders;
  useEffect(() => {
    if (wanted === null) return;
    loadCircleFolders(wanted).catch(() => {});
  }, [wanted, loadCircleFolders]);

  return place;
}

/**
 * The top of an item's own page: one step back, and the walk that got there.
 *
 * `Austin Madhwa Sangha › Madhwa Festivals › Krishna Janmashtami` over a recipe,
 * because **the folder hierarchy is the navigation hierarchy** — what kind of
 * thing the item is decides which fields it draws below this and nothing about
 * where it sits. Every step is a button, the last one included, which is the one
 * place this differs from `FolderPage`'s otherwise identical trail: there the
 * last step is the page the reader is on, and here the page is the item, so the
 * folder holding it is somewhere to go rather than where they already are.
 *
 * The `← All songs` this replaced is kept for exactly one case and is honest
 * there: a share in no circle at all — private, or saved into a library from a
 * circle since left — has no place to be returned to, so the listing is the only
 * truthful destination left.
 */
export function ItemTrail({
  store,
  item,
  origin,
  circleInView,
  onOpenPlace,
  onBackToList,
  listLabel,
}: {
  store: ShareAndLearn;
  item: Placeable | undefined;
  /** The circle and folder the reader came through, off the route. */
  origin: ItemOrigin;
  /** The circle the header is pointing at, as the second-best answer. */
  circleInView: number | null;
  /** Open one place in the app: a folder of a circle, or the circle itself. */
  onOpenPlace: (circleId: number, folderId: number | null) => void;
  /** The way out for an item that is in no circle to go back to. */
  onBackToList: () => void;
  /** What that way out is called — "All songs", "All recipes". */
  listLabel: string;
}) {
  const place = useItemPlace(store, item, origin, circleInView);
  const circle = place.circleId === null ? null : store.circleById.get(place.circleId) ?? null;

  if (!circle) {
    return (
      <button className="btn-text back-link" onClick={onBackToList}>
        ← {listLabel}
      </button>
    );
  }

  /* One step back: the folder the reader came through, or the item's own, and the
     circle itself for something sitting in no folder of it. Naming it matters more
     than the arrow does — "← Krishna Janmashtami" says where the tap lands. */
  const folders = store.circleFolders[circle.id] ?? [];
  const backName =
    place.backFolderId === null
      ? `${circle.icon} ${circle.name}`
      : (folderById(folders, place.backFolderId)?.name ??
        place.trail.find((step) => step.id === place.backFolderId)?.name ??
        `${circle.icon} ${circle.name}`);

  return (
    <>
      <button
        className="btn-text back-link"
        onClick={() => onOpenPlace(circle.id, place.backFolderId)}
      >
        ← {backName}
      </button>

      <div className="shelf-trail-head">
        <nav className="shelf-trail" aria-label={`Where this sits in ${circle.name}`}>
          <button className="shelf-trail-step" onClick={() => onOpenPlace(circle.id, null)}>
            {circle.name}
          </button>
          {place.trail.map((step, index) => (
            <span key={step.id ?? `name-${index}`} className="shelf-trail-link">
              <span className="shelf-trail-sep" aria-hidden="true">
                ›
              </span>
              {/* An ancestor read off the stored path has a name and no id, so it
                  is said rather than offered — a button that cannot open the
                  folder it names would be worse than a word. */}
              {step.id === null ? (
                <span className="shelf-trail-here">{step.name}</span>
              ) : (
                <button
                  className="shelf-trail-step"
                  onClick={() => onOpenPlace(circle.id, step.id)}
                >
                  {step.name}
                </button>
              )}
            </span>
          ))}
        </nav>
      </div>
    </>
  );
}

/**
 * The way back when there is no item to ask.
 *
 * Two moments look identical from here: a share that could not be read at all —
 * removed, made private, or never visible to this reader — and the instant after
 * its author has deleted it. In both, the filing that would have said where the
 * thing sits is gone or was never in hand, so the route's own origin is the whole
 * of what is left: the folder the reader walked in through, and the per-type
 * listing for somebody who arrived on a bare link.
 */
export function backFromOrigin(
  origin: ItemOrigin,
  onOpenPlace: (circleId: number, folderId: number | null) => void,
  onBackToList: () => void,
): () => void {
  const from = origin.circleId;
  return from === null ? onBackToList : () => onOpenPlace(from, origin.folderId);
}

/**
 * That same way back, drawn: the button under "That recipe is not available".
 *
 * It names where it lands rather than the listing it used to name, because a
 * reader who walked in from Krishna Janmashtami wants that folder back and not
 * every recipe in the app. The folder is named where its tree is in hand and the
 * circle otherwise, and the destination follows the words either way — a button
 * saying one place and opening another is worse than the plainer sentence.
 */
export function MissingItemBack({
  store,
  origin,
  onOpenPlace,
  onBackToList,
  listLabel,
}: {
  store: ShareAndLearn;
  origin: ItemOrigin;
  onOpenPlace: (circleId: number, folderId: number | null) => void;
  onBackToList: () => void;
  /** What the listing is called, for a reader with no place to return to. */
  listLabel: string;
}) {
  const circle = origin.circleId === null ? null : store.circleById.get(origin.circleId) ?? null;
  if (!circle) {
    return (
      <button className="btn btn-ghost" onClick={onBackToList}>
        ← {listLabel}
      </button>
    );
  }

  const folders = store.circleFolders[circle.id] ?? [];
  const folder = origin.folderId === null ? null : folderById(folders, origin.folderId);
  return (
    <button
      className="btn btn-ghost"
      onClick={() => onOpenPlace(circle.id, folder ? folder.id : null)}
    >
      ← Back to {folder ? folder.name : `${circle.icon} ${circle.name}`}
    </button>
  );
}
