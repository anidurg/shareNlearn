// src/components/CircleFolders.tsx
// Folders, which are how a normal circle is navigated.
//
// A folder answers *where* something belongs — Madhwa Festivals › Krishna
// Janmashtami — and a content type answers *what* it is — a song, a recipe, a
// book. The two used to compete for the same grid on a circle's page, which meant
// two navigation systems saying different things about one shelf of content, and
// the folder is the one a circle actually organises itself by. So the folders are
// the tiles and the breadcrumbs, and the content types have moved to the three
// places where they are the question being asked: what a member is sharing, how a
// folder's listing is narrowed, and what the circle is configured to accept.
//
// Everything here is derived from `src/folders.ts`, which is the same tree walk a
// subcategory uses over a different table — a folder hangs off a circle and a
// subcategory off a category, and the two are deliberately unrelated.
import { useEffect, useMemo, useState } from "react";
import type { Circle, CircleCategory, Folder } from "../api";
import { isCustom, shareFlows, sortedCategories, type ShareFlow } from "../categories";
import {
  childFolders,
  folderBranchIds,
  folderById,
  folderTree,
  inFolderBranch,
  MAX_FOLDER_NAME,
  visibleFolders,
  type ShareTarget,
} from "../folders";
import type { SharePrefill } from "../incoming-share";
import { TOPICS, type FeedEntry } from "../feed";
import { pathText } from "../tree";
import type { ShareAndLearn } from "../store";
import { ActionSheet, type SheetAction } from "./ActionSheet";
import { useGuidelinesGate } from "./Guidelines";
import {
  deleteAction,
  disableAction,
  ManageConfirm,
  ManageRow,
  moveActions,
} from "./ManageRow";
import { PostModal } from "./PostModal";
import { CircleFeedList } from "./CircleCategories";
import { EmptyState, ErrorLine, SearchField } from "./shared";

/**
 * How many of the newest things a folder with subfolders shows before it hands
 * the rest over to "View all". A folder holding other folders is a place to look
 * around from rather than a list to read, exactly as a category node is.
 */
const RECENT_LIMIT = 5;

/** How a folder's own listing can be ordered once somebody is reading it. */
type FolderSort = "newest" | "oldest" | "title" | "title-reverse";

const FOLDER_SORTS: { value: FolderSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "title", label: "Title A–Z" },
  { value: "title-reverse", label: "Title Z–A" },
];

/** "3 items", "1 item" — what a folder tile and a folder chip count. */
export function itemCount(total: number) {
  return `${total} ${total === 1 ? "item" : "items"}`;
}

/**
 * "+ Share an item", and the chooser behind it: one full-width row per content
 * type the circle has switched on, asked as a sheet rather than as a dropdown
 * because a list a thumb can hit is the whole point of it.
 *
 * It is one component rather than two because the question is the same wherever
 * it is asked — on a folder's page, where the folder is already known, and on the
 * circle's own page, where there is no folder and the share simply goes to the
 * circle. `folder` is that difference and the only one: it travels with a custom
 * content type's form here, and back through `onPick` for a built-in one, so
 * neither form asks a member where they are standing.
 *
 * A content type the circle has hidden is not offered, and a circle that has
 * switched every one of them off gets no button at all rather than a chooser with
 * nothing in it.
 */
export function ShareItemButton({
  store,
  categories,
  subtitle,
  folder,
  prefill,
  onPick,
  onSaved,
}: {
  store: ShareAndLearn;
  categories: CircleCategory[];
  /** Where the item is going, named on the sheet's own header. */
  subtitle: string;
  /** Where the item is going: a folder, or `id: null` for the circle itself. */
  folder: ShareTarget;
  /**
   * Text the device's share sheet handed over, when the sheet is being opened
   * from the incoming-share screen. It is passed straight through to whichever
   * form the member picks, this component having no opinion about what is in it.
   */
  prefill?: SharePrefill;
  /** A built-in content type was picked, so the shell's own form opens. */
  onPick: (flow: ShareFlow) => void;
  /**
   * A custom content type's post was saved — the one form this component opens
   * itself, so the one completion the shell cannot hear about through `onPick`.
   * Undefined where nothing is waiting on the answer, which is every ordinary
   * circle and folder page.
   */
  onSaved?: () => void;
}) {
  const [sharing, setSharing] = useState(false);
  /** The custom content type whose form is open, if a member picked one. */
  const [writing, setWriting] = useState<CircleCategory | null>(null);
  /**
   * A post in a custom content type is written here rather than through the
   * shell, so the guidelines tick is asked for here too. The server refuses an
   * unagreed share either way.
   */
  const guidelines = useGuidelinesGate(store);

  const rows: SheetAction[] = sortedCategories(categories)
    .filter((category) => !category.hidden)
    .map((category) => ({
      key: String(category.id),
      label: category.name,
      glyph: category.icon,
      onSelect: () => {
        // The sheet does not dismiss itself, and a form opening behind an open
        // sheet is the sheet answering a question that has been answered.
        setSharing(false);
        if (isCustom(category)) {
          guidelines.guard(() => setWriting(category));
          return;
        }
        const flow = category.itemType ? shareFlows(category.itemType)[0] : null;
        if (flow) onPick(flow.flow);
      },
    }));

  if (rows.length === 0) return null;

  return (
    <>
      {/* One action, worded where there is room for the words and shortened on a
          phone, which is how every other primary action in the app is offered. */}
      <button
        className="btn btn-primary tab-header-wide-action"
        onClick={() => setSharing(true)}
      >
        + Share an item
      </button>
      <button
        className="chip-button chip-strong section-head-narrow-action"
        onClick={() => setSharing(true)}
      >
        + Share
      </button>

      {sharing && (
        <ActionSheet
          title="What are you sharing?"
          subtitle={subtitle}
          actions={rows}
          onClose={() => setSharing(false)}
        />
      )}

      {guidelines.gate}

      {writing && (
        <PostModal
          category={writing}
          folder={folder}
          prefill={prefill}
          onClose={() => setWriting(null)}
          onSave={async (values) => {
            await store.addPost(values);
            setWriting(null);
            onSaved?.();
          }}
        />
      )}
    </>
  );
}

/**
 * What a circle holds, as a grid of folder tiles. Only the folders at the top of
 * the circle are drawn: a folder is walked into rather than jumped to, which is
 * what the whole tree being flattened on one page got wrong about a tree.
 *
 * A hidden folder is not drawn at all, for a keeper as much as for anybody else,
 * because this grid is the way into a folder and a hidden one has nowhere to go —
 * **Manage folders** is where a keeper reads the hidden ones and shows them again.
 * The server has already taken them out of a plain member's copy.
 */
export function FolderGrid({
  folders,
  canManage,
  onOpen,
  onManage,
  onAdd,
}: {
  folders: Folder[];
  canManage: boolean;
  onOpen: (folderId: number) => void;
  onManage?: () => void;
  /** Straight into the add panel, which is what an empty circle needs. */
  onAdd?: () => void;
}) {
  const top = childFolders(visibleFolders(folders), null);

  return (
    <section className="circle-section">
      <div className="section-head section-head-inline">
        <h2 className="section-title">Folders</h2>
        {canManage && onManage && (
          <div className="section-head-actions">
            <button className="btn-text tab-header-wide-action" onClick={onManage}>
              Manage folders
            </button>
            <button className="btn-text section-head-narrow-action" onClick={onManage}>
              Manage
            </button>
          </div>
        )}
      </div>
      {top.length === 0 ? (
        /*
         * A keeper is the only person told that a circle has no folders, because
         * they are the only person who can do anything about it. For everybody
         * else the section is not drawn at all — a member reading a circle with no
         * folders wants the feed under it, not a note about a structure nobody has
         * made yet.
         */
        <>
          <p className="muted">
            No folders yet. Create folders to organize what your circle shares.
          </p>
          {onAdd && (
            <div className="admin-add">
              <button className="btn btn-ghost" onClick={onAdd}>
                + Add folder
              </button>
            </div>
          )}
        </>
      ) : (
        <ul className="category-grid">
          {top.map((folder) => (
            <li key={folder.id}>
              <button className="category-tile" onClick={() => onOpen(folder.id)}>
                <span className="category-tile-icon" aria-hidden="true">
                  📁
                </span>
                <span className="category-tile-name">{folder.name}</span>
                <span className="category-tile-count">
                  {itemCount(folder.childCount > 0 ? folder.totalCount : folder.count)}
                  {folder.childCount > 0 &&
                    ` · ${folder.childCount} ${folder.childCount === 1 ? "subfolder" : "subfolders"}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * One folder of one circle: where the reader is standing, the subfolders directly
 * under it, and everything shared into it or anywhere below it.
 *
 * The content types appear here as chips over the listing — `All · Songs ·
 * Recipes` — and they are filters rather than places: tapping one narrows the
 * list in front of the reader without moving them, which is exactly what a
 * subfolder chip does not do.
 */
export function FolderPage({
  store,
  userId,
  circle,
  folders,
  folderId,
  categories,
  entries: circleEntries,
  canManage,
  canContribute,
  onBack,
  onOpenFolder,
  onShareInto,
  onOpenEntry,
}: {
  store: ShareAndLearn;
  userId: string;
  circle: Circle;
  folders: Folder[];
  folderId: number;
  categories: CircleCategory[];
  /** Every share this circle holds, as feed rows, worked out once by the page above. */
  entries: FeedEntry[];
  canManage: boolean;
  /**
   * Whether this member may share into the folder at all. A public circle is
   * readable by somebody who has only come to look, and a button that answers
   * with a refusal is worse than no button; the server refuses them either way.
   */
  canContribute: boolean;
  onBack: () => void;
  onOpenFolder: (folderId: number | null) => void;
  /**
   * A built-in content type picked from "What are you sharing?". The folder
   * travels with it — its id so the share is filed there, and its path so the
   * form can say where it is going instead of asking a second time.
   */
  onShareInto: (flow: ShareFlow, folder: ShareTarget) => void;
  onOpenEntry: (entry: FeedEntry) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [viewAll, setViewAll] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<FolderSort>("newest");
  /** Which content type the listing is narrowed to, or null for all of them. */
  const [kind, setKind] = useState<string | null>(null);

  const here = folderById(folders, folderId);

  /**
   * Walking into another folder is arriving somewhere new, so it arrives in the
   * state every folder starts in: looking around, nothing typed, nothing
   * narrowed. A search carried from one festival into another filters a list
   * nobody asked a question about.
   */
  useEffect(() => {
    setViewAll(false);
    setQuery("");
    setSort("newest");
    setKind(null);
  }, [folderId, circle.id]);

  /** The folders directly under this one, and nothing deeper. */
  const children = useMemo(
    () => childFolders(folders, folderId).filter((row) => canManage || !row.hidden),
    [folders, folderId, canManage],
  );

  /** This folder and everything inside it, which is what its listing holds. */
  const branch = useMemo(() => folderBranchIds(folders, folderId), [folders, folderId]);

  const entries = useMemo(
    () =>
      circleEntries.filter((entry) => inFolderBranch(entry, circle.id, branch)),
    [circleEntries, circle.id, branch],
  );

  /**
   * The content types actually present in this folder, in the feed's own order.
   * A chip for a kind nobody has shared here would narrow the list to nothing,
   * so the row says what is here rather than what the circle could hold.
   */
  const kinds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      counts.set(entry.itemType, (counts.get(entry.itemType) ?? 0) + 1);
    }
    return TOPICS.filter((topic) => counts.has(topic.type)).map((topic) => ({
      ...topic,
      count: counts.get(topic.type) ?? 0,
    }));
  }, [entries]);

  /** A chip for a kind that has since gone from the folder is not left selected. */
  const chosenKind = kind !== null && kinds.some((row) => row.type === kind) ? kind : null;

  const narrowed = useMemo(
    () => (chosenKind === null ? entries : entries.filter((entry) => entry.itemType === chosenKind)),
    [entries, chosenKind],
  );

  /** The listing itself, once somebody is reading it rather than glancing at it. */
  const listed = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const found = needle
      ? narrowed.filter((entry) =>
          [entry.title, entry.detail, entry.memberName, entry.kind]
            .filter(Boolean)
            .some((field) => (field as string).toLowerCase().includes(needle)),
        )
      : narrowed;
    const order = [...found];
    order.sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "title-reverse") return b.title.localeCompare(a.title);
      if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
      return b.createdAt.localeCompare(a.createdAt);
    });
    return order;
  }, [narrowed, query, sort]);

  /**
   * A place to look around from, or a list to read. A folder with subfolders is
   * the first and leads with what has just arrived anywhere below it; a folder
   * with none is only ever the second. Typing a search, changing the sort or
   * picking a content type is itself a way of asking for the whole list, since a
   * truncated one would answer all three wrongly.
   */
  const hasChildren = children.length > 0;
  const browsing =
    !hasChildren || viewAll || query.trim() !== "" || sort !== "newest" || chosenKind !== null;
  const recent = narrowed.slice(0, RECENT_LIMIT);

  if (!here) {
    return (
      <>
        <button className="btn-text back-link" onClick={onBack}>
          ← {circle.icon} {circle.name}
        </button>
        <EmptyState glyph="📁" title="That folder is not here">
          It may have been renamed, deleted or hidden since the link was made.
        </EmptyState>
      </>
    );
  }

  /**
   * The trail from the circle down to here, every step of it a way back up.
   * `path` is names alone, so the ids come from walking `parentId` — with the
   * same guard `folderHidden()` keeps, a bad `PATCH` that made a cycle costing a
   * breadcrumb rather than the page.
   */
  const trail: Folder[] = [];
  const seen = new Set<number>();
  let step: Folder | null = here;
  while (step && !seen.has(step.id)) {
    seen.add(step.id);
    trail.unshift(step);
    step = folderById(folders, step.parentId);
  }

  /** Where the reader is standing, which is where anything they share goes. */
  const shareTarget: ShareTarget = { id: folderId, path: here.path ?? [here.name] };

  return (
    <>
      {/* One step back up the tree, or out to the circle from the top of it. The
          breadcrumb below carries the rest of the walk. */}
      <button
        className="btn-text back-link"
        onClick={() => (here.parentId === null ? onBack() : onOpenFolder(here.parentId))}
      >
        ←{" "}
        {here.parentId === null
          ? `${circle.icon} ${circle.name}`
          : (folderById(folders, here.parentId)?.name ?? circle.name)}
      </button>

      <header className="category-header">
        <span className="circle-icon circle-icon-large" aria-hidden="true">
          📁
        </span>
        <div className="circle-header-text">
          <h1 className="tab-title">{here.name}</h1>
          <p className="circle-meta">
            {itemCount(entries.length)}
            {here.hidden && <span className="tag">Hidden</span>}
          </p>
        </div>
      </header>

      <ErrorLine message={error} />

      {/* Where the reader is, and the way back up. The circle's own name is the
          first step, so a reader three folders deep is never stranded. */}
      <div className="shelf-trail-head">
        <nav className="shelf-trail" aria-label={`Where you are in ${circle.name}`}>
          <button className="shelf-trail-step" onClick={onBack}>
            {circle.name}
          </button>
          {trail.map((node, index) =>
            index === trail.length - 1 ? (
              <span key={node.id} className="shelf-trail-here" aria-current="page">
                <span className="shelf-trail-sep" aria-hidden="true">
                  ›
                </span>
                {node.name}
              </span>
            ) : (
              <span key={node.id} className="shelf-trail-link">
                <span className="shelf-trail-sep" aria-hidden="true">
                  ›
                </span>
                <button className="shelf-trail-step" onClick={() => onOpenFolder(node.id)}>
                  {node.name}
                </button>
              </span>
            ),
          )}
        </nav>
      </div>

      {/* The subfolders under this one, and a keeper's way into the tree beside
          the heading. A folder with none draws no section at all rather than a
          note about an absence, which read as an empty page on top of a full
          listing. */}
      {(hasChildren || canManage) && (
        <section className="circle-section">
          <div className="section-head section-head-inline">
            <h2 className="section-title">Subfolders</h2>
            {canManage && (
              <div className="section-head-actions">
                <button
                  className="btn-text tab-header-wide-action"
                  onClick={() => setManaging((open) => !open)}
                >
                  {managing ? "Done" : "Manage folders"}
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
          {hasChildren ? (
            <div
              className="shelf-chips shelf-chips-wrap"
              role="group"
              aria-label={`Subfolders of ${here.name}`}
            >
              {children.map((row) => (
                <button
                  key={row.id}
                  className="chip-button"
                  onClick={() => onOpenFolder(row.id)}
                >
                  {row.name} ({row.childCount > 0 ? row.totalCount : row.count})
                  {row.hidden && <span className="tag">Hidden</span>}
                  {row.childCount > 0 && (
                    <span className="chip-into" aria-hidden="true">
                      ›
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">
              No subfolders here. Add one from Manage folders to break this folder up.
            </p>
          )}
        </section>
      )}

      {canManage && managing && (
        <FolderManager
          store={store}
          circleId={circle.id}
          circleName={circle.name}
          folders={folders}
          startUnder={folderId}
          onClose={() => setManaging(false)}
        />
      )}

      <section className="circle-section">
        <div className="section-head section-head-inline">
          <h2 className="section-title">
            {browsing ? `Everything in ${here.name}` : "Recent uploads"}
          </h2>
          <div className="section-head-actions">
            {hasChildren && browsing && (
              <button
                className="btn-text"
                onClick={() => {
                  setViewAll(false);
                  setQuery("");
                  setSort("newest");
                  setKind(null);
                }}
              >
                Show recent only
              </button>
            )}
            {canContribute && (
              <ShareItemButton
                store={store}
                categories={categories}
                subtitle={pathText([circle.name, ...shareTarget.path])}
                folder={shareTarget}
                onPick={(flow) => onShareInto(flow, shareTarget)}
              />
            )}
          </div>
        </div>

        {hasChildren && (
          <p className="muted">Everything in {here.name}, including its subfolders.</p>
        )}

        {/*
          The content types, as filters over the list rather than as places to go.
          "All" comes first and is the state the page opens in, so it is drawn as
          the selected pill; tapping it on a landing page asks for the whole
          listing, which is the only honest thing a count of everything can mean.
        */}
        {kinds.length > 1 && (
          <div
            className="shelf-chips"
            role="group"
            aria-label={`Narrow ${here.name} by what it is`}
          >
            <button
              type="button"
              className={chosenKind === null ? "chip-button chip-active" : "chip-button"}
              aria-pressed={chosenKind === null}
              onClick={() => {
                setKind(null);
                setViewAll(true);
              }}
            >
              All ({entries.length})
            </button>
            {kinds.map((topic) => (
              <button
                key={topic.type}
                type="button"
                className={chosenKind === topic.type ? "chip-button chip-active" : "chip-button"}
                aria-pressed={chosenKind === topic.type}
                onClick={() => setKind(topic.type)}
              >
                {topic.glyph} {topic.label} ({topic.count})
              </button>
            ))}
          </div>
        )}

        {entries.length > 0 && (
          <div className="feed-controls">
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder={`Search ${here.name.toLowerCase()}…`}
            />
            <label className="feed-sort">
              <span>Sort</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as FolderSort)}>
                {FOLDER_SORTS.map((option) => (
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
            {canContribute
              ? `Share the first thing into ${here.name}.`
              : "Nothing has been shared into this folder."}
          </EmptyState>
        ) : listed.length === 0 ? (
          <EmptyState glyph="◦" title="Nothing matches">
            <button
              className="btn-text"
              onClick={() => {
                setQuery("");
                setKind(null);
              }}
            >
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
              throughFolder
              onOpenEntry={onOpenEntry}
              onError={setError}
            />
            {!browsing && narrowed.length > recent.length && (
              <p className="shelf-view-all">
                <button className="btn-text" onClick={() => setViewAll(true)}>
                  View all {itemCount(narrowed.length)} →
                </button>
              </p>
            )}
          </>
        )}
      </section>

    </>
  );
}

/**
 * The tree as its keepers see it: every folder including the hidden ones, each
 * collapsible and indented by how deep it sits, and each offering the same
 * handful of things — add a subfolder, rename, move, merge, hide and delete.
 *
 * It is deliberately not the subcategory manager with different words: a folder
 * hangs off the circle, so its writes are the circle's keepers' alone with no
 * "members may add one" setting behind them. A subcategory is filing invented in
 * the middle of posting; a folder is the structure everybody else navigates.
 */
export function FolderManager({
  store,
  circleId,
  circleName,
  folders,
  startUnder = null,
  startAdding = false,
  onClose,
}: {
  store: ShareAndLearn;
  circleId: number;
  circleName: string;
  folders: Folder[];
  /** Which folder the add panel opens under, for a manager opened from inside one. */
  startUnder?: number | null;
  /**
   * True when the manager was opened by somebody asking to add a folder rather
   * than to read the tree — "+ Add folder" on a circle with none, which should
   * land on the field itself rather than on a second button saying the same.
   */
  startAdding?: boolean;
  onClose: () => void;
}) {
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
  const [removing, setRemoving] = useState<number | null>(null);
  const [addUnder, setAddUnder] = useState<number | null>(startUnder);
  const [adding, setAdding] = useState(startAdding);
  const [newName, setNewName] = useState("");
  const [similar, setSimilar] = useState<{ id: number; name: string; path?: string[] } | null>(
    null,
  );

  const tree = folderTree(folders);

  /** A folder is on screen when nothing above it is folded shut. */
  function shown(folder: Folder) {
    let parent = folderById(folders, folder.parentId);
    let guard = 0;
    while (parent && guard < 64) {
      if (collapsed.includes(parent.id)) return false;
      parent = folderById(folders, parent.parentId);
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

  /** Reordering is between siblings, since that is the only place order means anything. */
  function move(folder: Folder, delta: number) {
    const siblings = childFolders(folders, folder.parentId);
    const order = siblings.map((row) => row.id);
    const at = order.indexOf(folder.id);
    const to = at + delta;
    if (to < 0 || to >= order.length) return;
    [order[at], order[to]] = [order[to], order[at]];
    run(`order:${folder.id}`, store.reorderFolders(circleId, order));
  }

  /** `confirm` is what turns "did you mean Festivals?" into "make Festival anyway". */
  async function add(confirm: boolean) {
    const name = newName.trim();
    if (!name) return;
    setBusy("add");
    setError(null);
    try {
      const outcome = await store.addFolder(circleId, name, addUnder, confirm);
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
      setError(err instanceof Error ? err.message : "That folder could not be added.");
    } finally {
      setBusy(null);
    }
  }

  /** Where a folder may go: anywhere but itself and its own branch. */
  function parentChoices(exclude?: number) {
    const barred = exclude ? folderBranchIds(folders, exclude) : [];
    return tree.filter((folder) => !barred.includes(folder.id));
  }

  const addPath = addUnder === null ? [] : (folderById(folders, addUnder)?.path ?? []);
  const removingFolder =
    removing === null ? null : (tree.find((row) => row.id === removing) ?? null);

  /** What the ⋯ holds for one folder — everything a keeper can do to it. */
  function actionsFor(folder: Folder, index: number, siblingCount: number): SheetAction[] {
    return [
      {
        key: "edit",
        label: "Rename",
        glyph: "✏️",
        onSelect: () => {
          setRenaming(folder.id);
          setDraft(folder.name);
        },
      },
      {
        key: "child",
        label: "Add subfolder",
        glyph: "➕",
        note: `inside ${folder.name}`,
        onSelect: () => {
          setAddUnder(folder.id);
          setAdding(true);
          setSimilar(null);
          setCollapsed((prev) => prev.filter((row) => row !== folder.id));
        },
      },
      ...moveActions(index, siblingCount, (delta) => move(folder, delta)),
      {
        key: "move",
        label: "Move…",
        glyph: "↕",
        note: "into another folder",
        onSelect: () => {
          setMoving(folder.id);
          setMoveUnder(folder.parentId ? String(folder.parentId) : "");
        },
      },
      ...(tree.length > 1
        ? [
            {
              key: "merge",
              label: "Merge…",
              glyph: "⤵",
              note: "fold into another",
              onSelect: () => {
                setMerging(folder.id);
                setMergeInto("");
              },
            } as SheetAction,
          ]
        : []),
      disableAction(
        folder.hidden,
        () => run(`hide:${folder.id}`, store.editFolder(circleId, folder.id, { hidden: !folder.hidden })),
        "items keep",
        { hide: "Hide", show: "Show" },
      ),
      deleteAction(() => setRemoving(folder.id)),
    ];
  }

  return (
    <section className="circle-section admin-panel">
      <div className="section-head">
        <h2 className="section-title">Folders in {circleName}</h2>
        <button className="btn-text" onClick={onClose}>
          Done
        </button>
      </div>
      <p className="muted">
        Rearranging never deletes anything anybody shared. Moving a folder takes what is inside it
        along, hiding one takes it off the circle page and keeps it, and deleting one moves its
        subfolders up a level.
      </p>

      <ErrorLine message={removingFolder ? null : error} />
      {note && <p className="muted">{note}</p>}

      {tree.length === 0 ? (
        <p className="muted">No folders yet.</p>
      ) : (
        <ul className="manage-list">
          {tree.filter(shown).map((folder) => {
            const siblings = childFolders(folders, folder.parentId);
            const index = siblings.findIndex((row) => row.id === folder.id);
            const children = childFolders(folders, folder.id);
            const folded = collapsed.includes(folder.id);
            return (
              <ManageRow
                key={folder.id}
                name={folder.name}
                depth={folder.depth}
                tag={folder.hidden ? <span className="tag">Hidden</span> : undefined}
                meta={
                  <>
                    {itemCount(folder.count)}
                    {folder.totalCount > folder.count &&
                      ` · ${folder.totalCount} including subfolders`}
                  </>
                }
                sheetSubtitle={pathText([circleName, ...folder.path])}
                busy={busy !== null}
                actions={actionsFor(folder, index, siblings.length)}
                lead={
                  children.length > 0 ? (
                    <button
                      className="chip-button"
                      aria-expanded={!folded}
                      aria-label={
                        folded ? `Show what is inside ${folder.name}` : `Fold up ${folder.name}`
                      }
                      onClick={() => toggle(folder.id)}
                    >
                      {folded ? "▸" : "▾"}
                    </button>
                  ) : (
                    <span className="manage-leaf" aria-hidden="true" />
                  )
                }
                editing={
                  renaming === folder.id ? (
                    <>
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        maxLength={MAX_FOLDER_NAME}
                        aria-label="Folder name"
                        autoFocus
                      />
                      <div className="admin-actions">
                        <button
                          className="chip-button chip-strong"
                          disabled={!draft.trim() || busy === `rename:${folder.id}`}
                          onClick={() =>
                            run(
                              `rename:${folder.id}`,
                              store.editFolder(circleId, folder.id, { name: draft.trim() }),
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
                  ) : moving === folder.id ? (
                    <>
                      <label className="field">
                        <span>Move {folder.name} into</span>
                        <select value={moveUnder} onChange={(e) => setMoveUnder(e.target.value)}>
                          <option value="">Top level</option>
                          {parentChoices(folder.id).map((other) => (
                            <option key={other.id} value={other.id}>
                              {pathText(other.path)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="admin-actions">
                        <button
                          className="chip-button chip-strong"
                          disabled={busy === `move:${folder.id}`}
                          onClick={() =>
                            run(
                              `move:${folder.id}`,
                              store.editFolder(circleId, folder.id, {
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
                  ) : merging === folder.id ? (
                    <>
                      <label className="field">
                        <span>Merge {folder.name} into</span>
                        <select value={mergeInto} onChange={(e) => setMergeInto(e.target.value)}>
                          <option value="">Choose a folder…</option>
                          {parentChoices(folder.id).map((other) => (
                            <option key={other.id} value={other.id}>
                              {pathText(other.path)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="field-hint">
                        What is in it and anything inside it go with it. Nothing is deleted.
                      </p>
                      <div className="admin-actions">
                        <button
                          className="chip-button chip-strong"
                          disabled={!mergeInto || busy === `merge:${folder.id}`}
                          onClick={() =>
                            run(
                              `merge:${folder.id}`,
                              store.editFolder(circleId, folder.id, {
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

      {/* Deleting moves things rather than taking them, so it says what becomes of
          the subfolders and of what was shared here before it happens. */}
      {removingFolder && (
        <ManageConfirm
          title={`Delete “${removingFolder.name}”?`}
          error={error}
          confirmLabel="Delete the folder"
          busyLabel="Deleting…"
          busy={busy === `remove:${removingFolder.id}`}
          onCancel={() => setRemoving(null)}
          onConfirm={() =>
            run(
              `remove:${removingFolder.id}`,
              store.removeFolder(circleId, removingFolder.id),
              () => setRemoving(null),
            )
          }
        >
          <p>
            {removingFolder.childCount > 0
              ? "What is inside it moves up a level rather than going with it. "
              : ""}
            {removingFolder.count > 0
              ? `${itemCount(removingFolder.count)} shared here ${
                  removingFolder.count === 1 ? "stays" : "stay"
                } in ${circleName}, outside any folder.`
              : "Nothing has been shared here."}{" "}
            Hiding it instead takes it off the circle page and keeps it exactly as it is.
          </p>
        </ManageConfirm>
      )}

      {adding ? (
        <div className="admin-add">
          <label className="field">
            <span>Inside</span>
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
          {/* Which folder a new one lands in is the whole of what makes it useful,
              so the path is spelled out rather than implied by where the panel
              happens to have opened. */}
          <p className="field-hint">
            {addPath.length > 0
              ? `New folder inside ${pathText([circleName, ...addPath])}.`
              : `New folder at the top of ${circleName}.`}
          </p>
          <label className="field">
            <span>Name</span>
            <input
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setSimilar(null);
              }}
              maxLength={MAX_FOLDER_NAME}
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
              setAddUnder(startUnder);
              setAdding(true);
              setSimilar(null);
            }}
          >
            + Add folder
          </button>
        </div>
      )}
    </section>
  );
}
