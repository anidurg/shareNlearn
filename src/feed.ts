import {
  formatDuration,
  recipeMenuBits,
  type Book,
  type Bookmark,
  type CircleFiling,
  type Fact,
  type ItemPhoto,
  type ItemType,
  type Post,
  type Recipe,
  type Remedy,
  type Song,
  type Visibility,
  type Word,
} from "./api";

/**
 * The topics a mixed feed can be narrowed to. The order is also the order the
 * feed uses when it is grouped by topic rather than by date.
 */
export const TOPICS: { type: ItemType; label: string; glyph: string }[] = [
  { type: "song", label: "Songs", glyph: "🎵" },
  { type: "recipe", label: "Recipes", glyph: "🍲" },
  { type: "fact", label: "Fun facts", glyph: "💡" },
  { type: "word", label: "Words", glyph: "🔤" },
  { type: "book", label: "Books", glyph: "📖" },
  { type: "remedy", label: "Remedies", glyph: "🌱" },
  { type: "bookmark", label: "Bookmarks", glyph: "🔗" },
  { type: "post", label: "Posts", glyph: "📌" },
];

export const TOPIC_ORDER: Record<ItemType, number> = TOPICS.reduce(
  (order, topic, index) => ({ ...order, [topic.type]: index }),
  {} as Record<ItemType, number>,
);

/**
 * One line in a mixed feed, whatever kind of thing it is. Used by a circle's feed
 * and by a circle's own page, which is the same feed narrowed to one circle.
 */
export interface FeedEntry {
  key: string;
  itemType: ItemType;
  id: number;
  glyph: string;
  kind: string;
  title: string;
  detail: string | null;
  /** Who shared it — what the ⋮ menu needs in order to offer "Block user". */
  memberId: string;
  memberName: string;
  createdAt: string;
  visibility: Visibility;
  /** The circles this post was shared into; empty means the whole group. */
  circleIds: number[];
  /** Which shelf it sits on in each of those circles. */
  filings: CircleFiling[];
  /** The pictures that came with it, if the member added any. */
  photos: ItemPhoto[];
  /**
   * Whether there is anything to play. Only ever false for a song, and only for
   * one shared as words alone — a stotra somebody knows by heart is a whole share,
   * so its row offers no Play button rather than one that answers a 404.
   */
  playable?: boolean;
  /**
   * Which recording that is — the song's own blob key, carried so the player under a
   * row can name the take it is playing. A song re-recorded keeps its id, so without
   * this the row would go on offering the one it replaced.
   */
  audioKey?: string | null;
  /**
   * Where the row points, for the one kind whose whole content is somewhere else.
   * A bookmark is read by leaving the app, so its row carries the address rather
   * than opening a panel that would hold nothing but the same link.
   */
  href?: string;
}

/**
 * The counts a feed row can show without opening anything: how many discussions and
 * likes a book has collected, or how many people have tried a recipe or a remedy.
 * Nothing is added when the number is zero, so a quiet row stays quiet.
 */
function countBits(counts: { glyph: string; count: number }[]) {
  return counts.filter((bit) => bit.count > 0).map((bit) => `${bit.glyph} ${bit.count}`);
}

export function songEntry(song: Song): FeedEntry {
  return {
    key: `song:${song.id}`,
    itemType: "song",
    id: song.id,
    glyph: "🎵",
    kind: "Song",
    title: song.songName,
    detail:
      [
        song.composer,
        song.raga,
        formatDuration(song.durationSeconds),
        // What the group is asking about it, mostly which raga it is. A quiet
        // recording stays quiet: a count of zero adds nothing to the line.
        ...countBits([{ glyph: "💬", count: song.discussions?.length ?? 0 }]),
      ]
        .filter(Boolean)
        .join(" · ") || null,
    memberId: song.memberId,
    memberName: song.memberName,
    createdAt: song.createdAt,
    visibility: song.visibility,
    circleIds: song.circleIds ?? [],
    filings: song.filings ?? [],
    photos: song.photos ?? [],
    playable: Boolean(song.blobKey),
    audioKey: song.blobKey,
  };
}

export function recipeEntry(recipe: Recipe): FeedEntry {
  return {
    key: `recipe:${recipe.id}`,
    itemType: "recipe",
    id: recipe.id,
    glyph: "🍲",
    kind: "Recipe",
    title: recipe.title,
    detail:
      [
        ...recipeMenuBits(recipe),
        recipe.prepMinutes ? `${recipe.prepMinutes} minutes` : null,
        ...countBits([{ glyph: "💬", count: recipe.experiences?.length ?? 0 }]),
      ]
        .filter(Boolean)
        .join(" · ") || null,
    memberId: recipe.memberId,
    memberName: recipe.memberName,
    createdAt: recipe.createdAt,
    visibility: recipe.visibility,
    circleIds: recipe.circleIds ?? [],
    filings: recipe.filings ?? [],
    photos: recipe.photos ?? [],
  };
}

export function factEntry(fact: Fact): FeedEntry {
  return {
    key: `fact:${fact.id}`,
    itemType: "fact",
    id: fact.id,
    glyph: "💡",
    kind: "Fun fact",
    title: fact.fact,
    // A fun fact is short enough that the row is the whole of it — the title
    // holds the fact itself — so its source belongs on the row too. There is
    // nothing left to open, which is why a fact row has no button.
    detail: [fact.category, fact.source].filter(Boolean).join(" · ") || null,
    memberId: fact.memberId,
    memberName: fact.memberName,
    createdAt: fact.createdAt,
    visibility: fact.visibility,
    circleIds: fact.circleIds ?? [],
    filings: fact.filings ?? [],
    photos: fact.photos ?? [],
  };
}

export function wordEntry(word: Word): FeedEntry {
  return {
    key: `word:${word.id}`,
    itemType: "word",
    id: word.id,
    glyph: "🔤",
    kind: "Word",
    title: word.word,
    detail: word.meaning,
    memberId: word.memberId,
    memberName: word.memberName,
    createdAt: word.createdAt,
    visibility: word.visibility,
    circleIds: word.circleIds ?? [],
    filings: word.filings ?? [],
    // Word Explorer carries no pictures — a word is its meaning, not an image.
    photos: [],
  };
}

export function bookEntry(book: Book): FeedEntry {
  return {
    key: `book:${book.id}`,
    itemType: "book",
    id: book.id,
    glyph: "📖",
    kind: "Book",
    title: book.title,
    detail:
      [
        book.author && `by ${book.author}`,
        book.genre,
        book.language,
        book.rating ? "★".repeat(book.rating) : null,
        ...countBits([
          { glyph: "💬", count: book.discussions?.length ?? 0 },
          { glyph: "👍", count: book.likeCount ?? 0 },
        ]),
      ]
        .filter(Boolean)
        .join(" · ") || null,
    memberId: book.memberId,
    memberName: book.memberName,
    createdAt: book.createdAt,
    visibility: book.visibility,
    circleIds: book.circleIds ?? [],
    filings: book.filings ?? [],
    photos: book.photos ?? [],
  };
}

export function remedyEntry(remedy: Remedy): FeedEntry {
  return {
    key: `remedy:${remedy.id}`,
    itemType: "remedy",
    id: remedy.id,
    glyph: "🌱",
    kind: "Remedy",
    title: remedy.title,
    detail:
      [
        `For ${remedy.usedFor}`,
        remedy.passedDownFrom && `from ${remedy.passedDownFrom}`,
        ...countBits([{ glyph: "💬", count: remedy.experiences?.length ?? 0 }]),
      ]
        .filter(Boolean)
        .join(" · ") || null,
    memberId: remedy.memberId,
    memberName: remedy.memberName,
    createdAt: remedy.createdAt,
    visibility: remedy.visibility,
    circleIds: remedy.circleIds ?? [],
    filings: remedy.filings ?? [],
    photos: remedy.photos ?? [],
  };
}

/**
 * A link somebody passed on. Its detail line is the host rather than the whole
 * address, because that is the part a reader recognises — "wikipedia.org" says
 * what a row of query parameters does not, and the address itself is one tap away
 * under the row.
 */
export function bookmarkEntry(bookmark: Bookmark): FeedEntry {
  let host: string | null = null;
  try {
    host = new URL(bookmark.url).hostname.replace(/^www\./, "");
  } catch {
    host = null;
  }
  return {
    key: `bookmark:${bookmark.id}`,
    itemType: "bookmark",
    id: bookmark.id,
    glyph: "🔗",
    kind: "Bookmark",
    title: bookmark.title,
    detail: host,
    memberId: bookmark.memberId,
    memberName: bookmark.memberName,
    createdAt: bookmark.createdAt,
    visibility: bookmark.visibility,
    circleIds: bookmark.circleIds ?? [],
    filings: bookmark.filings ?? [],
    // A bookmark is its destination, so it carries no pictures of its own.
    photos: [],
    href: bookmark.url,
  };
}

/**
 * A post in a category a circle invented. It has no kind of its own, so it wears
 * its category's name and icon — "Festivals 🎉" reads better than "Post".
 */
export function postEntry(post: Post, category?: { name: string; icon: string } | null): FeedEntry {
  const summary = post.body?.replace(/\s+/g, " ").trim() ?? "";
  return {
    key: `post:${post.id}`,
    itemType: "post",
    id: post.id,
    glyph: category?.icon ?? "📌",
    kind: category?.name ?? "Post",
    title: post.title,
    detail: summary.length > 120 ? `${summary.slice(0, 120)}…` : summary || null,
    memberId: post.memberId,
    memberName: post.memberName,
    createdAt: post.createdAt,
    visibility: post.visibility,
    circleIds: post.circleIds ?? [],
    filings: post.filings ?? [],
    photos: post.photos ?? [],
  };
}

/**
 * Everything in one list, before any filtering or sorting. `categoryOf` names the
 * category a custom post belongs to, which is the only thing a feed cannot work
 * out from the post itself.
 */
export function feedEntries(
  collections: {
    songs: Song[];
    recipes: Recipe[];
    facts: Fact[];
    words: Word[];
    books: Book[];
    remedies: Remedy[];
    bookmarks?: Bookmark[];
    posts?: Post[];
  },
  categoryOf?: (categoryId: number) => { name: string; icon: string } | null,
): FeedEntry[] {
  return [
    ...collections.songs.map(songEntry),
    ...collections.recipes.map(recipeEntry),
    ...collections.facts.map(factEntry),
    ...collections.words.map(wordEntry),
    ...collections.books.map(bookEntry),
    ...collections.remedies.map(remedyEntry),
    ...(collections.bookmarks ?? []).map(bookmarkEntry),
    ...(collections.posts ?? []).map((post) => postEntry(post, categoryOf?.(post.categoryId))),
  ];
}

/**
 * One circle's share of a collection. Navigation is circle-first, so a listing
 * shows what the circle in view holds rather than everything the member may see
 * across all of them — otherwise a book shared into Book Club turns up while
 * Family is on screen, which is not what the reader asked to look at.
 *
 * With no circle in view there is nothing to narrow to and the whole collection
 * is the answer: that is the first member of a new group, who has everything and
 * belongs to nothing yet.
 */
export function inCircle<T extends { circleIds: number[] }>(
  rows: T[],
  circleId: number | null,
): T[] {
  if (circleId === null) return rows;
  return rows.filter((row) => row.circleIds.includes(circleId));
}

/** Search across a feed: the title, the detail line, and who shared it. */
export function matchesQuery(entry: FeedEntry, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [entry.title, entry.detail, entry.memberName, entry.kind]
    .filter(Boolean)
    .some((field) => (field as string).toLowerCase().includes(needle));
}
