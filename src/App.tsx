import { useEffect, useRef, useState } from "react";
import type { Circle } from "./api";
import type { ShareFlow } from "./categories";
import type { ShareTarget } from "./folders";
import {
  forgetIncomingShare,
  hasContent,
  pendingIncomingShare,
  pendingSharedPayload,
  rememberIncomingShare,
  type IncomingFile,
  type IncomingImage,
  type IncomingShare,
  type SharePrefill,
} from "./incoming-share";
import { AboutPage } from "./components/AboutPage";
import { AccessGate, CircleTrustNote, type GateKind } from "./components/AccessGate";
import { AuthPanel, logoutUser, useIdentityUser } from "./components/Auth";
import { BookModal } from "./components/BookModal";
import { BooksTab } from "./components/BooksTab";
import { CircleModal } from "./components/CircleModal";
import { CirclesTab } from "./components/CirclesTab";
import { CircleMenu } from "./components/CircleSwitcher";
import { IncomingShareScreen } from "./components/IncomingShareScreen";
import { InstallBanner } from "./components/InstallPrompt";
import { InviteModal } from "./components/InviteModal";
import { forgetPendingInvite, JoinScreen, pendingInvite } from "./components/JoinScreen";
import { LearnTab, type LearnSection } from "./components/LearnTab";
import { LibraryTab } from "./components/LibraryTab";
import { MembersTab } from "./components/MembersTab";
import { Nav } from "./components/Nav";
import { NotificationBell } from "./components/NotificationBell";
import { ProfileTab } from "./components/ProfileTab";
import { RecipeModal } from "./components/RecipeModal";
import { RecipesTab } from "./components/RecipesTab";
import { RemediesTab } from "./components/RemediesTab";
import { RemedyModal } from "./components/RemedyModal";
import { BookmarkModal } from "./components/BookmarkModal";
import { FactModal } from "./components/FactModal";
import { useGuidelinesGate } from "./components/Guidelines";
import {
  forgetPendingShare,
  pendingShare,
  SharedItemScreen,
} from "./components/SharedItemScreen";
import { SongsTab } from "./components/SongsTab";
import { SongModal } from "./components/SongModal";
import { WordModal } from "./components/WordModal";
import { Modal } from "./components/shared";
import { isCircleScoped, originFrom, originPath, useRoute, type TabName } from "./router";
import { useShareAndLearn } from "./store";
import { useCurrentCircle } from "./current-circle";

/** Creation flows started from the header or a circle, so outside any one tab. */
type QuickShare = ShareFlow | "invite" | "circle";

/**
 * A share with nothing in it, which the incoming screen is drawn on when the
 * device sent no payload — and on every browser where the Web Share Target API
 * does not exist at all, iOS included. The screen's fields are editable either
 * way, so an empty one is a paste-a-link form rather than a broken screen.
 */
const NO_SHARE: IncomingShare = { title: "", text: "", url: "" };

/**
 * The letters in the corner. Nobody uploads a picture in this app, so the avatar
 * is the member's own initials: the first letter of each of the first two words
 * of their name.
 *
 * `memberName` falls back to the email address where an account has no name, and
 * an address initialled whole reads as nonsense ("priya@example.com" giving PE),
 * so anything from the @ onwards is dropped first. Null when there is nothing to
 * work from at all, and the caller draws a glyph instead.
 */
function initialsOf(name: string | null): string | null {
  const letters = (name ?? "")
    .split("@")[0]
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase());
  return letters.length > 0 ? letters.join("") : null;
}

export default function App() {
  const { user, ready, recovering, clearRecovering } = useIdentityUser();
  const [route, navigate] = useRoute();
  const store = useShareAndLearn(user?.id ?? null, ready);
  /**
   * Navigation is circle-first, so the app always has one circle in view: the
   * header dropdown names it, a share started outside a circle goes into it, and
   * opening a circle from the Circles listing is what moves it.
   */
  const current = useCurrentCircle(store.circles);
  const [showAuth, setShowAuth] = useState(false);
  const [quickShare, setQuickShare] = useState<QuickShare | null>(null);
  /** Set when a share was started from inside a circle, so that circle is ticked. */
  const [shareCircle, setShareCircle] = useState<number | null>(null);
  /**
   * Set when a share was started from inside a folder — "+ Share an item" on a
   * folder page. The member has already said where it goes by walking there, so
   * the form states the folder rather than asking again, and the id travels with
   * the share so the server files it.
   */
  const [shareFolder, setShareFolder] = useState<ShareTarget | null>(null);
  /**
   * Words another app handed over, when the form was opened from the
   * incoming-share screen. It seeds the fields the form has something to say
   * about and nothing else, and it is null for every ordinary share, which is
   * why every form takes it as optional and none of them changed shape.
   */
  const [sharePrefill, setSharePrefill] = useState<SharePrefill | null>(null);
  /**
   * The payload itself, read out of storage once rather than on every render.
   * `main.tsx` has already lifted it off the query string and written it down by
   * the time this runs, so a share that arrived on this page load is here, and so
   * is one stashed before a trip through logging in.
   */
  const [incoming, setIncoming] = useState<IncomingShare | null>(pendingIncomingShare);
  /**
   * Pictures that came with it, which only a POSTed share can carry and which
   * cannot be read as early as the strings are: they wait in Cache Storage,
   * which answers a promise, so they land on the screen a moment after it draws.
   */
  const [incomingImages, setIncomingImages] = useState<IncomingImage[]>([]);
  /**
   * A document, recording or clip that came with it — the same wait the pictures
   * have, and for the same reason: the bytes are in Cache Storage rather than in
   * the strings, so they land a moment after the screen draws.
   *
   * One at a time, because a share sheet hands over one file at a time, but held
   * as a list so the shape matches what the mailbox actually stores.
   */
  const [incomingFiles, setIncomingFiles] = useState<IncomingFile[]>([]);
  /** The circle being edited, when the circle modal is open for an existing one. */
  const [editingCircle, setEditingCircle] = useState<Circle | null>(null);
  /**
   * The organisation a new circle is being started under, when the form was
   * opened by "Add branch" rather than by "+ Start a circle". It only seeds the
   * form's existing parent field — the member can still change or clear it —
   * because starting a branch is starting a circle and nothing else.
   */
  const [branchParent, setBranchParent] = useState<Circle | null>(null);
  /** Set when somebody asked to start a circle before their account may. */
  const [circleHeldBack, setCircleHeldBack] = useState(false);
  /**
   * A sentence about something that has just happened, said once. It lives up
   * here rather than on the page that caused it because the two things worth
   * saying — you left a circle, and which circle you are looking at now — happen
   * either side of a navigation, and a note on the old page unmounts with it.
   */
  const [flash, setFlash] = useState<string | null>(null);
  /**
   * The guidelines, asked once before a member's first share. `guard` holds the
   * share that was started until the tick, and then opens it.
   */
  const guidelines = useGuidelinesGate(store);

  useEffect(() => {
    if (recovering) setShowAuth(true);
  }, [recovering]);

  /*
   * The flash says its sentence and then goes. It is an acknowledgement rather
   * than a state of the app, and one that stayed until it was dismissed would
   * still be claiming, ten minutes later, that something had just happened.
   */
  useEffect(() => {
    if (flash === null) return;
    const timer = window.setTimeout(() => setFlash(null), 6000);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const userId = user?.id ?? null;
  const memberName = user?.name ?? user?.email ?? null;
  const joining = route.tab === "join";
  /**
   * One item somebody was handed a link to. Like the join screen it sits outside
   * the tab bar and outside every gate: whoever opens it may have no account at
   * all, which is the whole point of it — the content is the invitation, so it is
   * read first and the circle is offered underneath it afterwards.
   */
  const viewingShare = route.tab === "shared";
  /**
   * Why the app exists, at `#/about`. Like the two screens above it, it is
   * outside every gate: it reads no data and belongs to no circle, so a visitor
   * weighing up whether to join and a member whose account has been paused can
   * both read it. Unlike them it keeps the tab bar, being an ordinary page of the
   * app rather than a door into it.
   */
  const readingAbout = route.tab === "about";
  /**
   * A share another app has just handed over, at `#/incoming`. Unlike the two
   * screens above it this one is *inside* the gates and keeps the tab bar: it
   * writes into a circle, so a paused account and a member with no circle yet
   * have nowhere to put it and should read the door rather than the form.
   */
  const sharingIn = route.tab === "incoming";

  // Someone who signed up from an invite link may come back through a
  // confirmation email, landing anywhere. The remembered token brings them back
  // to the invite so it still gets accepted.
  //
  // Once, though. The Identity user is a new object every time the token is
  // refreshed — which happens on every focus and every wake — and an invite that
  // was never accepted stays remembered, so without the guard this fired again
  // and again: a member typing into a form would be pulled to the join screen
  // seconds later for a link they had already dealt with.
  const invitePulled = useRef(false);
  useEffect(() => {
    if (!ready || !user || joining || viewingShare || invitePulled.current) return;
    const waiting = pendingInvite();
    if (!waiting) return;
    invitePulled.current = true;
    navigate("join", waiting);
  }, [ready, user, joining, viewingShare, navigate]);

  // The same problem one door along, and the reason it needs the same answer:
  // logging in from a shared item leaves the page. An OAuth provider navigates
  // away, and the email link comes back on Identity's own address carrying
  // `#recovery_token=…` — which overwrites `#/shared/<token>` — so there is no
  // redirect parameter that could survive the trip. The token is written down
  // before the reader leaves and read back here, which lands them on the thing
  // they were sent rather than on the Circles listing wondering what happened.
  //
  // Guarded once, for the reason above, and after the invite: a link that names a
  // circle is the wider welcome of the two, so if somebody is holding both, the
  // invite goes first and the item is still waiting behind it.
  const sharePulled = useRef(false);
  useEffect(() => {
    if (!ready || !user || joining || viewingShare || sharePulled.current) return;
    if (pendingInvite()) return;
    const waiting = pendingShare();
    if (!waiting) return;
    sharePulled.current = true;
    forgetPendingShare();
    navigate("shared", waiting);
  }, [ready, user, joining, viewingShare, navigate]);

  // And the third door, for the reason the first two exist: a share arriving
  // from the device's own share sheet may reach somebody with no account, and
  // logging in leaves the page. The payload is written down before they go and
  // read back here, which lands them on the form they were heading for rather
  // than on the Circles listing holding nothing.
  //
  // Ordered behind both of the others, which are somebody else's invitation and
  // somebody else's link — a payload of one's own is the one that can wait, and
  // it is still waiting once they are dealt with.
  //
  // The ref is marked the moment the screen is actually on screen as well as
  // when this fires, which is what stops it being a trap: a member who lands on
  // the screen and then taps into a circle without dealing with the share has
  // said something by doing that, and being dragged back to it a moment later
  // would be the app arguing with them. A fresh page load starts over, which is
  // exactly what a trip through logging in is.
  const incomingPulled = useRef(false);
  useEffect(() => {
    if (sharingIn) incomingPulled.current = true;
  }, [sharingIn]);
  useEffect(() => {
    if (!ready || !user || joining || viewingShare || sharingIn) return;
    if (incomingPulled.current) return;
    if (pendingInvite() || pendingShare()) return;
    const waiting = pendingIncomingShare();
    if (!waiting) return;
    incomingPulled.current = true;
    setIncoming(waiting);
    navigate("incoming");
  }, [ready, user, joining, viewingShare, sharingIn, navigate]);

  /*
   * The other half of an arrival, and the asynchronous half.
   *
   * A share that came in as a POST — which is every photo, and every link from an
   * app installed since the manifest moved to Level 2 — was answered by the
   * service worker rather than by the page: it put what arrived in a Cache Storage
   * mailbox and redirected here. Cache Storage is promises all the way down, so
   * unlike the query string this cannot be read in `main.tsx` before React draws.
   * The screen opens first and the payload lands on it a moment later, which is
   * why its fields are state rather than props of a single render.
   *
   * Read exactly once, guarded by a ref rather than by an empty dependency list,
   * because the mailbox only ever changes on the page load a share caused. The
   * three strings are written into `localStorage` on the way past as well, so the
   * half of the payload that can survive a trip through logging in does — the
   * pictures survive on their own, the mailbox being cleared only when the share
   * is finished with.
   *
   * There is deliberately no cancellation on the way out. A "still mounted?" flag
   * plus a read-once ref is the one combination that cannot work: Strict Mode
   * mounts, unmounts and mounts again, so the flag would cancel the only read the
   * ref allows and the payload would never arrive in development. Writing state
   * from a settled promise is harmless, and this component lives as long as the
   * page does anyway.
   */
  const mailboxRead = useRef(false);
  useEffect(() => {
    if (mailboxRead.current) return;
    mailboxRead.current = true;
    void pendingSharedPayload().then((payload) => {
      if (!payload) return;
      const { share, images, files } = payload;
      // A file on its own is a share: a PDF sent from WhatsApp arrives with no
      // words, no link and no picture, so a guard that only counted those two
      // would drop it on the floor.
      if (!hasContent(share) && images.length === 0 && files.length === 0) return;
      rememberIncomingShare(share);
      setIncoming(share);
      setIncomingImages(images);
      setIncomingFiles(files);
      incomingPulled.current = true;
      if (!sharingIn) navigate("incoming");
    });
  }, [sharingIn, navigate]);

  const learnSection: LearnSection = route.detail === "vocabulary" ? "vocabulary" : "facts";

  /**
   * Which door, if any, this account is standing at. Anybody who can log in is a
   * member and is joined to Discover, so in the ordinary case there is no door at
   * all — what is left is an account an admin has paused, an access read that did
   * not land, and the circle-first fallback for a member the server could not put
   * in a circle. Answered here once rather than in every tab, and only after the
   * access read has landed, since guessing either way would flash the wrong
   * screen.
   *
   * The circle-first door is the one whose answer the app can also see for
   * itself: a member with circles in hand is in a circle, whatever an access read
   * taken before they joined still says. Holding them at it anyway is what made
   * the whole app unreachable to somebody who had just accepted an invitation —
   * so the circle list wins over a stale answer, and the server refuses either
   * way if it turns out to be the other one.
   */
  const inACircle = store.circles.length > 0;
  const gate: GateKind | null =
    !user || !store.accessLoaded
      ? null
      : store.access.suspended
        ? "suspended"
        : !store.access.admitted
          ? "unavailable"
          : store.access.needsCircle && !inACircle
            ? "circle-first"
            : null;
  /** Barred outright: no tab is readable, so none is offered. */
  const barred = gate === "unavailable" || gate === "suspended";
  /**
   * Nothing is drawn until Identity has said who is asking.
   *
   * The store waits for the same answer, so before it lands there is nothing to
   * show anyway — but a tab rendered against an empty store does not look empty,
   * it looks like a visitor's app: Circles shows the "Create account" door, and a
   * member who has just logged in watches it for as long as the answer takes.
   * One line of "Loading…" is the honest version of that moment.
   */
  const shell = ready && !barred;
  /**
   * Needing a circle is not being barred — Circles is where they are going, and
   * Profile is where the account itself lives — so only the rest is held back.
   */
  const held =
    gate === "circle-first" &&
    route.tab !== "circles" &&
    route.tab !== "profile" &&
    route.tab !== "about";

  /** Songs, recipes and remedies each open one item at `#/<tab>/<id>`. */
  const detailId =
    route.detail && /^\d+$/.test(route.detail) ? Number(route.detail) : null;
  const openSongId = route.tab === "songs" ? detailId : null;
  const openRecipeId = route.tab === "recipes" ? detailId : null;
  const openRemedyId = route.tab === "remedies" ? detailId : null;
  const openBookId = route.tab === "books" ? detailId : null;
  const openCircleId = route.tab === "circles" ? detailId : null;
  /**
   * Where the reader walked in through, read off `#/<tab>/<id>/in/<circleId>[/<folderId>]`.
   *
   * An item's location is the circle and folder it was opened from rather than
   * anything about what kind of thing it is, and a share reaches several circles,
   * so the walk has to be written down somewhere that survives a reload and the
   * browser's own back button. That is the route. Nothing there is the ordinary
   * case for a link, a notification or a saved copy in My Library, and the item's
   * own filing answers for it instead.
   */
  const itemOrigin = originFrom(route.rest);
  /** `#/circles/<id>/<categoryId>/<shelfId>` — the category page, and one shelf in it. */
  const openCategoryId =
    openCircleId !== null && route.rest[0] && /^\d+$/.test(route.rest[0])
      ? Number(route.rest[0])
      : null;
  const openShelf = openCategoryId !== null ? (route.rest[1] ?? null) : null;
  /**
   * `#/circles/<id>/folders/<folderId>` — one folder of that circle. It cannot
   * collide with the category route above, which requires a number where this
   * one says "folders".
   */
  const openFolderId =
    openCircleId !== null && route.rest[0] === "folders" && route.rest[1] && /^\d+$/.test(route.rest[1])
      ? Number(route.rest[1])
      : null;

  /*
   * The corner follows the page. The Circles listing is every circle side by
   * side, so while it is on screen the answer to "which circle?" is all of them,
   * whatever the member last narrowed to — a corner naming one particular circle
   * above a page showing all of them is the header disagreeing with the page, and
   * it was the very first screen anybody saw.
   *
   * It is deliberately an override rather than a choice: nothing is written down,
   * so stepping off the listing onto Songs still narrows to the circle the member
   * picked. Widening for good is `chooseAll()`, which the dropdown does and this
   * does not.
   *
   * Only for somebody with an account. A visitor's Circles page *is* the shop
   * window for one circle, so the corner goes on naming it.
   */
  const showingAllCircles = userId !== null && route.tab === "circles" && route.detail === null;
  const circleInView = showingAllCircles ? null : current.circle;
  const circleIdInView = showingAllCircles ? null : current.circleId;

  /**
   * One circle in view, and the header is where it is read. Opening a circle's own
   * page therefore has to move the dropdown: it used to be possible to sit on
   * Austin Madhwa Sangha's page while the corner said Discover, which is two
   * answers to the same question and makes every "in this circle" on screen a
   * guess.
   *
   * It hangs off the route rather than off the Open button so that everything
   * that lands on a circle page is covered by it — a tapped notification, a
   * pasted link, the back button, a branch crumb — rather than the one path
   * somebody remembered to wire up.
   *
   * Only a circle they are actually in: previewing a public circle, or having a
   * look at one they were invited to, must not make the header claim a membership
   * they have not taken up.
   */
  useEffect(() => {
    if (openCircleId === null || openCircleId === current.circleId) return;
    if (!store.circles.some((circle) => circle.id === openCircleId)) return;
    current.choose(openCircleId);
  }, [openCircleId, current.circleId, current.choose, store.circles]);

  /**
   * The same rule for an item's own page, which is a circle-scoped screen even
   * though its route does not begin with a circle. A recipe opened from Austin
   * Madhwa Sangha's Recipes folder is being read *in* Austin Madhwa Sangha, so
   * the corner has to say so — otherwise the breadcrumb under it names one circle
   * while the header names another, which is the disagreement the effect above
   * exists to prevent.
   *
   * Gated on membership for the same reason: reading a share that reached a
   * public circle must not make the header claim a circle the member never
   * joined.
   */
  useEffect(() => {
    const from = itemOrigin.circleId;
    if (from === null || from === current.circleId) return;
    if (!store.circles.some((circle) => circle.id === from)) return;
    current.choose(from);
  }, [itemOrigin.circleId, current.circleId, current.choose, store.circles]);

  /**
   * Opens the front door. It takes no argument any more, because logging in and
   * creating an account are the same screen and the same tap — `AuthPanel` asks
   * for an address and works out for itself which of the two it turned out to be.
   */
  function requireLogin() {
    setShowAuth(true);
  }

  async function startQuickShare(
    flow: QuickShare,
    circleId?: number,
    folder?: ShareTarget,
    prefill?: SharePrefill,
  ) {
    if (!userId) {
      requireLogin();
      return;
    }
    // Only a member the group has reason to trust starts circles. The server
    // refuses either way; this says why instead of failing on submit.
    //
    // The answer in hand may predate an admin's vouch, which happens on somebody
    // else's screen entirely — so before refusing, ask again. Only when the
    // cached answer already says no, so the ordinary case costs no request.
    if (flow === "circle" && !editingCircle && store.accessLoaded) {
      const standing = store.access.canCreateCircle
        ? store.access
        : await store.loadAccess();
      if (!standing.canCreateCircle) {
        setCircleHeldBack(true);
        return;
      }
    }
    // The guidelines are asked once, before the first share of any kind. Inviting
    // somebody and starting a circle are not posting, so they are not held up by
    // it. The server refuses an unagreed share as well; this asks for the tick
    // rather than letting the form fail on submit.
    if (flow === "circle" || flow === "invite") {
      openQuickShare(flow, circleId, folder, prefill);
      return;
    }
    guidelines.guard(() => openQuickShare(flow, circleId, folder, prefill));
  }

  /** The share itself, once nothing is standing in front of it. */
  function openQuickShare(
    flow: QuickShare,
    circleId?: number,
    folder?: ShareTarget,
    prefill?: SharePrefill,
  ) {
    setShareCircle(circleId ?? null);
    setShareFolder(folder ?? null);
    setSharePrefill(prefill ?? null);
    setQuickShare(flow);
  }

  /**
   * Switching circles is a decision about what to look at, so it goes to that
   * circle's own page — which is what Home used to be, and is now the only
   * place a circle is read. The choice is made *before* navigating so the
   * header dropdown has already moved by the time the page draws: a page
   * titled one circle above a selector naming another is the one thing this
   * has to be impossible.
   *
   * It is also what the Open button on a circle card does, `CirclesTab` calling
   * it through `onEnterCircle` — opening a circle and switching to it are the
   * same act rather than two.
   */
  function switchCircle(circleId: number) {
    setFlash(null);
    current.choose(circleId);
    navigate("circles", circleId);
  }

  /**
   * Where an item's breadcrumb goes: a circle, or one folder inside it.
   *
   * It is `switchCircle()` with a folder on the end, and in the same order for
   * the same reason — the circle is chosen before the page is navigated to, so
   * the header has already moved by the time the folder draws. Every step of an
   * item's trail comes through here, the circle's own name included, which is why
   * an item page needs exactly one callback rather than one per depth.
   */
  function openPlace(circleId: number, folderId: number | null) {
    setFlash(null);
    current.choose(circleId);
    if (folderId === null) navigate("circles", circleId);
    else navigate("circles", circleId, "folders", folderId);
  }

  /**
   * One circle's roll, opened from the listing rather than from inside the
   * circle. It chooses the circle first and only then navigates, the same order
   * `switchCircle()` uses and for the same reason — Members is scoped, so the
   * circle has to be the answer before the page reads it.
   *
   * It deliberately does not go through `goToTab()`: that calls `keepScope()`,
   * which from the listing widens to All circles, and the member asking for one
   * circle's members would have got the consolidated roll of every circle
   * instead.
   */
  function openCircleMembers(circleId: number) {
    setFlash(null);
    current.choose(circleId);
    navigate("members");
  }

  /**
   * The tab bar, and the one rule it follows: **the main navigation preserves the
   * scope the page is showing.** The Circles listing is every circle side by
   * side, so stepping off it onto Members means every circle there too — it used
   * to mean whichever circle was last opened, because the listing's "All circles"
   * was a label the header wore rather than an answer anything was written down
   * about, and the remembered circle won again the moment the member left the
   * page. So leaving the listing writes down what it was showing.
   *
   * Only that direction, and only from the listing: a member standing on a
   * circle's own page takes that circle with them, which is what makes
   * "Austin → Members" Austin's roll.
   */
  function goToTab(tab: TabName) {
    keepScope();
    navigate(tab);
  }

  /**
   * Writes down the scope the page on screen is showing, for anything that
   * leaves it. Only the listing needs it: everywhere else the circle in view is
   * already the answer that was written down, and the listing's "all circles"
   * was the one that was not — it was an override the header wore while the page
   * was up, so the remembered circle came back the moment the member stepped
   * away. Leaving with what was on screen is the whole of the fix.
   */
  function keepScope() {
    if (showingAllCircles) current.chooseAll();
  }

  /**
   * The header selector, and the other half of the same rule: **the selector
   * changes which circle, and the tab decides which area.** Picking Discover
   * while reading Members loads Discover's members and stays on Members; it used
   * to land on the Circles listing, which threw away the thing the member was
   * doing in order to answer a question they had not asked.
   *
   * Off a scoped tab it still opens the circle, because there is nothing else
   * picking one there could mean — on Circles the circle *is* the subject, and
   * Library and Profile are not narrowed by one at all.
   */
  function selectCircle(circleId: number) {
    setFlash(null);
    current.choose(circleId);
    if (isCircleScoped(route.tab)) return;
    navigate("circles", circleId);
  }

  /** The same, widening: all circles, without leaving the area being read. */
  function selectAllCircles() {
    setFlash(null);
    current.chooseAll();
    if (isCircleScoped(route.tab)) return;
    navigate("circles");
  }

  /**
   * The other direction: out of one circle and back to all of them, which is what
   * the "← All circles" link on a circle's page says and therefore has to mean.
   * It goes to the Circles listing for the same reason `switchCircle()` goes to a
   * circle's page — the choice and the page it implies are one act — and it is
   * written down, because stepping out of a circle ends the context that circle
   * was being read in.
   */
  function showAllCircles() {
    setFlash(null);
    current.chooseAll();
    navigate("circles");
  }

  /**
   * Leaving a circle, once the member has said yes to the dialog. The membership
   * is the store's part; where they end up afterwards is the shell's, because
   * leaving the circle in view leaves the app looking at a circle the member is
   * no longer in.
   *
   * All circles is where they land, which is where the app opens and the one
   * answer that is always true. Standing them in a circle they never chose would
   * be picking for them; stepping back out claims nothing. It is written down
   * rather than left to the fallback because the remembered id still names the
   * circle they just left, and would win again the moment they rejoined
   * something.
   */
  async function leaveCircle(circle: Circle) {
    const wasInView = current.circleId === circle.id;
    await store.leaveCircle(circle.id);
    setFlash(`You left ${circle.name}.`);
    if (wasInView) {
      current.chooseAll();
      navigate("circles");
      return;
    }
    // Not the circle in view, so nothing has to move — except off the page of a
    // circle they have just left, which no longer has anything to show them.
    if (openCircleId === circle.id) navigate("circles");
  }

  /**
   * The circles a member could walk into without anybody answering the door. The
   * header menu offers these beside their own, so somebody who has just arrived
   * has somewhere to go; a circle that has to be asked about is not here, because
   * asking is a conversation and it belongs on the Circles tab.
   */
  const openToAll = store.discoverCircles.filter((circle) => circle.privacy === "public");

  /** Picking an open circle from the header joins it first, then looks at it. */
  async function joinAndEnter(circleId: number) {
    const result = await store.joinCircle(circleId);
    // A request left pending is not being in the circle, so there is nothing yet
    // to switch to. Only an actual join moves them.
    if (!result.joined) throw new Error("That circle has to let you in first.");
    return result;
  }

  /**
   * The form is shut with nothing kept, which is what Cancel means.
   *
   * It deliberately leaves an incoming payload alone. The incoming screen is
   * still underneath, with whatever the member typed into its fields, so closing
   * a form they changed their mind about puts them back on it to pick a different
   * content type rather than throwing the share away.
   */
  function closeQuickShare() {
    setQuickShare(null);
    setShareCircle(null);
    setShareFolder(null);
    setSharePrefill(null);
  }

  /**
   * The share was actually saved, which is the one ending that finishes an
   * incoming share rather than merely closing a form.
   *
   * The payload has become an item, so it is dropped — out of storage as well, or
   * the next visit would offer to share the same thing again — and the member is
   * taken to the circle they picked, which is where the thing they have just kept
   * now lives. Off the incoming screen it is `closeQuickShare()` and nothing
   * else, there being no payload to forget and nowhere they were not already.
   */
  function finishQuickShare(circleId?: number) {
    const landing = sharingIn ? (circleId ?? shareCircle) : null;
    forgetIncomingShare();
    setIncoming(null);
    setIncomingImages([]);
    setIncomingFiles([]);
    closeQuickShare();
    if (landing !== null) {
      current.choose(landing);
      navigate("circles", landing);
    }
  }

  function startCircleEdit(circle: Circle) {
    setEditingCircle(circle);
    setBranchParent(null);
    setQuickShare("circle");
  }

  /**
   * "Add branch" from a circle's ⋯: the same form, with the organisation already
   * chosen. Whether the account may start a circle at all is still
   * `startQuickShare`'s question, so a member who cannot reads the same note
   * they would have from the header's own button.
   */
  function startBranch(parent: Circle) {
    setBranchParent(parent);
    void startQuickShare("circle");
  }

  /** "+ Start a circle" from anywhere else, which is a circle under nothing. */
  function startPlainCircle() {
    setBranchParent(null);
    void startQuickShare("circle");
  }

  function closeCircleModal() {
    setEditingCircle(null);
    setBranchParent(null);
    closeQuickShare();
  }

  return (
    <div className="page">
      <div className="grain" aria-hidden="true" />
      <header className="site-header">
        <div className="header-left">
          <button className="brand" onClick={() => navigate("circles")}>
            <span className="brand-mark">S&amp;L</span>
            {/* The mark and the name, and nothing under them: the tagline here
                used to list the six kinds of thing, which stopped being the whole
                truth the moment a circle could invent a category of its own. */}
            <p className="brand-name">Share &amp; Learn</p>
          </button>
          {/* The circle in view, in the corner, on every screen: it is what the
              whole app is about, so it is chosen before anything is navigated.
              It reads the override rather than the stored choice, so on the
              Circles listing it says "All circles" along with the page.
              A visitor with no account has exactly one — Discover — and seeing it
              named here is how they know what they are reading. */}
          {ready && !barred && (
            <CircleMenu
              circles={store.circles}
              openCircles={openToAll}
              circleId={circleIdInView}
              onChoose={selectCircle}
              onChooseAll={selectAllCircles}
              onJoin={joinAndEnter}
            />
          )}
        </div>
        <div className="header-actions">
          {/* There was a refresh button here, beside the bell, and it read as a web
              page rather than as an app — nobody expects to ask their phone for
              today's posts. The store reads everything again whenever the app comes
              back to the front, counted category lists included, so the button was
              offering to do what had already happened. */}
          <NotificationBell notifications={store.notifications} />
          {ready && user ? (
            // The account, as one round mark in the corner. It was a bordered pill
            // carrying the word "Profile" as well, which is a lot of header for a
            // destination every app keeps in exactly this spot — and the word was
            // its whole accessible name, so it moves to `aria-label` rather than
            // being dropped. There is no avatar to draw: nobody uploads a picture,
            // so the mark is the member's own initials, and the glyph behind them
            // is what an account with no name to initial gets.
            <button
              className="avatar-button"
              onClick={() => goToTab("profile")}
              aria-label="Profile and account"
              title="Profile and account"
              aria-current={route.tab === "profile" ? "page" : undefined}
            >
              <span aria-hidden="true">{initialsOf(memberName) ?? "☺"}</span>
            </button>
          ) : (
            ready && (
              // One door rather than two. "Log in" and "Create account" opened the
              // same screen and called the same function, signing in and signing up
              // having become one field and one tap — so the header was asking the
              // same question twice in the corner it had least room in.
              <button className="btn btn-primary" onClick={() => requireLogin()}>
                Log in
              </button>
            )
          )}
        </div>
      </header>

      {!joining && !viewingShare && !barred && (
        <Nav
          active={route.tab}
          onNavigate={goToTab}
          onInviteFriend={() => startQuickShare("invite")}
        />
      )}

      <main className="content">
        {/* Live, so a member who has just left a circle is told so by a screen
            reader as well: the page changed under them and the reason for it is
            this line. */}
        {flash && (
          <p className="flash-note" role="status">
            {flash}
            <button className="btn-text" onClick={() => setFlash(null)}>
              Dismiss
            </button>
          </p>
        )}

        {joining && (
          <JoinScreen
            token={route.detail}
            user={user}
            ready={ready}
            onCreateAccount={() => requireLogin()}
            onLogIn={() => requireLogin()}
            onJoined={(circleId) => {
              // A circle link puts them in a circle, and that is the one they came
              // for — so it becomes the circle in view, and the page they land on.
              if (circleId !== null) current.choose(circleId);
              store.reload();
              store.loadCircles();
              store.loadCategories();
              store.loadNotifications();
              // Accepting is the moment an account is admitted and, for a circle
              // link, joins its first circle. Without this read the app keeps the
              // answer it got before either happened and holds them at a door
              // they have already walked through.
              store.loadAccess();
            }}
            onEnterApp={() => {
              forgetPendingInvite();
              // A circle link is the one circle they came for, so it is the page
              // they land on; a plain group link has no such answer and lands on
              // the listing, which is the app's front page either way.
              if (current.circleId !== null) navigate("circles", current.circleId);
              else navigate("circles");
            }}
          />
        )}

        {viewingShare && (
          <SharedItemScreen
            token={route.detail}
            user={user}
            ready={ready}
            /* What this reader is already in, so a member is offered the circle's
               door rather than a button that would tell them they are in it. */
            myCircleIds={store.circles.map((circle) => circle.id)}
            onLogIn={() => requireLogin()}
            /* The circle's own workflow and no other: a public circle admits them,
               an "Ask to Join" one files a request, and a private one refuses. It
               goes through the store so the app knows about the membership by the
               time they walk through the door. */
            onJoin={async (circleId) => {
              const answer = await store.joinCircle(circleId);
              if (answer.joined) current.choose(circleId);
              return answer;
            }}
            onOpenCircle={(circleId) => {
              current.choose(circleId);
              navigate("circles", circleId);
            }}
            onEnterApp={() => navigate("circles")}
          />
        )}

        {!joining && !viewingShare && !readingAbout && !sharingIn && !ready && (
          <p className="muted">Loading…</p>
        )}

        {/* No `shell`, and no wait for the access read: the page reads nothing at
            all, so making somebody watch "Loading…" before they can find out what
            the app is for would be the one screen in the app that had no reason to
            make anybody wait. */}
        {readingAbout && <AboutPage onNavigate={goToTab} />}

        {!joining && !viewingShare && !readingAbout && gate && (barred || held) && (
          <AccessGate
            kind={gate}
            access={store.access}
            memberName={memberName}
            onOpenCircles={() => navigate("circles")}
            onLogOut={() => logoutUser()}
          />
        )}

        {/* Outside `shell`, unlike every tab below it, and for the same reason
            the fields on it are editable: a share arrives at whoever the device
            handed it to, which may be somebody with no account yet and is often
            somebody whose session has not been read back yet. The screen answers
            all three of those itself — "One moment…", the two doors, or the form —
            so waiting for Identity out here would only replace its own first line
            with a worse one. The two gates that do apply still do: a paused
            account and a member with no circle have nowhere to put a share, and
            read the door instead. */}
        {!barred && !held && sharingIn && (
          <IncomingShareScreen
            /* Nothing stashed still draws the screen, rather than a blank page:
               a member on iOS or in any browser without an installed PWA reaches
               it with empty hands, and its fields are where they paste the link
               by hand. */
            share={incoming ?? NO_SHARE}
            store={store}
            user={user}
            ready={ready}
            /* The pictures, still as bytes: the screen previews them and uploads
               them through the same `uploadItemPhoto()` a form uses, once there
               is a session to upload them with. */
            images={incomingImages}
            /* The document, recording or clip, still as bytes: the screen checks
               it against the same rules a form's own upload field keeps and
               uploads it through the same calls, once there is a session. */
            files={incomingFiles}
            /* The circle they were last in, which is the answer already on the
               screen when it draws — the same default the header carries. */
            currentCircleId={current.circleId}
            /* A built-in content type: the shell opens that form, seeded with
               whatever is in the screen's fields at the moment it was picked. */
            onShare={(flow, circleId, folder, prefill) =>
              startQuickShare(flow, circleId, folder, prefill)
            }
            /* A custom category's post, which the sheet saves itself, so this is
               the one completion the shell cannot hear about through `onShare`. */
            onSaved={(circleId) => finishQuickShare(circleId)}
            onCreateAccount={() => requireLogin()}
            onLogIn={() => requireLogin()}
            onDismiss={() => {
              forgetIncomingShare();
              setIncoming(null);
              setIncomingImages([]);
              setIncomingFiles([]);
              navigate("circles");
            }}
          />
        )}

        {shell && !held && route.tab === "members" && (
          <MembersTab
            store={store}
            userId={userId}
            currentCircle={circleInView}
            onOpenCircle={(id) => navigate("circles", id)}
            onChooseCircle={selectCircle}
            onOpenCircles={() => navigate("circles")}
            onInviteFriend={() => startQuickShare("invite")}
            onNeedsLogin={() => requireLogin()}
          />
        )}

        {shell && !held && route.tab === "songs" && (
          <SongsTab
            store={store}
            userId={userId}
            currentCircle={circleInView}
            openSongId={openSongId}
            origin={itemOrigin}
            /* Opened from a listing narrowed to one circle, so that circle is
               where the reader came from. The listing spans every folder in it,
               which is why no folder travels: Back lands on the circle's own
               page, and the link says so rather than promising a folder. */
            onOpenSong={(id) => navigate("songs", id, ...originPath(circleIdInView, null))}
            onOpenPlace={openPlace}
            onBackToList={() => navigate("songs")}
            onNeedsLogin={() => requireLogin()}
          />
        )}

        {shell && !held && route.tab === "recipes" && (
          <RecipesTab
            store={store}
            userId={userId}
            currentCircle={circleInView}
            openRecipeId={openRecipeId}
            origin={itemOrigin}
            onOpenRecipe={(id) => navigate("recipes", id, ...originPath(circleIdInView, null))}
            onOpenPlace={openPlace}
            onBackToList={() => navigate("recipes")}
            onNeedsLogin={() => requireLogin()}
          />
        )}

        {shell && !held && route.tab === "learn" && (
          <LearnTab
            store={store}
            userId={userId}
            currentCircle={circleInView}
            section={learnSection}
            onSection={(section) => navigate("learn", section)}
            onNeedsLogin={() => requireLogin()}
          />
        )}

        {shell && !held && route.tab === "books" && (
          <BooksTab
            store={store}
            userId={userId}
            currentCircle={circleInView}
            openBookId={openBookId}
            origin={itemOrigin}
            onOpenBook={(id) => navigate("books", id, ...originPath(circleIdInView, null))}
            onOpenPlace={openPlace}
            onBackToList={() => navigate("books")}
            onNeedsLogin={() => requireLogin()}
          />
        )}

        {shell && !held && route.tab === "remedies" && (
          <RemediesTab
            store={store}
            userId={userId}
            currentCircle={circleInView}
            openRemedyId={openRemedyId}
            origin={itemOrigin}
            onOpenRemedy={(id) => navigate("remedies", id, ...originPath(circleIdInView, null))}
            onOpenPlace={openPlace}
            onBackToList={() => navigate("remedies")}
            onNeedsLogin={() => requireLogin()}
          />
        )}

        {shell && route.tab === "circles" && (
          <CirclesTab
            store={store}
            userId={userId}
            circleId={openCircleId}
            /* The shop window's circle, read by nobody with an account — so it
               is the stored answer rather than the route's, a visitor having one
               circle and no listing to widen to. */
            currentCircle={current.circle}
            categoryId={openCategoryId}
            shelf={openShelf}
            folderId={openFolderId}
            onOpenCircle={(id) => navigate("circles", id)}
            onEnterCircle={switchCircle}
            onLeaveCircle={leaveCircle}
            onOpenCategory={(id, categoryId, shelf) =>
              shelf === undefined
                ? navigate("circles", id, categoryId)
                : navigate("circles", id, categoryId, shelf)
            }
            /* Walking the folder tree, and the way back out of the top of it,
               which is the circle's own page. */
            onOpenFolder={(id, folderId) =>
              folderId === null
                ? navigate("circles", id)
                : navigate("circles", id, "folders", folderId)
            }
            onOpenMembers={() => goToTab("members")}
            onOpenCircleMembers={openCircleMembers}
            onBack={showAllCircles}
            onShareInto={(flow, id) => startQuickShare(flow, id)}
            /* The same forms, opened from inside a folder: the member has
               already said where the share goes by walking there, so the folder
               travels with it rather than being asked for again. */
            onShareIntoFolder={(flow, id, folder) => startQuickShare(flow, id, folder)}
            onEnteredCircle={current.choose}
            onStartCircle={startPlainCircle}
            onEditCircle={startCircleEdit}
            onAddBranch={startBranch}
            /* An item opened from inside a circle carries where it was opened
               from: the circle, and the folder the reader was standing in when
               they tapped it. That is what its breadcrumb reads back and what
               Back returns to — the content type says nothing about where the
               thing lives, so it cannot be asked. */
            onOpenRecipe={(id, folderId) =>
              navigate("recipes", id, ...originPath(openCircleId, folderId ?? null))
            }
            onOpenBook={(id, folderId) =>
              navigate("books", id, ...originPath(openCircleId, folderId ?? null))
            }
            onOpenRemedy={(id, folderId) =>
              navigate("remedies", id, ...originPath(openCircleId, folderId ?? null))
            }
            onNeedsLogin={() => requireLogin()}
          />
        )}

        {shell && !held && route.tab === "library" && (
          <LibraryTab
            store={store}
            userId={userId}
            /* My Library is nobody's circle — what somebody saved outlives the
               circle it came from — so a saved copy is opened with no origin at
               all and the item's own filing answers for where it sits. */
            onOpenRecipe={(id) => navigate("recipes", id)}
            onOpenRemedy={(id) => navigate("remedies", id)}
            onOpenBook={(id) => navigate("books", id)}
            onNeedsLogin={() => requireLogin()}
          />
        )}

        {shell && route.tab === "profile" && (
          <ProfileTab
            store={store}
            user={user}
            currentCircleId={circleIdInView}
            onSwitchCircle={switchCircle}
            onOpenCircle={(id) => navigate("circles", id)}
            onOpenCircles={() => navigate("circles")}
            onStartCircle={startPlainCircle}
            onNeedsLogin={() => requireLogin()}
            onNavigate={goToTab}
            onInviteFriend={() => startQuickShare("invite")}
          />
        )}
      </main>

      {/* The footer is where About lives, and the reason is that it is read once or
          twice in the life of an account: a tab, a header button or a card on
          Profile would all put it in front of members who are done with it, while
          the bottom of the page is where anybody looking for it looks first. */}
      <footer className="site-footer">
        <p>Share &amp; Learn — for the group that cooks, sings, and swaps what it knows.</p>
        <p className="site-footer-links">
          <small title={`Built ${import.meta.env.VITE_BUILD_TIME}`}>
            Build: ${'\u007b'}import.meta.env.VITE_BUILD_COMMIT} · ${'\u007b'}import.meta.env.VITE_BUILD_CONTEXT} · ${'\u007b'}new Date(import.meta.env.VITE_BUILD_TIME).toLocaleString()}
          </small>
        </p>
        <p className="site-footer-links">
          <button className="btn-text" onClick={() => goToTab("about")}>
            About Share &amp; Learn
          </button>
        </p>
      </footer>

      {!joining && <InstallBanner />}

      {showAuth && (
        <AuthPanel
          onClose={() => {
            setShowAuth(false);
            clearRecovering();
          }}
          initialMode={recovering ? "reset" : "welcome"}
        />
      )}

      {quickShare === "song" && (
        <SongModal
          store={store}
          userId={userId}
          circles={store.circles}
          categories={store.categories}
          presetCircleIds={shareCircle ? [shareCircle] : []}
          folder={shareFolder}
          prefill={sharePrefill ?? undefined}
          onClose={closeQuickShare}
          onSaved={(song) => {
            store.addSong(song);
            finishQuickShare();
          }}
        />
      )}
      {quickShare === "recipe" && (
        <RecipeModal
          store={store}
          circles={store.circles}
          categories={store.categories}
          presetCircleIds={shareCircle ? [shareCircle] : []}
          folder={shareFolder}
          prefill={sharePrefill ?? undefined}
          onClose={closeQuickShare}
          onSave={async (values) => {
            await store.addRecipe(values);
            finishQuickShare();
          }}
        />
      )}
      {quickShare === "fact" && (
        <FactModal
          circles={store.circles}
          categories={store.categories}
          presetCircleIds={shareCircle ? [shareCircle] : []}
          folder={shareFolder}
          prefill={sharePrefill ?? undefined}
          onClose={closeQuickShare}
          onSave={async (values) => {
            await store.addFact(values);
            finishQuickShare();
          }}
        />
      )}
      {quickShare === "word" && (
        <WordModal
          circles={store.circles}
          categories={store.categories}
          presetCircleIds={shareCircle ? [shareCircle] : []}
          folder={shareFolder}
          prefill={sharePrefill ?? undefined}
          onClose={closeQuickShare}
          onSave={async (values) => {
            await store.addWord(values);
            finishQuickShare();
          }}
        />
      )}
      {quickShare === "book" && (
        <BookModal
          store={store}
          circles={store.circles}
          categories={store.categories}
          presetCircleIds={shareCircle ? [shareCircle] : []}
          folder={shareFolder}
          prefill={sharePrefill ?? undefined}
          onClose={closeQuickShare}
          onSave={async (values) => {
            await store.addBook(values);
            finishQuickShare();
          }}
        />
      )}
      {quickShare === "remedy" && (
        <RemedyModal
          circles={store.circles}
          categories={store.categories}
          presetCircleIds={shareCircle ? [shareCircle] : []}
          folder={shareFolder}
          prefill={sharePrefill ?? undefined}
          onClose={closeQuickShare}
          onSave={async (values) => {
            await store.addRemedy(values);
            finishQuickShare();
          }}
        />
      )}
      {quickShare === "bookmark" && (
        <BookmarkModal
          circles={store.circles}
          categories={store.categories}
          presetCircleIds={shareCircle ? [shareCircle] : []}
          folder={shareFolder}
          prefill={sharePrefill ?? undefined}
          onClose={closeQuickShare}
          onSave={async (values) => {
            await store.addBookmark(values);
            finishQuickShare();
          }}
        />
      )}
      {quickShare === "circle" && (
        <CircleModal
          circle={editingCircle}
          parent={branchParent}
          circles={store.circles}
          contacts={store.contacts}
          onClose={closeCircleModal}
          onSubmit={async (input) => {
            if (editingCircle) await store.editCircle(editingCircle.id, input);
            else {
              const created = await store.createCircle(input);
              // Starting a circle is the strongest statement of where you want to
              // be, so it becomes the circle the app is looking at.
              current.choose(created.circle.id);
              navigate("circles", created.circle.id);
            }
          }}
        />
      )}
      {circleHeldBack && (
        <Modal
          eyebrow="Circles"
          title="Not just yet"
          onClose={() => setCircleHeldBack(false)}
        >
          <CircleTrustNote access={store.access} />
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={() => setCircleHeldBack(false)}>
              Understood
            </button>
          </div>
        </Modal>
      )}

      {guidelines.gate}

      {quickShare === "invite" && (
        <InviteModal
          onClose={closeQuickShare}
          onCreate={store.inviteFriend}
          inviterName={memberName ?? "A member"}
        />
      )}
    </div>
  );
}
