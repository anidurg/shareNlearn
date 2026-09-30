import { useEffect, useState } from "react";
import { NO_ORIGIN, type ItemOrigin } from "./item-location";

export type TabName =
  /** The circles you are in: the app's landing page, and where a circle is opened. */
  | "circles"
  /** The people in the circle currently in view: who is in, and who is waiting. */
  | "members"
  | "songs"
  | "recipes"
  | "learn"
  | "books"
  | "remedies"
  | "library"
  | "profile"
  /**
   * Why the app exists: `#/about`, outside the tab bar and reachable from the
   * footer. It reads no data and belongs to no circle, so it sits outside every
   * gate as well — a visitor deciding whether to join and a member whose account
   * has been paused are both people with a reason to read it.
   */
  | "about"
  /** The landing screen for an invite link: `#/join/<token>`, outside the tab bar. */
  | "join"
  /**
   * One shared item, read by whoever was handed the link: `#/shared/<token>`.
   * Outside the tab bar, and outside the app's own navigation altogether — the
   * token is the whole of what it may read, so there is nowhere to go from it but
   * into the circle it names.
   */
  | "shared"
  /**
   * Something another app has just handed *us*: `#/incoming`, where a share
   * arriving from the device's own share sheet is turned into an item.
   *
   * The mirror image of `shared` above, and deliberately not a second meaning of
   * that word: `shared` is a link this app minted and pointed outwards, and this
   * is a payload some other app pointed inwards. Outside the tab bar, because it
   * is somewhere a member is sent rather than somewhere they go, and it carries no
   * detail — the payload travels in `localStorage` rather than in the route, so it
   * survives a trip through logging in and a refresh cannot re-share it.
   */
  | "incoming";

export interface Route {
  tab: TabName;
  /**
   * Second path segment: a recipe, remedy, or circle id, "vocabulary" / "facts"
   * inside Learn, or an invite token.
   */
  detail: string | null;
  /**
   * Everything after that, which is two unrelated things. A circle goes three
   * deep — `#/circles/3/12/40` is the circle, the category and the shelf inside
   * it, and `#/circles/3/folders/40` one of its folders. An item's own page uses
   * them for where the reader came from: `#/recipes/12/in/3/40`, read by
   * `originFrom()` below.
   */
  rest: string[];
}

const TABS: TabName[] = [
  "circles",
  "members",
  "songs",
  "recipes",
  "learn",
  "books",
  "remedies",
  "library",
  "profile",
  "about",
  "join",
  "shared",
  "incoming",
];

/**
 * The areas a circle narrows. Each of these reads one circle's worth of the app —
 * Members is its roll, and the five per-type listings are what it holds — and
 * each of them widens to everything the member can see when the scope is all
 * circles.
 *
 * It exists so two rules can be stated once rather than guessed at per surface.
 * The **main navigation preserves the scope the page is showing**: stepping from
 * the Circles listing, which is every circle at once, onto Members keeps every
 * circle at once rather than quietly restoring whichever circle was last opened.
 * And the **selector changes the circle without changing the area**: picking
 * Discover while reading Members loads Discover's members, rather than throwing
 * the reader back to the Circles listing.
 *
 * Circles itself is deliberately not in the list. It is the one area whose
 * subject *is* a circle — picking one there is asking to open it — and Library
 * and Profile are not narrowed by a circle at all.
 */
const CIRCLE_SCOPED: TabName[] = ["members", "songs", "recipes", "learn", "books", "remedies"];

/**
 * Whether this tab reads one circle's worth of the app, and so keeps its place
 * when the circle in view changes.
 */
export function isCircleScoped(tab: TabName): boolean {
  return CIRCLE_SCOPED.includes(tab);
}

/**
 * Routes that no longer exist, and where their old links land now. Home was the
 * landing page until a circle became the thing the app is read circle by circle;
 * an installed app's `start_url`, a bookmark and the PWA shortcut all still say
 * `#/home`, so it is answered here rather than left to fall through.
 */
const MOVED: Record<string, TabName> = { home: "circles" };

function parseHash(): Route {
  const [rawTab, ...segments] = window.location.hash.replace(/^#\/?/, "").split("/");
  /* Circles is the default: it is the first thing a member sees on the way in. */
  const tab = TABS.find((name) => name === rawTab) ?? MOVED[rawTab] ?? "circles";
  const parts = segments.filter(Boolean).map(decodeURIComponent);
  return { tab, detail: parts[0] ?? null, rest: parts.slice(1) };
}

/** Hash routing keeps the browser's back button working without a router dependency. */
export function useRoute(): [Route, (tab: TabName, ...detail: (string | number)[]) => void] {
  const [route, setRoute] = useState<Route>(parseHash);

  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  function navigate(tab: TabName, ...detail: (string | number)[]) {
    window.location.hash = detail.length === 0 ? `#/${tab}` : `#/${tab}/${detail.join("/")}`;
  }

  return [route, navigate];
}

/**
 * How an item's page says where its reader came from.
 *
 * A share reaches several circles and sits in a folder of each, so "where is
 * this?" has as many answers as the item has audiences — and the one that
 * matters is the place the reader walked in through, because that is where Back
 * has to return them. The route is the only thing that survives a reload and the
 * browser's own back button, so the walk is written into it:
 * `#/recipes/12/in/3/40` is recipe 12, opened from folder 40 of circle 3.
 *
 * The folder is optional (`#/recipes/12/in/3` is the circle's own page), and the
 * whole clause is optional too: a link, a notification or a saved copy in My
 * Library carries nothing, and the item's own filing answers for it instead.
 * `in` cannot be mistaken for anything else in that slot, every other use of
 * `rest` being a number or the word `folders`.
 */
const ORIGIN_MARK = "in";

/** Where the reader came from, or nulls for an item opened cold. */
export function originFrom(rest: string[]): ItemOrigin {
  if (rest[0] !== ORIGIN_MARK) return NO_ORIGIN;
  const circleId = Number(rest[1]);
  if (!Number.isInteger(circleId)) return NO_ORIGIN;
  const folderId = Number(rest[2]);
  return { circleId, folderId: Number.isInteger(folderId) ? folderId : null };
}

/**
 * That clause as route segments, to hand to `navigate()` after the item's id.
 * Empty for a place worth nothing to record, so opening an item from somewhere
 * with no circle behind it leaves the route as short as it always was.
 */
export function originPath(circleId: number | null, folderId: number | null): (string | number)[] {
  if (circleId === null) return [];
  return folderId === null ? [ORIGIN_MARK, circleId] : [ORIGIN_MARK, circleId, folderId];
}

export function itemLink(tab: TabName, detail?: string | number) {
  const base = `${window.location.origin}${window.location.pathname}`;
  return detail === undefined ? `${base}#/${tab}` : `${base}#/${tab}/${detail}`;
}

/**
 * The link handed out for one item. It names the share token and nothing else —
 * not the circle, not the folder, not the item's own id — because the token is
 * the permission and anything else in it would be a second way to ask.
 */
export function sharedItemLink(token: string): string {
  return itemLink("shared", token);
}
