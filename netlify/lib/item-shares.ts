// netlify/lib/item-shares.ts
// One item, handed to somebody outside the app.
//
// This is the other half of `invites.ts` and deliberately not the same thing. An
// invite says "come and join this circle"; a share says "I thought you would
// enjoy this particular thing", and the content is the whole of the invitation —
// the recipient reads the recipe, listens to the recording, opens the bookmark,
// and only then is asked whether they would like more of where it came from.
//
// **The token is the permission.** It is unguessable, it is minted by a member who
// could already see the item, and it names exactly one item and the one circle it
// was shared out of. Everything a recipient is answered with is derived from those
// two facts and nothing wider: the item itself, and the circle's own shell — its
// name, its icon, its description and its privacy. Never its roll, never its head
// count, never its folder contents, never another item filed beside this one.
// There is no public route in the app that takes a circle id, which is what makes
// that a property of the design rather than a promise about the markup.
//
// Nothing is copied into the share row, and that is the second half of the safety:
// every read re-derives the item and its filing live, so deleting the share,
// making it private, or a moderator taking it out of the circle the link names
// stops the link answering at once, with nothing to go round and tidy up.

import { and, eq } from "drizzle-orm";
import type { User } from "@netlify/identity";
import { db } from "../../db/index.js";
import { circleCategories, circles, itemCircles, itemShares } from "../../db/schema.js";
import { folderPathsFor } from "./folders.js";
import {
  ITEM_TABLES,
  badRequest,
  isItemType,
  notFound,
  visibleTo,
  type ItemType,
} from "./items.js";
import { FIELDED_ITEM_TYPES, fieldValuesOf, type FieldItemType } from "./fields.js";
import { photosOf } from "./photos.js";
import { lyricReadingOf } from "./lyrics.js";
import { songScripts } from "./settings.js";
import { recipeReadingOf } from "./recipes.js";
import { readableLanguages, withTranslations } from "./translations.js";
import { connectionsOf, wordResponse } from "./words.js";
import { bookResponse } from "./books.js";

export type ItemShareRow = typeof itemShares.$inferSelect;

/**
 * The same shape an invite token has, for the same reason: long enough that
 * guessing is not a strategy, and short enough to survive being pasted into a
 * WhatsApp message by hand.
 */
export function newShareToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

/** The token off a route, or null for anything that is not one. */
export function shareTokenFrom(params: Record<string, string | undefined>) {
  const token = String(params.token ?? "").trim().toLowerCase();
  return /^[a-z0-9]{16,64}$/.test(token) ? token : null;
}

/**
 * The link this member already made for this item out of this circle, if any.
 *
 * Sharing the same recipe twice should hand out the same link rather than a second
 * one nobody can tell from the first — a member who shares something to three
 * chats has sent one thing three times. Deduped in code rather than by a unique
 * index, because `circle_id` is nullable and Postgres does not treat two nulls as
 * equal, so an index could not say what this says.
 */
async function existingShare(
  itemType: ItemType,
  itemId: number,
  circleId: number | null,
  memberId: string,
) {
  const rows = await db
    .select()
    .from(itemShares)
    .where(
      and(
        eq(itemShares.itemType, itemType),
        eq(itemShares.itemId, itemId),
        eq(itemShares.sharedById, memberId),
        eq(itemShares.status, "active"),
      ),
    );
  return rows.find((row) => row.circleId === circleId) ?? null;
}

/**
 * Which circle a new link should speak for, and whether it may be made at all.
 *
 * Answers the circle id to write — or null for an item that reaches the whole
 * group, which is what everything did before circles existed — and a `Response`
 * to refuse with when the answer is that it may not. Three things are checked and
 * they are the whole of the sharer-side rule: the member can already see the item
 * (`visibleTo()`, the same predicate every listing uses, so an item they cannot
 * see is an item that does not exist), the item is shared rather than private, and
 * the circle they are sharing it out of is one the item actually reaches.
 *
 * That last check is what stops a link claiming an audience the item never had.
 * A caller naming no circle is not refused — My Library knows what it saved and
 * not always where it came from — and the item's own filing answers instead,
 * preferring a circle the sharer is in, since that is the one they mean.
 */
export async function shareTarget(
  itemType: ItemType,
  itemId: number,
  asked: number | null,
  user: User,
  mine: number[],
): Promise<{ circleId: number | null } | Response> {
  const table = ITEM_TABLES[itemType];
  const [row] = await db
    .select({ id: table.id, visibility: table.visibility })
    .from(table)
    .where(and(eq(table.id, itemId), visibleTo(table, user, itemType)));
  if (!row) return notFound("Item");
  if (row.visibility === "private") {
    return badRequest(
      "That is a private item, so there is nothing to hand out. Share it with a circle first.",
    );
  }

  const rows = await db
    .select({ circleId: itemCircles.circleId })
    .from(itemCircles)
    .where(and(eq(itemCircles.itemType, itemType), eq(itemCircles.itemId, itemId)));
  if (rows.length === 0) return { circleId: null };

  const reaches = rows.map((each) => each.circleId);
  if (asked !== null) {
    if (!reaches.includes(asked)) {
      return badRequest("That item was not shared into that circle.");
    }
    return { circleId: asked };
  }
  return { circleId: reaches.find((id) => mine.includes(id)) ?? reaches[0] };
}

/**
 * Mint the link, or hand back the one that already exists. The caller has already
 * established that this member may see the item and that the circle is one the
 * item actually reaches — this only writes the row.
 */
export async function mintShare(
  itemType: ItemType,
  itemId: number,
  circleId: number | null,
  member: { id: string; name: string },
): Promise<ItemShareRow> {
  const already = await existingShare(itemType, itemId, circleId, member.id);
  if (already) return already;

  const [row] = await db
    .insert(itemShares)
    .values({
      token: newShareToken(),
      itemType,
      itemId,
      circleId,
      sharedById: member.id,
      sharedByName: member.name,
    })
    .returning();
  return row;
}

/** The share behind a token, or null for one that never existed or was withdrawn. */
export async function shareByToken(token: string): Promise<ItemShareRow | null> {
  const [row] = await db
    .select()
    .from(itemShares)
    .where(and(eq(itemShares.token, token), eq(itemShares.status, "active")));
  return row ?? null;
}

/**
 * Which of the item's circles a token speaks for, checked *now* rather than
 * trusted from when the link was made.
 *
 * A token naming a circle is only answered while the item still has an
 * `item_circles` row for it, so a moderator taking the share out of that circle,
 * or its author unticking it, quietly ends the link. A token naming no circle is
 * only answered while the item still names none — a share that reaches the whole
 * group, which is what everything did before circles existed.
 */
async function filingForShare(share: ItemShareRow) {
  const rows = await db
    .select({ circleId: itemCircles.circleId, folderId: itemCircles.folderId })
    .from(itemCircles)
    .where(and(eq(itemCircles.itemType, share.itemType), eq(itemCircles.itemId, share.itemId)));

  if (share.circleId === null) return rows.length === 0 ? { folderId: null } : null;
  const filing = rows.find((row) => row.circleId === share.circleId);
  return filing ? { folderId: filing.folderId } : null;
}

/**
 * What the recipient is told about where this came from: enough to want more of
 * it, and nothing that would let them read it. The head count is deliberately
 * absent, as is anything about who is in it.
 */
export interface SharedCircle {
  id: number;
  name: string;
  icon: string;
  description: string | null;
  privacy: string;
  isDefault: boolean;
  /** `Madhwa Festivals › Krishna Janmashtami`, as names alone, where it has one. */
  folderPath: string[];
}

/**
 * The item as somebody outside the app reads it.
 *
 * Two things are dropped on the way out and both matter. `memberId` goes, because
 * an Identity id is not something an anonymous reader needs; the byline name is
 * what a reader wants and is already on every card. And a song's `blobKey` goes,
 * because it is a key into the blob store and the audio is served by the token
 * instead — `hasAudio` is the whole of what the shell needs to know.
 *
 * **Everything else here is the same reading the members' own routes do, and it
 * has to be.** A Drizzle row is not the shape the browser is typed against: a
 * word's synonyms are one newline-joined `text` column and a book's quotes are
 * another, and the listings hand both to `wordResponse()` / `bookResponse()`
 * before they leave. This route did not, so a shared word arrived with
 * `synonyms: null` and a shared book with `quotes: "…"`, and the screen — which
 * trusts the type and calls `.length` and `.join(", ")` on them — threw on
 * render. With no error boundary above it that is a blank white page, which is
 * exactly the bug this normalisation removes. A new column that a members' route
 * reads through a helper belongs here too.
 */
function publicItem(itemType: ItemType, row: Record<string, unknown>) {
  const { memberId: _memberId, blobKey, ...rest } = row as Record<string, unknown> & {
    memberId?: string;
    blobKey?: string | null;
  };
  const item = { ...rest, itemType } as Record<string, unknown>;
  if (itemType === "song") item.hasAudio = Boolean(blobKey);
  if (itemType === "recipe") {
    Object.assign(
      item,
      recipeReadingOf(
        row as { menuTypes: string | null; dishType: string | null; category: string | null },
      ),
    );
  }
  if (itemType === "word") {
    Object.assign(
      item,
      wordResponse(row as { synonyms: string | null; antonyms: string | null }),
    );
    delete item.memberId;
  }
  if (itemType === "book") {
    Object.assign(item, bookResponse(row as { quote: string | null; quotes: string | null }));
    delete item.memberId;
  }
  if (itemType === "post") {
    item.translateInto = readableLanguages(row as { translateInto: string | null }).translateInto;
  }
  return item;
}

/**
 * The item's own name, which is identity rather than content — what a recipient
 * is told a locked link holds so the page can say "a recipe for Genasina Holige"
 * instead of nothing at all.
 *
 * A fun fact is the one kind with no name of its own: the whole of it is one
 * sentence, so printing its "title" would be printing the content. It answers
 * null and the screen says what kind of thing it is instead.
 */
function sharedTitle(itemType: ItemType, row: Record<string, unknown>): string | null {
  if (itemType === "fact") return null;
  if (itemType === "song") return (row.songName as string | null) ?? null;
  if (itemType === "word") return (row.word as string | null) ?? null;
  return (row.title as string | null) ?? null;
}

/** What a shared link answers with: one item, and where it came from. */
export interface SharedItemPayload {
  token: string;
  sharedByName: string;
  /** Whether whoever is asking is already in the circle the link came out of. */
  member: boolean;
  /**
   * True when the circle is invite only and this reader is not in it yet. The
   * link still answers — it names what was shared and who shared it — but `item`
   * is null, because an invite-only circle's content is not readable by somebody
   * who has not been invited into it.
   */
  locked: boolean;
  /** What kind of thing it is, which a locked link says as well as an open one. */
  itemType: ItemType;
  /** Its own name, or null for a fun fact, whose name would be its content. */
  title: string | null;
  item: Record<string, unknown> | null;
  circle: SharedCircle | null;
}

/**
 * Everything behind `GET /api/shared/:token`, assembled from scratch on every read.
 *
 * The three checks are the whole of the privacy model at this end: the item still
 * exists, it is still `shared` rather than private, and it still reaches the circle
 * the token named. Any one of them failing answers the same "not available" as a
 * token that never existed, so a link never becomes a way of finding out what
 * happened to something.
 *
 * `myCircles` is the fourth check and the one that reads the circle's own door.
 * **Open to All and Ask to Join circles are readable through a link, and a Private
 * one is not** — the first two are listed in the app and anybody may look, so a
 * link into them tells a recipient nothing they could not have found, and the
 * content being the invitation is the whole point of sharing. An invite-only
 * circle is a different promise: its members were let in one at a time, so the
 * link answers with what was shared and who shared it, and withholds the thing
 * itself until the reader is actually in the circle. That is decided here rather
 * than in the browser, because a payload the screen merely declines to draw has
 * still been sent.
 */
export async function sharedItem(
  share: ItemShareRow,
  myCircles: number[],
): Promise<SharedItemPayload | null> {
  if (!isItemType(share.itemType)) return null;
  const itemType = share.itemType;
  const table = ITEM_TABLES[itemType];

  const [row] = await db.select().from(table).where(eq(table.id, share.itemId));
  /* A share made private after the link went out stops answering: the link was to
     something its author had shared, and they have since decided otherwise. */
  if (!row || row.visibility === "private") return null;

  const filing = await filingForShare(share);
  if (!filing) return null;

  const circle = await sharedCircle(share.circleId, filing.folderId);
  const member = circle !== null && myCircles.includes(circle.id);
  const title = sharedTitle(itemType, row as Record<string, unknown>);

  /* An invite-only circle, read by somebody who is not in it: the link says what
     it is and who sent it, and nothing that was written inside the circle. There
     is nothing to join here either — the screen says to ask the sharer for an
     invitation, which is the only door such a circle has. */
  if (circle !== null && circle.privacy === "private" && !member) {
    return {
      token: share.token,
      sharedByName: share.sharedByName,
      member: false,
      locked: true,
      itemType,
      title,
      item: null,
      circle,
    };
  }

  const item = publicItem(itemType, row as Record<string, unknown>);

  /* The pictures on it, which need no login of their own — a photo is served on an
     unguessable key exactly as an uploaded document is. */
  item.photos = await photosOf(itemType, share.itemId);

  /* What the circle asked about this kind of thing, and the answers given. Read
     only for the four kinds that can be asked anything at all. */
  if ((FIELDED_ITEM_TYPES as readonly string[]).includes(itemType)) {
    const values = await fieldValuesOf(itemType as FieldItemType, [share.itemId]);
    item.fieldValues = values.get(share.itemId) ?? [];
  }

  /* A recording's words in whatever scripts have already been written for it. The
     public read never *renders* one — that costs a gateway call and belongs to
     members — so a visitor reads what the group has read already. */
  if (itemType === "song") {
    const song = row as {
      id: number;
      lyrics: string | null;
      lyricsScheme: string | null;
      readInto: string | null;
    };
    Object.assign(item, await lyricReadingOf(song, await songScripts()));
  }

  /* A post's category, which is the name of the thing it is — a Travelogue entry
     rather than "a post". One row, by id, and nothing else from that circle. */
  if (itemType === "post") {
    const categoryId = (row as { categoryId: number }).categoryId;
    const [category] = await db
      .select({ name: circleCategories.name, icon: circleCategories.icon })
      .from(circleCategories)
      .where(eq(circleCategories.id, categoryId));
    item.categoryName = category?.name ?? null;
    item.categoryIcon = category?.icon ?? null;
  }

  /* The same word in other languages, which is part of the entry rather than a
     comment on it — a word read without them is missing half of what the group
     knows about it. */
  if (itemType === "word") {
    const found = await connectionsOf([share.itemId]);
    item.connections = found.get(share.itemId) ?? [];
  }

  /* A post in whatever languages have already been written for it, read the same
     way a song's scripts are: what the group has read already, never a fresh
     gateway call on somebody else's behalf. */
  if (itemType === "post") {
    const [read] = await withTranslations([
      row as { id: number; body: string | null },
    ]);
    item.translations = read.translations;
    item.translationsAvailable = read.translationsAvailable;
  }

  return {
    token: share.token,
    sharedByName: share.sharedByName,
    member,
    locked: false,
    itemType,
    title,
    item,
    circle,
  };
}

/** The circle's shell, and the folder trail inside it as plain names. */
async function sharedCircle(
  circleId: number | null,
  folderId: number | null,
): Promise<SharedCircle | null> {
  if (circleId === null) return null;
  const [circle] = await db
    .select({
      id: circles.id,
      name: circles.name,
      icon: circles.icon,
      description: circles.description,
      privacy: circles.privacy,
      isDefault: circles.isDefault,
    })
    .from(circles)
    .where(eq(circles.id, circleId));
  if (!circle) return null;

  const paths = folderId === null ? null : await folderPathsFor([folderId]);
  return { ...circle, folderPath: paths?.get(folderId!) ?? [] };
}

/**
 * The audio behind a shared song, looked up by the token rather than by an id.
 *
 * It answers the same four questions the item read does, and the fourth is the
 * one worth stating: a recording out of an invite-only circle does not stream to
 * somebody who is not in that circle. Withholding the payload and serving the
 * bytes anyway would have been the whole gate undone by one `<audio src>`.
 */
export async function sharedSongAudio(share: ItemShareRow, myCircles: number[]) {
  if (share.itemType !== "song") return null;
  const filing = await filingForShare(share);
  if (!filing) return null;

  const circle = await sharedCircle(share.circleId, filing.folderId);
  if (circle !== null && circle.privacy === "private" && !myCircles.includes(circle.id)) {
    return null;
  }

  const [song] = await db
    .select({ blobKey: ITEM_TABLES.song.blobKey, visibility: ITEM_TABLES.song.visibility })
    .from(ITEM_TABLES.song)
    .where(eq(ITEM_TABLES.song.id, share.itemId));
  if (!song || song.visibility === "private" || !song.blobKey) return null;
  return song.blobKey;
}
