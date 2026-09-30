import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  fetchCircle,
  formatDate,
  reasonLabel,
  type Circle,
  type CircleCategory,
  type CircleDetail,
  type CirclePrivacy,
  type Invite,
} from "../api";
import { categoryIn, sortedCategories, type ShareFlow } from "../categories";
import { feedEntries, matchesQuery, TOPIC_ORDER, type FeedEntry } from "../feed";
import { childFolders, folderById, visibleFolders, type ShareTarget } from "../folders";
import type { ShareAndLearn } from "../store";
import { branchesOf, branchLabel, type Branch } from "../branches";
import { BranchStrip } from "./BranchStrip";
import {
  CategoryGrid,
  CategoryManager,
  CategoryPage,
  CircleFeedList,
} from "./CircleCategories";
import { FolderGrid, FolderManager, FolderPage, ShareItemButton } from "./CircleFolders";
import { ActionSheet, type SheetAction } from "./ActionSheet";
import { InviteShare } from "./InviteModal";
import { canLeaveCircle, LeaveCircleModal } from "./LeaveCircleModal";
import { IconButton } from "./Icons";
import {
  EmptyState,
  ErrorLine,
  Modal,
  SearchField,
  TabHeader,
  WelcomeNote,
} from "./shared";

// The words a member reads for each of the three doors. "Ask to join" is the
// stored `discoverable` and "Open to all" is the stored `public`.
const PRIVACY_LABEL: Record<CirclePrivacy, string> = {
  private: "Private · invite only",
  discoverable: "Ask to join · the owner decides",
  public: "Open to all · anyone can join",
};

/**
 * The same three doors in as few words as they can be said in, for a card, where
 * the line has a head count in front of it and a phone's width to fit in. The
 * longer sentences above are for a circle's own page, which has room to say what
 * each door means.
 */
const PRIVACY_SHORT: Record<CirclePrivacy, string> = {
  private: "Private",
  discoverable: "Ask to join",
  public: "Open to all",
};

/**
 * How a circle's feed can be ordered. Newest is the default and what the heading
 * above it promises; grouped by topic is the order this page used to have and is
 * kept, because reading a circle kind by kind is a real way of reading it.
 */
type FeedSort = "newest" | "oldest" | "topic";

const FEED_SORTS: { value: FeedSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "topic", label: "Grouped by topic" },
];

/**
 * Which of this circle's categories a feed row belongs to, which is what the
 * filter chips count and narrow by. The filing decides it and the kind of thing
 * is only the fallback — a song filed into Events is an Events row here exactly
 * as it is on the category page — and a filing naming a category this circle no
 * longer offers falls back the same way, since a chip cannot be drawn for it.
 */
function categoryFor(
  entry: FeedEntry,
  circleId: number,
  categories: CircleCategory[],
): number | null {
  const filed = categoryIn(entry, circleId);
  if (filed !== null && categories.some((row) => row.id === filed)) return filed;
  if (entry.itemType === "post") return filed;
  return categories.find((row) => row.itemType === entry.itemType)?.id ?? null;
}

/**
 * A panel on a circle's own page that the listing asked for. Two of the things
 * behind a card's ⋯ — inviting people and the admin drawer — live on the circle's
 * page rather than on the card, so choosing one opens the circle and tells the
 * page to arrive with that panel already open. Anything else would have been a
 * second copy of a panel that is already written.
 */
type CirclePanel = "invite" | "admin";

function memberLabel(count: number) {
  return `${count} ${count === 1 ? "member" : "members"}`;
}


/**
 * How many branches an organisation names on its collapsed line, and how many
 * rows it opens with once somebody asks for them.
 *
 * Both are small on purpose. This page is a list of doors, and an organisation
 * with a dozen chapters is one door among them — printing all twelve unasked
 * would make SVKV the subject of a page that is supposed to be about every
 * circle the member is in.
 */
const BRANCH_NAMES_SHOWN = 3;
const BRANCH_ROWS_SHOWN = 5;

/** One id in or out of a set, as a new set — this is React state, so no mutation. */
function withMember(ids: Set<number>, id: number, member: boolean) {
  const next = new Set(ids);
  if (member) next.add(id);
  else next.delete(id);
  return next;
}

/**
 * Circles: the ones you are in, the ones you have been invited to, the ones you
 * could join, and — for a circle you own — who is waiting at the door. A single
 * circle opens at `#/circles/<id>`, where the same mixed feed is narrowed to
 * that circle.
 *
 * This is the app's landing page. There used to be a Home tab in front of it
 * carrying a greeting and a dashboard built from whichever circle was in view,
 * and it said nothing the circle's own page does not say better: a member
 * arriving wants to know which circles they are in and to open one, which is
 * this page and then the page one tap after it.
 */
export function CirclesTab({
  store,
  userId,
  circleId,
  currentCircle,
  categoryId,
  shelf,
  folderId,
  onOpenCircle,
  onEnterCircle,
  onLeaveCircle,
  onOpenCategory,
  onOpenFolder,
  onOpenMembers,
  onOpenCircleMembers,
  onBack,
  onStartCircle,
  onEditCircle,
  onAddBranch,
  onShareInto,
  onShareIntoFolder,
  onEnteredCircle,
  onOpenRecipe,
  onOpenBook,
  onOpenRemedy,
  onNeedsLogin,
}: {
  store: ShareAndLearn;
  userId: string | null;
  /** Set when the route is `#/circles/<id>`; null shows the list of circles. */
  circleId: number | null;
  /**
   * The circle the header dropdown names. Only the visitor's shop window reads
   * it — a member's listing is about all of their circles at once, and a circle's
   * own page is told which one it is by the route.
   */
  currentCircle: Circle | null;
  /** `#/circles/<id>/<categoryId>` — one category of that circle. */
  categoryId: number | null;
  /** `#/circles/<id>/<categoryId>/<shelf>` — a subcategory id, or "none". */
  shelf: string | null;
  /**
   * `#/circles/<id>/folders/<folderId>` — one folder of that circle. Folders are
   * how a normal circle is navigated, so this and `categoryId` are never both
   * set: the folder route puts "folders" where a category id would be.
   */
  folderId: number | null;
  onOpenCircle: (id: number) => void;
  /**
   * Opening a circle *is* switching to it: the header dropdown is the one answer
   * to which circle is in view, so this makes it the active one and lands on the
   * circle's own page — its roll, its waiting room, its categories, its feed.
   * There is no separate Home to be sent to any more, which is what "Open"
   * meant to do all along.
   */
  onEnterCircle: (id: number) => void;
  /**
   * Leaving, once the member has said yes to the dialog. The shell owns what
   * happens afterwards, because leaving the circle in view has to move the
   * dropdown and the page as well as the membership.
   */
  onLeaveCircle: (circle: Circle) => Promise<void>;
  onOpenCategory: (id: number, categoryId: number, shelf?: string) => void;
  /**
   * Walking the folder tree. Null is the circle's own page — the way back out of
   * the top folder — and a number is that folder's page.
   */
  onOpenFolder: (id: number, folderId: number | null) => void;
  /**
   * The Members tab, which is where the roll lives now: it holds the same list
   * plus the waiting room, the role controls and a search box, so the circle's
   * own page carried a second, smaller copy of it and no longer does. Reached
   * from the head count in the header and from Admin tools.
   */
  onOpenMembers: () => void;
  /**
   * The Members tab for one particular circle, which is what "Manage members" on
   * a card means: the roll is a circle's, so the circle has to be chosen before
   * the tab is opened. Distinct from `onOpenMembers` above, which leaves a circle
   * page the member is already standing in and takes its scope with it.
   */
  onOpenCircleMembers: (circleId: number) => void;
  onBack: () => void;
  onStartCircle: () => void;
  onEditCircle: (circle: Circle) => void;
  /** Opens the circle form for a new circle standing under this one. */
  onAddBranch: (parent: Circle) => void;
  /** Opens one of the six share forms with this circle already ticked. */
  onShareInto: (flow: ShareFlow, circleId: number) => void;
  /**
   * The same forms, opened from inside a folder: the circle is ticked and the
   * folder travels with the share, so the member is not asked where it goes a
   * second time having just walked there.
   */
  onShareIntoFolder: (flow: ShareFlow, circleId: number, folder: ShareTarget) => void;
  /**
   * Called when the member actually becomes a member — accepting an invitation or
   * joining a public circle, but not merely asking. Somebody who just got in wants
   * to be in it, so it becomes the circle in view.
   */
  onEnteredCircle: (circleId: number) => void;
  /**
   * Open one item on its own page, carrying where it was opened from: the folder
   * the reader was standing in, or null for the circle's own page.
   *
   * The folder travels because the item cannot be asked. A recipe reaches as many
   * circles as its author ticked and sits in a different folder in each, so what
   * kind of thing it is says nothing whatever about where this reader found it —
   * which is why `onOpenBooks()` used to take no argument at all and drop
   * somebody on the whole books listing, out of the circle they were reading in.
   */
  onOpenRecipe: (id: number, folderId: number | null) => void;
  onOpenBook: (id: number, folderId: number | null) => void;
  onOpenRemedy: (id: number, folderId: number | null) => void;
  onNeedsLogin: () => void;
}) {
  /**
   * A panel the listing asked a circle's page to open with, and the circle it was
   * asked about. Cleared as soon as the page has read it, so the back button does
   * not re-open the drawer.
   */
  const [pendingPanel, setPendingPanel] = useState<{
    circleId: number;
    panel: CirclePanel;
  } | null>(null);

  if (!userId) {
    return <VisitorWindow store={store} currentCircle={currentCircle} onNeedsLogin={onNeedsLogin} />;
  }

  if (circleId !== null) {
    return (
      <CircleDetailView
        store={store}
        userId={userId}
        circleId={circleId}
        categoryId={categoryId}
        shelf={shelf}
        folderId={folderId}
        onBack={onBack}
        onOpenCircle={onOpenCircle}
        onLeaveCircle={onLeaveCircle}
        onOpenCategory={onOpenCategory}
        onOpenFolder={onOpenFolder}
        onOpenMembers={onOpenMembers}
        openPanel={pendingPanel?.circleId === circleId ? pendingPanel.panel : null}
        onPanelShown={() => setPendingPanel(null)}
        onEditCircle={onEditCircle}
        onShareInto={onShareInto}
        onShareIntoFolder={onShareIntoFolder}
        onEnteredCircle={onEnteredCircle}
        onOpenRecipe={onOpenRecipe}
        onOpenBook={onOpenBook}
        onOpenRemedy={onOpenRemedy}
      />
    );
  }

  return (
    <CircleList
      store={store}
      userId={userId}
      onOpenCircle={onOpenCircle}
      onEnterCircle={onEnterCircle}
      onLeaveCircle={onLeaveCircle}
      onStartCircle={onStartCircle}
      onEditCircle={onEditCircle}
      onAddBranch={onAddBranch}
      onOpenCircleMembers={onOpenCircleMembers}
      onOpenPanel={(circle, panel) => {
        setPendingPanel({ circleId: circle.id, panel });
        onEnterCircle(circle.id);
      }}
      onEnteredCircle={onEnteredCircle}
    />
  );
}

/**
 * The doorway, which used to be Home's job and came here with the tab. Somebody
 * with no account is shown what the app is *for* and not a word of what anybody
 * put in it: the default circle's name, the categories it holds, and an
 * invitation to come in. There is no feed here to hide — `visibleTo()` answers a
 * visitor's listing with nothing at all, so the shares are absent rather than
 * merely off screen — and the tiles carry no counts, a count of what you cannot
 * read still being something about other members.
 *
 * A tile is still tappable, and what it opens is the way in.
 */
function VisitorWindow({
  store,
  currentCircle,
  onNeedsLogin,
}: {
  store: ShareAndLearn;
  currentCircle: Circle | null;
  onNeedsLogin: () => void;
}) {
  const circleId = currentCircle?.id ?? null;

  // The member-wide list is empty for a visitor, so the circle on offer asks for
  // its own categories the same way a member's circle page does. It is the only
  // read a visitor makes, and the server answers it with the shell alone.
  useEffect(() => {
    if (circleId === null) return;
    store.loadCircleCategories(circleId).catch(() => {});
  }, [circleId, store.loadCircleCategories]);

  const counted = circleId === null ? undefined : store.circleCategories[circleId];
  const categoriesHere = useMemo(
    () => counted ?? (circleId === null ? [] : (store.categoriesByCircle.get(circleId) ?? [])),
    [counted, circleId, store.categoriesByCircle],
  );

  return (
    <>
      <WelcomeNote
        memberName={null}
        compact={currentCircle !== null}
        discover={currentCircle?.isDefault ?? false}
      />

      {/* Nothing for Discover: the header dropdown above already names the circle
          in view, and a card repeating it was the shop window describing its own
          glass. */}
      {currentCircle && !currentCircle.isDefault && (
        <header className="home-circle-strip">
          {currentCircle.coverUrl && (
            <img className="circle-cover circle-cover-wide" src={currentCircle.coverUrl} alt="" />
          )}
          <div className="home-circle-line">
            <span className="circle-icon" aria-hidden="true">
              {currentCircle.icon}
            </span>
            <h2 className="home-circle-name">{currentCircle.name}</h2>
          </div>
        </header>
      )}

      <CategoryGrid
        categories={categoriesHere}
        canManage={false}
        title={currentCircle ? null : "What people share here"}
        showCounts={false}
        emptyNote="This circle has not decided what it holds yet."
        onOpen={() => onNeedsLogin()}
      />

      <section className="home-section join-note">
        <h2 className="section-title">Discover more when you join us</h2>
        <p className="section-note">
          Log in to explore posts shared by members, save your favorites, and share your own
          discoveries.
        </p>
        <div className="join-note-actions">
          <button className="btn btn-primary" onClick={() => onNeedsLogin()}>
            Create account
          </button>
          <button className="btn btn-ghost" onClick={() => onNeedsLogin()}>
            Log in
          </button>
        </div>
      </section>
    </>
  );
}

function CircleList({
  store,
  userId,
  onOpenCircle,
  onEnterCircle,
  onLeaveCircle,
  onStartCircle,
  onEditCircle,
  onAddBranch,
  onOpenCircleMembers,
  onOpenPanel,
  onEnteredCircle,
}: {
  store: ShareAndLearn;
  userId: string;
  onOpenCircle: (id: number) => void;
  onEnterCircle: (id: number) => void;
  onLeaveCircle: (circle: Circle) => Promise<void>;
  onStartCircle: () => void;
  onEditCircle: (circle: Circle) => void;
  /** Opens the circle form for a new circle standing under this one. */
  onAddBranch: (parent: Circle) => void;
  onOpenCircleMembers: (circleId: number) => void;
  /** Opens the circle with one of its own panels already showing. */
  onOpenPanel: (circle: Circle, panel: CirclePanel) => void;
  onEnteredCircle: (circleId: number) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  /** The circle whose leave is being asked about, and null when nothing is. */
  const [leaving, setLeaving] = useState<Circle | null>(null);
  /** The circle whose ⋯ is open, and null when no sheet is showing. */
  const [sheetFor, setSheetFor] = useState<Circle | null>(null);
  /** The circle whose closure is being asked about. */
  const [deleting, setDeleting] = useState<Circle | null>(null);

  /**
   * Which organisations have their branches showing, and which of those have
   * been asked for the whole list rather than the first few of it. Both are the
   * reader's own state and neither is remembered: the listing opens compact,
   * which is the whole point of it.
   */
  const [openBranches, setOpenBranches] = useState<Set<number>>(new Set());
  const [allBranches, setAllBranches] = useState<Set<number>>(new Set());

  /**
   * Runs one of the page's actions with its own busy key, and answers whether it
   * worked — which the delete confirmation reads, so a refusal leaves the dialog
   * open with the reason on it rather than closing on an error nobody saw.
   */
  function run(key: string, action: Promise<unknown>): Promise<boolean> {
    setBusy(key);
    setError(null);
    return action
      .then(() => true)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "That did not work.");
        return false;
      })
      .finally(() => setBusy(null));
  }

  /**
   * Joining answers whether they are in or only waiting: a public circle and an
   * accepted invitation let them straight through, a discoverable one leaves a
   * request with its owner. Only actually being in it moves them there.
   */
  function join(circleId: number) {
    run(
      `join:${circleId}`,
      store.joinCircle(circleId).then((result) => {
        if (result.joined) onEnteredCircle(circleId);
      }),
    );
  }

  /**
   * What the ⋯ on a card offers, which is only ever what this member is allowed
   * to do with this circle. `moderating` is the same answer the server's
   * `moderatorOf()` gives — the owner, an admin they made, or the app admin
   * stepping in — so a keeper's sheet and a plain member's are two different
   * lists rather than one list with things greyed out. Every row here is also
   * refused server-side, the sheet being a courtesy and never the check.
   *
   * Two of them are not on this page at all: inviting people and the admin
   * drawer are panels on the circle's own page, so choosing one opens the circle
   * with that panel showing rather than duplicating it here.
   */
  function actionsFor(circle: Circle): SheetAction[] {
    const canManage =
      circle.role === "owner" || circle.role === "admin" || store.moderating.has(circle.id);
    const waiting = store.openReports[circle.id] ?? 0;
    const actions: SheetAction[] = [];

    if (canManage) {
      actions.push({
        key: "edit",
        glyph: "✏️",
        label: "Edit circle",
        onSelect: () => {
          setSheetFor(null);
          onEditCircle(circle);
        },
      });
      actions.push({
        key: "invite",
        glyph: "✉️",
        label: "Invite people",
        onSelect: () => {
          setSheetFor(null);
          onOpenPanel(circle, "invite");
        },
      });
      // Only for a circle that could be an organisation. A branch is one level
      // deep — the routes refuse a branch of a branch — so the row is absent on
      // one that already has a parent rather than offered and refused, and it is
      // absent on Discover, which is nobody's organisation.
      if (!circle.isDefault && !circle.parentCircleId) {
        actions.push({
          key: "branch",
          glyph: "🌿",
          label: "Add branch",
          onSelect: () => {
            setSheetFor(null);
            onAddBranch(circle);
          },
        });
      }
    }

    actions.push({
      key: "members",
      glyph: "👥",
      label: canManage ? "Manage members" : "View members",
      onSelect: () => {
        setSheetFor(null);
        onOpenCircleMembers(circle.id);
      },
    });

    if (canManage) {
      actions.push({
        key: "admin",
        glyph: "🛠",
        label: "Admin tools",
        // The same number the drawer's own button carries: what is actually
        // waiting on a keeper, and nothing when nothing is.
        note: waiting > 0 ? <span className="tag tag-warn">{waiting}</span> : undefined,
        onSelect: () => {
          setSheetFor(null);
          onOpenPanel(circle, "admin");
        },
      });
    }

    // Drawn only for the members who can actually go: a circle keeps its owner,
    // and nobody leaves Discover, so for those two the row's one possible outcome
    // would have been a dialog saying no.
    if (canLeaveCircle(circle)) {
      actions.push({
        key: "leave",
        glyph: "🚪",
        label: "Leave circle",
        tone: "danger",
        onSelect: () => {
          setSheetFor(null);
          setLeaving(circle);
        },
      });
    }

    // Discover cannot be closed — every account is joined to it, and the server
    // refuses it — so the row is not offered for it either.
    if (canManage && !circle.isDefault) {
      actions.push({
        key: "delete",
        glyph: "🗑",
        label: "Delete circle",
        tone: "danger",
        onSelect: () => {
          setSheetFor(null);
          setDeleting(circle);
        },
      });
    }

    return actions;
  }

  const needle = query.trim().toLowerCase();
  /**
   * The search rule, and it has to reach a branch as surely as an organisation:
   * somebody typing "Austin" is looking for Austin, whether or not SVKV's
   * branches happen to be open on screen. The parent's name is matched as well,
   * so "SVKV" answers with the organisation and every chapter of it.
   */
  function matches(circle: Circle) {
    if (!needle) return true;
    return [circle.name, circle.description, circle.ownerName, circle.parentName]
      .filter(Boolean)
      .some((field) => (field as string).toLowerCase().includes(needle));
  }

  /**
   * Which circles are drawn **under** another row rather than beside it.
   *
   * SVKV and Austin used to be two equal rows, one after the other, saying most
   * of the same words — and a member scanning for their circles read the
   * organisation's name twice before reaching either of them. A branch now sits
   * under its organisation, and this is the rule for which row is responsible
   * for it, so nothing is listed twice and nothing is dropped: a branch nests
   * under its organisation when that organisation is in the **same section**.
   * One of the member's own circles is never buried under a row in "Circles you
   * could join", and a circle on offer whose organisation is one of theirs sits
   * under that organisation, which is exactly where somebody would look for the
   * chapter they have not joined yet.
   */
  const mineIds = new Set(store.circles.map((circle) => circle.id));
  const offerIds = new Set(store.discoverCircles.map((circle) => circle.id));
  const nestedInMine = (circle: Circle) =>
    Boolean(circle.parentCircleId && circle.parentCircleId !== circle.id && mineIds.has(circle.parentCircleId));
  const nestedInOffer = (circle: Circle) =>
    !nestedInMine(circle) &&
    Boolean(circle.parentCircleId && circle.parentCircleId !== circle.id && offerIds.has(circle.parentCircleId));

  /** The branches one row draws, out of what this page already has in hand. */
  function branchesFor(circle: Circle): Branch[] {
    const rows = branchesOf(circle, store.circles, store.discoverCircles);
    // A row in "could join" leaves the member's own chapters alone — those are
    // rows of their own in the section above.
    return mineIds.has(circle.id) ? rows : rows.filter((row) => !mineIds.has(row.circle.id));
  }

  /** One organisation and the branches sitting under it. */
  interface CircleGroup {
    circle: Circle;
    branches: Branch[];
  }

  /**
   * The listing as it reads when nothing is being searched for: one row per
   * circle that is not somebody else's branch here, each carrying its own
   * branches behind a single quiet line.
   */
  function groupsFrom(circles: Circle[], nested: (circle: Circle) => boolean): CircleGroup[] {
    return circles
      .filter((circle) => !nested(circle))
      .map((circle) => ({ circle, branches: branchesFor(circle) }));
  }

  /**
   * The listing as it reads while somebody is searching, which is deliberately
   * **flat**. A query is a member saying what they are looking for, so the
   * answer is the circles that match rather than the organisations they happen
   * to sit under: a chapter found this way is a row of its own saying "Branch of
   * SVKV", instead of being hidden inside a parent that is folded up.
   */
  function hitsFrom(circles: Circle[]): Circle[] {
    return circles
      .filter((circle) => matches(circle))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const mine = groupsFrom(store.circles, nestedInMine);
  const discover = groupsFrom(store.discoverCircles, (circle) => nestedInMine(circle) || nestedInOffer(circle));
  const mineHits = hitsFrom(store.circles);
  const discoverHits = hitsFrom(store.discoverCircles);

  /**
   * The ⋯ on a row of the member's own. What is behind it is `actionsFor()`'s
   * answer and nothing else, so a keeper's sheet and a plain member's are two
   * different lists rather than one list with half of it greyed out.
   */
  function moreButton(circle: Circle) {
    return (
      <IconButton
        icon="more"
        label={`More actions for ${circle.name}`}
        className="circle-row-more"
        onClick={(event) => {
          // The one line this layout depends on: the ⋯ sits on something that is
          // itself tappable, so without it every tap on the button would also
          // open the circle behind the sheet.
          event.stopPropagation();
          setSheetFor(circle);
        }}
      />
    );
  }

  /**
   * The door on a row the member is not in yet — the same three answers the
   * cards gave: join an open circle on the spot, ask about one whose owner
   * decides, and say so once it has been asked. The row behind it opens the
   * circle for a look, so this is the only thing on it that changes anything.
   */
  function doorButton(circle: Circle) {
    if (circle.standing === "requested") {
      return (
        <span className="tag circle-row-tag" title={`Waiting for ${circle.ownerName}`}>
          Asked
        </span>
      );
    }
    const working = busy === `join:${circle.id}`;
    const word =
      circle.standing === "invited" ? "Accept" : circle.privacy === "public" ? "Join" : "Ask to join";
    return (
      <button
        type="button"
        className="chip-button chip-strong circle-row-join"
        disabled={working}
        // The visible word is one or two; the accessible name has to be the whole
        // sentence, since "Join" out of context does not say what is being joined.
        aria-label={
          circle.standing === "invited"
            ? `Accept your invitation to ${circle.name}`
            : circle.privacy === "public"
              ? `Join ${circle.name}`
              : `Ask to join ${circle.name}`
        }
        onClick={(event) => {
          event.stopPropagation();
          join(circle.id);
        }}
      >
        {working ? "…" : word}
      </button>
    );
  }

  /**
   * One line of the listing, and the whole of what a member taps. The row opens
   * the circle — one they are in switches to it, one they are not shows it to
   * them — so there is no Open button on it: a door with a handle inside it is
   * two targets where a thumb wants one.
   *
   * It is an `<li>` with an `onClick` rather than a button, because a button may
   * not contain a heading and the circle's name is one; the name itself is a real
   * button, so a keyboard reaches the circle without the row having to fake
   * focus. The ⋯, the join chip and the branch line inside it each stop the tap
   * from reaching the row, which is what keeps two things from firing at once.
   */
  function circleRow(
    circle: Circle,
    options: {
      /** What to call it here — a branch's own word under its organisation. */
      label?: string;
      /** "Branch of SVKV", where the row is not already sitting under it. */
      parentNote?: string | null;
      /** A branch drawn under its organisation, which is indented and quieter. */
      nested?: boolean;
      /** The branches to offer under it, folded up until somebody asks. */
      branches?: Branch[];
    } = {},
  ) {
    const joined = mineIds.has(circle.id);
    const label = options.label ?? circle.name;
    const open = () => (joined ? onEnterCircle(circle.id) : onOpenCircle(circle.id));
    const facts = [memberLabel(circle.memberCount), PRIVACY_SHORT[circle.privacy]];
    if (options.parentNote) facts.push(options.parentNote);
    return (
      <li
        key={circle.id}
        className={`circle-row${options.nested ? " circle-row-nested" : ""}`}
        onClick={open}
      >
        <div className="circle-row-line">
          <span className="circle-row-icon" aria-hidden="true">
            {circle.icon}
          </span>
          <div className="circle-row-text">
            <h3 className="circle-row-name">
              {/* The description is not printed on a row any more — this is a
                  list of doors and the whole of it is one tap away — but a
                  desktop can read it on hover, which is a bonus rather than the
                  only way to it, since a phone has no hover to offer. */}
              <button
                type="button"
                className="circle-name-button"
                title={circle.description || undefined}
                onClick={(event) => {
                  event.stopPropagation();
                  open();
                }}
              >
                {label}
              </button>
            </h3>
            <p className="circle-row-meta">{facts.join(" · ")}</p>
          </div>
          {joined ? moreButton(circle) : doorButton(circle)}
        </div>
        {options.branches && branchGroup(circle, options.branches)}
      </li>
    );
  }

  /** One searched row, which says where it sits since nothing above it does. */
  function hitRow(circle: Circle) {
    const parent = circle.parentName;
    return circleRow(circle, {
      label: parent ? branchLabel(parent, circle.name) : circle.name,
      parentNote: parent ? `Branch of ${parent}` : null,
    });
  }

  /**
   * The branches under an organisation, which are secondary to it and stay that
   * way. Folded up they are one quiet line saying how many there are and naming
   * the first few; tapping that line opens them as rows of their own, indented
   * and tinted, with a "Show less" to fold them back.
   *
   * There is not a connector line anywhere in it. Indentation, a tint and the
   * spacing say what belongs to what, which is what a community app reads like;
   * `├──` and `└──` say the same thing in the vocabulary of a file explorer, on
   * the one screen where there is least room for characters that mean nothing.
   *
   * And an organisation with a dozen chapters never draws a dozen rows unasked:
   * BRANCH_ROWS_SHOWN of them and then "View all", so one circle cannot take
   * over the page it is only listed on.
   */
  function branchGroup(parent: Circle, branches: Branch[]) {
    if (branches.length === 0) return null;
    const count = `${branches.length} ${branches.length === 1 ? "branch" : "branches"}`;
    const listId = `branches-${parent.id}`;

    if (!openBranches.has(parent.id)) {
      const named = branches.slice(0, BRANCH_NAMES_SHOWN);
      const rest = branches.length - named.length;
      return (
        <button
          type="button"
          className="branch-summary"
          aria-expanded={false}
          aria-controls={listId}
          aria-label={`Show the ${count} of ${parent.name}`}
          onClick={(event) => {
            event.stopPropagation();
            setOpenBranches(withMember(openBranches, parent.id, true));
          }}
        >
          <span className="branch-summary-count">{count}</span>
          <span className="branch-summary-names">
            {named.map((branch) => branch.label).join(" · ")}
            {rest > 0 ? ` +${rest} more` : ""}
          </span>
          <span className="branch-summary-chevron" aria-hidden="true">
            {"⌄"}
          </span>
        </button>
      );
    }

    const shown = allBranches.has(parent.id) ? branches : branches.slice(0, BRANCH_ROWS_SHOWN);
    const hidden = branches.length - shown.length;
    return (
      <div className="branch-group">
        <p className="branch-group-title">{count}</p>
        <ul className="circle-rows circle-rows-nested" id={listId}>
          {shown.map((branch) => circleRow(branch.circle, { label: branch.label, nested: true }))}
        </ul>
        <div className="branch-group-actions">
          {hidden > 0 && (
            <button
              type="button"
              className="branch-link"
              onClick={(event) => {
                event.stopPropagation();
                setAllBranches(withMember(allBranches, parent.id, true));
              }}
            >
              View all {branches.length} branches ›
            </button>
          )}
          <button
            type="button"
            className="branch-link branch-link-quiet"
            aria-expanded={true}
            aria-controls={listId}
            onClick={(event) => {
              event.stopPropagation();
              setOpenBranches(withMember(openBranches, parent.id, false));
              setAllBranches(withMember(allBranches, parent.id, false));
            }}
          >
            Show less
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* One line rather than a paragraph. This is the first screen of the app and
          the page under it is a list of doors, so the introduction says what to do
          with them and gets out of the way — on a phone the difference is a card
          and a half of scrolling. Starting a circle is offered at every width and
          exactly once: the worded button in the header where there is room for it,
          and the compact "+ New" beside the "Your circles" heading where there is
          not. A phone gets the chip and never the worded button, because a
          full-width primary button in a header that also holds a title, a subtitle
          and the app's own chrome is the one control that ends up half off the
          side of the screen — which is what it did. */}
      <TabHeader
        title="Circles"
        subtitle="Find and manage your circles."
        actions={
          <button className="btn btn-primary tab-header-wide-action" onClick={onStartCircle}>
            + Start a circle
          </button>
        }
      />

      <ErrorLine message={error} />

      {store.circleInvitations.length > 0 && (
        <section className="circle-section">
          <h2 className="section-title">Invitations</h2>
          <ul className="circle-cards">
            {store.circleInvitations.map((invitation) => (
              <li key={invitation.circle.id} className="circle-card">
                <CircleCardHead circle={invitation.circle} />
                <p className="circle-card-note">{invitation.invitedByName} invited you</p>
                <div className="circle-card-actions">
                  <button
                    className="btn btn-primary"
                    disabled={busy === `join:${invitation.circle.id}`}
                    onClick={() => join(invitation.circle.id)}
                  >
                    {busy === `join:${invitation.circle.id}` ? "Joining…" : "Join"}
                  </button>
                  <button className="btn-text" onClick={() => onOpenCircle(invitation.circle.id)}>
                    Have a look first
                  </button>
                  {/* Turning it down is the invitee's own call, not the owner's. */}
                  <button
                    className="btn-text"
                    disabled={busy === `decline:${invitation.circle.id}`}
                    onClick={() =>
                      run(
                        `decline:${invitation.circle.id}`,
                        store.removeCircleMember(invitation.circle.id, userId),
                      )
                    }
                  >
                    Not now
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {store.circleRequests.length > 0 && (
        <section className="circle-section">
          <h2 className="section-title">Waiting to join your circles</h2>
          <ul className="pending-list">
            {store.circleRequests.map((request) => (
              <li key={`${request.circleId}:${request.memberId}`} className="pending-row">
                <span>
                  <strong>{request.memberName}</strong> asked to join{" "}
                  <span aria-hidden="true">{request.circleIcon}</span> {request.circleName}
                </span>
                <button
                  className="chip-button chip-strong"
                  disabled={busy === `approve:${request.circleId}:${request.memberId}`}
                  onClick={() =>
                    run(
                      `approve:${request.circleId}:${request.memberId}`,
                      store.approveCircleRequest(request.circleId, request.memberId),
                    )
                  }
                >
                  Approve
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="circle-section">
        {/* The heading, with the search under it rather than above the whole page:
            a member looking for a circle they are already in is looking through
            this list, so the box belongs with the list it searches. The heading
            also carries the phone's way of starting a circle — "Your circles"
            and a "+ New" chip on one line — which is the same action the header's
            worded button is, and exactly one of the two is ever on screen, so it
            is never offered twice a heading apart. */}
        <div className="section-head section-head-inline">
          <h2 className="section-title">Your circles</h2>
          <button
            className="chip-button chip-strong section-head-narrow-action"
            onClick={onStartCircle}
          >
            + New
          </button>
        </div>
        {(store.circles.length > 0 || store.discoverCircles.length > 0) && (
          <SearchField value={query} onChange={setQuery} placeholder="Search your circles" />
        )}
        {store.circles.length === 0 ? (
          <EmptyState glyph="👥" title="No circles yet">
            Start one for the thing you care about — a book club, a music group, the family
            kitchen — and invite the people who would enjoy it.
          </EmptyState>
        ) : needle ? (
          /* Searching answers with the circles that match, flat and by name —
             organisations and branches together, since somebody typing "Austin"
             is looking for Austin and not for the organisation it belongs to. */
          mineHits.length === 0 ? (
            <p className="muted">No circle of yours matches “{query}”.</p>
          ) : (
            <ul className="circle-rows">{mineHits.map((circle) => hitRow(circle))}</ul>
          )
        ) : (
          <ul className="circle-rows">
            {mine.map(({ circle, branches }) => circleRow(circle, { branches }))}
          </ul>
        )}
      </section>

      {store.discoverCircles.length > 0 && (
        <section className="circle-section">
          <h2 className="section-title">Circles you could join</h2>
          {/* The same rows, because it is the same mental model: a circle is a
              line with a door on the end of it, and the only difference here is
              which door. */}
          {needle ? (
            discoverHits.length === 0 ? (
              <p className="muted">Nothing here matches “{query}”.</p>
            ) : (
              <ul className="circle-rows">{discoverHits.map((circle) => hitRow(circle))}</ul>
            )
          ) : (
            <ul className="circle-rows">
              {discover.map(({ circle, branches }) => circleRow(circle, { branches }))}
            </ul>
          )}
        </section>
      )}

      {/* Everything the card used to carry as buttons, in the one place a phone
          expects to find it. What is on it is `actionsFor()`'s answer and nothing
          else, so a plain member's sheet is shorter than a keeper's rather than
          being a keeper's with half of it disabled. */}
      {sheetFor && (
        <ActionSheet
          title={`${sheetFor.icon} ${sheetFor.name}`}
          subtitle={`${memberLabel(sheetFor.memberCount)} · ${PRIVACY_SHORT[sheetFor.privacy]}`}
          actions={actionsFor(sheetFor)}
          onClose={() => setSheetFor(null)}
        />
      )}

      {leaving && (
        <LeaveCircleModal
          circle={leaving}
          onCancel={() => setLeaving(null)}
          onLeave={() => onLeaveCircle(leaving).then(() => setLeaving(null))}
        />
      )}

      {/* Closing a circle is asked about, in the same shape leaving one is: the
          safe answer plain and first, the destructive one second and never the
          primary. The server refuses it for Discover and for anybody who is not a
          keeper, and the refusal is read here rather than swallowed. */}
      {deleting && (
        <Modal
          eyebrow="Circles"
          title={`Delete ${deleting.name}?`}
          onClose={() => setDeleting(null)}
          busy={busy === `delete:${deleting.id}`}
        >
          <p className="form-note">
            The circle closes for everybody in it, and nothing anybody shared is deleted: a
            share left with no circles becomes private to whoever wrote it. This cannot be
            undone.
          </p>
          <ErrorLine message={error} />
          <div className="modal-actions">
            <button
              className="btn btn-ghost"
              onClick={() => setDeleting(null)}
              disabled={busy === `delete:${deleting.id}`}
            >
              Cancel
            </button>
            <button
              className="btn btn-danger"
              disabled={busy === `delete:${deleting.id}`}
              onClick={() =>
                run(`delete:${deleting.id}`, store.removeCircle(deleting.id)).then((ok) => {
                  if (ok) setDeleting(null);
                })
              }
            >
              {busy === `delete:${deleting.id}` ? "Deleting…" : "Delete circle"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

/**
 * What every circle card says, in the order a member reads it: the icon and the
 * name on one row with whatever control the card carries at the right, then the
 * head count and which of the three doors it is, then a couple of lines of the
 * description, then who keeps it.
 *
 * The privacy is the short label here — "Ask to join" rather than the sentence —
 * because it sits in a line of two facts and the long form wrapped the row onto
 * three on a phone. A circle's own page still reads the full sentence, where
 * there is room to explain rather than only to identify.
 *
 * `onOpen` is what makes the name a real button: the card around it is clickable
 * but is not a control, so without this there was nothing on it a keyboard could
 * reach. It is deliberately the name rather than the whole card, since a button
 * cannot contain the heading the name is.
 */
function CircleCardHead({
  circle,
  onOpen,
  action,
}: {
  circle: Circle;
  /** Set on a card that opens the circle, which makes the name the button for it. */
  onOpen?: () => void;
  /** The control at the right of the name row — the ⋯ on the member's own cards. */
  action?: ReactNode;
}) {
  return (
    <>
      {circle.coverUrl && <img className="circle-cover" src={circle.coverUrl} alt="" />}
      <div className="circle-card-head">
        <span className="circle-icon" aria-hidden="true">
          {circle.icon}
        </span>
        <div className="circle-card-titles">
          <h3 className="circle-name">
            {onOpen ? (
              <button type="button" className="circle-name-button" onClick={onOpen}>
                {circle.name}
              </button>
            ) : (
              circle.name
            )}
          </h3>
          <p className="circle-meta">
            {memberLabel(circle.memberCount)} · {PRIVACY_SHORT[circle.privacy]}
          </p>
        </div>
        {action}
      </div>
      {circle.description && <p className="circle-description">{circle.description}</p>}
      <p className="circle-owner">Kept by {circle.ownerName}</p>
    </>
  );
}

/** One circle: who is in it, who is waiting, and everything shared into it. */
function CircleDetailView({
  store,
  userId,
  circleId,
  categoryId,
  shelf,
  folderId,
  onBack,
  onOpenCircle,
  onLeaveCircle,
  onOpenCategory,
  onOpenFolder,
  onOpenMembers,
  onEditCircle,
  onShareInto,
  onShareIntoFolder,
  onEnteredCircle,
  onOpenRecipe,
  onOpenBook,
  onOpenRemedy,
  openPanel = null,
  onPanelShown,
}: {
  store: ShareAndLearn;
  userId: string;
  circleId: number;
  categoryId: number | null;
  shelf: string | null;
  folderId: number | null;
  onBack: () => void;
  onOpenCircle: (id: number) => void;
  onLeaveCircle: (circle: Circle) => Promise<void>;
  onOpenCategory: (id: number, categoryId: number, shelf?: string) => void;
  onOpenFolder: (id: number, folderId: number | null) => void;
  onOpenMembers: () => void;
  onEditCircle: (circle: Circle) => void;
  onShareInto: (flow: ShareFlow, circleId: number) => void;
  onShareIntoFolder: (flow: ShareFlow, circleId: number, folder: ShareTarget) => void;
  onEnteredCircle: (circleId: number) => void;
  /** Open one item, carrying the folder the reader was standing in. */
  onOpenRecipe: (id: number, folderId: number | null) => void;
  onOpenBook: (id: number, folderId: number | null) => void;
  onOpenRemedy: (id: number, folderId: number | null) => void;
  /**
   * Which of the circle's own panels to open on arrival, when the member asked
   * for it from somewhere else — "Invite people" and "Admin tools" on the
   * listing's ⋯ both open the circle rather than duplicating a panel that lives
   * here. Null is the ordinary arrival, which opens nothing.
   */
  openPanel?: CirclePanel | null;
  /** Called once the hint has been acted on, so a later visit opens plain. */
  onPanelShown?: () => void;
}) {
  const [detail, setDetail] = useState<CircleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [inviting, setInviting] = useState(false);
  const [invitees, setInvitees] = useState<string[]>([]);
  const [managing, setManaging] = useState(false);
  /**
   * True while the folder manager is open. Its own state rather than `managing`,
   * because the two are deliberately different jobs: folders are where a share
   * goes and content types are what it is, and the manager for one is never the
   * manager for the other.
   */
  const [folderAdmin, setFolderAdmin] = useState(false);
  /** Which folder the manager's add panel opens under, and whether it opens at all. */
  const [addingFolder, setAddingFolder] = useState(false);
  /** True while the Admin tools drawer is open. Closed on arrival, always. */
  const [admin, setAdmin] = useState(false);
  /** True while the leave dialog is open for this circle. */
  const [leaving, setLeaving] = useState(false);
  /** True while the header's ⋯ sheet is open. */
  const [sheet, setSheet] = useState(false);
  /** True while closing this circle is being asked about. */
  const [deleting, setDeleting] = useState(false);
  /** Which of the circle's categories the feed is narrowed to, or null for all. */
  const [topic, setTopic] = useState<number | null>(null);
  /** How the feed is ordered: the reader's own control, under the heading. */
  const [sort, setSort] = useState<FeedSort>("newest");

  // The circle's own read already carries its categories; handing them to the
  // store keeps the share forms and this page looking at the same list.
  const receiveCategories = store.receiveCategories;
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCircle(circleId);
      setDetail(data);
      receiveCategories(circleId, data.categories);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That circle could not be opened.");
    } finally {
      setLoading(false);
    }
  }, [circleId, receiveCategories]);

  useEffect(() => {
    load();
  }, [load]);

  const circle = detail?.circle ?? store.circleById.get(circleId) ?? null;
  /**
   * A circle runs itself: its owner and whoever they made an admin see what has
   * been reported here and decide everything else about the circle, and nobody
   * else does — not even the app admin, unless they are stepping in, which is what
   * `moderating` says when they do.
   */
  const moderating = detail?.moderating ?? null;
  /**
   * An admin of a circle manages the circle, so this and not ownership is what
   * every control on this page is drawn from. The two part company in exactly one
   * place, below: the owner cannot leave, because a circle keeps its owner.
   */
  const canManage = moderating !== null;
  /**
   * Folders are what a normal circle is navigated by, and they do not travel with
   * the circle's own read, so they are asked for separately. Discover is
   * deliberately left exactly as it was, so nothing is asked for on its behalf.
   */
  const isDefaultCircle = circle?.isDefault ?? false;
  const loadCircleFolders = store.loadCircleFolders;
  useEffect(() => {
    if (isDefaultCircle) return;
    loadCircleFolders(circleId).catch(() => {});
  }, [circleId, isDefaultCircle, loadCircleFolders]);
  const folders = isDefaultCircle ? [] : (store.circleFolders[circleId] ?? []);
  /** The folders at the top level of this circle, which is what the grid draws. */
  const topFolders = childFolders(visibleFolders(folders), null);
  /**
   * Sharing into the circle rather than into any folder of it, which is what the
   * chooser beside "Recent shares" does. There is no folder to name, so the form
   * says nothing about where the share is going — and asks nothing either: the
   * content type was chosen in the sheet, so the old cross-category "File under"
   * question has been answered and is not put a second time.
   */
  const intoCircle: ShareTarget = { id: null, path: [] };
  const openReports = (detail?.reports ?? []).filter((report) => report.status === "open");
  const requests = detail?.requests ?? [];
  const invitations = detail?.invitations ?? [];
  /**
   * What the badge on Admin tools counts: the two things actually waiting on a
   * keeper to answer. An outstanding invitation is deliberately not one of them —
   * it is waiting on the person invited, and counting it would put a number on the
   * button that nothing in the drawer can clear.
   */
  const needsAttention = openReports.length + requests.length;
  /** A manager's list includes what has been switched off; a member's does not. */
  const categories = store.circleCategories[circleId] ?? detail?.categories ?? [];

  // Acting on the hint the listing's ⋯ left behind. It waits for the circle's own
  // read, because both panels are a keeper's and `canManage` is not known until
  // the server has answered — opening the drawer before then would draw it for a
  // moment to somebody who may not have it.
  const loadContacts = store.loadContacts;
  useEffect(() => {
    if (!openPanel || loading || !canManage) return;
    if (openPanel === "invite") {
      setInviting(true);
      void loadContacts();
    } else {
      setAdmin(true);
    }
    onPanelShown?.();
  }, [openPanel, loading, canManage, loadContacts, onPanelShown]);

  /**
   * Everything shared into this circle, newest first, before any of the reader's
   * three controls have narrowed it. The chips count from this rather than from
   * what is on screen, so "Books (2)" says how many books the circle holds rather
   * than how many of them survived the search box.
   */
  const shared = useMemo(() => {
    return feedEntries(
      {
        songs: store.songs,
        recipes: store.recipes,
        facts: store.facts,
        words: store.words,
        books: store.books,
        remedies: store.remedies,
        bookmarks: store.bookmarks,
        posts: store.posts,
      },
      (id) => store.categoryById.get(id) ?? null,
    )
      .filter((entry) => entry.circleIds.includes(circleId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [
    store.songs,
    store.recipes,
    store.facts,
    store.words,
    store.books,
    store.remedies,
    store.bookmarks,
    store.posts,
    store.categoryById,
    circleId,
  ]);

  /**
   * The chips under the heading: one per category with something in it, in the
   * circle's own category order, each carrying its count. A category holding
   * nothing gets no chip, because a chip leading to an empty list is a dead end
   * rather than a filter.
   */
  const filters = useMemo(() => {
    const counts = new Map<number, number>();
    for (const entry of shared) {
      const id = categoryFor(entry, circleId, categories);
      if (id !== null) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return sortedCategories(categories)
      .map((row) => ({ id: row.id, name: row.name, count: counts.get(row.id) ?? 0 }))
      .filter((row) => row.count > 0);
  }, [shared, categories, circleId]);

  /**
   * The chip actually in force. A filing can stop being offered — the category is
   * switched off, or the last thing in it moved — and a selection pointing at a
   * chip that is no longer drawn would leave the reader looking at an empty list
   * with nothing on screen selected, so it falls back to all of it.
   */
  const chosen = topic !== null && filters.some((row) => row.id === topic) ? topic : null;

  /** The feed as the reader has asked for it: chip, search box, sort. */
  const feed = useMemo(() => {
    const rows = shared.filter(
      (entry) =>
        matchesQuery(entry, query) &&
        (chosen === null || categoryFor(entry, circleId, categories) === chosen),
    );
    if (sort === "oldest") return [...rows].reverse();
    if (sort === "topic") {
      // Grouped by topic, newest first inside each topic.
      return [...rows].sort(
        (a, b) =>
          TOPIC_ORDER[a.itemType] - TOPIC_ORDER[b.itemType] ||
          b.createdAt.localeCompare(a.createdAt),
      );
    }
    return rows;
  }, [shared, query, chosen, sort, categories, circleId]);

  /** Contacts who are neither in the circle nor already invited. */
  const invitable = useMemo(() => {
    const known = new Set<string>([
      ...(detail?.members ?? []).map((member) => member.memberId),
      ...(detail?.invitations ?? []).map((pending) => pending.memberId),
    ]);
    return store.contacts.filter((contact) => !known.has(contact.id));
  }, [store.contacts, detail]);

  function run(key: string, action: Promise<unknown>, after?: () => void) {
    setBusy(key);
    setError(null);
    action
      .then(() => {
        after?.();
        return load();
      })
      .catch((err) => setError(err instanceof Error ? err.message : "That did not work."))
      .finally(() => setBusy(null));
  }

  /**
   * The three kinds with a page of their own. A song plays and a post or a word
   * opens under its own row — `entryAction()` decides which — so there is
   * deliberately no fallback branch: the one that used to be here sent a word, a
   * fun fact and a post to the Learn tab, which is not even in this circle.
   *
   * `from` is the folder the row was tapped in, and it travels with the item so
   * the page it opens can say where the reader is and send them back to it. It is
   * asked for rather than derived, because only the caller knows: the same feed
   * is drawn on a folder's page, on a category's, and on the circle's own.
   */
  function openEntry(entry: FeedEntry, from: number | null) {
    if (entry.itemType === "recipe") onOpenRecipe(entry.id, from);
    else if (entry.itemType === "book") onOpenBook(entry.id, from);
    else if (entry.itemType === "remedy") onOpenRemedy(entry.id, from);
  }

  if (loading && !circle) {
    return (
      <>
        <button className="btn-text back-link" onClick={onBack}>
          ← All circles
        </button>
        <p className="muted">Opening the circle…</p>
      </>
    );
  }

  if (!circle) {
    return (
      <>
        <button className="btn-text back-link" onClick={onBack}>
          ← All circles
        </button>
        <EmptyState glyph="◦" title="That circle is not available">
          {error ?? "It may have been closed, or it may be private."}
        </EmptyState>
      </>
    );
  }

  const isMember = Boolean(circle.role);

  /**
   * The same circle, typed without the null its state carries. The guard above
   * has already answered that question, but a sheet row's `onSelect` runs long
   * after this render, so the narrowing has to be held as a value rather than as
   * a control-flow fact the closures below cannot see.
   */
  const shownCircle: Circle = circle;

  /**
   * Everything this member may do to the circle, in the one place a phone expects
   * to find it. It is built from the same facts the server checks rather than from
   * a longer list with rows disabled, so a plain member's sheet is two rows and a
   * keeper's is six — and the two destructive ones still open their own question
   * rather than acting on the tap that closed the sheet.
   *
   * The same six actions as the listing's ⋯, in the same order, because it is the
   * same circle and the same menu. Two of them differ only in where they land:
   * inviting and the admin drawer are panels on this page, so they open here
   * rather than navigating anywhere.
   */
  function pageActions(): SheetAction[] {
    const actions: SheetAction[] = [];
    if (canManage) {
      actions.push({
        key: "edit",
        glyph: "✏️",
        label: "Edit circle",
        onSelect: () => {
          setSheet(false);
          onEditCircle(shownCircle);
        },
      });
      actions.push({
        key: "invite",
        glyph: "✉️",
        label: "Invite people",
        onSelect: () => {
          setSheet(false);
          setInviting(true);
          // Somebody may have joined since the page loaded; the tick-list is only
          // useful if it knows about them.
          void store.loadContacts();
        },
      });
    }
    if (isMember) {
      actions.push({
        key: "members",
        glyph: "👥",
        label: canManage ? "Manage members" : "View members",
        onSelect: () => {
          setSheet(false);
          onOpenMembers();
        },
      });
    }
    if (canManage) {
      actions.push({
        key: "admin",
        glyph: "🛠",
        label: "Admin tools",
        note: needsAttention > 0 ? <span className="tag tag-warn">{needsAttention}</span> : undefined,
        onSelect: () => {
          setSheet(false);
          setAdmin(true);
        },
      });
    }
    /* An admin looks after the circle and can still walk away from it; the owner
       cannot, because a circle keeps its owner — deleting it is their way out,
       which is the row below. Nobody leaves Discover either. Neither refusal has
       a remedy, so the row is left off rather than drawn and explained. */
    if (isMember && canLeaveCircle(shownCircle)) {
      actions.push({
        key: "leave",
        glyph: "🚪",
        label: "Leave circle",
        tone: "danger",
        onSelect: () => {
          setSheet(false);
          setLeaving(true);
        },
      });
    }
    if (canManage && !shownCircle.isDefault) {
      actions.push({
        key: "delete",
        glyph: "🗑",
        label: "Delete circle",
        tone: "danger",
        onSelect: () => {
          setSheet(false);
          setDeleting(true);
        },
      });
    }
    return actions;
  }

  const sheetActions = pageActions();

  /**
   * What to call this circle, and what to say about where it sits.
   *
   * A branch is a whole circle with its own name, and the organisation above it
   * is said once — in the line under the title — rather than at the front of
   * every heading, every crumb and every notification. `branchLabel()` is a
   * display-only tidy-up for a circle still carrying the old "SVKV - Austin"
   * wording: the relationship itself is `parentCircleId` and nothing is inferred
   * from the words.
   *
   * The organisation's name is a link only where the member could actually open
   * it — a circle in their own list, or one on offer — because a private circle
   * they are not in answers a page they cannot read, and a dead link in a header
   * is worse than a name.
   */
  const shownName = circle.parentName ? branchLabel(circle.parentName, circle.name) : circle.name;
  const parentId = circle.parentCircleId;
  const parentReachable =
    parentId !== null &&
    [...store.circles, ...store.discoverCircles].some((row) => row.id === parentId);

  const openCategory =
    categoryId === null ? null : (categories.find((row) => row.id === categoryId) ?? null);

  // A folder has its own page: where the reader is standing, the folders under
  // it, and everything shared into that branch whatever kind of thing it is.
  if (folderId !== null) {
    if (!folderById(folders, folderId)) {
      return (
        <>
          <button className="btn-text back-link" onClick={() => onOpenFolder(circleId, null)}>
            ← {circle.icon} {shownName}
          </button>
          <EmptyState glyph="◦" title="That folder is not here">
            {!isDefaultCircle && store.circleFolders[circleId] === undefined
              ? "Opening the folder…"
              : "It may have been renamed, hidden or deleted."}
          </EmptyState>
        </>
      );
    }
    return (
      <FolderPage
        store={store}
        userId={userId}
        circle={circle}
        folders={folders}
        folderId={folderId}
        categories={categories}
        entries={shared}
        canManage={canManage}
        // Sharing into a folder is for the people in the circle. Somebody
        // previewing a public one reads it and is offered no way to add to it,
        // which is the same answer the server gives.
        canContribute={isMember}
        onBack={() => onOpenFolder(circleId, null)}
        onOpenFolder={(next) => onOpenFolder(circleId, next)}
        onShareInto={(flow, folder) => onShareIntoFolder(flow, circleId, folder)}
        /* The folder on screen is where the reader is, so it is where an item
           opened from here reads its trail back to and where Back returns. */
        onOpenEntry={(entry) => openEntry(entry, folderId)}
      />
    );
  }

  // A category has its own page, with its subcategories and only its own posts.
  if (categoryId !== null) {
    if (!openCategory) {
      return (
        <>
          <button className="btn-text back-link" onClick={() => onOpenCategory(circleId, 0)}>
            ← {circle.icon} {shownName}
          </button>
          <EmptyState glyph="◦" title="That category is not here">
            {loading ? "Opening the circle…" : "It may have been renamed or switched off."}
          </EmptyState>
        </>
      );
    }
    return (
      <CategoryPage
        store={store}
        userId={userId}
        circle={circle}
        category={openCategory}
        categories={categories}
        shelf={shelf}
        canManage={canManage}
        // Sharing into a circle is for the people in it. Somebody previewing a
        // public circle reads the category and is offered no way to add to it,
        // which is the same answer the server gives.
        canContribute={isMember}
        onBack={() => onOpenCircle(circleId)}
        onOpenShelf={(next) => onOpenCategory(circleId, openCategory.id, next)}
        onShareInto={(flow) => onShareInto(flow, circleId)}
        /* A category is what an item *is* rather than where it sits, so no folder
           travels: the item's own filing says which one holds it in this circle,
           and Back lands on the circle. */
        onOpenEntry={(entry) => openEntry(entry, null)}
      />
    );
  }

  return (
    <>
      <button className="btn-text back-link" onClick={onBack}>
        ← All circles
      </button>

      <header className="circle-header">
        {circle.coverUrl && <img className="circle-cover circle-cover-wide" src={circle.coverUrl} alt="" />}
        <div className="circle-header-body">
          <span className="circle-icon circle-icon-large" aria-hidden="true">
            {circle.icon}
          </span>
          <div className="circle-header-text">
            <h1 className="tab-title">{shownName}</h1>
            <p className="circle-meta">
              {/* Where this circle sits, said once and only where there is
                  something to say: "Branch of SVKV · 3 members · Ask to join".
                  Austin is a real circle with its own members, admins and
                  settings — the relationship is organisational, so it is a line
                  of context rather than a claim about who may read what. */}
              {circle.parentName && parentId !== null && (
                <>
                  Branch of{" "}
                  {parentReachable ? (
                    <button
                      className="btn-text circle-meta-link"
                      onClick={() => onOpenCircle(parentId)}
                    >
                      {circle.parentName}
                    </button>
                  ) : (
                    circle.parentName
                  )}
                  {" · "}
                </>
              )}
              {/* The head count is how the roll is reached now that this page does
                  not carry one: Members holds the same list plus the waiting room,
                  the role controls and a search box, so a second smaller copy here
                  was saying it twice. Only for somebody in the circle — a roll is
                  for the people in it, and a visitor previewing a public circle
                  gets the number and no door. */}
              {isMember ? (
                <button className="btn-text circle-meta-link" onClick={onOpenMembers}>
                  {memberLabel(circle.memberCount)}
                </button>
              ) : (
                memberLabel(circle.memberCount)
              )}
              {" · "}
              {PRIVACY_LABEL[circle.privacy]} · kept by {circle.ownerName}
            </p>
            {circle.description && <p className="circle-description">{circle.description}</p>}
          </div>
          {/* One ⋯ in the corner rather than a row of administrative buttons. The
              header is the circle itself — its icon, its name, who is in it, which
              door it is, who keeps it and what it is for — and everything a member
              can *do* to it is one tap behind this, in the bottom sheet a phone
              expects and in the same corner a circle card keeps it. Drawn only
              when the sheet would have rows on it. */}
          {sheetActions.length > 0 && (
            <IconButton
              icon="more"
              label={`More actions for ${circle.name}`}
              className="circle-header-more"
              onClick={() => setSheet(true)}
            />
          )}
          {/* Joining is a choice rather than an action on something the member
              already has, so it stays a worded button — the same way an invitation
              and a circle on offer keep theirs on the listing. A member who is in
              the circle has nothing to answer here, and the row goes with it. */}
          {!isMember && (
            <div className="circle-header-actions">
              {circle.standing === "requested" ? (
                <span className="tag">Waiting for {circle.ownerName}</span>
              ) : (
                <button
                  className="btn btn-primary"
                  disabled={busy === "join"}
                  onClick={() =>
                    run(
                      "join",
                      // Asking to join a discoverable circle is not being in it yet,
                      // so only a real join moves them here.
                      store.joinCircle(circle.id).then((result) => {
                        if (result.joined) onEnteredCircle(circle.id);
                      }),
                    )
                  }
                >
                  {circle.privacy === "public" || circle.standing === "invited"
                    ? "Join circle"
                    : "Ask to join"}
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* An organisation lists its chapters here, this being the page somebody
          following a link to SVKV actually lands on. A crumb opens that branch's
          own page and makes it the circle in view. */}
      <BranchStrip
        parent={circle}
        store={store}
        onSwitch={(id) => {
          onEnteredCircle(id);
          onOpenCircle(id);
        }}
      />

      <ErrorLine message={error} />

      {canManage && inviting && (
        <section className="circle-section invite-panel">
          <h2 className="section-title">Invite from your contacts</h2>
          {invitable.length === 0 ? (
            <p className="muted">
              {store.contacts.length === 0
                ? "Nobody else is in the group yet, so there is nobody to tick. Send a link instead — whoever opens it lands in this circle."
                : "Everybody you know is already in this circle, or waiting on it. A link reaches anyone else."}
            </p>
          ) : (
            <>
              <div className="contact-list">
                {invitable.map((contact) => (
                  <label
                    key={contact.id}
                    className={
                      invitees.includes(contact.id) ? "contact-row contact-row-on" : "contact-row"
                    }
                  >
                    <input
                      type="checkbox"
                      checked={invitees.includes(contact.id)}
                      onChange={() =>
                        setInvitees((prev) =>
                          prev.includes(contact.id)
                            ? prev.filter((id) => id !== contact.id)
                            : [...prev, contact.id],
                        )
                      }
                    />
                    <span>{contact.name}</span>
                  </label>
                ))}
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setInviting(false)}>
                  Done
                </button>
                <button
                  className="btn btn-primary"
                  disabled={invitees.length === 0 || busy === "invite"}
                  onClick={() =>
                    run("invite", store.inviteToCircle(circle.id, invitees), () => {
                      setInvitees([]);
                      setInviting(false);
                    })
                  }
                >
                  {busy === "invite" ? "Inviting…" : `Invite ${invitees.length || ""}`.trim()}
                </button>
              </div>
            </>
          )}
          <CircleInviteLink circle={circle} store={store} />
        </section>
      )}

      {/* Admin tools: one drawer, opened on purpose. Reports, the waiting room
          and the outstanding invitations used to be three sections of the page
          itself, each one rendered whether or not it had anything in it — so the
          first thing on a quiet circle's page was a heading saying nothing had
          been reported. They are all housekeeping, all a keeper's, and all better
          behind a button that says how much of it is waiting. */}
      {canManage && admin && (
        <section className="circle-section admin-tools">
          {/* The drawer is opened from the ⋯ sheet, which is gone by the time it
              draws, so it carries its own way out rather than relying on the
              button that opened it still being on screen. */}
          <div className="section-head section-head-inline">
            <h2 className="section-title">Admin tools</h2>
            <IconButton
              icon="close"
              label="Close admin tools"
              onClick={() => setAdmin(false)}
            />
          </div>
          <p className="section-note">
            {moderating === "app_admin"
              ? "You are seeing this as the app admin, for abuse and support."
              : "Looking after this circle. Nobody but its keepers sees any of it."}
          </p>

          <h3 className="section-title">
            Reported here
            {openReports.length > 0 && <span className="tag tag-warn">{openReports.length}</span>}
          </h3>
          <p className="section-note">
            What members here have flagged. Removing a post takes it out of this circle and deletes
            nothing — the author keeps it.
          </p>
          {openReports.length === 0 ? (
            <p className="muted">Nothing is waiting. Reports from this circle land here.</p>
          ) : (
            <ul className="report-list">
              {openReports.map((report) => (
                <li key={report.id} className="report-row">
                  <div className="report-body">
                    <p className="report-head">
                      <span className="tag">{reasonLabel(report.reason)}</span>
                      <strong>{report.authorName}</strong>&apos;s {report.itemType}
                    </p>
                    {report.details && <p className="report-details">“{report.details}”</p>}
                    <p className="byline">
                      Reported by {report.reporterName} · {formatDate(report.createdAt)}
                    </p>
                  </div>
                  <span className="owner-actions">
                    <button
                      className="chip-button"
                      disabled={busy === `dismiss:${report.id}`}
                      onClick={() =>
                        run(`dismiss:${report.id}`, store.settleReport(report.id, "dismiss"), load)
                      }
                    >
                      Leave it up
                    </button>
                    <button
                      className="chip-button chip-danger"
                      disabled={busy === `remove-report:${report.id}`}
                      onClick={() =>
                        run(
                          `remove-report:${report.id}`,
                          store.settleReport(report.id, "remove"),
                          load,
                        )
                      }
                    >
                      Take it out of the circle
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h3 className="section-title">
            Asking to join
            {requests.length > 0 && <span className="tag tag-warn">{requests.length}</span>}
          </h3>
          {requests.length === 0 ? (
            <p className="muted">Nobody is waiting at the door.</p>
          ) : (
            <ul className="pending-list">
              {requests.map((request) => (
                <li key={request.memberId} className="pending-row">
                  <span>
                    <strong>{request.memberName}</strong> · asked {formatDate(request.createdAt)}
                  </span>
                  <span className="owner-actions">
                    <button
                      className="chip-button chip-strong"
                      disabled={busy === `approve:${request.memberId}`}
                      onClick={() =>
                        run(
                          `approve:${request.memberId}`,
                          store.approveCircleRequest(circle.id, request.memberId),
                        )
                      }
                    >
                      Approve
                    </button>
                    <button
                      className="chip-button"
                      disabled={busy === `turndown:${request.memberId}`}
                      onClick={() =>
                        run(
                          `turndown:${request.memberId}`,
                          store.removeCircleMember(circle.id, request.memberId),
                        )
                      }
                    >
                      Turn down
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h3 className="section-title">Invited, not answered yet</h3>
          {invitations.length === 0 ? (
            <p className="muted">No invitation is outstanding.</p>
          ) : (
            <ul className="pending-list">
              {invitations.map((pending) => (
                <li key={pending.memberId} className="pending-row">
                  <span>
                    <strong>{pending.memberName}</strong> · invited {formatDate(pending.createdAt)}
                  </span>
                  <button
                    className="chip-button"
                    disabled={busy === `uninvite:${pending.memberId}`}
                    onClick={() =>
                      run(
                        `uninvite:${pending.memberId}`,
                        store.removeCircleMember(circle.id, pending.memberId),
                      )
                    }
                  >
                    Withdraw
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* The roll and the roles are one tab away rather than a third copy
              here: Members already holds this circle's people, its waiting room,
              a search box and the buttons that hand out the admin role. */}
          <h3 className="section-title">Members and roles</h3>
          <p className="section-note">
            Who is in, who looks after the circle, and who to remove — all on the Members tab, for
            whichever circle is in view.
          </p>
          <button className="btn-text" onClick={onOpenMembers}>
            Open Members →
          </button>

          {/* Which kinds of thing this circle takes, which is a different
              question from how it is organised: a folder is where a share goes
              and a content type is what it is, so the two managers are kept
              apart. Discover keeps its own grid and its Manage link on it. */}
          {!isDefaultCircle && (
            <>
              <h3 className="section-title">Content types</h3>
              <p className="section-note">
                Which kinds of thing this circle takes — songs, recipes, books — and the categories
                it invented for itself. It is also where <strong>Manage fields</strong> lives: what
                each one's form asks, such as which Menu type and Dish type options a recipe here
                is offered.
              </p>
              <button className="btn-text" onClick={() => setManaging((open) => !open)}>
                {managing ? "Hide content types" : "Manage content types →"}
              </button>
              {managing && (
                <CategoryManager
                  store={store}
                  circleId={circle.id}
                  categories={categories}
                  onClose={() => setManaging(false)}
                />
              )}
            </>
          )}
        </section>
      )}

      {/* How a circle is navigated. Discover is deliberately left exactly as it
          was — its content types are its grid — and every other circle is
          navigated by its folders, which is one structure rather than two
          competing ones. A keeper's way into the content types themselves is
          the Admin tools drawer above. */}
      {isMember && isDefaultCircle && (
        <>
          <CategoryGrid
            categories={categories}
            canManage={canManage}
            onOpen={(id) => onOpenCategory(circle.id, id)}
            onManage={() => setManaging((open) => !open)}
          />
          {canManage && managing && (
            <CategoryManager
              store={store}
              circleId={circle.id}
              categories={categories}
              onClose={() => setManaging(false)}
            />
          )}
        </>
      )}

      {/* A member reading a circle with nothing filed anywhere is shown the feed
          rather than a note about a structure nobody has made yet, so the whole
          section is left out. A keeper is told, because they are the only person
          who can do anything about it. */}
      {isMember && !isDefaultCircle && (canManage || topFolders.length > 0) && (
        <>
          <FolderGrid
            folders={folders}
            canManage={canManage}
            onOpen={(id) => onOpenFolder(circle.id, id)}
            onManage={() => {
              setAddingFolder(false);
              setFolderAdmin((open) => !open);
            }}
            onAdd={
              canManage
                ? () => {
                    setAddingFolder(true);
                    setFolderAdmin(true);
                  }
                : undefined
            }
          />
          {canManage && folderAdmin && (
            <FolderManager
              store={store}
              circleId={circle.id}
              circleName={shownName}
              folders={folders}
              startAdding={addingFolder}
              onClose={() => {
                setAddingFolder(false);
                setFolderAdmin(false);
              }}
            />
          )}
        </>
      )}

      <section className="circle-section">
        {/* What the list is, and nothing about how it is being read: the chips,
            the search box and the sort are controls under the heading rather than
            a description of the page's own state — a heading that changes as the
            reader filters says the filter twice and the subject not at all. */}
        <div className="section-head section-head-inline">
          <h2 className="section-title">Recent shares</h2>
          {/* Adding to the circle itself, for a circle whose shares do not all
              belong in a folder — and the only way in at all on a circle that has
              no folders yet, which is what a member arriving at a new circle
              finds. A folder's own page offers the same chooser, filed there. */}
          {isMember && !isDefaultCircle && (
            <div className="section-head-actions">
              <ShareItemButton
                store={store}
                categories={categories}
                subtitle={shownName}
                folder={intoCircle}
                onPick={(flow) => onShareIntoFolder(flow, circle.id, intoCircle)}
              />
            </div>
          )}
        </div>
        {!isMember ? (
          <EmptyState glyph="🔒" title="Join to see what is inside">
            Posts in a circle are for the people in it.
          </EmptyState>
        ) : (
          <>
            {/* One chip per category with something in it, "All" first, each
                carrying its count. It scrolls sideways on a phone rather than
                wrapping into a wall of chips, and it is only drawn when there is
                more than one thing to choose between — a single chip beside "All"
                is the same list twice. */}
            {filters.length > 1 && (
              <div className="shelf-chips" role="group" aria-label="Narrow by category">
                <button
                  type="button"
                  className={`chip-button${chosen === null ? " chip-active" : ""}`}
                  aria-pressed={chosen === null}
                  onClick={() => setTopic(null)}
                >
                  All ({shared.length})
                </button>
                {filters.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className={`chip-button${chosen === row.id ? " chip-active" : ""}`}
                    aria-pressed={chosen === row.id}
                    onClick={() => setTopic(chosen === row.id ? null : row.id)}
                  >
                    {row.name} ({row.count})
                  </button>
                ))}
              </div>
            )}
            <div className="feed-controls">
              <SearchField value={query} onChange={setQuery} placeholder="Search shares" />
              <label className="feed-sort">
                <span>Sort</span>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as FeedSort)}
                >
                  {FEED_SORTS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {feed.length === 0 ? (
              <EmptyState
                glyph="◦"
                title={query || chosen !== null ? "Nothing matches" : "Nothing shared here yet"}
              >
                {query || chosen !== null ? (
                  <button
                    className="btn-text"
                    onClick={() => {
                      setQuery("");
                      setTopic(null);
                    }}
                  >
                    Show everything again
                  </button>
                ) : (
                  "Nothing has been shared here yet."
                )}
              </EmptyState>
            ) : (
              <CircleFeedList
                entries={feed}
                categories={categories}
                circleId={circle.id}
                store={store}
                userId={userId}
                /* The circle's whole feed spans every folder in it, so none of
                   them is where the reader is standing. */
                onOpenEntry={(entry) => openEntry(entry, null)}
                onError={setError}
              />
            )}
          </>
        )}
      </section>

      {/* Everything the header used to carry as a row of buttons, in the shape a
          phone expects. It decides nothing and confirms nothing: `pageActions()`
          has already worked out which rows this member gets, and the two
          destructive ones close the sheet and open their own question. */}
      {sheet && (
        <ActionSheet
          title={`${circle.icon} ${circle.name}`}
          subtitle={`${memberLabel(circle.memberCount)} · ${PRIVACY_SHORT[circle.privacy]}`}
          actions={sheetActions}
          onClose={() => setSheet(false)}
        />
      )}

      {leaving && (
        <LeaveCircleModal
          circle={circle}
          onCancel={() => setLeaving(false)}
          // The shell navigates away afterwards, so there is nothing here to put
          // back — closing the dialog is only for the refusal that never ran.
          onLeave={() => onLeaveCircle(circle)}
        />
      )}

      {/* Closing a circle is still asked about, in the same shape leaving one is:
          the safe answer plain and first, the destructive one second and never the
          primary. The server refuses it for Discover and for anybody who is not a
          keeper, and the refusal is read here rather than swallowed. */}
      {deleting && (
        <Modal
          eyebrow={circle.name}
          title={`Delete ${circle.name}?`}
          onClose={() => setDeleting(false)}
          busy={busy === `delete:${circle.id}`}
        >
          <p className="form-note">
            The circle closes for everybody in it, and nothing anybody shared is deleted: a share
            left with no circles becomes private to whoever wrote it. This cannot be undone.
          </p>
          <ErrorLine message={error} />
          <div className="modal-actions">
            <button
              className="btn btn-ghost"
              onClick={() => setDeleting(false)}
              disabled={busy === `delete:${circle.id}`}
            >
              Cancel
            </button>
            <button
              className="btn btn-danger"
              disabled={busy === `delete:${circle.id}`}
              onClick={() => run(`delete:${circle.id}`, store.removeCircle(circle.id), onBack)}
            >
              {busy === `delete:${circle.id}` ? "Deleting…" : "Delete circle"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

/**
 * Inviting somebody who is not in the group yet. The contact tick-list can only
 * offer people the app already knows, so a brand new circle would otherwise have
 * nobody to invite. This link brings the friend into the group and into this
 * circle in the same step.
 */
function CircleInviteLink({ circle, store }: { circle: Circle; store: ShareAndLearn }) {
  const [inviteeName, setInviteeName] = useState("");
  const [invite, setInvite] = useState<Invite | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      setInvite(await store.inviteFriend({ inviteeName, circleId: circle.id }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "That link could not be made.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="invite-link-block">
      <h3 className="section-title">Or invite someone new by link</h3>
      {invite ? (
        <>
          <InviteShare invite={invite} inviterName={circle.ownerName} />
          <button
            className="btn-text"
            onClick={() => {
              setInvite(null);
              setInviteeName("");
            }}
          >
            Make another link
          </button>
        </>
      ) : (
        <>
          <p className="muted">
            Whoever opens the link joins the group and {circle.icon} {circle.name} together — send it
            however you normally talk to them.
          </p>
          <label className="field">
            <span>Their name (optional)</span>
            <input
              value={inviteeName}
              onChange={(e) => setInviteeName(e.target.value)}
            />
            <span className="field-hint">Only so you can tell your own links apart on Profile.</span>
          </label>
          <ErrorLine message={error} />
          <button className="btn btn-primary" disabled={busy} onClick={create}>
            {busy ? "Making the link…" : "Create invite link"}
          </button>
        </>
      )}
    </div>
  );
}
