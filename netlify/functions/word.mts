// netlify/functions/word.mts
import type { Config, Context } from "@netlify/functions";
import { admittedAccess } from "../lib/access.js";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { learnedWords, savedItems, words } from "../../db/schema.js";
import { filedCategoryIdFrom, shelfChoiceFrom } from "../lib/categories.js";
import {
  applyItemCircles,
  circleIdsFrom,
  clearItemCircles,
  filingsOf,
} from "../lib/circles.js";
import { folderIdFrom } from "../lib/folders.js";
import {
  badRequest,
  idFrom,
  jsonBody,
  notFound,
  notYours,
  optionalText,
  text,
  unauthorized,
  visibilityOf,
} from "../lib/items.js";
import { clearItemPhotos } from "../lib/photos.js";
import { unsafeText } from "../lib/safety.js";
import { clearConnections, connectionsOf, wordListPatch, wordResponse } from "../lib/words.js";
import { blockedIdsFor, mayManageItem } from "../lib/moderation.js";

export default async (req: Request, context: Context) => {
  const id = idFrom(context.params);
  if (id === null) return badRequest("Invalid word id.");

  const access = await admittedAccess();
  if (!access) return unauthorized();
  const user = access.user;

  const [existing] = await db.select().from(words).where(eq(words.id, id));
  if (!existing) return notFound("Word");
  // A share is its author's own work, and it is also something said in somebody's
  // circle. So the author may always correct or withdraw it, and so may whoever
  // keeps a circle it went into — its owner, an admin they chose, or the app admin
  // stepping in. Everybody else is told it is not theirs.
  if (!(await mayManageItem("word", id, existing.memberId, access))) {
    return notYours("vocabulary words");
  }

  if (req.method === "PATCH") {
    const body = await jsonBody(req);
    if (!body) return badRequest("Expected a JSON body.");

    const word = text(body.word ?? existing.word);
    const meaning = text(body.meaning ?? existing.meaning);
    if (!word || !meaning) return badRequest("A vocabulary entry needs a word and its meaning.");

    const example = "example" in body ? optionalText(body.example) : existing.example;
    const notes = "notes" in body ? optionalText(body.notes) : existing.notes;
    // A body that names a list replaces it, which is how the last synonym is
    // taken away; one that says nothing about it keeps what is there.
    const synonyms = wordListPatch(body, "synonyms", existing.synonyms);
    const antonyms = wordListPatch(body, "antonyms", existing.antonyms);

    const refused = unsafeText(word, meaning, example, notes, synonyms, antonyms);
    if (refused) return refused;

    const [updated] = await db
      .update(words)
      .set({
        word,
        meaning,
        example,
        language: "language" in body ? optionalText(body.language) : existing.language,
        pronunciation:
          "pronunciation" in body ? optionalText(body.pronunciation) : existing.pronunciation,
        synonyms,
        antonyms,
        notes,
        source: "source" in body ? optionalText(body.source) : existing.source,
        visibility: "visibility" in body ? visibilityOf(body.visibility) : existing.visibility,
      })
      .where(eq(words.id, id))
      .returning();

    const circleIds = await applyItemCircles(
      "word",
      id,
      circleIdsFrom(body),
      updated.visibility,
      user,
      shelfChoiceFrom(body),
      filedCategoryIdFrom(body),
      folderIdFrom(body),
    );

    // A word carries no pictures, so an edit has none to keep or replace.
    return Response.json({
      word: {
        ...wordResponse(updated),
        circleIds,
        filings: await filingsOf("word", id, user),
        connections: (await connectionsOf([id], await blockedIdsFor(user))).get(id) ?? [],
      },
    });
  }

  await db.delete(words).where(eq(words.id, id));
  await db.delete(savedItems).where(and(eq(savedItems.itemType, "word"), eq(savedItems.itemId, id)));
  await db.delete(learnedWords).where(eq(learnedWords.wordId, id));
  await clearConnections(id);
  await clearItemCircles("word", id);
  // Words no longer take pictures, but one added before they were removed still
  // has rows and blobs to sweep up.
  await clearItemPhotos("word", id);

  return Response.json({ ok: true });
};

export const config: Config = {
  path: "/api/words/:id",
  method: ["PATCH", "DELETE"],
};
