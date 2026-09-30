import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addCategoryField as apiAddCategoryField,
  addCircleCategory as apiAddCircleCategory,
  addFolder as apiAddFolder,
  addSubcategory as apiAddSubcategory,
  approveCircleRequest as apiApproveCircleRequest,
  blockMember as apiBlockMember,
  createBook,
  createCircle as apiCreateCircle,
  createExperience,
  createFact,
  createInvite,
  createRecipe,
  createPost,
  createBookmark,
  createRemedy,
  createWord,
  createWordConnection,
  deleteBook,
  deleteCircle as apiDeleteCircle,
  deleteDiscussion as apiDeleteDiscussion,
  deleteDiscussionReply,
  deleteExperience,
  deleteFact,
  deletePost,
  deleteRecipe,
  deleteBookmark,
  deleteRemedy,
  deleteSong,
  deleteWord,
  deleteWordConnection,
  fetchCircleRoll as apiFetchCircleRoll,
  fetchOrphans as apiFetchOrphans,
  deleteOrphanBlobs as apiDeleteOrphanBlobs,
  fetchMemberBlocks as apiFetchMemberBlocks,
  liftMemberBlock as apiLiftMemberBlock,
  mergeDefaultCircles as apiMergeDefaultCircles,
  moveItemToFolder as apiMoveItemToFolder,
  acceptGuidelines as apiAcceptGuidelines,
  fetchBooks,
  fetchCircles,
  fetchContacts,
  fetchFacts,
  fetchInvites,
  fetchCircleCategories,
  fetchCircleFolders,
  fetchLibrary,
  fetchMyAccess,
  fetchSongScripts,
  fetchMyCategories,
  fetchNotifications,
  fetchPosts,
  fetchRecipes,
  fetchBookmarks,
  fetchRemedies,
  fetchSongs,
  fetchUsageReport,
  fetchWords,
  hideItem as apiHideItem,
  inviteToCircle as apiInviteToCircle,
  joinCircle as apiJoinCircle,
  leaveCircle as apiLeaveCircle,
  NO_ACCESS,
  registerMember,
  removeCategoryField as apiRemoveCategoryField,
  removeCircleCategory as apiRemoveCircleCategory,
  removeCircleMember as apiRemoveCircleMember,
  removeFolder as apiRemoveFolder,
  removeFromLibrary,
  removeSubcategory as apiRemoveSubcategory,
  reorderCategoryFields as apiReorderCategoryFields,
  reorderCircleCategories as apiReorderCircleCategories,
  reorderFolders as apiReorderFolders,
  reorderSubcategories as apiReorderSubcategories,
  reportItem,
  replyToDiscussion,
  renderSongLyricScript,
  updateSongScripts,
  resolveReport as apiResolveReport,
  revokeInvite,
  saveToLibrary,
  setBookLike,
  setCircleMemberRole as apiSetCircleMemberRole,
  setWordLearned,
  startDiscussion as apiStartDiscussion,
  summarizeDiscussion,
  translatePost as apiTranslatePost,
  unblockMember as apiUnblockMember,
  unhideItem as apiUnhideItem,
  updateBook,
  updateCircle as apiUpdateCircle,
  updateCategoryField as apiUpdateCategoryField,
  updateCircleCategory as apiUpdateCircleCategory,
  updateFact,
  updateMemberStanding,
  updatePost,
  updateRecipe,
  updateBookmark,
  updateRemedy,
  updateSong,
  updateFolder as apiUpdateFolder,
  updateSubcategory as apiUpdateSubcategory,
  updateWord,
  type AccessState,
  type AudioWay,
  type BlockedMember,
  type Book,
  type Circle,
  type CircleCategory,
  type CircleFiling,
  type Folder,
  type CircleInvitation,
  type CircleRequest,
  type FieldFileType,
  type FieldKind,
  type Contact,
  type Discussion,
  type DiscussionItemType,
  type Fact,
  type HiddenRef,
  type Invite,
  type ItemExperience,
  type ItemType,
  type LibraryItems,
  type LyricScript,
  type SongScriptSettings,
  type AppRole,
  type MemberRecord,
  type NewCategory,
  type NewCategoryField,
  type NewCircle,
  type NewExperience,
  type NewInvite,
  type NewWordConnection,
  type Notification,
  type Post,
  type PostLanguage,
  type Recipe,
  type Bookmark,
  type Remedy,
  type ReportReason,
  type Shared,
  type SharedPost,
  type SharedBook,
  type SharedRecipe,
  type SharedSong,
  type SharedWord,
  type Song,
  type UploadKind,
  type Word,
} from "./api";

export function savedKey(itemType: ItemType, itemId: number) {
  return `${itemType}:${itemId}`;
}

/**
 * What an ordinary member of the circle sees: a hidden category is gone from the
 * list, and a hidden shelf's posts show up as unfiled rather than disappearing.
 * The same rule the server applies, applied again to a manager's fuller list so a
 * share form never offers something the circle has switched off.
 */
export function activeCategories(categories: CircleCategory[]): CircleCategory[] {
  return categories
    .filter((category) => !category.hidden)
    .map((category) => ({
      ...category,
      uncategorizedCount:
        category.uncategorizedCount +
        category.subcategories
          .filter((shelf) => shelf.hidden)
          .reduce((total, shelf) => total + shelf.count, 0),
      subcategories: category.subcategories.filter((shelf) => !shelf.hidden),
    }));
}

/**
 * Everything the app shares lives in one place: the six collections, the
 * member's own library, the circles they belong to, and the group's activity
 * feed. Collections reload when the signed-in member changes, because private
 * items, saved items, and circle membership are all per-member.
 *
 * `ready` is Identity's answer to who is asking, and nothing is read before it
 * lands. That is not tidiness: `userId` is null until the answer arrives, so a
 * store that started without it read the whole app twice on every page load —
 * once as a visitor, whose listings come back empty, and again as the member a
 * second or two later. The first round put an empty page on screen and declared
 * itself loaded, which is precisely the stale screen a member saw between
 * logging in and the app catching up.
 */
/**
 * How long what is on screen may go unread before coming back to the front is
 * worth eight requests. Coming back to the front is not a rare event on a phone —
 * every notification and every app switch is one — so this is what keeps the
 * automatic re-read an event rather than a poll. It is also the whole of the
 * answer now: there is no refresh button to fall back on, the reasoning being
 * that asking for fresh content is not a thing an app should make somebody do.
 */
const STALE_AFTER_MS = 60_000;

export function useShareAndLearn(userId: string | null, ready = true) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [words, setWords] = useState<Word[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [remedies, setRemedies] = useState<Remedy[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<CircleCategory[]>([]);
  const [circleCategories, setCircleCategories] = useState<Record<number, CircleCategory[]>>({});
  /**
   * One circle's folders, keyed by circle, because a folder tree belongs to a
   * circle rather than to the member: two circles are two unrelated trees and
   * there is no cross-circle list worth keeping. A keeper's copy also carries the
   * folders they have hidden, which is what makes showing one again possible.
   */
  const [circleFolders, setCircleFolders] = useState<Record<number, Folder[]>>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [saves, setSaves] = useState<{ itemType: ItemType; itemId: number; createdAt: string }[]>([]);
  const [libraryItems, setLibraryItems] = useState<LibraryItems>({});
  const [learnedWordIds, setLearnedWordIds] = useState<number[]>([]);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [discoverCircles, setDiscoverCircles] = useState<Circle[]>([]);
  const [circleInvitations, setCircleInvitations] = useState<CircleInvitation[]>([]);
  const [circleRequests, setCircleRequests] = useState<CircleRequest[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  // Where this member stands with the group, and the moderation they can see or do.
  const [access, setAccess] = useState<AccessState>(NO_ACCESS);
  const [accessLoaded, setAccessLoaded] = useState(false);
  // The last standing the server actually answered with, and whose it was, so a
  // dropped re-read can be told from a real refusal. Kept in a ref because it is
  // read inside a callback rather than rendered.
  const lastAccess = useRef<AccessState | null>(null);
  const lastAccessFor = useRef<string | null>(null);
  /** When everything was last read in full, so returning to the app is not a poll. */
  const lastFullRead = useRef(0);
  /**
   * Which circles' full category lists this session has read. `refreshAll()` reads
   * them again, because those are the only lists that carry counts — the
   * member-wide one leaves them out — and a refresh that renewed the shares while
   * leaving the category tiles on yesterday's numbers is the staleness complaint
   * all over again. Kept in a ref rather than derived from `circleCategories`, so
   * refreshing does not re-subscribe the listeners that call it.
   */
  const countedCircles = useRef(new Set<number>());
  /**
   * Which circles' folders this session has read, for the same reason and kept
   * the same way: folder counts are derived from the shares, so a refresh that
   * renewed the feed and left the folder counts alone would be stale in exactly
   * the place a member is looking.
   */
  const folderedCircles = useRef(new Set<number>());
  const [moderating, setModerating] = useState<number[]>([]);
  const [openReports, setOpenReports] = useState<Record<string, number>>({});
  const [hidden, setHidden] = useState<HiddenRef[]>([]);
  const [blocked, setBlocked] = useState<BlockedMember[]>([]);
  const [directory, setDirectory] = useState<MemberRecord[]>([]);
  // Which scripts the Songs category offers, as the app admin has it set. Read once at
  // startup because two very different surfaces need it and neither should ask for
  // itself: the share form pre-ticks it, and the links under a song are drawn from it.
  const [songScripts, setSongScripts] = useState<SongScriptSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Which member the state below belongs to, and the guard that keeps somebody
   * else's answer from landing on it.
   *
   * Every read here is started for a particular member and answers some
   * milliseconds later, by which time the member may have changed — logging out
   * and back in as somebody else happens without the page ever reloading. A reply
   * that arrives after the switch is the previous member's data, so it is dropped
   * rather than filed. Kept in a ref because it is read inside callbacks that
   * were created a render or two ago rather than rendered.
   */
  const populatedFor = useRef<string | null>(userId);
  const isCurrent = useCallback((member: string | null) => populatedFor.current === member, []);

  /** The activity feed is a member's own; a visitor has nothing waiting for them. */
  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      return;
    }
    try {
      const list = await fetchNotifications();
      if (isCurrent(userId)) setNotifications(list);
    } catch {
      // The activity feed is a nice-to-have; a failure here stays quiet.
    }
  }, [isCurrent, userId]);

  /** Invites belong to whoever sent them, so an anonymous visitor has none. */
  const loadInvites = useCallback(async () => {
    if (!userId) {
      setInvites([]);
      return;
    }
    try {
      const list = await fetchInvites();
      if (isCurrent(userId)) setInvites(list);
    } catch {
      // Same reasoning as the feed: the rest of the page still works.
    }
  }, [isCurrent, userId]);

  /**
   * Circles, the ones on offer, and whoever is waiting at either door.
   *
   * Asked for even with nobody logged in, because the answer then is not nothing:
   * it is Discover, with a null role, which is what gives a visitor a circle in
   * view and therefore a page. The invitations and requests come back empty, as
   * they should — those are conversations, and a visitor is not in one.
   */
  const loadCircles = useCallback(async () => {
    try {
      const state = await fetchCircles();
      if (!isCurrent(userId)) return;
      setCircles(state.circles);
      setDiscoverCircles(state.discover);
      setCircleInvitations(state.invitations);
      setCircleRequests(state.requests);
    } catch {
      // A circles hiccup should not take the shared feed down with it.
    }
  }, [isCurrent, userId]);

  /**
   * The people a circle's managers can invite. Registering first means the caller shows up
   * in everybody else's contact list too, which is how the group knows who is in
   * it without an Identity admin call.
   */
  const loadContacts = useCallback(async () => {
    if (!userId) {
      setContacts([]);
      return;
    }
    try {
      await registerMember();
    } catch {
      // Being listed is a courtesy; failing to register changes nothing else.
    }
    try {
      const list = await fetchContacts();
      if (isCurrent(userId)) setContacts(list);
    } catch {
      // Same again.
    }
  }, [isCurrent, userId]);

  /**
   * The categories of every circle the member is in, as they see them, which is
   * what a share form picks from and what names a custom post in the feed. With
   * nobody logged in it is Discover's, so the grid on the page a visitor landed
   * on is drawn from the same list every member's is.
   */
  const loadCategories = useCallback(async () => {
    try {
      const list = await fetchMyCategories();
      if (isCurrent(userId)) setCategories(list);
    } catch {
      // A missing category list narrows the share form; it breaks nothing else.
    }
  }, [isCurrent, userId]);

  /**
   * A change of member empties the store.
   *
   * Everything in it was read as somebody — a manager's category list carries what
   * they switched off, a library is one member's shelf, a feed is what reached
   * them — so when the member changes, every last row of it is the wrong
   * member's. Without this the app went on showing the previous session's songs,
   * feed and standing for as long as the new member's reads took to answer, which
   * is the whole of "I log in and see the old screen for a few seconds".
   *
   * `loading` and `accessLoaded` go back with it, so what fills the gap is the
   * loading state the tabs already have rather than stale content, and no gate is
   * decided from the standing of the account that has just left. The first run is
   * a no-op by design: at mount the store is already empty and there is nothing
   * to clear.
   */
  useEffect(() => {
    if (populatedFor.current === userId) return;
    populatedFor.current = userId;
    setSongs([]);
    setRecipes([]);
    setFacts([]);
    setWords([]);
    setBooks([]);
    setRemedies([]);
    setPosts([]);
    setCategories([]);
    setCircleCategories({});
    setNotifications([]);
    setInvites([]);
    setSaves([]);
    setLibraryItems({});
    setLearnedWordIds([]);
    setCircles([]);
    setDiscoverCircles([]);
    setCircleInvitations([]);
    setCircleRequests([]);
    setContacts([]);
    setAccess(NO_ACCESS);
    setAccessLoaded(false);
    setModerating([]);
    setOpenReports({});
    setHidden([]);
    setBlocked([]);
    setDirectory([]);
    setSongScripts(null);
    setCircleFolders({});
    setLoading(true);
    setError(null);
  }, [userId]);

  /**
   * One circle's list in full — for whoever looks after it that includes what is
   * hidden, which is why the admin screens read this rather than the member-wide
   * list. Counts come with it, so this is also the call behind a category page.
   */
  const loadCircleCategories = useCallback(async (circleId: number) => {
    const list = await fetchCircleCategories(circleId);
    countedCircles.current.add(circleId);
    setCircleCategories((prev) => ({ ...prev, [circleId]: list }));
    setCategories((prev) => [
      ...prev.filter((category) => category.circleId !== circleId),
      ...activeCategories(list),
    ]);
    return list;
  }, []);

  /** A circle that has been left or closed takes its categories with it. */
  const forgetCircleCategories = useCallback((circleId: number) => {
    countedCircles.current.delete(circleId);
    setCircleCategories((prev) => {
      if (!(circleId in prev)) return prev;
      const next = { ...prev };
      delete next[circleId];
      return next;
    });
    setCategories((prev) => prev.filter((category) => category.circleId !== circleId));
    folderedCircles.current.delete(circleId);
    setCircleFolders((prev) => {
      if (!(circleId in prev)) return prev;
      const next = { ...prev };
      delete next[circleId];
      return next;
    });
  }, []);

  /** One circle's fresh folder tree, with the counts its own page shows. */
  const takeFolders = useCallback((circleId: number, list: Folder[]) => {
    folderedCircles.current.add(circleId);
    setCircleFolders((prev) => ({ ...prev, [circleId]: list }));
    return list;
  }, []);

  /**
   * A circle's folders, read on its own rather than with the circle: the folders
   * are what a normal circle is navigated by, so the page asks for them directly
   * and every mutation below answers with the whole tree.
   */
  const loadCircleFolders = useCallback(
    async (circleId: number) => takeFolders(circleId, await fetchCircleFolders(circleId)),
    [takeFolders],
  );

  /**
   * Where the member stands: admitted or not, in a circle or not, allowed to start
   * one or not, plus what they have hidden, who they have blocked and where the
   * reports are waiting. Read once at startup and again after anything that could
   * move it, because it decides between the app and a gate screen.
   *
   * It answers the state it read, so a caller about to refuse something can ask
   * again and act on the reply rather than on whatever was in hand. Standing is
   * the one part of the store somebody else can change — an admin vouching for an
   * account, or pausing one — so the answer held here goes stale without anything
   * happening in this browser at all.
   *
   * A *failed* read is not an answer, and is deliberately not treated as one once
   * a real answer has landed. This runs again on every focus and every
   * `visibilitychange` — picking a photo, switching apps, waking a phone — and a
   * single dropped request used to replace the whole app with the "we could not
   * read where your account stands" screen, taking any open form down with it.
   * Somebody halfway through editing a song would watch it close for reasons that
   * had nothing to do with them. So a failure keeps the last known standing, and
   * only the first read, with nothing known yet, falls back to allowing nothing.
   */
  const loadAccess = useCallback(async (): Promise<AccessState> => {
    try {
      const state = await fetchMyAccess();
      lastAccess.current = state.access;
      lastAccessFor.current = userId;
      // An answer about somebody who is no longer signed in is still the answer to
      // the question the caller asked, so it is returned — but it is not written
      // into a store that now belongs to a different member.
      if (isCurrent(userId)) {
        setAccess(state.access);
        setModerating(state.moderating);
        setOpenReports(state.openReports);
        setHidden(state.hidden);
        setBlocked(state.blocked);
        setDirectory(state.directory);
      }
      return state.access;
    } catch {
      // Only the answer this same account was last given counts; a login or a
      // logout in between makes it somebody else's.
      const known = lastAccessFor.current === userId ? lastAccess.current : null;
      if (known) return known;
      if (isCurrent(userId)) setAccess(NO_ACCESS);
      return NO_ACCESS;
    } finally {
      if (isCurrent(userId)) setAccessLoaded(true);
    }
  }, [isCurrent, userId]);

  /**
   * The enabled script list, which every logged-in member may read. A failure leaves it
   * null rather than guessing at a list: the form falls back to asking the author from a
   * blank slate and a song still offers whatever its own row says it can, so a dropped
   * request costs a convenience rather than the feature.
   */
  const loadSongScripts = useCallback(async () => {
    if (!userId) {
      setSongScripts(null);
      return;
    }
    try {
      const list = await fetchSongScripts();
      if (isCurrent(userId)) setSongScripts(list);
    } catch {
      // Left as it was. An admin who has just saved is the only person who would
      // notice, and they will see it on the next read.
    }
  }, [isCurrent, userId]);

  const reload = useCallback(async () => {
    try {
      const [
        songList,
        recipeList,
        factList,
        wordList,
        bookList,
        remedyList,
        bookmarkList,
        postList,
        library,
      ] = await Promise.all([
        fetchSongs(),
        fetchRecipes(),
        fetchFacts(),
        fetchWords(),
        fetchBooks(),
        fetchRemedies(),
        fetchBookmarks(),
        fetchPosts(),
        fetchLibrary(),
      ]);
      // Nine requests take as long as the slowest of them, which is plenty of
      // time for a login to land. What came back is then the previous member's
      // reading of the group, and writing it now would put their page back on
      // screen — with `loading` false beside it, so nothing would take it off
      // again until the real load finished.
      if (!isCurrent(userId)) return;
      setSongs(songList);
      setRecipes(recipeList);
      setFacts(factList);
      setWords(wordList);
      setBooks(bookList);
      setRemedies(remedyList);
      setBookmarks(bookmarkList);
      setPosts(postList);
      setSaves(library.saves);
      setLibraryItems(library.items ?? {});
      setLearnedWordIds(library.learnedWordIds);
      setError(null);
    } catch (err) {
      if (isCurrent(userId)) {
        setError(err instanceof Error ? err.message : "Could not load what the group has shared.");
      }
    } finally {
      if (isCurrent(userId)) setLoading(false);
    }
  }, [isCurrent, userId]);

  /**
   * The one read of everything, and it waits for Identity.
   *
   * `ready` is false for the first moment of every page load, while the session is
   * restored from storage and `getUser()` answers. Reading before that answer
   * arrives is not merely early — it is a whole round of the app read as *nobody*,
   * because `visibleTo()` on the server answers false for a caller with no
   * account, so every listing comes back empty and `loading` goes false over the
   * top of it. Then the answer lands, `userId` changes, and the same eight
   * requests are made again as the member. That second wave is the pause a member
   * saw between logging in and their own page appearing.
   */
  useEffect(() => {
    if (!ready) return;
    reload();
    loadNotifications();
    loadInvites();
    loadCircles();
    loadCategories();
    loadContacts();
    loadAccess();
    loadSongScripts();
  }, [
    ready,
    reload,
    loadNotifications,
    loadInvites,
    loadCircles,
    loadCategories,
    loadContacts,
    loadAccess,
    loadSongScripts,
    userId,
  ]);

  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(loadNotifications, 20000);
    return () => clearInterval(interval);
  }, [loadNotifications, ready]);

  /**
   * Everything, read again, on purpose.
   *
   * The app is loaded once and afterwards kept current optimistically by whoever
   * is doing the typing, which is exactly right for the member making a change
   * and no use at all to the one watching: a song added on a phone does not
   * appear on the laptop that has been open since breakfast, and a manager who has
   * just switched a category on somewhere else sees the old grid. There was no
   * way to say "look again" short of reloading the browser, which on an installed
   * PWA is not an obvious thing to do.
   *
   * Deliberately **not** `loading`. The page on screen is already correct enough,
   * and blanking it back to "Loading what the group shared…" would replace a
   * slightly stale answer with no answer at all. Nothing announces this: the lists
   * simply change underneath when they change.
   *
   * The counted category lists go with it. They are read per circle and are the
   * only place the tile counts come from, so leaving them out meant a refresh that
   * renewed every share on the page and left the grid above it saying "3 books"
   * when there were five.
   *
   * Every read is caught on its own so one failing does not sink the others —
   * `reload()` already reports its own trouble through `error`, and a notification
   * count arriving a moment late is not worth a message.
   */
  const refreshAll = useCallback(async () => {
    const quiet = (work: Promise<unknown>) => work.catch(() => {});
    await Promise.all([
      quiet(reload()),
      quiet(loadNotifications()),
      quiet(loadInvites()),
      quiet(loadCircles()),
      quiet(loadCategories()),
      quiet(loadContacts()),
      quiet(loadAccess()),
      quiet(loadSongScripts()),
      ...Array.from(countedCircles.current, (circleId) =>
        quiet(loadCircleCategories(circleId)),
      ),
      ...Array.from(folderedCircles.current, (circleId) =>
        quiet(loadCircleFolders(circleId)),
      ),
    ]);
  }, [
    reload,
    loadNotifications,
    loadInvites,
    loadCircles,
    loadCategories,
    loadContacts,
    loadAccess,
    loadSongScripts,
    loadCircleCategories,
    loadCircleFolders,
  ]);

  /**
   * The app comes back to the front and reads again. Two things at two rhythms.
   *
   * Standing changes without anybody touching this browser — an admin vouches for
   * an account, or pauses one — and the answer read at startup would otherwise
   * hold until a reload, which is how a member who had just been approved kept
   * being told they could not start a circle. That one is cheap and is read every
   * single time.
   *
   * Everything else — the shares, the circles, the categories — is read again too,
   * but no more than once every `STALE_AFTER_MS`, because coming back to the front
   * happens constantly on a phone (every notification, every app switch) and eight
   * requests on each of them would be a poll dressed up as an event. The interval
   * is long enough that returning after lunch reads fresh and tapping between two
   * apps does not.
   *
   * This is now the whole answer to "it does not update dynamically" rather than
   * half of it: the header used to carry a refresh button beside the bell, and it
   * was the most web-like control in an app that is meant to read as an installed
   * one. Anything it could do, coming back to the front does — including the
   * counted category lists, which `refreshAll()` now reads for itself.
   */
  useEffect(() => {
    if (!userId) return;
    function refresh() {
      if (document.visibilityState !== "visible") return;
      loadAccess();
      const now = Date.now();
      if (now - lastFullRead.current < STALE_AFTER_MS) return;
      lastFullRead.current = now;
      refreshAll();
    }
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [loadAccess, refreshAll, userId]);

  const savedKeys = useMemo(
    () => new Set(saves.map((save) => savedKey(save.itemType, save.itemId))),
    [saves],
  );
  const learnedSet = useMemo(() => new Set(learnedWordIds), [learnedWordIds]);
  /** What this member has hidden, as keys, so a card can offer to show it again. */
  const hiddenKeys = useMemo(
    () => new Set(hidden.map((row) => savedKey(row.itemType, row.itemId))),
    [hidden],
  );
  const blockedIds = useMemo(() => new Set(blocked.map((row) => row.memberId)), [blocked]);
  /** The circles this member moderates, for the panels only a moderator gets. */
  const moderatingSet = useMemo(() => new Set(moderating), [moderating]);
  /** Posts carry circle ids; the feed needs the icon and name behind each one. */
  const circleById = useMemo(
    () => new Map(circles.map((circle) => [circle.id, circle])),
    [circles],
  );

  /**
   * Counts are worked out from the posts themselves, never stored, so anything
   * shared, refiled or deleted can change them. Reloading is quiet: the number on
   * a shelf catching up a moment late is not worth an error message.
   */
  const refreshCategories = useCallback(() => {
    loadCategories().catch(() => {});
  }, [loadCategories]);

  /** One circle's fresh list, into both the admin copy and the member-wide one. */
  const takeCategories = useCallback((circleId: number, list: CircleCategory[]) => {
    setCircleCategories((prev) => ({ ...prev, [circleId]: list }));
    setCategories((prev) => [
      ...prev.filter((category) => category.circleId !== circleId),
      ...activeCategories(list),
    ]);
    return list;
  }, []);

  const categoriesByCircle = useMemo(() => {
    const grouped = new Map<number, CircleCategory[]>();
    for (const category of categories) {
      const list = grouped.get(category.circleId);
      if (list) list.push(category);
      else grouped.set(category.circleId, [category]);
    }
    for (const list of grouped.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);
    return grouped;
  }, [categories]);

  /** A custom post names its category and nothing else; the feed needs the rest. */
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  /**
   * Something shared can be on screen twice — in its own tab and again in My
   * Library — so a discussion, a like or an experience has to land on both copies
   * or the two disagree until the next reload.
   */
  function patchBook(id: number, change: (book: Book) => Book) {
    setBooks((prev) => prev.map((item) => (item.id === id ? change(item) : item)));
    setLibraryItems((prev) =>
      prev.book
        ? { ...prev, book: prev.book.map((item) => (item.id === id ? change(item) : item)) }
        : prev,
    );
  }

  function patchSong(id: number, change: (song: Song) => Song) {
    setSongs((prev) => prev.map((item) => (item.id === id ? change(item) : item)));
    setLibraryItems((prev) =>
      prev.song
        ? { ...prev, song: prev.song.map((item) => (item.id === id ? change(item) : item)) }
        : prev,
    );
  }

  function patchRecipe(id: number, change: (recipe: Recipe) => Recipe) {
    setRecipes((prev) => prev.map((item) => (item.id === id ? change(item) : item)));
    setLibraryItems((prev) =>
      prev.recipe
        ? { ...prev, recipe: prev.recipe.map((item) => (item.id === id ? change(item) : item)) }
        : prev,
    );
  }

  function patchRemedy(id: number, change: (remedy: Remedy) => Remedy) {
    setRemedies((prev) => prev.map((item) => (item.id === id ? change(item) : item)));
    setLibraryItems((prev) =>
      prev.remedy
        ? { ...prev, remedy: prev.remedy.map((item) => (item.id === id ? change(item) : item)) }
        : prev,
    );
  }

  /**
   * Every discussion mutation is a change to one share's list of threads, and the
   * two kinds of share that have threads keep them in different collections — so
   * this is the single place that knows which one to reach into.
   */
  function patchDiscussions(
    itemType: DiscussionItemType,
    itemId: number,
    change: (threads: Discussion[]) => Discussion[],
  ) {
    const apply = <T extends { discussions?: Discussion[] }>(item: T) => ({
      ...item,
      discussions: change(item.discussions ?? []),
    });
    if (itemType === "book") patchBook(itemId, apply);
    else patchSong(itemId, apply);
  }

  /**
   * Both reply calls and the summary answer with the whole thread, so this is the
   * only patch they need — and the thread names the share it belongs to, so nothing
   * has to be threaded down from the component that asked.
   */
  function replaceDiscussion(discussion: Discussion) {
    patchDiscussions(discussion.itemType, discussion.itemId, (threads) =>
      threads.map((thread) => (thread.id === discussion.id ? discussion : thread)),
    );
  }

  /**
   * Takes something off the screen without waiting for a reload — what hiding a
   * post and blocking a member both look like from the reader's side. The server
   * has the last word on the next read; this is only so the tap has an effect.
   */
  function dropWhere(matches: (item: { id: number; memberId: string }) => boolean, type?: ItemType) {
    const keep = <T extends { id: number; memberId: string }>(rows: T[]) =>
      rows.filter((row) => !matches(row));
    if (!type || type === "song") setSongs(keep);
    if (!type || type === "recipe") setRecipes(keep);
    if (!type || type === "fact") setFacts(keep);
    if (!type || type === "word") setWords(keep);
    if (!type || type === "book") setBooks(keep);
    if (!type || type === "remedy") setRemedies(keep);
    if (!type || type === "bookmark") setBookmarks(keep);
    if (!type || type === "post") setPosts(keep);
    // A saved copy of a hidden or blocked share goes quiet too, or My Library
    // would still be showing what the feed no longer does.
    setLibraryItems((prev) => {
      const next: LibraryItems = { ...prev };
      if ((!type || type === "song") && next.song) next.song = keep(next.song);
      if ((!type || type === "recipe") && next.recipe) next.recipe = keep(next.recipe);
      if ((!type || type === "fact") && next.fact) next.fact = keep(next.fact);
      if ((!type || type === "word") && next.word) next.word = keep(next.word);
      if ((!type || type === "book") && next.book) next.book = keep(next.book);
      if ((!type || type === "remedy") && next.remedy) next.remedy = keep(next.remedy);
      if ((!type || type === "bookmark") && next.bookmark) next.bookmark = keep(next.bookmark);
      if ((!type || type === "post") && next.post) next.post = keep(next.post);
      return next;
    });
  }

  /**
   * Where one share sits, after it has been moved into a folder or out of one.
   * A move answers with the only two things it can have changed — the circles the
   * share reaches, and its folder and shelf in each of them — so this patches
   * those onto the row and leaves the words, the photos and everything said about
   * it exactly as they were.
   *
   * Written per kind rather than by indexing on the type, the same way
   * `dropWhere` is: the eight collections hold eight different shapes, and one
   * line each is plainer than a cast. The saved copy in My Library is refiled too,
   * or a member reading it from their own shelf would see the old folder until the
   * next full read.
   */
  function refileItem(
    itemType: ItemType,
    itemId: number,
    filed: { circleIds: number[]; filings: CircleFiling[] },
  ) {
    const moved = <T extends { id: number }>(rows: T[]) =>
      rows.map((row) => (row.id === itemId ? { ...row, ...filed } : row));
    if (itemType === "song") setSongs(moved);
    if (itemType === "recipe") setRecipes(moved);
    if (itemType === "fact") setFacts(moved);
    if (itemType === "word") setWords(moved);
    if (itemType === "book") setBooks(moved);
    if (itemType === "remedy") setRemedies(moved);
    if (itemType === "bookmark") setBookmarks(moved);
    if (itemType === "post") setPosts(moved);
    setLibraryItems((prev) => {
      const next: LibraryItems = { ...prev };
      if (itemType === "song" && next.song) next.song = moved(next.song);
      if (itemType === "recipe" && next.recipe) next.recipe = moved(next.recipe);
      if (itemType === "fact" && next.fact) next.fact = moved(next.fact);
      if (itemType === "word" && next.word) next.word = moved(next.word);
      if (itemType === "book" && next.book) next.book = moved(next.book);
      if (itemType === "remedy" && next.remedy) next.remedy = moved(next.remedy);
      if (itemType === "bookmark" && next.bookmark) next.bookmark = moved(next.bookmark);
      if (itemType === "post" && next.post) next.post = moved(next.post);
      return next;
    });
  }

  async function toggleSave(itemType: ItemType, itemId: number) {
    const key = savedKey(itemType, itemId);
    const alreadySaved = savedKeys.has(key);
    // Optimistic: the button flips immediately and rolls back if the call fails.
    setSaves((prev) =>
      alreadySaved
        ? prev.filter((save) => savedKey(save.itemType, save.itemId) !== key)
        : [{ itemType, itemId, createdAt: new Date().toISOString() }, ...prev],
    );
    try {
      if (alreadySaved) await removeFromLibrary(itemType, itemId);
      else await saveToLibrary(itemType, itemId);
    } catch (err) {
      setSaves((prev) =>
        alreadySaved
          ? [{ itemType, itemId, createdAt: new Date().toISOString() }, ...prev]
          : prev.filter((save) => savedKey(save.itemType, save.itemId) !== key),
      );
      throw err;
    }
  }

  async function toggleLearned(wordId: number) {
    const learned = learnedSet.has(wordId);
    setLearnedWordIds((prev) => (learned ? prev.filter((id) => id !== wordId) : [...prev, wordId]));
    try {
      await setWordLearned(wordId, !learned);
    } catch (err) {
      setLearnedWordIds((prev) =>
        learned ? [...prev, wordId] : prev.filter((id) => id !== wordId),
      );
      throw err;
    }
  }

  return {
    songs,
    recipes,
    facts,
    words,
    books,
    remedies,
    bookmarks,
    posts,
    categories,
    categoriesByCircle,
    categoryById,
    circleCategories,
    circleFolders,
    notifications,
    invites,
    saves,
    libraryItems,
    savedKeys,
    learnedWordIds: learnedSet,
    circles,
    discoverCircles,
    circleInvitations,
    circleRequests,
    circleById,
    contacts,
    access,
    accessLoaded,
    moderating: moderatingSet,
    openReports,
    hidden,
    hiddenKeys,
    blocked,
    blockedIds,
    directory,
    /**
     * Which scripts songs are offered in, and null until the answer lands. Null is
     * read as "not known yet" everywhere rather than as an empty list, so nothing
     * flashes a song with no scripts on it before the setting arrives.
     */
    songScripts,
    loadSongScripts,
    /**
     * The app admin saving the list. The answer replaces what is held, so what is on
     * screen afterwards is what the server kept rather than what was submitted.
     */
    async saveSongScripts(scripts: LyricScript[]) {
      setSongScripts(await updateSongScripts(scripts));
    },
    loading,
    error,
    reload,
    /**
     * Read everything again without blanking the page — the refresh button, and
     * the throttled re-read when the app comes back to the front.
     */
    refreshAll,
    loadAccess,
    loadNotifications,
    loadInvites,
    loadCircles,
    loadCategories,
    loadCircleCategories,
    /** A circle page reads its categories with the rest of the circle; this is where they land. */
    receiveCategories: takeCategories,
    loadCircleFolders,
    /** A read made somewhere else — a manager, say — lands here for everybody. */
    receiveFolders: takeFolders,
    refreshCategories,
    loadContacts,
    toggleSave,
    toggleLearned,

    /**
     * Agreeing to the Community Guidelines, which every member is asked once
     * before their first share. The server answers with the refreshed access, so
     * the form the member was on the way to can open straight afterwards without
     * waiting for another read.
     */
    async acceptGuidelines() {
      const state = await apiAcceptGuidelines();
      setAccess(state);
      return state;
    },

    // The ⋮ menu on a post, and the moderation behind it. Reporting sends a post
    // to whoever moderates the circle it was read in; hiding and blocking are the
    // reader's own view and change nothing for anybody else.
    /** Reports a post to its circle's moderators. Nothing about it changes on screen. */
    async reportPost(input: {
      itemType: ItemType;
      itemId: number;
      reason: ReportReason;
      details?: string;
      circleId?: number | null;
    }) {
      return reportItem(input);
    },
    /**
     * Hides a post for this member alone. Optimistic, because a hidden post
     * disappearing a second later would read as the tap not having worked.
     */
    async hidePost(itemType: ItemType, itemId: number) {
      const previous = hidden;
      setHidden((prev) => [...prev, { itemType, itemId }]);
      dropWhere((item) => item.id === itemId, itemType);
      try {
        await apiHideItem(itemType, itemId);
      } catch (err) {
        setHidden(previous);
        await reload();
        throw err;
      }
    },
    /** Puts one back. The listings have to come down again to bring it with them. */
    async unhidePost(itemType: ItemType, itemId: number) {
      await apiUnhideItem(itemType, itemId);
      setHidden((prev) =>
        prev.filter((row) => !(row.itemType === itemType && row.itemId === itemId)),
      );
      await reload();
    },
    /**
     * Blocks somebody. A block is mutual and silent: neither member sees the
     * other's shares or contributions from here on, nothing is deleted, and the
     * blocked member is never told. Everything they wrote goes at once, which is
     * the whole point of pressing it.
     */
    async blockPerson(memberId: string, memberName?: string | null) {
      const previous = blocked;
      setBlocked((prev) => [
        { memberId, memberName: memberName ?? null, createdAt: new Date().toISOString() },
        ...prev,
      ]);
      dropWhere((item) => item.memberId === memberId);
      try {
        await apiBlockMember(memberId, memberName);
        await loadAccess();
      } catch (err) {
        setBlocked(previous);
        await reload();
        throw err;
      }
    },
    /** Unblocking brings everything back, so the collections are read again. */
    async unblockPerson(memberId: string) {
      await apiUnblockMember(memberId);
      setBlocked((prev) => prev.filter((row) => row.memberId !== memberId));
      await Promise.all([reload(), loadAccess()]);
    },
    /**
     * A moderator's answer to a report. "remove" takes the post out of the circle
     * it was reported in and deletes nothing, so the listings come back down to
     * show where it went.
     */
    async settleReport(id: number, decision: "dismiss" | "remove") {
      const result = await apiResolveReport(id, decision);
      await Promise.all([loadAccess(), decision === "remove" ? reload() : null]);
      return result;
    },
    /** A manager of the circle making a member an admin, or taking the role back. */
    async setCircleRole(circleId: number, memberId: string, role: "admin" | "member") {
      const member = await apiSetCircleMemberRole(circleId, memberId, role);
      await Promise.all([loadCircles(), loadNotifications()]);
      return member;
    },
    /**
     * The app admin's few levers, for abuse and support and nothing else —
     * plus naming an App Manager, which is the one that grants no lever at all.
     */
    async setMemberStanding(
      memberId: string,
      changes: { trusted?: boolean; status?: "active" | "suspended"; role?: AppRole },
    ) {
      const member = await updateMemberStanding(memberId, changes);
      setDirectory((prev) => prev.map((row) => (row.id === memberId ? { ...row, ...member } : row)));
      return member;
    },
    /**
     * What the app cost, member by member, for one month. Not folded into the
     * store's state: it is one screen's read, asked for when that screen opens
     * and by nobody else, so keeping a copy of it here would be a copy nothing
     * else reads.
     */
    async usageReport(month?: string) {
      return fetchUsageReport(month);
    },
    /**
     * The blocks a member is on either side of, and the circles they are in — the
     * two things that decide whether one member can read another, answered
     * together because on their own neither explains anything.
     */
    async memberBlocks(memberId: string) {
      return apiFetchMemberBlocks(memberId);
    },
    /**
     * Lifting a block somebody else placed. The collections come back down
     * afterwards because the admin may well be the member who could not see
     * anything, in which case what was missing reappears with this.
     */
    async liftBlock(memberId: string, otherId: string) {
      const result = await apiLiftMemberBlock(memberId, otherId);
      await Promise.all([reload(), loadAccess()]);
      return result;
    },
    /** Every circle in the group, and whether a stray Discover is among them. */
    async circleRoll() {
      return apiFetchCircleRoll();
    },
    /**
     * Folds any duplicate Discover back into one. It moves shares and members
     * between circles, so everything is read again — the member running it is
     * quite likely one of the people who could not see the other side.
     */
    async mergeDefaultCircles() {
      const result = await apiMergeDefaultCircles();
      await Promise.all([reload(), loadCircles(), loadAccess()]);
      return result;
    },
    /**
     * The blobs nothing points at any more, per store. Nothing in the app reads
     * a stray, so neither of these touches the collections: the report is about
     * storage rather than about anything a member can see.
     */
    async orphanBlobs() {
      return apiFetchOrphans();
    },
    /** Removes the strays the admin picked, and answers the report afresh. */
    async deleteOrphanBlobs(store: string, keys: string[]) {
      return apiDeleteOrphanBlobs(store, keys);
    },

    /**
     * Starting a circle is also joining one, so the access read comes back down
     * with it: "join a circle first" stops being true the moment this returns.
     */
    async createCircle(input: NewCircle) {
      const result = await apiCreateCircle(input);
      setCircles((prev) => [result.circle, ...prev]);
      setCircleCategories((prev) => ({ ...prev, [result.circle.id]: result.categories }));
      setCategories((prev) => [...prev, ...activeCategories(result.categories)]);
      await Promise.all([loadCircles(), loadNotifications(), loadAccess()]);
      return result;
    },
    async editCircle(id: number, changes: Partial<NewCircle>) {
      const circle = await apiUpdateCircle(id, changes);
      setCircles((prev) => prev.map((item) => (item.id === id ? circle : item)));
      return circle;
    },
    /**
     * Closing a circle can change what its posts reach, so the collections come
     * back down with the circle list — and it can also leave the owner in no
     * circle at all, which is what the access read answers.
     */
    async removeCircle(id: number) {
      await apiDeleteCircle(id);
      setCircles((prev) => prev.filter((item) => item.id !== id));
      forgetCircleCategories(id);
      await Promise.all([reload(), loadCircles(), loadNotifications(), loadAccess()]);
    },
    async inviteToCircle(id: number, memberIds: string[]) {
      const invited = await apiInviteToCircle(id, memberIds);
      await loadCircles();
      return invited;
    },
    /**
     * Joining opens up that circle's posts, so everything reloads behind it — the
     * access read included, since being in a circle is the one thing the
     * "join a circle first" door waits for. Skipping it would leave a member who
     * has just joined still standing at it.
     */
    async joinCircle(id: number) {
      const result = await apiJoinCircle(id);
      await Promise.all([
        loadCircles(),
        loadNotifications(),
        result.joined ? reload() : null,
        result.joined ? loadCategories() : null,
        result.joined ? loadAccess() : null,
      ]);
      return result;
    },
    async approveCircleRequest(id: number, memberId: string) {
      await apiApproveCircleRequest(id, memberId);
      await Promise.all([loadCircles(), loadNotifications()]);
    },
    /**
     * Leaving hides that circle's posts again — but not anything already saved.
     * Leaving the last one puts the member back at the join-a-circle door, which
     * is why the access read comes with it.
     */
    async leaveCircle(id: number) {
      await apiLeaveCircle(id);
      setCircles((prev) => prev.filter((item) => item.id !== id));
      forgetCircleCategories(id);
      await Promise.all([reload(), loadCircles(), loadNotifications(), loadAccess()]);
    },
    async removeCircleMember(id: number, memberId: string) {
      await apiRemoveCircleMember(id, memberId);
      await loadCircles();
    },

    // Categories and their shelves. Every one of these calls comes back with the
    // circle's whole list, counts included, so there is nothing to patch by hand.
    /** Ticking a built-in back on, or inventing a category for this circle alone. */
    async addCategory(circleId: number, input: NewCategory) {
      return takeCategories(circleId, await apiAddCircleCategory(circleId, input));
    },
    async editCategory(
      circleId: number,
      categoryId: number,
      changes: { name?: string; icon?: string; hidden?: boolean },
    ) {
      return takeCategories(circleId, await apiUpdateCircleCategory(circleId, categoryId, changes));
    },
    async reorderCategories(circleId: number, order: number[]) {
      return takeCategories(circleId, await apiReorderCircleCategories(circleId, order));
    },
    /**
     * Removing a category the circle invented. The posts in it are moved or left
     * private to whoever wrote them, never deleted, so the collections and the
     * activity feed both come back down with the new list.
     */
    async removeCategory(
      circleId: number,
      categoryId: number,
      disposition?: { posts: "move"; to: number } | { posts: "release" },
    ) {
      const result = await apiRemoveCircleCategory(circleId, categoryId, disposition);
      takeCategories(circleId, result.categories);
      await Promise.all([reload(), loadNotifications()]);
      return result;
    },

    /**
     * Asking for a taxonomy node. `parentId` is which node it goes beneath — null
     * for one at the top of the category. A name close to one already under the
     * same parent comes back as `similar` with nothing created; calling again with
     * `confirm` makes it anyway.
     */
    async addShelf(
      circleId: number,
      categoryId: number,
      name: string,
      parentId: number | null = null,
      confirm = false,
    ) {
      const outcome = await apiAddSubcategory(circleId, categoryId, name, parentId, confirm);
      if (outcome.categories.length > 0) takeCategories(circleId, outcome.categories);
      return outcome;
    },
    /**
     * Renaming a node, hiding it, moving it under another parent, or merging it
     * into one. `parentId` is the move, and it takes the branch under the node
     * along with it — a node names its parent and nothing else.
     */
    async editShelf(
      circleId: number,
      categoryId: number,
      subcategoryId: number,
      changes: {
        name?: string;
        hidden?: boolean;
        mergeIntoId?: number;
        parentId?: number | null;
      },
    ) {
      return takeCategories(
        circleId,
        await apiUpdateSubcategory(circleId, categoryId, subcategoryId, changes),
      );
    },
    /**
     * The node goes; what was filed on it moves one level up, and its children
     * are promoted to the same place rather than cut off from the category.
     */
    async removeShelf(circleId: number, categoryId: number, subcategoryId: number) {
      return takeCategories(
        circleId,
        await apiRemoveSubcategory(circleId, categoryId, subcategoryId),
      );
    },
    async reorderShelves(circleId: number, categoryId: number, order: number[]) {
      return takeCategories(
        circleId,
        await apiReorderSubcategories(circleId, categoryId, order),
      );
    },

    // A circle's folders — where a share belongs, as against what kind of thing
    // it is. Every one of these answers with the circle's whole tree, counts
    // included, so there is nothing to patch by hand. Shaping the tree belongs to
    // whoever looks after the circle; the server refuses anybody else.
    /**
     * Asking for a folder. `parentId` is which folder it goes inside — null for
     * one at the top of the circle. A name close to one already inside the same
     * parent comes back as `similar` with nothing made; calling again with
     * `confirm` makes it anyway.
     */
    async addFolder(circleId: number, name: string, parentId: number | null = null, confirm = false) {
      const outcome = await apiAddFolder(circleId, name, parentId, confirm);
      if (outcome.folders.length > 0) takeFolders(circleId, outcome.folders);
      return outcome;
    },
    /**
     * Renaming a folder, hiding it, moving it inside another, or merging it into
     * one. `parentId` is the move, and it takes the subfolders under it along —
     * a folder names its parent and nothing else.
     */
    async editFolder(
      circleId: number,
      folderId: number,
      changes: { name?: string; hidden?: boolean; mergeIntoId?: number; parentId?: number | null },
    ) {
      return takeFolders(circleId, await apiUpdateFolder(circleId, folderId, changes));
    },
    /**
     * The folder goes; what was in it moves one level up and its subfolders are
     * promoted to the same place. Nothing anybody shared is deleted, so the
     * collections come back down with the tree.
     */
    async removeFolder(circleId: number, folderId: number) {
      const list = takeFolders(circleId, await apiRemoveFolder(circleId, folderId));
      await reload().catch(() => {});
      return list;
    },
    async reorderFolders(circleId: number, order: number[]) {
      return takeFolders(circleId, await apiReorderFolders(circleId, order));
    },
    /**
     * Putting something already shared into one of its circle's folders, or back
     * at the top of the circle with `folderId` null. This is the other half of
     * folders: a share names its folder on the form that made it, and until now
     * there was no way to change that answer afterwards — which left everything
     * shared before a folder existed sitting outside every folder for good.
     *
     * The move itself is one PATCH carrying `folderId` and nothing else, so it
     * cannot touch the words, the photos, the shelf or the audience, and whoever
     * keeps the circle may make it on somebody else's share exactly as they may
     * already correct one. Afterwards the row is refiled in place and the
     * circle's folder tree is re-read, because the counts on it have moved.
     */
    async moveToFolder(
      itemType: ItemType,
      itemId: number,
      folderId: number | null,
      circleId?: number | null,
    ) {
      const filed = await apiMoveItemToFolder(itemType, itemId, folderId);
      refileItem(itemType, itemId, filed);
      // The counts are derived per folder, so both the folder it left and the one
      // it arrived in are now wrong until the tree is read again. A failure here
      // costs a stale number and nothing else, so it never fails the move.
      const circles = circleId ? [circleId] : filed.circleIds;
      await Promise.all(
        circles.map((id) => loadCircleFolders(id).catch(() => {})),
      );
      return filed;
    },

    /**
     * The extra questions a custom category asks. Adding one belongs to whoever
     * looks after the circle — its owner or one of its admins — because a field
     * reshapes the form everybody else fills in, which is the opposite of a
     * shelf. Every other way of reshaping it is the same set of people.
     */
    async addField(circleId: number, categoryId: number, input: NewCategoryField) {
      const outcome = await apiAddCategoryField(circleId, categoryId, input);
      if (outcome.categories.length > 0) takeCategories(circleId, outcome.categories);
      return outcome;
    },
    async editField(
      circleId: number,
      categoryId: number,
      fieldId: number,
      changes: {
        label?: string;
        kind?: FieldKind;
        options?: string[];
        hint?: string | null;
        required?: boolean;
        /**
         * An upload field's own rules; ignored on every other kind, and each half
         * of them ignored on the other sort of upload — a document is asked which
         * formats and how big, audio is asked how it may be answered.
         */
        uploadKind?: UploadKind;
        fileTypes?: FieldFileType[];
        maxBytes?: number | null;
        multiple?: boolean;
        audioWays?: AudioWay[];
        hidden?: boolean;
      },
    ) {
      return takeCategories(
        circleId,
        await apiUpdateCategoryField(circleId, categoryId, fieldId, changes),
      );
    },
    /** The question goes and the answers with it, so the posts come back down too. */
    async removeField(circleId: number, categoryId: number, fieldId: number) {
      const categories = await apiRemoveCategoryField(circleId, categoryId, fieldId);
      takeCategories(circleId, categories);
      await reload();
      return categories;
    },
    async reorderFields(circleId: number, categoryId: number, order: number[]) {
      return takeCategories(
        circleId,
        await apiReorderCategoryFields(circleId, categoryId, order),
      );
    },

    /** A post in a category a circle invented. Its category decides its circle. */
    async addPost(input: SharedPost) {
      const post = await createPost(input);
      setPosts((prev) => [post, ...prev]);
      loadNotifications();
      refreshCategories();
      return post;
    },
    async editPost(id: number, changes: SharedPost) {
      const post = await updatePost(id, changes);
      setPosts((prev) => prev.map((item) => (item.id === id ? post : item)));
      refreshCategories();
      return post;
    },
    async removePost(id: number) {
      await deletePost(id);
      setPosts((prev) => prev.filter((item) => item.id !== id));
      refreshCategories();
    },
    /**
     * The post's own details in one of the scripts its author offered — the same
     * words, different letters. The answer is folded into the post already loaded —
     * and into the saved copy in My Library — so the same script opens instantly the
     * next time, on either surface.
     */
    async translatePost(id: number, language: PostLanguage) {
      const translation = await apiTranslatePost(id, language);
      const fold = (post: Post) => ({
        ...post,
        translations: [
          ...(post.translations ?? []).filter((row) => row.language !== language),
          translation,
        ],
      });
      setPosts((prev) => prev.map((item) => (item.id === id ? fold(item) : item)));
      setLibraryItems((prev) =>
        prev.post
          ? { ...prev, post: prev.post.map((item) => (item.id === id ? fold(item) : item)) }
          : prev,
      );
      return translation;
    },

    async inviteFriend(input: NewInvite) {
      const invite = await createInvite(input);
      setInvites((prev) => [invite, ...prev]);
      return invite;
    },
    async cancelInvite(token: string) {
      const invite = await revokeInvite(token);
      setInvites((prev) => prev.map((item) => (item.token === token ? invite : item)));
    },

    addSong(song: Song) {
      setSongs((prev) => [song, ...prev]);
      loadNotifications();
    },
    async editSong(id: number, changes: SharedSong) {
      const song = await updateSong(id, changes);
      // The whole row, on both copies: an edit can now swap the recording itself, and
      // a saved copy still pointing at the take that was replaced would go on playing
      // it until the next reload.
      patchSong(id, () => song);
      return song;
    },
    async removeSong(id: number) {
      await deleteSong(id);
      setSongs((prev) => prev.filter((item) => item.id !== id));
    },
    /**
     * Asks for the song's own words in another script and keeps what came back on
     * the song, so tapping Kannada and then Telugu and then Kannada again is one
     * request each and none after. The words converted are the ones the member who
     * shared the recording typed — nothing here goes looking for a song's lyrics.
     */
    async songLyricScript(songId: number, script: LyricScript) {
      const rendered = await renderSongLyricScript(songId, script);
      patchSong(songId, (song) => ({
        ...song,
        lyricScripts: [
          ...(song.lyricScripts ?? []).filter((row) => row.script !== script),
          rendered,
        ],
      }));
      return rendered;
    },

    async addRecipe(input: SharedRecipe) {
      const recipe = await createRecipe(input);
      setRecipes((prev) => [recipe, ...prev]);
      loadNotifications();
      return recipe;
    },
    async editRecipe(id: number, changes: SharedRecipe) {
      const recipe = await updateRecipe(id, changes);
      setRecipes((prev) => prev.map((item) => (item.id === id ? recipe : item)));
    },
    async removeRecipe(id: number) {
      await deleteRecipe(id);
      setRecipes((prev) => prev.filter((item) => item.id !== id));
    },

    async addFact(input: Shared<Fact>) {
      const fact = await createFact(input);
      setFacts((prev) => [fact, ...prev]);
      loadNotifications();
      return fact;
    },
    async editFact(id: number, changes: Shared<Fact>) {
      const fact = await updateFact(id, changes);
      setFacts((prev) => prev.map((item) => (item.id === id ? fact : item)));
    },
    async removeFact(id: number) {
      await deleteFact(id);
      setFacts((prev) => prev.filter((item) => item.id !== id));
    },

    async addWord(input: SharedWord) {
      const word = await createWord(input);
      setWords((prev) => [word, ...prev]);
      loadNotifications();
      return word;
    },
    async editWord(id: number, changes: SharedWord) {
      const word = await updateWord(id, changes);
      setWords((prev) => prev.map((item) => (item.id === id ? word : item)));
    },
    async removeWord(id: number) {
      await deleteWord(id);
      setWords((prev) => prev.filter((item) => item.id !== id));
    },
    /**
     * A language connection belongs to the word rather than to the member who
     * added it, so it lands on the word wherever the word is being read.
     */
    async addWordConnection(wordId: number, input: NewWordConnection) {
      const connection = await createWordConnection(wordId, input);
      setWords((prev) =>
        prev.map((item) =>
          item.id === wordId
            ? {
                ...item,
                connections: [
                  ...(item.connections ?? []).filter((row) => row.id !== connection.id),
                  connection,
                ],
              }
            : item,
        ),
      );
      return connection;
    },
    async removeWordConnection(wordId: number, connectionId: number) {
      await deleteWordConnection(wordId, connectionId);
      setWords((prev) =>
        prev.map((item) =>
          item.id === wordId
            ? {
                ...item,
                connections: (item.connections ?? []).filter((row) => row.id !== connectionId),
              }
            : item,
        ),
      );
    },

    async addBook(input: SharedBook) {
      const book = await createBook(input);
      setBooks((prev) => [book, ...prev]);
      loadNotifications();
      return book;
    },
    async editBook(id: number, changes: SharedBook) {
      const book = await updateBook(id, changes);
      setBooks((prev) => prev.map((item) => (item.id === id ? book : item)));
    },
    async removeBook(id: number) {
      await deleteBook(id);
      setBooks((prev) => prev.filter((item) => item.id !== id));
    },

    // Discussions on a book or a recording. Starting one, joining one and closing
    // one are all things any member the share reaches may do, so none of them is
    // gated on owning it — the same rule a word's language connections follow.
    async startDiscussion(itemType: DiscussionItemType, itemId: number, prompt: string) {
      const discussion = await apiStartDiscussion(itemType, itemId, prompt);
      patchDiscussions(itemType, itemId, (threads) => [discussion, ...threads]);
      loadNotifications();
      return discussion;
    },
    async removeDiscussion(
      itemType: DiscussionItemType,
      itemId: number,
      discussionId: number,
    ) {
      await apiDeleteDiscussion(itemType, itemId, discussionId);
      patchDiscussions(itemType, itemId, (threads) =>
        threads.filter((thread) => thread.id !== discussionId),
      );
    },
    async replyToDiscussion(discussionId: number, body: string) {
      const discussion = await replyToDiscussion(discussionId, body);
      replaceDiscussion(discussion);
      return discussion;
    },
    async removeDiscussionReply(discussionId: number, replyId: number) {
      const discussion = await deleteDiscussionReply(discussionId, replyId);
      replaceDiscussion(discussion);
      return discussion;
    },
    /** The AI reading of a long thread. The server caches it; this stores what came back. */
    async summarizeDiscussion(discussionId: number) {
      const discussion = await summarizeDiscussion(discussionId);
      replaceDiscussion(discussion);
      return discussion;
    },
    /** Optimistic: the count moves as the button is pressed and rolls back on failure. */
    async toggleBookLike(bookId: number) {
      const liked = books.find((book) => book.id === bookId)?.likedByMe ?? false;
      const guess = (book: Book) => ({
        ...book,
        likeCount: Math.max(0, (book.likeCount ?? 0) + (liked ? -1 : 1)),
        likedByMe: !liked,
      });
      patchBook(bookId, guess);
      try {
        const state = await setBookLike(bookId, !liked);
        patchBook(bookId, (book) => ({ ...book, ...state }));
      } catch (err) {
        patchBook(bookId, (book) => ({
          ...book,
          likeCount: Math.max(0, (book.likeCount ?? 0) + (liked ? 1 : -1)),
          likedByMe: liked,
        }));
        throw err;
      }
    },

    async addRemedy(input: Shared<Remedy>) {
      const remedy = await createRemedy(input);
      setRemedies((prev) => [remedy, ...prev]);
      loadNotifications();
      return remedy;
    },
    async editRemedy(id: number, changes: Shared<Remedy>) {
      const remedy = await updateRemedy(id, changes);
      setRemedies((prev) => prev.map((item) => (item.id === id ? remedy : item)));
    },
    async removeRemedy(id: number) {
      await deleteRemedy(id);
      setRemedies((prev) => prev.filter((item) => item.id !== id));
    },

    async addBookmark(input: Shared<Bookmark>) {
      const bookmark = await createBookmark(input);
      setBookmarks((prev) => [bookmark, ...prev]);
      loadNotifications();
      return bookmark;
    },
    async editBookmark(id: number, changes: Shared<Bookmark>) {
      const bookmark = await updateBookmark(id, changes);
      setBookmarks((prev) => prev.map((item) => (item.id === id ? bookmark : item)));
    },
    async removeBookmark(id: number) {
      await deleteBookmark(id);
      setBookmarks((prev) => prev.filter((item) => item.id !== id));
    },

    /**
     * Experiences and tips on a recipe, and the experiences and extras members add
     * to a remedy. One pair of calls for both, because the story is the same: what
     * happened when somebody actually tried it, written by whoever tried it.
     */
    async addExperience(itemType: "recipe" | "remedy", itemId: number, input: NewExperience) {
      const experience = await createExperience(itemType, itemId, input);
      const add = <T extends { experiences?: ItemExperience[] }>(item: T) => ({
        ...item,
        experiences: [...(item.experiences ?? []), experience],
      });
      if (itemType === "recipe") patchRecipe(itemId, add);
      else patchRemedy(itemId, add);
      return experience;
    },
    async removeExperience(itemType: "recipe" | "remedy", itemId: number, experienceId: number) {
      await deleteExperience(experienceId);
      const drop = <T extends { experiences?: ItemExperience[] }>(item: T) => ({
        ...item,
        experiences: (item.experiences ?? []).filter((row) => row.id !== experienceId),
      });
      if (itemType === "recipe") patchRecipe(itemId, drop);
      else patchRemedy(itemId, drop);
    },
  };
}

export type ShareAndLearn = ReturnType<typeof useShareAndLearn>;
