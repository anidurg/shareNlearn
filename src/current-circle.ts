import { useCallback, useState } from "react";
import type { Circle } from "./api";

const KEY = "share-and-learn:current-circle";
/** What is written down for "all circles" — never a circle id, so they cannot collide. */
const ALL = "all";

/**
 * Which circle the member is looking at. Navigation is circle-first, so this is
 * the one piece of state the whole shell reads: the header dropdown names it,
 * Members lists its people, a share started outside a circle goes into it, and
 * opening a circle from the Circles listing is what moves it. It follows the
 * route as well as leading it — arriving on a circle's page by link, notification
 * or the back button chooses that circle, so the dropdown can never disagree with
 * the page under it.
 *
 * **All circles is one of the answers, and it is the one nothing chosen means.**
 * The app opens on the Circles listing — every circle side by side — so a corner
 * naming one particular circle was the header disagreeing with the page on the
 * very first screen, and standing in with Discover was a choice nobody made.
 * Nothing is narrowed while it holds: the per-type listings show everything
 * across every circle, which is what `inCircle(rows, null)` has always meant, and
 * Members says plainly that a roll needs one circle.
 *
 * It lives on the device rather than on the server, because it is where somebody
 * last was rather than something the group needs to know. Nothing breaks if it is
 * lost — the app opens on all of them, exactly as a first visit does.
 */
type Choice = number | typeof ALL | null;

function remembered(): Choice {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return null;
    if (raw === ALL) return ALL;
    const id = Number(raw);
    return Number.isInteger(id) ? id : null;
  } catch {
    // Private browsing with storage blocked: the choice still holds for this tab.
    return null;
  }
}

function remember(choice: number | typeof ALL) {
  try {
    localStorage.setItem(KEY, String(choice));
  } catch {
    // Nothing to keep it in; the state above is still authoritative.
  }
}

export interface CurrentCircle {
  /** The circle in view, or null for all of them at once. */
  circleId: number | null;
  circle: Circle | null;
  choose: (circleId: number) => void;
  /** Steps back out to every circle at once, which is what nothing chosen means. */
  chooseAll: () => void;
}

export function useCurrentCircle(circles: Circle[]): CurrentCircle {
  const [chosen, setChosen] = useState<Choice>(remembered);

  /*
   * The pick is only ever the member's own — a fallback is worked out here rather
   * than written back over it. That matters while circles are still arriving: a
   * circle just joined is chosen before the list knows about it, and standing in
   * for it with some other circle must not become the answer. Standing in with
   * "all circles" is safe, because it claims nothing.
   *
   * The one person not choosing between circles is somebody with no account. They
   * have exactly one on offer — Discover — and are looking at it rather than in
   * it, so the shop window and the corner above it both have to be able to name
   * it; "all circles" would be a listing they do not get. Read that off the role
   * the server sent rather than off whether anybody is logged in, so this file
   * still knows nothing about accounts.
   */
  const picked =
    typeof chosen === "number" ? (circles.find((row) => row.id === chosen) ?? null) : null;
  const visitor = circles.length > 0 && !circles.some((row) => row.role);
  const circle =
    picked ?? (visitor ? (circles.find((row) => row.isDefault) ?? circles[0] ?? null) : null);

  const choose = useCallback((circleId: number) => {
    setChosen(circleId);
    remember(circleId);
  }, []);

  const chooseAll = useCallback(() => {
    setChosen(ALL);
    remember(ALL);
  }, []);

  return { circleId: circle?.id ?? null, circle, choose, chooseAll };
}
