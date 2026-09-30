import { useEffect, useMemo, useState } from "react";
import {
  audioUrl,
  formatDate,
  type Book,
  type Bookmark,
  type Circle,
  type CircleCategory,
  type CircleFiling,
  type DiscussionItemType,
  type Post,
  type Song,
} from "../api";
import {
  BUILT_IN_CATEGORIES,
  CATEGORY_ICONS,
  categoryIn,
  childShelves,
  DEFAULT_CATEGORY_ICON,
  entryBreadcrumb,
  filedIn,
  isCustom,
  normalizeName,
  PATH_SEPARATOR,
  pathText,
  shareFlows,
  shelfBranchIds,
  shelfById,
  shelfPath,
  sortedCategories,
  trailBelow,
  treeOf,
  type ShareFlow,
} from "../categories";
import {
  bookEntry,
  bookmarkEntry,
  factEntry,
  postEntry,
  recipeEntry,
  remedyEntry,
  songEntry,
  wordEntry,
  type FeedEntry,
} from "../feed";
import type { ShareAndLearn } from "../store";
import { canAddFields } from "../fields";
import { canManageShare, deleteNote } from "../manage";
import type { SheetAction } from "./ActionSheet";
import { entryAction, EntryActionButton, EntryDetail } from "./EntryReader";
import { useGuidelinesGate } from "./Guidelines";
import { PostActions } from "./PostMenu";
import { MoveToFolderButton } from "./MoveToFolder";
import { BookmarkModal } from "./BookmarkModal";
import { ManageFieldsButton, ManageFieldsModal } from "./ManageFields";
import {
  deleteAction,
  disableAction,
  ManageConfirm,
  ManageRow,
  moveActions,
} from "./ManageRow";
import { PostModal } from "./PostModal";
import { ItemDiscussions } from "./Discussions";
import { ShareLinkButton } from "./ShareLink";
import { SongLyrics } from "./SongLyrics";
import { ADD_A_SONG_NOTE, SongModal } from "./SongModal";
import { WordExplorer } from "./WordExplorer";
import {
  EmptyState,
  ErrorLine,
  OwnerActions,
  PhotoGallery,
  PrivateTag,
  SaveButton,
  SearchField,
} from "./shared";

/**
 * How many of the newest entries a landing page shows before it stops and offers
 * the rest. A category or a node with children is a place to look around from
 * rather than a list to read, so it leads with what has just arrived and hands the
 * full listing over to "View all" — which is also where searching and sorting live,
 * those being questions about a list rather than about a place.
 */
const RECENT_LIMIT = 5;

/** How a node's own listing can be ordered once somebody is reading it rather than browsing. */
type ShelfSort = "newest" | "oldest" | "title" | "title-reverse";

const SHELF_SORTS: { value: ShelfSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "title", label: "Title A–Z" },
  { value: "title-reverse", label: "Title Z–A" },
];

/** "3 entries", "1 entry" — the number under a category tile or beside a shelf. */
export function entryCount(total: number) {
  return `${total} ${total === 1 ? "entry" : "entries"}`;
}

/**
 * Everything in one category of one circle, as feed rows. A built-in category
 * draws from the collection for its kind, narrowed to this circle; a category the
 * circle invented draws from the posts that name it. Nothing here counts
 * anything — the numbers on the tiles come from the server, which works them out
 * from the posts each time.
 *
 * Where a share sits is what its filing says, not what kind of thing it is. A
 * member who filed the Rathotsava recording under Events wanted it in Events, so a
 * category the circle invented shows the built-in shares filed into it alongside
 * its own posts, and Songs stops showing the ones that went elsewhere. A null in
 * the filing is the ordinary case and means "wherever this kind belongs", which is
 * what every share said before any of this could be asked.
 */
export function categoryEntries(
  store: ShareAndLearn,
  circleId: number,
  category: CircleCategory,
): FeedEntry[] {
  // Filed here on purpose, or filed nowhere in particular and this is where the
  // kind of thing lives anyway.
  const belongs = (row: { circleIds: number[]; filings?: CircleFiling[] }) => {
    if (!row.circleIds.includes(circleId)) return false;
    const filed = categoryIn(row, circleId);
    return filed === null ? category.itemType !== null : filed === category.id;
  };
  const here = <T extends { circleIds: number[]; filings?: CircleFiling[] }>(rows: T[]) =>
    rows.filter(belongs);

  // A category the circle invented holds its own posts, plus whatever was filed
  // into it from elsewhere — the same rows Songs or Recipes would otherwise show.
  const filedIntoCustom = (): FeedEntry[] => [
    ...here(store.songs).map(songEntry),
    ...here(store.recipes).map(recipeEntry),
    ...here(store.facts).map(factEntry),
    ...here(store.words).map(wordEntry),
    ...here(store.books).map(bookEntry),
    ...here(store.remedies).map(remedyEntry),
    ...here(store.bookmarks).map(bookmarkEntry),
  ];

  const entries: FeedEntry[] =
    category.itemType === "song"
      ? here(store.songs).map(songEntry)
      : category.itemType === "recipe"
        ? here(store.recipes).map(recipeEntry)
        : category.itemType === "fact"
          ? here(store.facts).map(factEntry)
          : category.itemType === "word"
            ? here(store.words).map(wordEntry)
            : category.itemType === "book"
              ? here(store.books).map(bookEntry)
              : category.itemType === "remedy"
                ? here(store.remedies).map(remedyEntry)
                : category.itemType === "bookmark"
                  ? here(store.bookmarks).map(bookmarkEntry)
                  : [
                      ...store.posts
                        .filter((post) => post.categoryId === category.id)
                        .map((post) => postEntry(post, category)),
                      ...filedIntoCustom(),
                    ];

  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * What a circle is for, as a grid of tiles, and it holds exactly what the circle
 * can actually be used for: the categories that are switched on, for a keeper
 * every bit as much as for a plain member. A hidden category is not drawn here at
 * all — not as a faded tile and not with a badge on it — because this grid is the
 * way into a category and there is nothing to go into. Nothing is lost by the
 * omission: the category, its posts and its shelves are all still there, and
 * `CategoryManager` behind the "Manage" link is where a keeper reads the hidden
 * ones and shows them again.
 *
 * A visitor's shop window renders the same grid with no counts and nothing to
 * manage — hence the two optional props. Counts are never worked out here either
 * way: the number on a tile is the one the server sent.
 */
export function CategoryGrid({
  categories,
  canManage,
  title = "What this circle is for",
  showCounts = true,
  emptyNote = "This circle has not decided what it holds yet.",
  action,
  onOpen,
  onManage,
}: {
  categories: CircleCategory[];
  canManage: boolean;
  /**
   * Null draws no heading at all, which is what the visitor's window does: the
   * circle is already named above the tiles, and saying it again over them was
   * the same sentence twice on one screen.
   */
  title?: string | null;
  showCounts?: boolean;
  emptyNote?: string;
  /** One quiet link on the heading row, for a caller with somewhere else to go. */
  action?: { label: string; onClick: () => void };
  onOpen: (categoryId: number) => void;
  onManage?: () => void;
}) {
  const list = sortedCategories(categories).filter((category) => !category.hidden);
  /*
   * "Manage" rather than "Manage categories": it sits on the heading that has
   * just said the word, where the longer label was the same noun twice and the
   * one that wrapped the row on a phone. It is a keeper's alone — a plain member
   * has no such link — and it stays here, beside the tiles it is about, rather
   * than moving into the circle's own ⋯ menu, which is about the circle.
   */
  const manage = canManage && onManage ? { label: "Manage", onClick: onManage } : null;
  const aside = manage ?? action ?? null;

  return (
    <section className="circle-section">
      {(title || aside) && (
        <div className={title ? "section-head" : "section-head section-head-bare"}>
          {title && <h2 className="section-title">{title}</h2>}
          {aside && (
            <button className="btn-text" onClick={aside.onClick}>
              {aside.label}
            </button>
          )}
        </div>
      )}
      {list.length === 0 ? (
        <p className="muted">{emptyNote}</p>
      ) : (
        <ul className="category-grid">
          {list.map((category) => (
            <li key={category.id}>
              <button className="category-tile" onClick={() => onOpen(category.id)}>
                <span className="category-tile-icon" aria-hidden="true">
                  {category.icon}
                </span>
                <span className="category-tile-name">{category.name}</span>
                {showCounts && (
                  <span className="category-tile-count">{entryCount(category.count)}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * One category of one circle: its shelves with their counts, and the posts on the
 * shelf being looked at. `shelf` is a subcategory id, "none" for the things
 * nobody filed, or null for everything in the category at once.
 */
export function CategoryPage({
  store,
  userId,
  circle,
  category,
  categories,
  shelf,
  canManage,
  canContribute,
  onBack,
  onOpenShelf,
  onShareInto,
  onOpenEntry,
}: {
  store: ShareAndLearn;
  userId: string;
  circle: Circle;
  category: CircleCategory;
  categories: CircleCategory[];
  shelf: string | null;
  canManage: boolean;
  /**
   * Whether this member may add to the category at all — a circle's page is
   * readable by somebody who has only come to look, and an Add button that
   * answers with a refusal is worse than no button. The server refuses them
   * either way, so this is a courtesy rather than the check.
   */
  canContribute: boolean;
  onBack: () => void;
  onOpenShelf: (shelf: string | undefined) => void;
  onShareInto: (flow: ShareFlow) => void;
  onOpenEntry: (entry: FeedEntry) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [writing, setWriting] = useState(false);
  /**
   * Reading the listing rather than looking around from here. A node with children
   * leads with what has just arrived; "View all" is how a reader says they want the
   * whole thing, and it is the same page with the search box and the sort on it.
   * A node with no children is a listing already and needs no asking.
   */
  const [viewAll, setViewAll] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ShelfSort>("newest");
  /**
   * Adding to a custom category opens its form here rather than through the
   * shell's share flows, so the guidelines are asked for here too — the tick is
   * wanted before the first post of any kind, and the server refuses either way.
   */
  const guidelines = useGuidelinesGate(store);

  /**
   * The tree, and where in it the reader is standing. `shelf` is a subcategory id,
   * "none" for the things nobody filed, or null for the top of the category. A
   * member's copy has already had the hidden branches taken out of it by the
   * server; a manager's has them and marks them.
   */
  const nodes = category.subcategories;
  const chosen = shelf === null ? null : shelf === "none" ? "none" : Number(shelf);
  const here = typeof chosen === "number" ? shelfById(nodes, chosen) : null;

  /**
   * Walking somewhere else is arriving at a new place, so it arrives in the state
   * every place starts in: looking around, nothing typed, newest first. Carrying a
   * search from Bookmarks into Stotras would filter a listing the reader never
   * asked a question about.
   */
  useEffect(() => {
    setViewAll(false);
    setQuery("");
    setSort("newest");
  }, [shelf, category.id, circle.id]);

  /**
   * The nodes directly beneath where the reader is standing, and nothing else. The
   * page used to draw the whole tree flat, which put "Aradhane", "Aradhane ›
   * Bookmarks" and "Aradhane › Songs" side by side as three equal chips and made
   * the parent look like a peer of its own children. One level at a time is what
   * the tree actually says, so a child is entered rather than jumped to, and its
   * own name is enough on the chip because the trail above says where it sits.
   */
  const children = useMemo(
    () =>
      chosen === "none"
        ? []
        : childShelves(nodes, typeof chosen === "number" ? chosen : null).filter(
            (row) => canManage || !row.hidden,
          ),
    [nodes, chosen, canManage],
  );

  /**
   * The path from the category down to where the reader is, as steps they can tap
   * to walk back up. `path` on a node is names alone, so the ids come from walking
   * `parentId` — the guard is the same one `shelfHidden()` keeps, since a bad
   * `PATCH` that made a cycle should cost a breadcrumb rather than the page.
   */
  const trail = useMemo(() => {
    if (chosen === "none") return [{ shelf: "none", label: "Everything else" }];
    // A link to a node that has since been renamed away, deleted or hidden: say
    // so as the last step rather than quietly claiming to be at the top.
    if (typeof chosen === "number" && !here) {
      return [{ shelf: String(chosen), label: "That subcategory" }];
    }
    const chain: { shelf: string; label: string }[] = [];
    const seen = new Set<number>();
    let node = here;
    while (node && !seen.has(node.id)) {
      seen.add(node.id);
      chain.unshift({ shelf: String(node.id), label: node.name });
      node = shelfById(nodes, node.parentId);
    }
    return chain;
  }, [nodes, here, chosen]);

  /**
   * Opening a node shows its branch rather than only what is filed on it exactly,
   * because a share may be attached at any level: Vegetarian holds the things
   * filed under Vegetarian and everything below it, which is what its count says.
   */
  const branch = useMemo(
    () => (typeof chosen === "number" ? shelfBranchIds(nodes, chosen) : []),
    [nodes, chosen],
  );

  const entries = useMemo(() => {
    const all = categoryEntries(store, circle.id, category);
    if (chosen === null) return all;
    return all.filter((entry) => {
      const filing = filedIn(entry, circle.id);
      if (chosen === "none") return filing === null;
      return filing !== null && branch.includes(filing);
    });
  }, [store, circle.id, category, chosen, branch]);

  /**
   * Where the reader is standing, written the way a row writes where a share sits,
   * so a row can leave off the part the breadcrumb above the list has already said.
   * The unfiled bucket is not a place in the tree, so it has no path below the
   * category itself.
   */
  const baseTrail = useMemo(
    () =>
      typeof chosen === "number" && here
        ? [category.name, ...trail.map((step) => step.label)]
        : [category.name],
    [category.name, chosen, here, trail],
  );

  /** The listing itself, once somebody is reading it: what they searched for, in the order they asked for. */
  const listed = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const found = needle
      ? entries.filter((entry) =>
          [entry.title, entry.detail, entry.memberName, entry.kind]
            .filter(Boolean)
            .some((field) => (field as string).toLowerCase().includes(needle)),
        )
      : entries;
    const order = [...found];
    order.sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "title-reverse") return b.title.localeCompare(a.title);
      if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
      return b.createdAt.localeCompare(a.createdAt);
    });
    return order;
  }, [entries, query, sort]);

  /**
   * Word Explorer reads the words themselves rather than feed rows: it shows a
   * word's synonyms, its language connections and everything else a feed line
   * has no room for. Narrowed the same way the rows are — this circle, this shelf.
   */
  const wordsHere = useMemo(() => {
    if (category.itemType !== "word") return [];
    return store.words
      .filter((word) => word.circleIds.includes(circle.id))
      .filter((word) => {
        if (chosen === null) return true;
        const filing = filedIn(word, circle.id);
        if (chosen === "none") return filing === null;
        return filing !== null && branch.includes(filing);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [store.words, circle.id, category.itemType, chosen, branch]);

  /**
   * What the listing beneath the navigation calls itself. The node's own name is
   * enough now that the trail above it prints the whole path, and repeating
   * "Events › Aradhane › Songs" twice on one screen said it twice.
   */
  const shelfLabel =
    chosen === null
      ? null
      : chosen === "none"
        ? "Everything else"
        : (here?.name ?? "That subcategory");

  /**
   * The chips under the trail: one per immediate child, and — only at the top of
   * the category — the unfiled bucket, which is a question about the whole category
   * rather than about a node.
   *
   * There is no "Everything" chip. The listing under these chips is already
   * everything filed here and below, so a chip that led to the page it was drawn on
   * was a way of standing still, and it took the eye first on every landing page a
   * reader was meant to be browsing.
   *
   * A child's count is exact where it is a leaf and its whole branch's where it
   * has children, so a parent never reads as emptier than what is inside it.
   */
  const navChips = [
    ...children.map((row) => (
      <button
        key={row.id}
        className="chip-button"
        onClick={() => onOpenShelf(String(row.id))}
      >
        {row.name} ({row.childCount > 0 ? row.totalCount : row.count})
        {row.hidden && <span className="tag">Hidden</span>}
        {/* A node with children goes somewhere; a leaf is where the walk ends. */}
        {row.childCount > 0 && (
          <span className="chip-into" aria-hidden="true">
            {PATH_SEPARATOR}
          </span>
        )}
      </button>
    )),
    ...(chosen === null && category.uncategorizedCount > 0
      ? [
          <button key="none" className="chip-button" onClick={() => onOpenShelf("none")}>
            Everything else ({category.uncategorizedCount})
          </button>,
        ]
      : []),
  ];

  /**
   * A place to look around from, or a list to read. A node with children is the
   * first: it offers the children and the handful of things that have just arrived
   * anywhere below it, and the whole listing is one tap away. A node with no
   * children is only ever the second, so it goes straight to the listing with the
   * search box and the sort on it — there is nothing to browse into.
   */
  const hasChildren = children.length > 0;
  const recent = entries.slice(0, RECENT_LIMIT);
  /**
   * Reading the whole listing rather than glancing at the newest of it. A node with
   * nothing under it is always this, having nothing to browse into. On a landing
   * page it is what the reader asked for — by tapping "View all", or by typing in
   * the search box or changing the sort, both of which are questions about the whole
   * list and would be answered wrongly by a truncated one: the five newest sorted
   * A–Z is neither the newest five nor the first five alphabetically.
   */
  const browsing = !hasChildren || viewAll || query.trim() !== "" || sort !== "newest";

  /**
   * Adding to this category, which is one action however the category is made: a
   * built-in kind opens the shell's own form for it, and a category the circle
   * invented opens `PostModal` behind the guidelines tick. Word Explorer is the
   * one category left out, because its own listing carries "+ Add Word".
   *
   * It sits on the line of the listing's heading rather than in the page header,
   * and is worded twice and shown once, the same pair every other heading in the
   * app uses: "+ Add a book" where there is room for the words, "+ Add" on a
   * phone. A big primary button in a header holding a back link, an icon, a title
   * and a count is the first thing to go off the side of a 320px screen.
   */
  const flow = category.itemType ? (shareFlows(category.itemType)[0] ?? null) : null;
  const addLabel = flow ? flow.label : `+ Add to ${category.name}`;
  const mayAdd =
    canContribute && category.itemType !== "word" && (category.itemType === null || flow !== null);

  function addHere() {
    if (flow) {
      onShareInto(flow.flow);
      return;
    }
    guidelines.guard(() => setWriting(true));
  }

  return (
    <>
      <button className="btn-text back-link" onClick={onBack}>
        ← {circle.icon} {circle.name}
      </button>

      <header className="category-header">
        <span className="circle-icon circle-icon-large" aria-hidden="true">
          {category.icon}
        </span>
        <div className="circle-header-text">
          <h1 className="tab-title">{category.name}</h1>
          {/* The count and nothing else. The back link directly above already
              names the circle, so "2 entries in Discover" said it twice and cost
              the header a line it does not have on a phone. */}
          <p className="circle-meta">
            {entryCount(category.count)}
            {category.hidden && <span className="tag">Hidden</span>}
          </p>
        </div>
      </header>

      <ErrorLine message={error} />

      {/*
        Walking the tree, directly under the category's own header because it is
        the first question a reader has about a category: what is in here. The
        trail says where they are standing and every step of it goes back up, and
        the chips under it are the immediate children and nothing deeper. A level
        with no children draws no chips at all rather than an empty row — the
        trail is still there, because otherwise a reader who walked three levels
        down would have no way back.

        The section is drawn when there is somewhere to go, when the reader is
        standing below the top (and so needs the trail), or for a manager, whose
        way into the tree itself is the action on its heading.
      */}
      {(navChips.length > 0 || chosen !== null || canManage) && (
        <section className="circle-section">
          {/*
            "Subcategories", and the manager's own way into the tree beside it —
            worded where there is room for the words and cut to "Manage" on a
            phone, which is the pair used everywhere else and reads plainly enough
            next to the heading it belongs to. A plain member sees the heading and
            no action, the server refusing them either way.
          */}
          <div className="section-head section-head-inline">
            <h2 className="section-title">Subcategories</h2>
            {canManage && (
              <div className="section-head-actions">
                <button
                  className="btn-text tab-header-wide-action"
                  onClick={() => setManaging((open) => !open)}
                >
                  {managing ? "Done" : "Manage subcategories"}
                </button>
                <button
                  className="btn-text section-head-narrow-action"
                  onClick={() => setManaging((open) => !open)}
                >
                  {managing ? "Done" : "Manage"}
                </button>
              </div>
            )}
          </div>

          {/*
            Where the reader is, and the way back up. It is drawn only below the
            top level: standing at the top, every step of it is the category's own
            name, which the page title two lines above has already said.
          */}
          {chosen !== null && (
            <div className="shelf-trail-head">
              <nav className="shelf-trail" aria-label={`Where you are in ${category.name}`}>
                <button className="shelf-trail-step" onClick={() => onOpenShelf(undefined)}>
                  {category.name}
                </button>
                {trail.map((step, index) =>
                  index === trail.length - 1 ? (
                    <span key={step.shelf} className="shelf-trail-here" aria-current="page">
                      <span className="shelf-trail-sep" aria-hidden="true">
                        {PATH_SEPARATOR}
                      </span>
                      {step.label}
                    </span>
                  ) : (
                    <span key={step.shelf} className="shelf-trail-link">
                      <span className="shelf-trail-sep" aria-hidden="true">
                        {PATH_SEPARATOR}
                      </span>
                      <button
                        className="shelf-trail-step"
                        onClick={() => onOpenShelf(step.shelf)}
                      >
                        {step.label}
                      </button>
                    </span>
                  ),
                )}
              </nav>
            </div>
          )}

          {/*
            One level of the tree, wrapping across as many rows as it takes. "All"
            comes first and is the state the page is already in — tapping a child
            navigates, so nothing else here is ever the selected one — and what it
            counts is everything filed here and below, which is exactly the list
            underneath. So it is a selected pill rather than a chip that leads
            somewhere, and tapping it opens that list in full: on a landing page
            showing the newest five, "All (2)" is the honest way to ask for all of
            them.
          */}
          {navChips.length > 0 && (
            <div
              className="shelf-chips shelf-chips-wrap"
              role="group"
              aria-label={`Narrow ${category.name} by subcategory`}
            >
              <button
                type="button"
                className="chip-button chip-active"
                aria-pressed={true}
                onClick={() => setViewAll(true)}
              >
                All ({entries.length})
              </button>
              {navChips}
            </div>
          )}
          {/*
            A node with nothing under it says nothing about it. "Nothing sits under
            Bookmarks yet." was drawn on a page whose whole job was to list the
            bookmarks, and it read as though the page were empty when it was full.
            The one place the absence is worth mentioning is the top of a category a
            manager could give a tree to, and only to them.
          */}
          {canManage && chosen === null && !hasChildren && (
            <p className="muted">
              No subcategories yet. Add one from the share form, or from Manage
              subcategories, and it stays here for next time.
            </p>
          )}
        </section>
      )}

      {canManage && managing && (
        <TaxonomyManager
          store={store}
          circleId={circle.id}
          category={category}
          onClose={() => setManaging(false)}
        />
      )}

      {category.itemType === "word" ? (
        <WordExplorer
          store={store}
          userId={userId}
          words={wordsHere}
          onAddWord={canContribute ? () => onShareInto("word") : null}
          emptyTitle={chosen === null ? "No words here yet" : "Nothing is filed here yet"}
          emptyHint={
            chosen === null
              ? `Add the first word to ${circle.name}.`
              : "Words filed on this shelf will show up here."
          }
        />
      ) : (
        <section className="circle-section">
          <div className="section-head section-head-inline">
            {/*
              What this listing is: the newest few from here down, or the whole of
              it. The node's own name is enough either way, because the trail above
              has already printed the path to it.
            */}
            <h2 className="section-title">
              {browsing
                ? (shelfLabel ?? `Everything in ${category.name}`)
                : "Recent uploads"}
            </h2>
            <div className="section-head-actions">
              {/* Back to looking around, for a reader who opened the whole list and
                  would rather have the children in front of them again. It clears the
                  search and the sort too, those being the other two ways in. */}
              {hasChildren && browsing && (
                <button
                  className="btn-text"
                  onClick={() => {
                    setViewAll(false);
                    setQuery("");
                    setSort("newest");
                  }}
                >
                  Show recent only
                </button>
              )}
              {/*
                What the form behind that Add button asks, changed without opening
                it. A keeper's door and nobody else's — the button draws itself
                only for the circle's owner, its admins and the app admin, and only
                on a category that can be asked anything at all — so it needs no
                condition here.
              */}
              <ManageFieldsButton
                store={store}
                category={category}
                className="btn-text"
                label="Manage fields"
              />
              {/* Adding to the category, on the line of the list it adds to. Two
                  shapes, one on screen: the words where there is room for them and
                  a chip on a phone. */}
              {mayAdd && (
                <>
                  <button className="btn btn-primary tab-header-wide-action" onClick={addHere}>
                    {addLabel}
                  </button>
                  <button
                    className="chip-button chip-strong section-head-narrow-action"
                    onClick={addHere}
                  >
                    + Add
                  </button>
                </>
              )}
            </div>
          </div>

          {/* One button stands where "Record one" and "Upload a file" used to, so
              something has to say what is behind it — including the way in neither
              of them offered. It follows the button rather than sitting at the top
              of the page, there being no point explaining a control three
              paragraphs above it, and it is for the people who can use it. */}
          {category.itemType === "song" && mayAdd && (
            <p className="tab-note">{ADD_A_SONG_NOTE}</p>
          )}

          {/* Standing on a node shows its branch, so say so rather than leave a
              reader wondering why a Stotras entry is listed under Songs. */}
          {hasChildren && chosen !== null && (
            <p className="muted">Everything filed under {here?.name ?? "here"}, at any depth.</p>
          )}

          {/*
            Searching and sorting are on offer at every level, because a reader who
            knows what they are looking for should not have to walk to it. Using
            either one is itself a way of saying "the whole list, please", so both of
            them turn a landing page into the listing rather than filtering the five
            rows underneath them.
          */}
          {entries.length > 0 && (
            <div className="feed-controls">
              <SearchField
                value={query}
                onChange={setQuery}
                placeholder={`Search ${(shelfLabel ?? category.name).toLowerCase()}…`}
              />
              <label className="feed-sort">
                <span>Sort</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as ShelfSort)}>
                  {SHELF_SORTS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {entries.length === 0 ? (
            <EmptyState glyph="◦" title="Nothing here yet">
              {chosen === null
                ? "Be the first to add something."
                : "Nothing is filed here yet."}
            </EmptyState>
          ) : browsing && listed.length === 0 ? (
            <EmptyState glyph="◦" title="Nothing matches">
              <button className="btn-text" onClick={() => setQuery("")}>
                Clear the search
              </button>
            </EmptyState>
          ) : (
            <>
              <CircleFeedList
                entries={browsing ? listed : recent}
                categories={categories}
                circleId={circle.id}
                store={store}
                userId={userId}
                trailBase={baseTrail}
                onOpenEntry={onOpenEntry}
                onError={setError}
              />
              {/* One quiet way on, and only when there is actually more to see. */}
              {!browsing && entries.length > recent.length && (
                <p className="shelf-view-all">
                  <button className="btn-text" onClick={() => setViewAll(true)}>
                    View all {entryCount(entries.length)} →
                  </button>
                </p>
              )}
            </>
          )}
        </section>
      )}

      {guidelines.gate}

      {writing && (
        <PostModal
          category={category}
          onClose={() => setWriting(false)}
          onSave={async (values) => {
            await store.addPost(values);
            setWriting(false);
          }}
        />
      )}
    </>
  );
}

/**
 * A feed inside one circle. The only thing it knows that a cross-circle feed
 * could not is the shelf each row sits on here, which is a property of the circle
 * rather than of the post.
 */
export function CircleFeedList({
  entries,
  categories,
  circleId,
  store,
  userId,
  trailBase,
  throughFolder = false,
  onOpenEntry,
  onError,
}: {
  entries: FeedEntry[];
  categories: CircleCategory[];
  circleId: number;
  store: ShareAndLearn;
  userId: string;
  /**
   * Where the reader already is, as a path — "Songs › Thursday Bhajane ›
   * Bookmarks". A row leaves that part of its own trail off, since the breadcrumb
   * above the list has said it once already and saying it again on every row is
   * the same sentence twenty times. Left out on a circle's own feed, where there is
   * no one place the reader is standing and the whole path is what tells rows apart.
   */
  trailBase?: string[];
  /**
   * Whether the list is being read through one of the circle's folders. A folder
   * and a category's shelves are two different trees, so the breadcrumb above a
   * folder page says where the share is and the old category trail says nothing
   * the row does not already say — a bookmark in Thursday Bhajane read as
   * "BOOKMARK · Bookmarks", which is the kind of thing twice. So the folder
   * breadcrumb tells the reader where, the content type tells them what, and the
   * filing badge is left off entirely.
   */
  throughFolder?: boolean;
  onOpenEntry: (entry: FeedEntry) => void;
  onError: (message: string | null) => void;
}) {
  const [playing, setPlaying] = useState<number | null>(null);
  // Keyed by entry rather than by id, because a post and a word can share a
  // number and both of them now open in place.
  const [reading, setReading] = useState<string | null>(null);
  const [editing, setEditing] = useState<Post | null>(null);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const postById = useMemo(
    () => new Map(store.posts.map((post) => [post.id, post])),
    [store.posts],
  );
  // A song row carries its words, so it needs the song itself rather than the
  // feed's summary of it.
  const songById = useMemo(
    () => new Map(store.songs.map((song) => [song.id, song])),
    [store.songs],
  );
  // A bookmark has no tab of its own — the whole of it is a link and a name — so
  // this row is the only place its author can change or delete it.
  const bookmarkById = useMemo(
    () => new Map(store.bookmarks.map((bookmark) => [bookmark.id, bookmark])),
    [store.bookmarks],
  );
  // A book row carries the conversation about it, the same way a song row carries
  // the words, so it needs the book rather than the feed's summary of it.
  const bookById = useMemo(
    () => new Map(store.books.map((book) => [book.id, book])),
    [store.books],
  );

  function save(entry: FeedEntry) {
    store
      .toggleSave(entry.itemType, entry.id)
      .catch((err) => onError(err instanceof Error ? err.message : "That could not be saved."));
  }

  return (
    <>
      <ul className="feed">
        {entries.map((entry) => {
          /**
           * The whole trail rather than the shelf alone, so a row reads
           * "Recipes › Vegetarian › South Indian › Karnataka" and a reader can
           * see where a share sits without opening the category. It is left off
           * when it would only repeat the kind — an unfiled song under Songs —
           * and shown whenever the filing says something the row does not: a
           * node anywhere down the tree, or a category this circle invented.
           */
          const full = throughFolder ? [] : entryBreadcrumb(categories, entry, circleId);
          const trail = trailBase ? trailBelow(full, trailBase) : full;
          const shelf = throughFolder
            ? // Read through a folder, the row's where is the breadcrumb above the
              // list: the category trail would only repeat the kind of thing.
              null
            : trailBase
              ? // Inside one place, a row says only what sets it apart from the row
                // above it: nothing when it is filed exactly here, and the steps
                // below when it came from further down the branch.
                trail.length > 0
                ? pathText(trail)
                : null
              : trail.length > 1 || categoryIn(entry, circleId) !== null
                ? pathText(trail)
                : null;
          const post = entry.itemType === "post" ? (postById.get(entry.id) ?? null) : null;
          const song = entry.itemType === "song" ? (songById.get(entry.id) ?? null) : null;
          const bookmark =
            entry.itemType === "bookmark" ? (bookmarkById.get(entry.id) ?? null) : null;
          const book = entry.itemType === "book" ? (bookById.get(entry.id) ?? null) : null;
          /**
           * What the group has said about this row, if its kind can be said anything
           * about. Keyed on the kind rather than written per kind, so a third
           * discussable thing is one more line here and nothing else — the bug this
           * replaced was a feed that drew the conversation for no kind at all, which
           * left a recording's discussions unreachable from the circle it was shared
           * in, a song's row opening the player rather than a page.
           */
          const discussed: { itemType: DiscussionItemType; item: Song | Book } | null = song
            ? { itemType: "song", item: song }
            : book
              ? { itemType: "book", item: book }
              : null;
          // The author, a keeper of this circle, or the app admin: the same test the
          // server makes before it lets an edit or a delete through, asked of whichever
          // kind of thing this row is.
          const managePost = post ? canManageShare(store, userId, post) : false;
          const manageSong = song ? canManageShare(store, userId, song) : false;
          const manageBookmark = bookmark ? canManageShare(store, userId, bookmark) : false;
          const action = entryAction(entry);
          const open = action === "play" ? playing === entry.id : reading === entry.key;
          return (
            <li className="feed-row" key={entry.key}>
              <span className="feed-glyph" aria-hidden="true">
                {entry.glyph}
              </span>
              <div className="feed-body">
                <p className="feed-kind">
                  {entry.kind}
                  {shelf && <span className="tag">{shelf}</span>}
                  <PrivateTag visibility={entry.visibility} />
                </p>
                <p className="feed-title">{entry.title}</p>
                {entry.detail && !open && <p className="feed-detail">{entry.detail}</p>}
                <PhotoGallery photos={entry.photos} title={entry.title} compact />
                {action === "read" && open && (
                  <EntryDetail entry={entry} store={store} userId={userId} onError={onError} />
                )}
                <p className="byline">
                  Shared by {entry.memberName} · {formatDate(entry.createdAt)}
                </p>
                {entry.itemType === "song" && playing === entry.id && (
                  <audio
                    controls
                    autoPlay
                    className="card-audio"
                    src={audioUrl(entry.id, entry.audioKey)}
                    onError={() => onError("That recording could not be played.")}
                  />
                )}
                {/* The words, behind their own Details link — which is also how a
                    song shared as words alone is read at all, since there is
                    nothing to play and so no button in the row. */}
                {song && <SongLyrics song={song} store={store} canEdit={manageSong} />}
                {/* And what the group said back, behind its own line for the same
                    reason: the row's detail line has already counted the questions,
                    and this is the way to read them without leaving the circle. */}
                {discussed && (
                  <ItemDiscussions
                    itemType={discussed.itemType}
                    item={discussed.item}
                    userId={userId}
                    store={store}
                    onError={(err) =>
                      onError(
                        err instanceof Error ? err.message : "That discussion could not be opened.",
                      )
                    }
                  />
                )}
              </div>
              <div className="feed-actions">
                {action === "play" && (
                  <EntryActionButton
                    action={action}
                    open={open}
                    onClick={() => setPlaying(open ? null : entry.id)}
                  />
                )}
                {action === "read" && (
                  <EntryActionButton
                    action={action}
                    open={open}
                    onClick={() => setReading(open ? null : entry.key)}
                  />
                )}
                {action === "open" && (
                  <EntryActionButton action={action} open={open} onClick={() => onOpenEntry(entry)} />
                )}
                {action === "visit" && (
                  <EntryActionButton action={action} open={open} href={entry.href} />
                )}
                {/* Straight after whatever this row's own action is, because
                    passing something on is the second thing a reader wants to do
                    with it. It is the only Share a bookmark or a post has, those
                    two having no page of their own to carry one. */}
                <ShareLinkButton
                  itemType={entry.itemType}
                  itemId={entry.id}
                  name={entry.title}
                  blurb={`${entry.memberName} shared “${entry.title}” on Share & Learn.`}
                  circleId={circleId}
                />
                <SaveButton
                  saved={store.savedKeys.has(entry.key)}
                  canSave
                  onToggle={() => save(entry)}
                />
                <PostActions
                  store={store}
                  userId={userId}
                  itemType={entry.itemType}
                  item={entry}
                  circleId={circleId}
                />
                {/* Where a share sits, changed from the share itself. Every kind
                    of thing is in a folder the same way, so this is one control
                    for all eight rather than something bolted onto the three
                    that happen to have an edit button on this row — and it
                    decides for itself whether to appear, so a circle with no
                    folders and a reader who may not manage this share both see
                    nothing. */}
                <MoveToFolderButton
                  store={store}
                  userId={userId}
                  circleId={circleId}
                  item={entry}
                  onError={onError}
                />
                {post && managePost && (
                  <OwnerActions
                    onEdit={() => setEditing(post)}
                    busy={busy === `post:${post.id}`}
                    confirmNote={deleteNote(post.memberId === userId, "post", post.memberName)}
                    onDelete={() => {
                      setBusy(`post:${post.id}`);
                      store
                        .removePost(post.id)
                        .catch((err) =>
                          onError(err instanceof Error ? err.message : "That could not be removed."),
                        )
                        .finally(() => setBusy(null));
                    }}
                  />
                )}
                {bookmark && manageBookmark && (
                  <OwnerActions
                    onEdit={() => setEditingBookmark(bookmark)}
                    busy={busy === `bookmark:${bookmark.id}`}
                    confirmNote={deleteNote(
                      bookmark.memberId === userId,
                      "bookmark",
                      bookmark.memberName,
                    )}
                    onDelete={() => {
                      setBusy(`bookmark:${bookmark.id}`);
                      store
                        .removeBookmark(bookmark.id)
                        .catch((err) =>
                          onError(err instanceof Error ? err.message : "That could not be removed."),
                        )
                        .finally(() => setBusy(null));
                    }}
                  />
                )}
                {song && manageSong && (
                  <OwnerActions
                    onEdit={() => setEditingSong(song)}
                    busy={busy === `song:${song.id}`}
                    confirmNote={deleteNote(song.memberId === userId, "song", song.memberName)}
                    onDelete={() => {
                      setBusy(`song:${song.id}`);
                      store
                        .removeSong(song.id)
                        .catch((err) =>
                          onError(err instanceof Error ? err.message : "That could not be removed."),
                        )
                        .finally(() => setBusy(null));
                    }}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {editing && store.categoryById.get(editing.categoryId) && (
        <PostModal
          category={store.categoryById.get(editing.categoryId) as CircleCategory}
          post={editing}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            await store.editPost(editing.id, values);
            setEditing(null);
          }}
        />
      )}
      {editingSong && (
        <SongModal
          song={editingSong}
          store={store}
          userId={userId}
          circles={store.circles}
          categories={store.categories}
          onClose={() => setEditingSong(null)}
          onSaved={() => setEditingSong(null)}
        />
      )}
      {editingBookmark && (
        <BookmarkModal
          bookmark={editingBookmark}
          circles={store.circles}
          categories={store.categories}
          onClose={() => setEditingBookmark(null)}
          onSave={async (values) => {
            await store.editBookmark(editingBookmark.id, values);
            setEditingBookmark(null);
          }}
        />
      )}
    </>
  );
}

/**
 * A manager's view of the list itself: renaming, reordering, hiding a category,
 * and — for one the circle invented and has already been hidden — removing it.
 * Hiding is the ordinary move and it is reversible; removal asks what should
 * happen to the posts, and never destroys one.
 *
 * It is also the only place a hidden category can be read at all, the circle page
 * itself now showing only what its members can use, so this list deliberately
 * holds every category the circle has — the hidden ones marked as such and
 * offering "Show". The word is Hide rather than Disable for the same reason: the
 * category comes off the circle page and nothing about it is switched off.
 */
export function CategoryManager({
  store,
  circleId,
  categories,
  onClose,
}: {
  store: ShareAndLearn;
  circleId: number;
  categories: CircleCategory[];
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftIcon, setDraftIcon] = useState(DEFAULT_CATEGORY_ICON);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState(DEFAULT_CATEGORY_ICON);
  const [removing, setRemoving] = useState<CircleCategory | null>(null);
  const [moveTo, setMoveTo] = useState<string>("release");
  /**
   * The category whose form is being reshaped, if any. Managing the questions a
   * category asks is a different job from managing the categories themselves, so
   * it opens over this panel rather than inside it — and this is the door a keeper
   * of any circle can actually reach, the per-type tab headers being the other one.
   */
  const [fieldsFor, setFieldsFor] = useState<CircleCategory | null>(null);

  const list = sortedCategories(categories);
  const missing = BUILT_IN_CATEGORIES.filter(
    (builtIn) => !list.some((category) => category.itemType === builtIn.itemType),
  );

  function run(key: string, action: Promise<unknown>, after?: () => void) {
    setBusy(key);
    setError(null);
    action
      .then(() => after?.())
      .catch((err) => setError(err instanceof Error ? err.message : "That did not work."))
      .finally(() => setBusy(null));
  }

  function move(category: CircleCategory, delta: number) {
    const order = list.map((row) => row.id);
    const at = order.indexOf(category.id);
    const to = at + delta;
    if (to < 0 || to >= order.length) return;
    [order[at], order[to]] = [order[to], order[at]];
    run(`order:${category.id}`, store.reorderCategories(circleId, order));
  }

  function startRename(category: CircleCategory) {
    setRenaming(category.id);
    setDraftName(category.name);
    setDraftIcon(category.icon);
  }

  function addOwnCategory() {
    const name = newName.trim();
    if (!name) return;
    const clash = list.find((category) => normalizeName(category.name) === normalizeName(name));
    if (clash) {
      setError(`This circle already has a category called “${clash.name}”.`);
      return;
    }
    run("add", store.addCategory(circleId, { name, icon: newIcon }), () => {
      setNewName("");
      setNewIcon(DEFAULT_CATEGORY_ICON);
      setAdding(false);
    });
  }

  /** Where the posts in a category being removed can go: this circle's own others. */
  const destinations = removing
    ? list.filter((category) => isCustom(category) && category.id !== removing.id)
    : [];

  /**
   * What the ⋯ holds for one category, and the whole of what a keeper may do to
   * it. It is built from what is actually allowed rather than drawn and disabled,
   * which is what keeps a built-in safe: Songs and Recipes belong to every circle
   * and cannot be deleted at all, so no Delete row exists on one. A category the
   * circle invented gets Delete only once it is hidden — the same two-step the
   * server insists on — and deleting it still asks what becomes of its posts.
   */
  function actionsFor(category: CircleCategory, index: number): SheetAction[] {
    return [
      {
        key: "rename",
        label: "Rename",
        glyph: "✏️",
        onSelect: () => startRename(category),
      },
      // What this category's Add/Edit form asks beyond the questions it ships
      // with — a recipe's Menu type and Dish type among them, those two being the
      // circle's own configurable fields rather than one list handed to every
      // circle. Only the categories that can be asked anything get the row, which
      // `canAddFields()` answers: one the circle invented, or Songs, Books or
      // Recipes. The other three built-ins ask the same questions everywhere.
      ...(canAddFields(store, category)
        ? [
            {
              key: "fields",
              label: "Manage fields",
              glyph: "🧾",
              onSelect: () => setFieldsFor(category),
            } satisfies SheetAction,
          ]
        : []),
      ...moveActions(index, list.length, (delta) => move(category, delta)),
      disableAction(
        category.hidden,
        () =>
          run(
            `hide:${category.id}`,
            store.editCategory(circleId, category.id, { hidden: !category.hidden }),
          ),
        "posts keep",
        { hide: "Hide", show: "Show" },
      ),
      ...(isCustom(category) && category.hidden
        ? [
            deleteAction(() => {
              setRemoving(category);
              setMoveTo("release");
            }),
          ]
        : []),
    ];
  }

  return (
    <section className="circle-section admin-panel">
      <div className="section-head">
        <h2 className="section-title">Categories</h2>
        <button className="btn-text" onClick={onClose}>
          Done
        </button>
      </div>
      <p className="muted">
        Each ⋯ holds <strong>Manage fields</strong> — what that content type's form asks, such as
        the Menu type and Dish type a recipe here should say. Hiding a category takes it off the
        circle page and stops new shares. Nothing is deleted — show it again and everything comes
        back, exactly as it was.
      </p>

      {/* While a delete is being asked about, its refusal belongs on the question
          rather than at the top of a list the keeper has scrolled past. */}
      <ErrorLine message={removing ? null : error} />

      <ul className="manage-list">
        {list.map((category, index) => (
          <ManageRow
            key={category.id}
            name={category.name}
            icon={category.icon}
            tag={category.hidden ? <span className="tag">Hidden</span> : undefined}
            meta={entryCount(category.count)}
            sheetSubtitle={
              isCustom(category)
                ? `This circle's own · ${entryCount(category.count)}`
                : `Built in · ${entryCount(category.count)}`
            }
            busy={busy !== null}
            actions={actionsFor(category, index)}
            editing={
              renaming === category.id ? (
                <>
                  <input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    maxLength={40}
                    aria-label="Category name"
                    autoFocus
                  />
                  <div className="icon-grid">
                    {CATEGORY_ICONS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        className={
                          icon === draftIcon ? "icon-option icon-option-on" : "icon-option"
                        }
                        onClick={() => setDraftIcon(icon)}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                  <div className="admin-actions">
                    <button
                      className="chip-button chip-strong"
                      disabled={!draftName.trim() || busy === `rename:${category.id}`}
                      onClick={() =>
                        run(
                          `rename:${category.id}`,
                          store.editCategory(circleId, category.id, {
                            name: draftName.trim(),
                            icon: draftIcon,
                          }),
                          () => setRenaming(null),
                        )
                      }
                    >
                      Save
                    </button>
                    <button className="btn-text" onClick={() => setRenaming(null)}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : undefined
            }
          />
        ))}
      </ul>

      {removing && (
        <ManageConfirm
          title={`Delete “${removing.name}”?`}
          error={error}
          confirmLabel="Delete the category"
          busyLabel="Deleting…"
          busy={busy === `remove:${removing.id}`}
          onCancel={() => setRemoving(null)}
          onConfirm={() =>
            run(
              `remove:${removing.id}`,
              store.removeCategory(
                circleId,
                removing.id,
                removing.count === 0
                  ? undefined
                  : moveTo === "release"
                    ? { posts: "release" }
                    : { posts: "move", to: Number(moveTo) },
              ),
              () => setRemoving(null),
            )
          }
        >
          {removing.count > 0 ? (
            <>
              <p>
                {entryCount(removing.count)} {removing.count === 1 ? "is" : "are"} filed here.
                Choose where {removing.count === 1 ? "it goes" : "they go"} — nobody's post is
                deleted either way, and their authors are told what happened.
              </p>
              <div className="field">
                <label>
                  <input
                    type="radio"
                    checked={moveTo === "release"}
                    onChange={() => setMoveTo("release")}
                  />
                  <span>
                    Let them go — each post becomes private to whoever wrote it, and stays in their
                    library.
                  </span>
                </label>
                {destinations.map((destination) => (
                  <label key={destination.id}>
                    <input
                      type="radio"
                      checked={moveTo === String(destination.id)}
                      onChange={() => setMoveTo(String(destination.id))}
                    />
                    <span>
                      Move them into {destination.icon} {destination.name}
                    </span>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <p>Nothing is filed here, so nothing moves.</p>
          )}
        </ManageConfirm>
      )}

      <div className="admin-add">
        {missing.length > 0 && (
          <p className="muted">
            Not in this circle yet:{" "}
            {missing.map((builtIn) => (
              <button
                key={builtIn.itemType}
                className="chip-button"
                disabled={busy === `add:${builtIn.itemType}`}
                onClick={() =>
                  run(
                    `add:${builtIn.itemType}`,
                    store.addCategory(circleId, { itemType: builtIn.itemType }),
                  )
                }
              >
                + {builtIn.icon} {builtIn.name}
              </button>
            ))}
          </p>
        )}

        {adding ? (
          <div className="category-add">
            <label className="field">
              <span>Category name</span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={40}
                autoFocus
              />
              <span className="field-hint">
                It belongs to this circle alone — no other circle sees it.
              </span>
            </label>
            <div className="icon-grid">
              {CATEGORY_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  className={icon === newIcon ? "icon-option icon-option-on" : "icon-option"}
                  onClick={() => setNewIcon(icon)}
                >
                  {icon}
                </button>
              ))}
            </div>
            <div className="admin-actions">
              <button
                className="chip-button chip-strong"
                disabled={!newName.trim() || busy === "add"}
                onClick={addOwnCategory}
              >
                {busy === "add" ? "Adding…" : "Add category"}
              </button>
              <button className="btn-text" onClick={() => setAdding(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn-ghost" onClick={() => setAdding(true)}>
            + Add a category
          </button>
        )}
      </div>

      {/* Deciding what a form asks, over the top of the list it was opened from.
          It reads the fuller copy of the category out of the store itself, so a
          field switched off is still findable here. */}
      {fieldsFor && (
        <ManageFieldsModal
          store={store}
          category={fieldsFor}
          onClose={() => setFieldsFor(null)}
        />
      )}
    </section>
  );
}

/**
 * A manager's view of one category's taxonomy, drawn as the tree it is: every node
 * expandable, and each of them offering the five things that can be done to a node
 * plus the merge that folds two of them together.
 *
 * Nothing here can lose anybody's post, which is what makes a tree safe to tidy.
 * Moving a node takes its whole branch along, because a node names its parent and
 * nothing else. Switching one off takes the branch with it as it is read and
 * changes nothing on the way in, so ticking it back on brings it all back.
 * Merging hands this node's children to the node it goes into. Deleting promotes
 * its children one level and files what was on it where it used to sit — at the
 * top of a category, that is no shelf at all, exactly what deleting a shelf has
 * always done.
 */
function TaxonomyManager({
  store,
  circleId,
  category,
  onClose,
}: {
  store: ShareAndLearn;
  circleId: number;
  category: CircleCategory;
  onClose: () => void;
}) {
  const nodes = category.subcategories;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<number[]>([]);
  const [renaming, setRenaming] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [merging, setMerging] = useState<number | null>(null);
  const [mergeInto, setMergeInto] = useState<string>("");
  const [moving, setMoving] = useState<number | null>(null);
  const [moveUnder, setMoveUnder] = useState<string>("");
  /** Which node the delete question is being asked about, if any. */
  const [removing, setRemoving] = useState<number | null>(null);
  /** Which node the add panel is adding under: a node id, or null for the top. */
  const [addUnder, setAddUnder] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [similar, setSimilar] = useState<{ id: number; name: string; path?: string[] } | null>(
    null,
  );

  const tree = treeOf(nodes);

  /** A node is on screen when nothing above it is folded shut. */
  function shown(node: (typeof nodes)[number]) {
    let parent = shelfById(nodes, node.parentId);
    let guard = 0;
    while (parent && guard < 64) {
      if (collapsed.includes(parent.id)) return false;
      parent = shelfById(nodes, parent.parentId);
      guard += 1;
    }
    return true;
  }

  function toggle(id: number) {
    setCollapsed((prev) => (prev.includes(id) ? prev.filter((row) => row !== id) : [...prev, id]));
  }

  function run(key: string, action: Promise<unknown>, after?: () => void) {
    setBusy(key);
    setError(null);
    action
      .then(() => after?.())
      .catch((err) => setError(err instanceof Error ? err.message : "That did not work."))
      .finally(() => setBusy(null));
  }

  /** Reordering is within one set of siblings: the order of a branch is its own. */
  function move(node: (typeof nodes)[number], delta: number) {
    const siblings = childShelves(nodes, node.parentId ?? null);
    const order = siblings.map((row) => row.id);
    const at = order.indexOf(node.id);
    const to = at + delta;
    if (to < 0 || to >= order.length) return;
    [order[at], order[to]] = [order[to], order[at]];
    run(`order:${node.id}`, store.reorderShelves(circleId, category.id, order));
  }

  /** `confirm` is what turns "did you mean Sweets?" into "make Desserts anyway". */
  async function add(confirm: boolean) {
    const name = newName.trim();
    if (!name) return;
    setBusy("add");
    setError(null);
    try {
      const outcome = await store.addShelf(circleId, category.id, name, addUnder, confirm);
      if (outcome.similar && !outcome.created) {
        setSimilar(outcome.similar);
      } else {
        setSimilar(null);
        setNewName("");
        setAdding(false);
        setNote(
          outcome.created
            ? `Added “${pathText(outcome.created.path ?? [outcome.created.name])}”.`
            : null,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "That subcategory could not be added.");
    } finally {
      setBusy(null);
    }
  }

  /** Where a node may be moved to: anywhere but itself and its own branch. */
  function parentChoices(exclude?: number) {
    const barred = exclude ? shelfBranchIds(nodes, exclude) : [];
    return tree.filter((node) => !barred.includes(node.id));
  }

  const addPath = addUnder === null ? [] : shelfPath([category], addUnder);
  const removingNode = removing === null ? null : (tree.find((row) => row.id === removing) ?? null);

  /**
   * What the ⋯ holds for one node. Everything a keeper could do to a subcategory
   * is here and nothing has been dropped on the way in — the row used to draw all
   * seven of these as chips, which on a phone was a wall of small targets under a
   * name. Move up and move down are among them rather than beside them for the
   * same reason, and they are only offered where they lead somewhere.
   */
  function actionsFor(
    shelf: (typeof tree)[number],
    index: number,
    siblingCount: number,
  ): SheetAction[] {
    return [
      {
        key: "edit",
        label: "Edit",
        glyph: "✏️",
        onSelect: () => {
          setRenaming(shelf.id);
          setDraft(shelf.name);
        },
      },
      {
        key: "child",
        label: "Add child",
        glyph: "➕",
        note: `under ${shelf.name}`,
        onSelect: () => {
          setAddUnder(shelf.id);
          setAdding(true);
          setSimilar(null);
          setCollapsed((prev) => prev.filter((row) => row !== shelf.id));
        },
      },
      ...moveActions(index, siblingCount, (delta) => move(shelf, delta)),
      {
        key: "move",
        label: "Move…",
        glyph: "↕",
        note: "to another parent",
        onSelect: () => {
          setMoving(shelf.id);
          setMoveUnder(shelf.parentId ? String(shelf.parentId) : "");
        },
      },
      // Merging needs somewhere to merge into, so it is absent in a tree of one.
      ...(tree.length > 1
        ? [
            {
              key: "merge",
              label: "Merge…",
              glyph: "⤵",
              note: "fold into another",
              onSelect: () => {
                setMerging(shelf.id);
                setMergeInto("");
              },
            } as SheetAction,
          ]
        : []),
      disableAction(
        shelf.hidden,
        () =>
          run(
            `hide:${shelf.id}`,
            store.editShelf(circleId, category.id, shelf.id, { hidden: !shelf.hidden }),
          ),
        "posts keep",
      ),
      deleteAction(() => setRemoving(shelf.id)),
    ];
  }

  return (
    <section className="circle-section admin-panel">
      <div className="section-head">
        <h2 className="section-title">Subcategories of {category.name}</h2>
        <button className="btn-text" onClick={onClose}>
          Done
        </button>
      </div>
      {/* The one thing a keeper needs to know before rearranging anything, said
          once and briefly: the dense paragraph that used to be here explained each
          operation in turn and was skipped for it. */}
      <p className="muted">
        Rearranging never deletes posts. Moving a subcategory takes its whole branch along,
        disabling hides it, and deleting moves its children up a level.
      </p>

      <ErrorLine message={removingNode ? null : error} />
      {note && <p className="muted">{note}</p>}

      {tree.length === 0 ? (
        <p className="muted">No subcategories yet.</p>
      ) : (
        <ul className="manage-list">
          {tree.filter(shown).map((shelf) => {
            const siblings = childShelves(nodes, shelf.parentId ?? null);
            const index = siblings.findIndex((row) => row.id === shelf.id);
            const children = childShelves(nodes, shelf.id);
            const folded = collapsed.includes(shelf.id);
            return (
              <ManageRow
                key={shelf.id}
                name={shelf.name}
                depth={shelf.depth}
                tag={shelf.hidden ? <span className="tag">Off</span> : undefined}
                meta={
                  <>
                    {entryCount(shelf.count)}
                    {shelf.totalCount > shelf.count && ` · ${shelf.totalCount} in this branch`}
                  </>
                }
                sheetSubtitle={pathText([category.name, ...shelf.path])}
                busy={busy !== null}
                actions={actionsFor(shelf, index, siblings.length)}
                lead={
                  /* The twist is what keeps the hierarchy readable now that the
                     row is one line: a node with children can be folded shut, and
                     a leaf gets a spacer so every name still lines up. */
                  children.length > 0 ? (
                    <button
                      className="chip-button"
                      aria-expanded={!folded}
                      aria-label={
                        folded ? `Show what is under ${shelf.name}` : `Fold up ${shelf.name}`
                      }
                      onClick={() => toggle(shelf.id)}
                    >
                      {folded ? "▸" : "▾"}
                    </button>
                  ) : (
                    <span className="manage-leaf" aria-hidden="true" />
                  )
                }
                editing={
                  renaming === shelf.id ? (
                    <>
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        maxLength={40}
                        aria-label="Subcategory name"
                        autoFocus
                      />
                      <div className="admin-actions">
                        <button
                          className="chip-button chip-strong"
                          disabled={!draft.trim() || busy === `rename:${shelf.id}`}
                          onClick={() =>
                            run(
                              `rename:${shelf.id}`,
                              store.editShelf(circleId, category.id, shelf.id, {
                                name: draft.trim(),
                              }),
                              () => setRenaming(null),
                            )
                          }
                        >
                          Save
                        </button>
                        <button className="btn-text" onClick={() => setRenaming(null)}>
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : moving === shelf.id ? (
                    <>
                      <label className="field">
                        <span>Move {shelf.name} under</span>
                        <select value={moveUnder} onChange={(e) => setMoveUnder(e.target.value)}>
                          <option value="">Top level</option>
                          {parentChoices(shelf.id).map((other) => (
                            <option key={other.id} value={other.id}>
                              {pathText(other.path)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="admin-actions">
                        <button
                          className="chip-button chip-strong"
                          disabled={busy === `move:${shelf.id}`}
                          onClick={() =>
                            run(
                              `move:${shelf.id}`,
                              store.editShelf(circleId, category.id, shelf.id, {
                                parentId: moveUnder ? Number(moveUnder) : null,
                              }),
                              () => {
                                setMoving(null);
                                setMoveUnder("");
                              },
                            )
                          }
                        >
                          Move
                        </button>
                        <button className="btn-text" onClick={() => setMoving(null)}>
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : merging === shelf.id ? (
                    <>
                      <label className="field">
                        <span>Merge {shelf.name} into</span>
                        <select value={mergeInto} onChange={(e) => setMergeInto(e.target.value)}>
                          <option value="">Choose a subcategory…</option>
                          {parentChoices(shelf.id).map((other) => (
                            <option key={other.id} value={other.id}>
                              {pathText(other.path)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="field-hint">
                        Its posts and anything under it go with it. Nothing is deleted.
                      </p>
                      <div className="admin-actions">
                        <button
                          className="chip-button chip-strong"
                          disabled={!mergeInto || busy === `merge:${shelf.id}`}
                          onClick={() =>
                            run(
                              `merge:${shelf.id}`,
                              store.editShelf(circleId, category.id, shelf.id, {
                                mergeIntoId: Number(mergeInto),
                              }),
                              () => {
                                setMerging(null);
                                setMergeInto("");
                              },
                            )
                          }
                        >
                          Merge
                        </button>
                        <button className="btn-text" onClick={() => setMerging(null)}>
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : undefined
                }
              />
            );
          })}
        </ul>
      )}

      {/* Deleting is the one action here that changes where things sit, so it says
          what becomes of the branch and of the posts before it happens — the same
          two facts the old inline confirm carried in its button label. */}
      {removingNode && (
        <ManageConfirm
          title={`Delete “${removingNode.name}”?`}
          error={error}
          confirmLabel="Delete the subcategory"
          busyLabel="Deleting…"
          busy={busy === `remove:${removingNode.id}`}
          onCancel={() => setRemoving(null)}
          onConfirm={() =>
            run(
              `remove:${removingNode.id}`,
              store.removeShelf(circleId, category.id, removingNode.id),
              () => setRemoving(null),
            )
          }
        >
          <p>
            {removingNode.childCount > 0
              ? `What is under it moves up a level rather than going with it. `
              : ""}
            {removingNode.count > 0
              ? `${entryCount(removingNode.count)} filed here ${
                  removingNode.count === 1 ? "stays" : "stay"
                } in ${category.name}, unfiled.`
              : "Nothing is filed here."}{" "}
            Disabling it instead hides the branch and keeps it exactly as it is.
          </p>
        </ManageConfirm>
      )}

      {adding ? (
        <div className="admin-add">
          <label className="field">
            <span>Under</span>
            <select
              value={addUnder === null ? "" : String(addUnder)}
              onChange={(e) => setAddUnder(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Top level</option>
              {parentChoices().map((other) => (
                <option key={other.id} value={other.id}>
                  {pathText(other.path)}
                </option>
              ))}
            </select>
          </label>
          {/* Which branch a new node lands in is the whole of what makes it useful,
              so the path it is going under is spelled out rather than implied by
              where the panel happens to have opened. */}
          <p className="field-hint">
            {addPath.length > 0
              ? `New subcategory under ${pathText([category.name, ...addPath])}.`
              : `New subcategory at the top of ${category.name}.`}
          </p>
          <label className="field">
            <span>Name</span>
            <input
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setSimilar(null);
              }}
              maxLength={40}
              autoFocus
            />
          </label>
          {similar ? (
            <div className="subcategory-similar">
              <p>“{similar.name}” is already here. Did you mean that one?</p>
              <div className="admin-actions">
                <button
                  className="chip-button chip-strong"
                  onClick={() => {
                    setSimilar(null);
                    setNewName("");
                    setAdding(false);
                  }}
                >
                  Use {similar.name}
                </button>
                <button className="chip-button" disabled={busy === "add"} onClick={() => add(true)}>
                  Create “{newName.trim()}” anyway
                </button>
              </div>
            </div>
          ) : (
            <div className="admin-actions">
              <button
                className="chip-button chip-strong"
                disabled={!newName.trim() || busy === "add"}
                onClick={() => add(false)}
              >
                {busy === "add" ? "Adding…" : "Add"}
              </button>
              <button
                className="btn-text"
                onClick={() => {
                  setAdding(false);
                  setNewName("");
                  setSimilar(null);
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="admin-add">
          <button
            className="btn btn-ghost"
            onClick={() => {
              setAddUnder(null);
              setAdding(true);
              setSimilar(null);
            }}
          >
            + Add a subcategory
          </button>
        </div>
      )}
    </section>
  );
}
