// netlify/functions/library.mts
import type { Config } from "@netlify/functions";
import type { User } from "@netlify/identity";
import { admittedUser } from "../lib/access.js";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  books,
  learnedWords,
  recipes as recipeRows,
  savedItems,
  words as wordRows,
} from "../../db/schema.js";
import { bookResponse } from "../lib/books.js";
import { withCircleIds } from "../lib/circles.js";
import { withDiscussions } from "../lib/discussions.js";
import { isExperienceItemType, withExperiences } from "../lib/experiences.js";
import {
  badRequest,
  isItemType,
  ITEM_TABLES,
  jsonBody,
  type ItemType,
  savedVisibleTo,
  unauthorized,
  visibleTo,
} from "../lib/items.js";
import { withLikes } from "../lib/likes.js";
import { withLyricScripts } from "../lib/lyrics.js";
import { recipeResponse } from "../lib/recipes.js";
import { songScripts } from "../lib/settings.js";
import { withPhotos } from "../lib/photos.js";
import { readableLanguages, withTranslations } from "../lib/translations.js";
import { withFieldValues } from "../lib/fields.js";
import { wordResponse, withConnections } from "../lib/words.js";

/** Members may only save something they are allowed to see. */
async function isVisible(itemType: ItemType, itemId: number, user: User) {
  const table = ITEM_TABLES[itemType];
  const [found] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, itemId), visibleTo(table, user, itemType)));
  return Boolean(found);
}

/**
 * The saved rows themselves, not just references. A library outlives the circle
 * an item was shared into — leaving a circle keeps the save — so these are looked
 * up without the circle test. What does remove an item is the author deleting it
 * or making it private, which `savedVisibleTo` still respects.
 */
async function savedRows(itemType: ItemType, ids: number[], user: User) {
  const table = ITEM_TABLES[itemType];
  const rows = await db
    .select()
    .from(table)
    .where(and(inArray(table.id, ids), savedVisibleTo(table, user, itemType)));
  // Three kinds hand over more than their own columns: a book its quotes, a word
  // its lists, and a recipe its menu types and dish type, which are read from the
  // two columns that hold them or from the single "Category" that used to.
  const shaped =
    itemType === "book"
      ? rows.map((row) => bookResponse(row as typeof books.$inferSelect))
      : itemType === "word"
        ? rows.map((row) => wordResponse(row as typeof wordRows.$inferSelect))
        : itemType === "recipe"
          ? rows.map((row) => recipeResponse(row as typeof recipeRows.$inferSelect))
          : rows;
  const decorated = await withPhotos(
    itemType,
    await withCircleIds(itemType, shaped as { id: number }[], user),
  );
  // A saved item keeps everything its own surface shows: a word its connections,
  // a book its discussions and likes, a song its lyrics in other scripts and the
  // discussion about its raga, a recipe or remedy the experiences on it, a post
  // the languages it can be read in.
  if (itemType === "word") return withConnections(decorated, user);
  if (itemType === "book") {
    return withDiscussions(
      "book",
      await withLikes("book", await withFieldValues("book", decorated), user),
      user,
    );
  }
  if (itemType === "song") {
    return withDiscussions(
      "song",
      await withFieldValues("song", await withLyricScripts(decorated, await songScripts())),
      user,
    );
  }
  if (itemType === "post") {
    const rows = decorated as { id: number; body?: string | null; translateInto?: string | null }[];
    // Its category's own questions travel with the answers, so a saved post still
    // reads properly long after the member left the circle that asked them.
    return (await withFieldValues("post", await withTranslations(rows))).map(readableLanguages);
  }
  if (isExperienceItemType(itemType)) {
    const noted = await withExperiences(itemType, decorated, user);
    // A saved recipe keeps the answers to its circles' own questions — Menu type
    // and Dish type among them — so it reads on the member's own shelf exactly as
    // it did in the circle, long after they have left it.
    return itemType === "recipe" ? withFieldValues("recipe", noted) : noted;
  }
  return decorated;
}

export default async (req: Request) => {
  const user = await admittedUser();
  if (!user) {
    // An anonymous visitor has no library, but the page should still render.
    return req.method === "GET"
      ? Response.json({ saves: [], items: {}, learnedWordIds: [] })
      : unauthorized();
  }

  if (req.method === "GET") {
    const saves = await db
      .select({
        itemType: savedItems.itemType,
        itemId: savedItems.itemId,
        createdAt: savedItems.createdAt,
      })
      .from(savedItems)
      .where(eq(savedItems.memberId, user.id))
      .orderBy(desc(savedItems.createdAt));

    const byType = new Map<ItemType, number[]>();
    for (const save of saves) {
      if (!isItemType(save.itemType)) continue;
      const ids = byType.get(save.itemType);
      if (ids) ids.push(save.itemId);
      else byType.set(save.itemType, [save.itemId]);
    }

    const items: Record<string, unknown[]> = {};
    for (const [itemType, ids] of byType) {
      items[itemType] = await savedRows(itemType, ids, user);
    }

    const learned = await db
      .select({ wordId: learnedWords.wordId })
      .from(learnedWords)
      .where(eq(learnedWords.memberId, user.id));

    return Response.json({ saves, items, learnedWordIds: learned.map((row) => row.wordId) });
  }

  const body = await jsonBody(req);
  if (!body) return badRequest("Expected a JSON body.");

  const itemType = body.itemType;
  const itemId = Number(body.itemId);
  if (!isItemType(itemType) || !Number.isInteger(itemId) || itemId <= 0) {
    return badRequest("Tell us which item to save.");
  }
  if (!(await isVisible(itemType, itemId, user))) {
    return badRequest("That item is no longer available.");
  }

  await db
    .insert(savedItems)
    .values({ memberId: user.id, itemType, itemId })
    .onConflictDoNothing();

  return Response.json({ saved: { itemType, itemId } }, { status: 201 });
};

export const config: Config = {
  path: "/api/library",
  method: ["GET", "POST"],
};
