// db/schema.ts
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Every shared item carries the member who created it plus a visibility flag:
 * "shared" means the whole group sees it, "private" keeps it to its author.
 */
export const songs = pgTable("songs", {
  id: serial().primaryKey(),
  memberId: text("member_id").notNull(),
  memberName: text("member_name").notNull(),
  songName: text("song_name").notNull(),
  composer: text("composer"),
  raga: text("raga"),
  /**
   * The recording itself, in the `song-audio` store. Nullable, because a song may
   * be words alone: somebody who knows a stotra and cannot sing it today still has
   * the whole of it to give, and the lyrics — and every script derived from
   * them — stand on their own without a recording under them.
   */
  blobKey: text("blob_key"),
  durationSeconds: integer("duration_seconds"),
  /**
   * The words as the member who shared the recording wrote them down, one line per
   * line. Optional — plenty of recordings are humming — and the member's own text
   * rather than anything fetched: the app never puts words into somebody's song.
   * Everything the group reads in another script is derived from this.
   */
  lyrics: text(),
  /** What language the words above are in: "Kannada", "Sanskrit", "Hindi". */
  lyricsLanguage: text("lyrics_language"),
  /**
   * Which convention the words are typed in when they are typed in Latin letters at
   * all: "itrans", "iast", "iso" or "hk". Null on lyrics written in an Indic script,
   * where the letters say what they are, and null on every row written before this
   * column existed.
   *
   * It is stored because it is the one thing about romanised lyrics that cannot be
   * worked out by looking at them. `aa`, `ā` and `A` are three conventions' answer to
   * the same vowel, so without knowing which was meant an exact conversion is not
   * possible — which is why every romanised stotra used to be handed to a language
   * model to guess at, and why it now converts by table like everything else.
   */
  lyricsScheme: text("lyrics_scheme"),
  /**
   * Which scripts the author asked the words to be readable in, held one per line the
   * way `posts.translate_into` holds a post's. The buttons a reader sees are drawn from
   * this, so the choice is the author's rather than the app's.
   *
   * Three states, and the difference between the last two is the whole reason it is
   * text rather than a boolean. Null means nobody was ever asked — every recording
   * shared before the form had the question — and there the app keeps offering whatever
   * the words can be converted into, exactly as it did before. An empty string is an
   * author who was asked and said no, and is offered nothing. Anything else is their
   * list.
   */
  readInto: text("read_into"),
  visibility: text().notNull().default("shared"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * One song's lyrics written out in one script, so a member who reads Kannada and a
 * member who reads Telugu can follow the same song. Derived from `songs.lyrics` and
 * cached here, keyed by a digest of the words it was made from: when the author edits
 * the lyrics the digest stops matching and the rendering is quietly remade rather than
 * shown out of date.
 *
 * Rows rather than columns on `songs` because a song may have none of these or all
 * of them, and because each one is asked for by whoever wanted to read it.
 */
export const songLyricScripts = pgTable(
  "song_lyric_scripts",
  {
    id: serial().primaryKey(),
    songId: integer("song_id").notNull(),
    /**
     * One of the ids in `LYRIC_SCRIPTS` — "kannada", "tamil", "english" and the rest.
     * A row saying "hindi" is left over from when this also translated: it is left
     * where it is and simply never read, which is why nothing had to be migrated when
     * translating was taken out.
     */
    script: text().notNull(),
    /** The lyrics in that script, kept line for line with the original. */
    body: text().notNull(),
    /** A digest of the lyrics this was made from, so a stale one is spotted. */
    sourceDigest: text("source_digest").notNull(),
    /**
     * Which converter wrote this: "aksharamukha" for a script conversion, which is a
     * character mapping and therefore exact, or "ai" for a row written back when this
     * also translated and handed romanised lyrics to a model to be guessed at.
     *
     * It is on the row because those two are not interchangeable: an "ai" row is an
     * approximation of an answer a table can now give exactly, so it is retired and
     * remade rather than served. The default is "ai" for exactly that reason — it is
     * the truth about every row that already existed.
     */
    engine: text().notNull().default("ai"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("song_lyric_scripts_song_script_idx").on(table.songId, table.script),
  ],
);

export const recipes = pgTable("recipes", {
  id: serial().primaryKey(),
  memberId: text("member_id").notNull(),
  memberName: text("member_name").notNull(),
  title: text().notNull(),
  /** One ingredient per line. */
  ingredients: text().notNull(),
  /** One preparation step per line. */
  method: text().notNull(),
  notes: text(),
  prepMinutes: integer("prep_minutes"),
  /**
   * What a recipe *is* on the menu, one per line — the shape a word keeps its
   * synonyms in, and for the same reasons: the entries are short, ordered, only
   * ever read with the recipe, and there is a small fixed list of them.
   *
   * More than one applies to the same dish, which is the whole reason it is not a
   * single value: a payasa is Vegetarian and No onion & garlic at once, and asking
   * a member to pick the more important of the two is asking the wrong question.
   */
  menuTypes: text("menu_types"),
  /**
   * What kind of dish it is — Appetizer, Rice item, Sweet / Dessert. Exactly one
   * applies, so it is a column rather than a list.
   *
   * Not validated against the offered list on the way in, deliberately: a value
   * carried over from the old `category` column that nobody thought to put on the
   * new list still has to survive being read back and saved again.
   */
  dishType: text("dish_type"),
  /**
   * The single "Category" the form used to ask for, which mixed the two questions
   * above into one dropdown: Vegetarian and Non-vegetarian sat beside Dessert and
   * Drink, so a vegetarian dessert had to choose which of the two facts to record.
   *
   * Kept, never written by the current form, and read only as a fallback by
   * `recipeReadingOf()` when the two columns above are both empty — the same
   * read-time normalisation `itemRefOf()` does for a discussion's old `book_id`,
   * so nothing anybody typed had to be rewritten by a migration. A recipe saved
   * through the new form has its answer moved into the new columns and this one
   * retired, since by then the author has seen the reading and confirmed it.
   */
  category: text(),
  visibility: text().notNull().default("shared"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const facts = pgTable("facts", {
  id: serial().primaryKey(),
  memberId: text("member_id").notNull(),
  memberName: text("member_name").notNull(),
  fact: text().notNull(),
  category: text().notNull().default("Other"),
  /** Where the member learned it, so others can check it. */
  source: text(),
  visibility: text().notNull().default("shared"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * The words in Word Explorer. Everything past the word and its meaning is
 * optional, and the surface only shows the sections somebody actually filled in:
 * a word with no synonyms has no "Synonyms" heading rather than an empty one.
 */
export const words = pgTable("words", {
  id: serial().primaryKey(),
  memberId: text("member_id").notNull(),
  memberName: text("member_name").notNull(),
  word: text().notNull(),
  meaning: text().notNull(),
  example: text(),
  language: text(),
  pronunciation: text(),
  /** Words that mean nearly the same, one per line — the shape quotes use. */
  synonyms: text(),
  /** Words that mean the opposite, one per line. */
  antonyms: text(),
  /** Anything else worth saying about the word: usage, register, a memory. */
  notes: text(),
  source: text(),
  visibility: text().notNull().default("shared"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * The same idea in another language: "Asthi" in Hindi is अस्थि, and the Greek
 * root behind it is osteon. Rows rather than a column because a word may have
 * none or many, because each one names its own language, and because any member
 * who can see a word may add one — a connection is knowledge somebody else has,
 * not an edit to the word itself.
 *
 * The unique index keeps one term per language per word, so two members adding
 * the same connection at the same moment leave one row.
 */
export const wordConnections = pgTable(
  "word_connections",
  {
    id: serial().primaryKey(),
    wordId: integer("word_id").notNull(),
    /** The language the term is in: "Greek", "German", "Hindi". */
    language: text().notNull(),
    /** The word itself in that language, in that language's own script. */
    term: text().notNull(),
    /** Notes on the connection — a shared root, a false friend. */
    note: text(),
    /** Whoever added it, which need not be the author of the word. */
    memberId: text("member_id").notNull(),
    memberName: text("member_name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("word_connections_word_language_term_idx").on(
      table.wordId,
      table.language,
      table.term,
    ),
  ],
);

/** Books members have read, shared so the rest of the group finds something to read next. */
export const books = pgTable("books", {
  id: serial().primaryKey(),
  memberId: text("member_id").notNull(),
  memberName: text("member_name").notNull(),
  title: text().notNull(),
  author: text(),
  genre: text(),
  /**
   * What language the member read it in, so a Kannada or Hindi book sits in the
   * same shelf as an English one. Free text on the way in: the form offers a list
   * and an "Other" box, and both arrive here the same way.
   */
  language: text(),
  /** Out of five, and optional — not every book needs a score. */
  rating: integer(),
  /** Why the member recommends it, in their own words. */
  review: text(),
  /**
   * The first line worth remembering. Kept because it predates `quotes`, and kept
   * in sync as the first entry of it.
   */
  quote: text(),
  /** Every line worth remembering from the book, one per line. */
  quotes: text(),
  /** Where another member can buy a copy — an http(s) link, validated on the way in. */
  buyUrl: text("buy_url"),
  visibility: text().notNull().default("shared"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * A discussion somebody started on a share: one question, and whatever the group
 * says back. Rows rather than a column because a share may carry none or several,
 * and because a discussion belongs to whoever opened it — any member the share
 * reaches may start one, the way a language connection hangs off a word.
 *
 * `itemType` and `itemId` name what it hangs on, so a book can be asked which
 * chapter landed hardest and a song can be asked which raga it is built on. The
 * older `bookId` column is what threads used before songs had discussions: it is
 * left in place and read as a fallback rather than migrated, so nothing already
 * asked disappears, and new rows fill the item pair instead.
 *
 * `summary` is the AI reading of a thread that has grown long enough to be worth
 * summarising. It is cached rather than recomputed: `summaryReplyCount` records how
 * many replies it covered, so the app knows when it has fallen behind and nobody
 * pays for the same summary twice.
 */
export const bookDiscussions = pgTable("book_discussions", {
  id: serial().primaryKey(),
  /** Null on every thread written since discussions stopped being books-only. */
  bookId: integer("book_id"),
  /** "book" | "song" — the kinds of share that carry a conversation. */
  itemType: text("item_type"),
  itemId: integer("item_id"),
  /** What the discussion is about: "Which chapter impacted you the most?" */
  prompt: text().notNull(),
  /** Whoever started it, which need not be the member who shared the book. */
  memberId: text("member_id").notNull(),
  memberName: text("member_name").notNull(),
  summary: text(),
  summaryReplyCount: integer("summary_reply_count"),
  summaryAt: timestamp("summary_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** One thing said in a discussion. "12 people joined" is a count of the members here. */
export const discussionReplies = pgTable("discussion_replies", {
  id: serial().primaryKey(),
  discussionId: integer("discussion_id").notNull(),
  body: text().notNull(),
  memberId: text("member_id").notNull(),
  memberName: text("member_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * A plain 👍 on something shared. One row per member per item, so the unique index
 * is what makes liking idempotent and a second tap a removal rather than a
 * duplicate. Kept generic, the way `item_photos` is, because the answer would be
 * identical for every kind of thing shared.
 */
export const itemLikes = pgTable(
  "item_likes",
  {
    id: serial().primaryKey(),
    /** "song" | "recipe" | "fact" | "word" | "book" | "remedy" | "post" */
    itemType: text("item_type").notNull(),
    itemId: integer("item_id").notNull(),
    memberId: text("member_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("item_likes_item_member_idx").on(table.itemType, table.itemId, table.memberId),
  ],
);

/**
 * What happened when somebody actually tried it: the tip that saved the dish, the
 * substitution that worked, the extra step a family adds to a remedy. Any member
 * the share reaches may add one, because it is knowledge they have rather than an
 * edit of what the author wrote — the same rule a word's language connections
 * follow.
 *
 * `kind` separates "I made this" from "here is a tip" from anything else worth
 * adding, so a surface can label them without guessing.
 */
export const itemExperiences = pgTable("item_experiences", {
  id: serial().primaryKey(),
  /** "recipe" | "remedy" — the two kinds of share that get tried rather than read. */
  itemType: text("item_type").notNull(),
  itemId: integer("item_id").notNull(),
  /** "experience" | "tip" | "extra" */
  kind: text().notNull().default("experience"),
  body: text().notNull(),
  memberId: text("member_id").notNull(),
  memberName: text("member_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Home remedies passed down in families — the kind of thing an aunt recites from
 * memory. Health-adjacent, so the tab that shows these carries a plain note that
 * they are shared traditions and not medical advice.
 */
export const remedies = pgTable("remedies", {
  id: serial().primaryKey(),
  memberId: text("member_id").notNull(),
  memberName: text("member_name").notNull(),
  title: text().notNull(),
  /** What the remedy is for: "sore throat", "cough", "indigestion". */
  usedFor: text("used_for").notNull(),
  /** One ingredient per line, the same shape recipes use. */
  ingredients: text().notNull(),
  /** One preparation step per line. */
  preparation: text().notNull(),
  /** How much to take and when — kept apart from how it is made. */
  howToUse: text("how_to_use"),
  /** Who it came down from: "My grandmother". */
  passedDownFrom: text("passed_down_from"),
  notes: text(),
  visibility: text().notNull().default("shared"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * A link somebody thought was worth passing on, and the name they gave it.
 *
 * The smallest kind of share in the app, and deliberately so: the thing being
 * shared is somewhere else, and everything this table holds is how to find it and
 * what to call it. There is no body, no photo and nothing to read in another
 * script, because a bookmark that needed all that would be a post.
 *
 * `url` is stored as `webAddressOf()` parsed it rather than as it was typed — a
 * missing scheme filled in, and anything that is not http or https refused
 * outright — because it is read back as something a member taps, and a link that
 * has not been parsed is a link that can be a `javascript:` payload.
 *
 * Unlike the other six built-in kinds, a circle does not get this one unless its
 * owner asks for it: `BUILT_INS` marks it `defaultOn: false`, so it is offered
 * unticked when a circle is started and absent from Discover entirely.
 */
export const bookmarks = pgTable("bookmarks", {
  id: serial().primaryKey(),
  memberId: text("member_id").notNull(),
  memberName: text("member_name").notNull(),
  /** What to call it — a title the member wrote, not one fetched from the page. */
  title: text().notNull(),
  /** Where it points, already parsed and known to be http or https. */
  url: text().notNull(),
  visibility: text().notNull().default("shared"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * The photos hung off a share — the plate of sweets, the page of the book, the
 * herb the remedy is made from. Optional everywhere and never limited to one, so
 * a member can add none, or several, to anything they share.
 *
 * Kept as its own table rather than a column for the same reason `item_circles`
 * is: the count is not fixed, it is the same story for every kind of thing shared,
 * and the bytes live in Blobs while only the key belongs in Postgres.
 */
export const itemPhotos = pgTable(
  "item_photos",
  {
    id: serial().primaryKey(),
    /** "song" | "recipe" | "fact" | "word" | "book" | "remedy" | "post" */
    itemType: text("item_type").notNull(),
    itemId: integer("item_id").notNull(),
    /** Key in the `item-photos` blob store, where the image itself sits. */
    blobKey: text("blob_key").notNull(),
    /** The order the author put them in, so the first photo stays the first photo. */
    sortOrder: integer("sort_order").notNull().default(0),
    /** Whoever uploaded it, which is always the author of the item it is on. */
    memberId: text("member_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("item_photos_item_key_idx").on(table.itemType, table.itemId, table.blobKey),
  ],
);

/**
 * A member's personal library. Removing a row only removes the item from that
 * member's library — the original item stays with whoever shared it.
 */
export const savedItems = pgTable(
  "saved_items",
  {
    id: serial().primaryKey(),
    memberId: text("member_id").notNull(),
    /** "song" | "recipe" | "fact" | "word" | "book" | "remedy" */
    itemType: text("item_type").notNull(),
    itemId: integer("item_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("saved_items_member_item_idx").on(table.memberId, table.itemType, table.itemId)],
);

/** Per-member "mark as learned" state for vocabulary words. */
export const learnedWords = pgTable(
  "learned_words",
  {
    id: serial().primaryKey(),
    memberId: text("member_id").notNull(),
    wordId: integer("word_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("learned_words_member_word_idx").on(table.memberId, table.wordId)],
);

export const notifications = pgTable("notifications", {
  id: serial().primaryKey(),
  message: text("message").notNull(),
  /** Which kind of item the notification is about, for the bell's icon. */
  itemType: text("item_type"),
  /**
   * Null means "everyone in the group sees this" — the original behaviour and
   * still the case for every share. A member id addresses one member only, which
   * is how an invited friend gets welcomed and an inviter hears back.
   */
  memberId: text("member_id"),
  /**
   * When a share names circles, the notification names one too, and only that
   * circle's members ever see it. Null keeps the group-wide reach.
   */
  circleId: integer("circle_id"),
  /** Where tapping the notification should go, as an in-app hash route. */
  link: text("link"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * An invitation to join the group. The link carries an unguessable token instead
 * of an email address, so a member can send it however they like — message,
 * email, or in person. `status` moves pending → accepted (once, by one member)
 * or pending → revoked if the inviter changes their mind.
 */
export const invites = pgTable(
  "invites",
  {
    id: serial().primaryKey(),
    token: text("token").notNull(),
    inviterId: text("inviter_id").notNull(),
    inviterName: text("inviter_name").notNull(),
    /** Who the invite is for, purely so the inviter can tell their invites apart. */
    inviteeName: text("invitee_name"),
    inviteeEmail: text("invitee_email"),
    /** A line from the inviter, shown to the friend on the welcome screen. */
    note: text("note"),
    /**
     * Set when the invite was made from a circle: accepting it joins the group and
     * that circle in one step, which is how an owner invites somebody who does not
     * have an account yet. Null is the plain group invite.
     */
    circleId: integer("circle_id"),
    /** "pending" | "accepted" | "revoked" */
    status: text().notNull().default("pending"),
    acceptedMemberId: text("accepted_member_id"),
    acceptedMemberName: text("accepted_member_name"),
    acceptedAt: timestamp("accepted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("invites_token_idx").on(table.token)],
);

/**
 * A circle is a group of people with a shared interest — "Book Club",
 * "Kannada literature", "Travel lovers". Anyone can start one, every circle has
 * an owner, and two members may each run their own "Book Club" for different
 * people: circles are never unique by name.
 */
export const circles = pgTable("circles", {
  id: serial().primaryKey(),
  ownerId: text("owner_id").notNull(),
  ownerName: text("owner_name").notNull(),
  name: text().notNull(),
  description: text(),
  /** One emoji, the circle's face everywhere it appears: 📚, ✈️, 🎵. */
  icon: text().notNull().default("👥"),
  /** Key in the `circle-covers` blob store, or null when nobody added a cover. */
  coverKey: text("cover_key"),
  /**
   * "private" — invite only.
   * "discoverable" — listed, and anyone may ask the owner to let them in.
   * "public" — listed, and anyone may join on the spot.
   */
  privacy: text().notNull().default("private"),
  /**
   * The one circle everybody starts in. Exactly one row carries this — Community —
   * and every admitted member is joined to it, so a new account has somewhere to
   * read and somewhere to post before anybody invites them anywhere.
   *
   * It is owned by the app itself rather than by a member (`owner_id` is
   * "system"), so no single person can rename it, change its privacy or delete
   * it out from under everybody. Its reports go to the app admin, who moderates
   * every circle, and to whichever members are made admins of it.
   */
  isDefault: boolean("is_default").notNull().default(false),
  /**
   * The circle's one piece of taxonomy configuration: may an ordinary member
   * invent a node while they are posting, or only whoever looks after the circle?
   *
   * True is what every circle did before the column existed — "+ Add new
   * subcategory" is part of the share form — so it defaults on and nothing
   * silently loses the ability. Switching it off leaves members able to file
   * into any node that exists and unable to make a new one; the server refuses
   * them either way, the form simply stops offering.
   */
  memberTaxonomy: boolean("member_taxonomy").notNull().default(true),
  /**
   * The circle this one is a branch of, or null when it stands on its own.
   *
   * An organisation with chapters — SVKV with Austin, Houston and Phoenix — is
   * one circle with three branches, and this column is the whole of what says
   * so. It used to be inferred from the name: a circle called "SVKV - Austin"
   * was read as a branch of "SVKV" because of the prefix, which meant the
   * relationship could not be set, could not be undone, and forced every branch
   * to be named after its parent. A column is a fact somebody decided rather
   * than a coincidence of spelling, so "Austin" can simply be called Austin.
   *
   * It is **organisational only**. Nothing is inherited: membership, admins,
   * categories, subcategories, fields and posts all belong to the branch alone,
   * exactly as they did when it was a circle like any other. What it changes is
   * how a circle is *presented* — grouped under its parent on the listing,
   * nested in the header dropdown, and named "Branch of SVKV" on its own page.
   *
   * Self-referencing and nullable, so an ordinary circle is one with no answer
   * here, which is what every row said before the column existed. A cycle and a
   * branch of a branch are refused by the routes rather than by the database:
   * the depth is a rule about presentation, and the check needs the tree.
   */
  parentCircleId: integer("parent_circle_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Who is in a circle. The owner is a member too, with `role` "owner", so one
 * join answers both "can they see this?" and "may they change it?".
 *
 * "admin" sits between the two: an owner may hand the moderating of their circle
 * to somebody they trust, who can then answer reports, take a post out of the
 * circle and remove a member — and nothing else. Renaming the circle, its
 * categories, its privacy and its deletion stay with the owner.
 */
export const circleMembers = pgTable(
  "circle_members",
  {
    id: serial().primaryKey(),
    circleId: integer("circle_id").notNull(),
    memberId: text("member_id").notNull(),
    memberName: text("member_name").notNull(),
    /** "owner" | "admin" | "member" */
    role: text().notNull().default("member"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("circle_members_circle_member_idx").on(table.circleId, table.memberId)],
);

/**
 * The waiting room for a circle, in both directions: `kind` "invite" is the
 * owner asking someone in, "request" is someone asking to be let into a
 * discoverable circle. Either way nobody becomes a member until the other side
 * says yes.
 */
export const circleInvites = pgTable(
  "circle_invites",
  {
    id: serial().primaryKey(),
    circleId: integer("circle_id").notNull(),
    /** "invite" | "request" */
    kind: text().notNull().default("invite"),
    /** The member the row is about: the invitee, or the one asking to join. */
    memberId: text("member_id").notNull(),
    memberName: text("member_name").notNull(),
    /** Who started it — the owner for an invite, the same member for a request. */
    invitedById: text("invited_by_id").notNull(),
    invitedByName: text("invited_by_name").notNull(),
    /** "pending" | "accepted" | "declined" */
    status: text().notNull().default("pending"),
    respondedAt: timestamp("responded_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("circle_invites_circle_member_kind_idx").on(
      table.circleId,
      table.memberId,
      table.kind,
    ),
  ],
);

/**
 * Which circles a shared item belongs to. One row per circle, so a single item
 * reaches several circles without ever being copied. An item with no rows here
 * keeps the original reach: "shared" means everyone in the group.
 */
export const itemCircles = pgTable(
  "item_circles",
  {
    id: serial().primaryKey(),
    /** "song" | "recipe" | "fact" | "word" | "book" | "remedy" | "post" */
    itemType: text("item_type").notNull(),
    itemId: integer("item_id").notNull(),
    circleId: integer("circle_id").notNull(),
    /**
     * Which of this circle's categories the item sits in, when it is somewhere
     * other than the obvious one. Null is the ordinary case and means "the
     * category for this kind of thing" — a recipe under Recipes — which is what
     * every row said before this column existed and is why it is nullable rather
     * than back-filled.
     *
     * A value is a member having said otherwise: a song filed under Events, a
     * recipe under Festivals. It is per-circle for the same reason the shelf
     * below is — a category belongs to one circle — so the same song can be an
     * Events entry in one circle and an ordinary Songs entry in another. A post
     * in a category a circle invented carries the same id its `posts` row does,
     * which costs a column and saves every reader a special case.
     */
    categoryId: integer("category_id"),
    /**
     * Where the item sits inside its circle's category. Subcategories belong to
     * one circle, so the answer differs per circle and lives here rather than on
     * the item — one recipe can be "Rice Items" in one circle and unfiled in
     * another. Null is the legitimate "no subcategory" state, never a row named
     * "Uncategorized": an absence cannot be renamed, merged or duplicated.
     */
    subcategoryId: integer("subcategory_id"),
    /**
     * Which of the circle's folders the item was shared into — where it belongs,
     * as against what kind of thing it is. Null is the ordinary case and means
     * "shared into the circle itself rather than into any folder", which is what
     * every row said before this column existed and is why it is nullable rather
     * than back-filled.
     *
     * Per-circle for the plainest of the three reasons: a folder belongs to one
     * circle, so a recipe shared into Austin Madhwa Sangha's Krishna Janmashtami
     * and into Family at the same time is one row saying that folder and one row
     * saying none.
     *
     * It sits beside `category_id` and `subcategory_id` rather than replacing
     * them. Those two answer "which content type, and where inside it" and are
     * the older classification; this one answers "which folder", and is what the
     * folder-first circles write. Nothing reconciles them on purpose — an item
     * shared before folders existed keeps its shelf and reads as unfoldered.
     */
    folderId: integer("folder_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("item_circles_item_circle_idx").on(table.itemType, table.itemId, table.circleId),
  ],
);

/**
 * The categories one circle offers. Six of them mirror the built-in kinds of
 * thing members share, and the rest are whatever the owner added — "Festivals",
 * "Travel". A custom category belongs to the circle it was made in and is never
 * offered anywhere else, so two circles never see the shape of each other.
 *
 * `itemType` names the built-in kind this category holds, and is null for a
 * custom one, whose posts live in the `posts` table. Null sorts as distinct in a
 * unique index, so a circle has each built-in at most once while keeping as many
 * custom categories as it likes.
 */
export const circleCategories = pgTable(
  "circle_categories",
  {
    id: serial().primaryKey(),
    circleId: integer("circle_id").notNull(),
    /** "song" | "recipe" | "fact" | "word" | "book" | "remedy", or null when custom. */
    itemType: text("item_type"),
    /** The label in this circle: a circle may call Recipes whatever it likes. */
    name: text().notNull(),
    icon: text().notNull().default("📌"),
    sortOrder: integer("sort_order").notNull().default(0),
    /**
     * "active" or "hidden". Unticking a category hides it — every post is kept
     * and ticking it again brings the category back exactly as it was.
     */
    status: text().notNull().default("active"),
    /**
     * When this category's starter fields were put on it, and null for one that
     * has never been given them. It is a date rather than a flag for the reason
     * `guidelines_accepted_at` is: it says *when* the seeding happened, so a
     * later change to the starter list can be told from the original pass.
     *
     * What it is actually for is making the seeding happen exactly once. A
     * circle's Recipes category is given a configurable "Menu type" and "Dish
     * type" the first time it is read, because those two used to be hard-coded
     * lists on the form and every circle that already exists would otherwise
     * have neither. Seeding off "this category has no fields" instead would put
     * them back every time a keeper deleted them, which is the opposite of the
     * point: the lists are the circle's to shape, including down to nothing.
     */
    fieldsSeededAt: timestamp("fields_seeded_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("circle_categories_circle_type_idx").on(table.circleId, table.itemType)],
);

/**
 * A category's subcategories — "Appetizers", "Rice Items", "Sweets". Scoped to
 * one category of one circle, because the category is, and stored as rows rather
 * than text typed onto each post so that renaming and merging are one update
 * instead of a rewrite of every post.
 */
export const subcategories = pgTable(
  "subcategories",
  {
    id: serial().primaryKey(),
    categoryId: integer("category_id").notNull(),
    /**
     * The node this one hangs under, or null for a node sitting directly beneath
     * the category itself. This one nullable column is the whole of the
     * hierarchy: Recipes › Vegetarian › South Indian › Karnataka is a category
     * and three rows, each naming the one above it, and there is no ceiling on
     * the chain other than the depth cap the server keeps so a tree stays
     * readable. Null is what every row said before the column existed, so the
     * two-level model everybody already had is simply the shallow case.
     *
     * A child always shares its ancestors' `category_id`: the category is the
     * root of the tree, so a whole branch moves between categories or not at all.
     */
    parentId: integer("parent_id"),
    name: text().notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    /**
     * "active" or "hidden", the same reversible switch categories have: hiding a
     * shelf takes it out of the dropdown without moving a single post off it.
     */
    status: text().notNull().default("active"),
    /** Any member of the circle may add one from the share form. */
    createdById: text("created_by_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    /**
     * A name is unique among its own siblings rather than across the category,
     * because "Karnataka" under Vegetarian and "Karnataka" under Non-Vegetarian
     * are two real shelves and the old category-wide index would have refused the
     * second. Postgres counts nulls as distinct, so this index says nothing about
     * two nodes sitting at the top of a category — which is what the second one
     * is for.
     */
    uniqueIndex("subcategories_category_name_idx").on(table.categoryId, table.parentId, table.name),
    uniqueIndex("subcategories_category_root_name_idx")
      .on(table.categoryId, table.name)
      .where(sql`parent_id is null`),
  ],
);

/**
 * A circle's folders — "Madhwa Festivals", and "Krishna Janmashtami" under it.
 *
 * This is the other tree, and it answers a different question from the one
 * `subcategories` answers. A subcategory says where something sits *inside a
 * content type*: Recipes › Vegetarian › Karnataka, which is a shelf in the
 * recipe cupboard. A folder says where it belongs *in the circle*, whatever kind
 * of thing it is — so Krishna Janmashtami holds the songs, the recipes and the
 * bookmarks that belong to Krishna Janmashtami, and a member browsing it reads
 * all of them together. A content type is what an item *is*; a folder is where
 * it *goes*.
 *
 * So it hangs off the circle rather than off a category, which is the whole
 * structural difference: a category-rooted tree cannot hold a song and a recipe
 * in one place, because the tree itself is inside one kind. Everything else is
 * deliberately the same shape as `subcategories` — `parent_id` naming the folder
 * above and null meaning the top level, a `sort_order` for the order its
 * siblings are shown in, a reversible `status`, and the same pair of unique
 * indexes, because Postgres counts nulls as distinct and it takes two of them to
 * say one thing. The tree arithmetic is shared outright: both trees are walked by
 * `netlify/lib/tree.ts`.
 */
export const folders = pgTable(
  "folders",
  {
    id: serial().primaryKey(),
    circleId: integer("circle_id").notNull(),
    /**
     * The folder this one sits in, or null for one at the top of the circle. As
     * with a subcategory, this single nullable column is the whole of the
     * hierarchy and there is no ceiling on the chain but the depth cap the server
     * keeps.
     */
    parentId: integer("parent_id"),
    name: text().notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    /**
     * "active" or "hidden". Hiding a folder takes it off the circle page and out
     * of the share form without moving a single item out of it, and showing it
     * again brings back exactly what was there.
     */
    status: text().notNull().default("active"),
    /** Whoever made it, which is always somebody who looks after the circle. */
    createdById: text("created_by_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    /**
     * A name is unique among its own siblings rather than across the circle:
     * "Songs" under Madhwa Festivals and "Songs" under Thursday Bhajane are two
     * real folders. Nulls being distinct, the partial index below is what says
     * anything about two folders at the top of the circle.
     */
    uniqueIndex("folders_circle_name_idx").on(table.circleId, table.parentId, table.name),
    uniqueIndex("folders_circle_root_name_idx")
      .on(table.circleId, table.name)
      .where(sql`parent_id is null`),
  ],
);

/**
 * An extra question one custom category asks. Every category a circle invents
 * shares the same hand-built form — a title, some details, a shelf — and this is
 * how a circle adds what its own category actually needs: "Deity" on Stotras,
 * "Country" on Travelogue, "Tried it?" on Festivals.
 *
 * `kind` is what the form draws: "text" a single line, "textarea" a paragraph,
 * "checkbox" a yes or no, "select" a dropdown of `options` (one per line, the way
 * a word keeps its synonyms) and "multiselect" tick boxes over that same list,
 * "file" an upload and "link" a web address. Rows rather than a column of JSON on
 * the category,
 * because an answer points at the field it answers and a field is renamed,
 * reordered and switched off exactly the way a subcategory is.
 */
export const categoryFields = pgTable(
  "category_fields",
  {
    id: serial().primaryKey(),
    categoryId: integer("category_id").notNull(),
    /** What the form shows above the input: "Deity", "Region", "Tried it?". */
    label: text().notNull(),
    /** "text" | "textarea" | "checkbox" | "select" | "multiselect" | "file" | "link" */
    kind: text().notNull().default("text"),
    /**
     * The choices a member picks from, one per line — a dropdown's list and a
     * tick box group's are the same list asked two ways. Null on every other
     * kind.
     */
    options: text(),
    /** A word of help under the input, when the circle wanted to explain it. */
    hint: text(),
    /** Whether the form insists on an answer before the post can be shared. */
    required: boolean().notNull().default(false),
    /**
     * What kind of thing an upload field takes: "document" or "audio". Null is
     * "document", which is what every upload field written before a field could
     * take audio already meant — so nothing had to be back-filled and nothing
     * stored changed its meaning. Meaningless on the other five kinds.
     */
    uploadKind: text("upload_kind"),
    /**
     * How members may answer an audio field, one way per line out of "record"
     * and "upload" — null meaning both, which is the same "no preference is
     * everything" rule `file_types` already follows. The two are not the same
     * question as the document types below and never both apply, which is why
     * this is its own column rather than a second reading of that one.
     */
    audioWays: text("audio_ways"),
    /**
     * What an upload field accepts, one id per line out of "pdf", "word" and
     * "excel" — null meaning all three, which is what every field written before
     * the question could be asked reads as. Held as text rather than an array
     * for the same reason a dropdown's choices are: it is a short ordered list
     * only ever read with the field.
     */
    fileTypes: text("file_types"),
    /**
     * The biggest file this particular field takes, in bytes. Null is the
     * platform's own ceiling, which is what one request can carry; a number here
     * is a circle asking for something smaller and is never allowed to ask for
     * more.
     */
    maxBytes: integer("max_bytes"),
    /** Whether an upload field takes several files rather than one. */
    multiple: boolean().notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    /**
     * "active" or "hidden", the same reversible switch a category and a shelf
     * have: hiding a field stops the form asking it and keeps every answer
     * already given.
     */
    status: text().notNull().default("active"),
    /** Any member of the circle may add one while posting, as with a shelf. */
    createdById: text("created_by_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("category_fields_category_label_idx").on(table.categoryId, table.label)],
);

/**
 * A post in a category the owner made up. There is no way to hand-build a form
 * for a category invented at runtime, so every custom category shares this one:
 * a title, something to say, and the same sharing rules everything else has.
 *
 * Its category exists in exactly one circle, so unlike the other six kinds this
 * one is only ever shared into that circle.
 */
export const posts = pgTable("posts", {
  id: serial().primaryKey(),
  memberId: text("member_id").notNull(),
  memberName: text("member_name").notNull(),
  /** The `circle_categories` row this post belongs to. */
  categoryId: integer("category_id").notNull(),
  title: text().notNull(),
  body: text(),
  /**
   * Free text rather than a date. The form no longer asks for it — a travelogue
   * wants nothing of the sort — but posts written while it did still say it, so
   * the column stays and nothing anybody typed is thrown away.
   */
  happensOn: text("happens_on"),
  /**
   * The languages the author asked for the details in, one per line: "kannada",
   * "hindi", "telugu", "tamil", "devanagari". Empty or null means the post is
   * read in the words it was written in and nothing is ever asked of a model.
   * Text rather than rows, the way a book keeps its quotes: a short ordered list
   * only ever read with the post itself.
   */
  translateInto: text("translate_into"),
  visibility: text().notNull().default("shared"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * One share's answer to one of its category's extra fields. Stored as its own row
 * for the same reason a photo is: a share may answer none of them or all of them,
 * the set of questions changes over time, and an answer belongs to the field it
 * answers rather than to a column nobody else uses.
 *
 * Everything is kept as text — "yes" is what a ticked checkbox stores — because
 * the field says how to read it and a category invented at runtime cannot have a
 * typed column of its own.
 *
 * The table keeps its name and its now-nullable `post_id` from when only a post in
 * a custom category could be asked anything extra. A row now names what it answers
 * for with `item_type` and `item_id`, exactly the way `book_discussions` came to
 * name what a thread hangs on, and `itemRefOf()` reads the old column as a
 * fallback — so nothing had to be back-filled and no answer anybody gave was lost.
 */
export const postFieldValues = pgTable(
  "post_field_values",
  {
    id: serial().primaryKey(),
    postId: integer("post_id"),
    /** "post", "song" or "book" — the shares whose form a category can reshape. */
    itemType: text("item_type").notNull().default("post"),
    itemId: integer("item_id"),
    fieldId: integer("field_id").notNull(),
    value: text().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("post_field_values_post_field_idx").on(table.postId, table.fieldId),
    uniqueIndex("post_field_values_item_field_idx").on(
      table.itemType,
      table.itemId,
      table.fieldId,
    ),
  ],
);

/**
 * One post's details written out in one other language or one other script — the same
 * idea as `song_lyric_scripts`, and stored the same way for the same reason.
 *
 * `sourceDigest` is a hash of the details it was made from, so editing the post
 * quietly retires every translation of the old text instead of showing a reader
 * a paragraph that is no longer there. Nothing has to be swept up: a translation
 * whose digest no longer matches is simply not read, and the next member who taps
 * that language pays for one fresh rendering.
 */
export const postTranslations = pgTable(
  "post_translations",
  {
    id: serial().primaryKey(),
    postId: integer("post_id").notNull(),
    /**
     * The script the details were written out in: "devanagari" | "kannada-script" |
     * "telugu-script" | "tamil-script" | "english-script". Rows naming one of the
     * languages this once also translated into — "kannada", "hindi", "telugu",
     * "tamil" — are left where they are and simply never read, which is why nothing
     * had to be migrated when translating was taken out.
     */
    language: text().notNull(),
    /** The details in that script, kept paragraph for paragraph. */
    body: text().notNull(),
    /** A digest of the details this was made from, so a stale one is spotted. */
    sourceDigest: text("source_digest").notNull(),
    /**
     * Which converter wrote this: "aksharamukha" for a script conversion, exact
     * because it is a character mapping, or "ai" for a row written back when this also
     * translated. Defaults to "ai", which is the truth about every row written before
     * script conversion had a converter of its own — and is why one of those is remade
     * rather than served, an exact answer being one table lookup away.
     */
    engine: text().notNull().default("ai"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("post_translations_post_language_idx").on(table.postId, table.language),
  ],
);

/**
 * The people a member can pick from when inviting others into a circle. Identity
 * holds the accounts; this table is the directory the app is allowed to show, and
 * each member refreshes their own row when they open the app.
 *
 * It is also where the group records what an account is allowed to do, because
 * Identity's own metadata is not something the app can query: `admittedAt` is when
 * the account first turned up, `trustedAt` is what lets somebody start a circle,
 * `role`
 * marks the one global admin kept for abuse and support, and `status` is how that
 * admin stops an account without deleting anything it wrote.
 */
export const members = pgTable("members", {
  /** The Netlify Identity user id. */
  id: text().primaryKey(),
  name: text().notNull(),
  /** Never sent to the browser — only used to tell two members of the same name apart. */
  email: text(),
  /**
   * When this account first turned up. Anybody may sign up, so it is a record
   * rather than a gate: `accessOf()` stamps it on the account's first request,
   * `admitMember()` stamps it when the account arrived on an invite, and it is
   * never moved afterwards because the trust clock is measured from it.
   */
  admittedAt: timestamp("admitted_at"),
  /** Whoever's invite they came in on, if any — for the record and for support questions. */
  invitedById: text("invited_by_id"),
  /**
   * When the account became trusted enough to start circles. Set by hand by the
   * app admin, or the first time an established member is found to qualify on
   * their own — a confirmed email, some days on the clock, and a circle they
   * already belong to. Null means they can still share, join and moderate
   * nothing of their own.
   */
  trustedAt: timestamp("trusted_at"),
  /**
   * "member", "app_manager" or "app_admin". The global admin exists for the
   * exceptional cases — abuse nobody in a circle can settle, and technical
   * support — and for nothing else: circles are moderated by their own admins.
   *
   * "app_manager" is narrower than it sounds and is deliberately not a rank
   * between the two: it grants exactly one thing, which is reading the usage
   * report, and no lever over any account, circle or share. It exists because
   * what a deployment costs is a question the app admin may want somebody else
   * looking at, and there was no way to show that page to anybody without also
   * handing them abuse and support. Plain text rather than an enum for the
   * usual reason — a third value cost no migration — and every reader in the
   * app tests `=== "app_admin"` rather than `!== "member"`, so nothing else
   * widened by this existing.
   */
  role: text().notNull().default("member"),
  /** "active" or "suspended". A suspended account can read nothing and write nothing. */
  status: text().notNull().default("active"),
  /**
   * When this member ticked "I agree" on the Community Guidelines. Null means
   * they have not yet, and every route that creates a share turns them away
   * until they do — the agreement is asked for once, before the first post,
   * rather than on every form.
   *
   * A timestamp rather than a boolean because the question a support request
   * asks is "when did they agree?", and a column that already answers it costs
   * nothing more than the flag would have.
   */
  guidelinesAcceptedAt: timestamp("guidelines_accepted_at"),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Somebody flagging a share for the people who moderate where it was posted. A
 * report is routed by `circleId` — the circle the reporter was reading when they
 * raised it — so a circle's own admins answer for their own room, and the app
 * admin sees everything for the cases a circle cannot settle itself.
 *
 * One row per member per item, so tapping Report twice is one report rather than
 * two, and a member can say what they think once.
 */
export const contentReports = pgTable(
  "content_reports",
  {
    id: serial().primaryKey(),
    /** "song" | "recipe" | "fact" | "word" | "book" | "remedy" | "post" */
    itemType: text("item_type").notNull(),
    itemId: integer("item_id").notNull(),
    /** Which circle it was read in, and so whose admins it goes to. Null is group-wide. */
    circleId: integer("circle_id"),
    reporterId: text("reporter_id").notNull(),
    reporterName: text("reporter_name").notNull(),
    /** The member who shared the thing, kept so a queue reads without a second join. */
    authorId: text("author_id").notNull(),
    authorName: text("author_name").notNull(),
    /** "spam" | "abuse" | "inappropriate" | "wrong" | "other" */
    reason: text().notNull().default("other"),
    details: text(),
    /** "open" | "dismissed" | "removed" — what the moderator decided. */
    status: text().notNull().default("open"),
    handledById: text("handled_by_id"),
    handledByName: text("handled_by_name"),
    handledAt: timestamp("handled_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("content_reports_item_reporter_idx").on(
      table.itemType,
      table.itemId,
      table.reporterId,
    ),
  ],
);

/**
 * One member deciding they would rather not see one share. Personal and silent:
 * nothing is deleted, nobody is told, and the same post stays exactly where it
 * was for everybody else. The opposite end of the same menu from a report, which
 * asks somebody else to act.
 */
export const hiddenItems = pgTable(
  "hidden_items",
  {
    id: serial().primaryKey(),
    memberId: text("member_id").notNull(),
    /** "song" | "recipe" | "fact" | "word" | "book" | "remedy" | "post" */
    itemType: text("item_type").notNull(),
    itemId: integer("item_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("hidden_items_member_item_idx").on(table.memberId, table.itemType, table.itemId),
  ],
);

/**
 * One member blocking another. Read both ways round: whatever either of them
 * shares stops reaching the other, because a block that only works in one
 * direction leaves the person who asked for it still visible to the person they
 * were getting away from. Silent, like a hide — the blocked member is not told.
 */
export const blockedMembers = pgTable(
  "blocked_members",
  {
    id: serial().primaryKey(),
    blockerId: text("blocker_id").notNull(),
    blockedId: text("blocked_id").notNull(),
    blockedName: text("blocked_name"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("blocked_members_pair_idx").on(table.blockerId, table.blockedId)],
);

/**
 * The few settings the app admin decides for the whole group, one row per setting.
 *
 * There is exactly one of these at the moment — which scripts the Songs category
 * offers a reader — and it is a row rather than a constant in the code because that
 * is the whole point of it: enabling Malayalam should be somebody ticking a box on a
 * Tuesday, not a deploy. A key/value table rather than a column per setting, because
 * the next one of these is a different shape and a table with one row and eleven
 * nullable columns is how that ends.
 *
 * `value` is text and the module that owns a key decides what the text means — a
 * newline-separated list, for the scripts, the same way a word keeps its synonyms and
 * a song keeps the scripts its author asked for. A key nobody has ever saved has no
 * row at all, and the module answers with its own default, so the app works on a
 * deployment where no admin has touched anything.
 */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  /** Who last changed it, for an admin wondering where a setting came from. */
  updatedById: text("updated_by_id"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * What has been asked for a sign-in link recently, so an address cannot be used
 * to post somebody else's inbox.
 *
 * `POST /api/email-signin` is the one write in the app that anybody at all can
 * make — it has to be, since the whole point of it is signing in somebody who is
 * not signed in — and every call to it sends an email. Left open that is a relay:
 * one address, a loop, a thousand messages. So each address carries the two
 * numbers a rate limit needs, and the route reads them before it sends anything.
 *
 * The address itself is never stored, only `email_hash`, a SHA-256 of the
 * normalised form. That is enough to count against and useless to read: this
 * table would otherwise be a list of every email anybody has ever typed into the
 * login form, including the ones that turned out not to be members, which is a
 * list worth not having. Members who actually arrive are recorded on `members`,
 * where the address is genuinely needed.
 *
 * `window_started_at` and `sent_count` are the hourly allowance, reset when the
 * hour rolls over; `last_sent_at` is the short cooldown between one link and the
 * next, which is what stops a member who taps "Resend" four times from getting
 * four links and having to guess which is current.
 */
export const signInLinks = pgTable("sign_in_links", {
  /** SHA-256 hex of the lowercased, trimmed address. Never the address itself. */
  emailHash: text("email_hash").primaryKey(),
  lastSentAt: timestamp("last_sent_at").defaultNow().notNull(),
  windowStartedAt: timestamp("window_started_at").defaultNow().notNull(),
  sentCount: integer("sent_count").default(0).notNull(),
});

/**
 * What one member has uploaded in the last hour, so nobody can fill the account's
 * storage — or spend its bandwidth allowance — faster than a person could mean to.
 *
 * Every size rule the app had before this one was about a single thing: a photo
 * under 5 MB, a recording under 20, a document under 10, a share's whole set of
 * uploads under 50. All of them are ceilings on *one* request, and none of them
 * says anything about the hundredth request in a minute — a loop posting a legal
 * 4 MB part over and over meets every rule in the app and writes a gigabyte a
 * minute into Blobs, where nothing expires and every byte is billed twice: once
 * to store and again each time it is read back.
 *
 * So the limit here is a **rate** rather than a quota. It is deliberately not a
 * per-member cap on how much a member may keep — a member who has shared two
 * hundred recipes over two years is the app working, and telling them they are
 * full would be the wrong answer to a question nobody asked. What it stops is the
 * shape no person has: an hour's worth of writing done in a minute.
 *
 * The row is as thin as `sign_in_links` and for the same reason — two numbers and
 * a window is the whole of what a rate limit needs. `upload_count` counts
 * requests and `upload_bytes` counts what they carried, because either one alone
 * has an obvious hole: bytes alone let a thousand 1 KB writes through, and
 * requests alone let a hundred 4 MB parts through. Both are `integer` rather than
 * anything wider, which holds because the count is only ever raised when it was
 * already under the allowance — the highest either can reach is the limit plus one
 * request's worth.
 *
 * A row going missing costs one extra hour's allowance and nothing a member would
 * notice, so it hangs off no member row and nothing reads it but the limiter.
 */
export const uploadRates = pgTable("upload_rates", {
  /** The Identity id of whoever is uploading. */
  memberId: text("member_id").primaryKey(),
  windowStartedAt: timestamp("window_started_at").defaultNow().notNull(),
  uploadCount: integer("upload_count").default(0).notNull(),
  uploadBytes: integer("upload_bytes").default(0).notNull(),
});


/**
 * One link to one particular share, handed to somebody who may not be a member —
 * "I thought you would enjoy this" rather than "come and join us", which is what
 * `invites` above is for and remains for.
 *
 * The token **is** the permission, exactly as an invite's is: unguessable, minted
 * by a member who could already see the item, and naming precisely one item and
 * the one circle it was shared out of. Nothing about the link is derivable from an
 * item's id, and there is no public route anywhere that takes a circle id — so a
 * link to one recipe in a private circle is a link to that recipe and never a way
 * into the circle's roll, its folders, or anything else filed in it.
 *
 * The row is deliberately thin, and what it does *not* hold is the point: no copy
 * of the item, no copy of the circle, no snapshot of who may read what. Every read
 * re-derives all of that live, so deleting the item, making it private, or a
 * moderator taking it out of that circle stops the link answering without anything
 * having to go round and tidy up. `status` is the sharer's own off switch for a
 * link they would rather not have sent.
 */
export const itemShares = pgTable(
  "item_shares",
  {
    id: serial().primaryKey(),
    token: text("token").notNull(),
    /** Which kind of thing, and which one — the same pair every generic table uses. */
    itemType: text("item_type").notNull(),
    itemId: integer("item_id").notNull(),
    /**
     * The circle the item was shared *out of*, which is the context the recipient
     * reads ("Shared from Austin Madhwa Sangha") and the circle the Join button
     * asks about. Nullable, because a share that names no circle reaches the whole
     * group and has no one circle to have come from.
     */
    circleId: integer("circle_id"),
    sharedById: text("shared_by_id").notNull(),
    sharedByName: text("shared_by_name").notNull(),
    /** `active`, or `revoked` once the member who minted it withdraws the link. */
    status: text().notNull().default("active"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("item_shares_token_idx").on(table.token)],
);

/**
 * What one member cost the site on one day, which is a different question from
 * every other counter in this file: those describe the app, and this one describes
 * the bill.
 *
 * It exists because none of the three things Netlify actually charges for can be
 * worked out after the fact. **Bytes in** cannot: a Blobs listing answers keys and
 * etags and no sizes at all, so the only moment the size of an upload is known is
 * the moment it arrives. **Bytes out** cannot either, and that is the half worth
 * having — bandwidth is 20 credits a gigabyte of *egress*, every piece of member
 * media in this app is served by a function, and nothing anywhere writes down that
 * a recording was played. **Model calls** cannot, the gateway billing the account
 * rather than the request. So each of the three is counted where it happens, into
 * this one row, and the counting is the whole of what this table is for: nothing in
 * the app reads it, no rule is enforced from it, and a member is never shown it.
 *
 * `upload_rates` beside it looks similar and answers nothing of this. That row is a
 * **window** — it resets every hour by design, because its job is to refuse a
 * hundred uploads in a minute — so it can say whether somebody is uploading too
 * fast and can never say what they have cost. This one never resets and is never
 * decremented; a day that has been written is a fact about that day.
 *
 * One row per member per UTC day, because the day is the smallest bucket any
 * question about a bill is asked in ("what did last month come to", "who are the
 * ten heaviest members", "did that circle's festival weekend show up") and because
 * an hour's worth of rows would be twenty-four times the writes for an answer
 * nobody needs. The day is `YYYY-MM-DD` text rather than a date: it is a bucket
 * label that sorts correctly and is never arithmetic, and UTC rather than anybody's
 * local time so two functions in two regions agree on which row to add to.
 *
 * The bytes are `bigint` where the request counts are `integer`, and that asymmetry
 * is deliberate: a count is bounded by what one member can plausibly do in a day,
 * while a member with a circle full of recordings can be served past two gigabytes
 * in one — which is exactly the member this table exists to notice, so the column
 * has to hold them rather than overflow at the interesting moment.
 *
 * Two things it deliberately does not attempt. It does not attribute to a
 * **circle**, which is the unit any future metering should use, because a byte
 * arrives from a member and is served to a reader and neither of them is a circle;
 * joining these rows to `item_circles` is a question to ask of the data later, not
 * a column to guess at now. And it does not pretend to be an invoice: reads served
 * from Netlify's own edge cache never reach a function, so `served_bytes` counts
 * the egress that cost compute as well as bandwidth and undercounts the rest. It is
 * the shape of the cost and its distribution across members, which is what
 * "should this be metered, and for whom" actually needs.
 */
export const memberUsage = pgTable(
  "member_usage",
  {
    /** The Identity id of the member the bytes are attributed to. */
    memberId: text("member_id").notNull(),
    /** The UTC day this row counts, as `YYYY-MM-DD`. */
    day: text().notNull(),
    /** Bytes that arrived, charged where they were received rather than where they landed. */
    uploadBytes: bigint("upload_bytes", { mode: "number" }).default(0).notNull(),
    uploadCount: integer("upload_count").default(0).notNull(),
    /** Bytes that went back out of a media route, which is where the money goes. */
    servedBytes: bigint("served_bytes", { mode: "number" }).default(0).notNull(),
    servedRequests: integer("served_requests").default(0).notNull(),
    /** Calls to the AI Gateway made at this member's asking. */
    aiCalls: integer("ai_calls").default(0).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("member_usage_member_day_idx").on(table.memberId, table.day)],
);
