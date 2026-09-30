// netlify/lib/items.ts
// Shared helpers for the kinds of things members share: songs, recipes, fun
// facts, vocabulary words, books, traditional remedies, and bookmarks. They all
// follow the same rules — only an item's author can edit or delete it, a "private" item is
// visible to its author alone, and a "shared" item reaches either the circles it
// names or, when it names none, everyone in the group.
import type { User } from "@netlify/identity";
import { and, eq, exists, notExists, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "../../db/index.js";
import {
  blockedMembers,
  bookmarks,
  books,
  circleMembers,
  facts,
  hiddenItems,
  itemCircles,
  posts,
  recipes,
  remedies,
  songs,
  words,
} from "../../db/schema.js";

export const ITEM_TYPES = [
  "song",
  "recipe",
  "fact",
  "word",
  "book",
  "remedy",
  "bookmark",
  "post",
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

/** The table behind each item type, so callers can stay generic over all of them. */
export const ITEM_TABLES = {
  song: songs,
  recipe: recipes,
  fact: facts,
  word: words,
  book: books,
  remedy: remedies,
  bookmark: bookmarks,
  post: posts,
} as const;

export function isItemType(value: unknown): value is ItemType {
  return typeof value === "string" && (ITEM_TYPES as readonly string[]).includes(value);
}

export function memberNameOf(user: User) {
  return user.name || user.email || "A member";
}

export function visibilityOf(value: unknown) {
  return value === "private" ? "private" : "shared";
}

/** The columns every shared item has, whichever of the six tables it lives in. */
type ItemColumns = { id: AnyPgColumn; visibility: AnyPgColumn; memberId: AnyPgColumn };

/**
 * "Shared" means one of two things, depending on whether the item names circles:
 * with no circles it reaches the whole group, and with circles it reaches their
 * members only. Written as a correlated subquery so a listing stays one query.
 */
function withinCircles(table: ItemColumns, user: User, itemType: ItemType): SQL | undefined {
  const anyCircle = db
    .select({ one: sql<number>`1` })
    .from(itemCircles)
    .where(and(eq(itemCircles.itemType, itemType), eq(itemCircles.itemId, table.id)));

  const myCircle = db
    .select({ one: sql<number>`1` })
    .from(itemCircles)
    .innerJoin(
      circleMembers,
      and(
        eq(circleMembers.circleId, itemCircles.circleId),
        eq(circleMembers.memberId, user.id),
      ),
    )
    .where(and(eq(itemCircles.itemType, itemType), eq(itemCircles.itemId, table.id)));

  return or(notExists(anyCircle), exists(myCircle));
}

/**
 * What somebody with no account may read, which is nothing at all. Written as a
 * predicate rather than as an early return in each route so the rule lives in
 * one place: a listing that forgets to check who is asking still comes back
 * empty rather than handing a visitor the group's shares.
 */
function nothingAtAll(): SQL {
  return sql`false`;
}

/**
 * The two personal filters from the ⋮ menu on a post, as predicates rather than
 * a second query: a share the reader chose to hide, and anything either side of a
 * block wrote. A block is read both ways round on purpose — one that only worked
 * in one direction would leave the member who asked for it still on show to the
 * person they wanted away from.
 */
function notHiddenByMe(table: ItemColumns, user: User, itemType: ItemType) {
  return notExists(
    db
      .select({ one: sql<number>`1` })
      .from(hiddenItems)
      .where(
        and(
          eq(hiddenItems.memberId, user.id),
          eq(hiddenItems.itemType, itemType),
          eq(hiddenItems.itemId, table.id),
        ),
      ),
  );
}

function notBlockedEitherWay(table: ItemColumns, user: User) {
  return notExists(
    db
      .select({ one: sql<number>`1` })
      .from(blockedMembers)
      .where(
        or(
          and(
            eq(blockedMembers.blockerId, user.id),
            eq(blockedMembers.blockedId, table.memberId),
          ),
          and(
            eq(blockedMembers.blockedId, user.id),
            eq(blockedMembers.blockerId, table.memberId),
          ),
        ),
      ),
  );
}

/**
 * Restricts a listing to items the caller is allowed to see.
 *
 * A member sees what is shared into a circle they are in, plus the group-wide
 * shares that predate circles, plus their own private things.
 *
 * Somebody with no account is not that with a smaller list — they see nothing.
 * Everything here is written by members for the people they chose, so the
 * doorway shows what the app is *for* — the categories a circle holds — and not
 * a word of what anybody put in them. A visitor who wants to read logs in, at
 * which point the ordinary rule above applies from their first request.
 */
export function visibleTo(table: ItemColumns, user: User | null, itemType: ItemType): SQL | undefined {
  if (!user) return nothingAtAll();
  const shared = and(eq(table.visibility, "shared"), withinCircles(table, user, itemType));
  return and(
    or(shared, eq(table.memberId, user.id)),
    notHiddenByMe(table, user, itemType),
    notBlockedEitherWay(table, user),
  );
}

/**
 * The rule for something already in a member's library: circles do not come into
 * it. Leaving a circle does not empty your library — only the author deleting the
 * item, or making it private, takes it away. Hiding one and blocking its author
 * do too, because those are the reader's own decisions about what to be shown.
 */
export function savedVisibleTo(table: ItemColumns, user: User, itemType: ItemType): SQL | undefined {
  return and(
    or(eq(table.visibility, "shared"), eq(table.memberId, user.id)),
    notHiddenByMe(table, user, itemType),
    notBlockedEitherWay(table, user),
  );
}

export function ownedBy(
  table: { id: AnyPgColumn; memberId: AnyPgColumn },
  id: number,
  user: User,
): SQL | undefined {
  return and(eq(table.id, id), eq(table.memberId, user.id));
}

export function text(value: unknown) {
  return String(value ?? "").trim();
}

export function optionalText(value: unknown) {
  const trimmed = text(value);
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * The first *grapheme* of what somebody typed, for the one-glyph icons circles
 * and categories carry. Emoji are often several code points — skin tones, flags,
 * joined sequences — so counting characters is not the same as counting marks.
 * Returns null when there is nothing to take, leaving the fallback to the caller.
 */
export function firstGlyph(value: unknown) {
  const trimmed = text(value);
  if (!trimmed) return null;
  const [first] = new Intl.Segmenter().segment(trimmed);
  return first?.segment ?? null;
}

export function optionalInt(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

/** For bounded scores like a book's rating out of five; anything else becomes null. */
export function optionalIntBetween(value: unknown, min: number, max: number) {
  const parsed = optionalInt(value);
  return parsed !== null && parsed >= min && parsed <= max ? parsed : null;
}

/** An email address is optional wherever it appears, and never trusted as an identity. */
export function optionalEmail(value: unknown) {
  const trimmed = text(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

/**
 * Links members paste get rendered as anchors, so only plain http(s) URLs are
 * accepted — anything else (including `javascript:`) becomes null.
 */
export function optionalUrl(value: unknown) {
  const trimmed = text(value);
  if (!trimmed) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function idFrom(params: Record<string, string | undefined>) {
  const id = Number(params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function jsonBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function unauthorized() {
  return Response.json({ error: "You must be logged in to do that." }, { status: 401 });
}

export function notFound(what: string) {
  return Response.json({ error: `${what} not found.` }, { status: 404 });
}

export function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

/** Only the author may change an item, so a mismatch reads as "not yours". */
export function notYours(what: string) {
  return Response.json({ error: `You can only change your own ${what}.` }, { status: 403 });
}
