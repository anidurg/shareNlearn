// netlify/functions/book.mts
import type { Config, Context } from "@netlify/functions";
import { admittedAccess } from "../lib/access.js";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { books, savedItems } from "../../db/schema.js";
import { bookResponse, joinQuotes, quotesFrom, quotesOf } from "../lib/books.js";
import {
  fieldsForBuiltIn,
  filedCategoryIdFrom,
  shelfChoiceFrom,
} from "../lib/categories.js";
import {
  applyItemCircles,
  circleIdsFrom,
  clearItemCircles,
  filingsOf,
} from "../lib/circles.js";
import { clearDiscussions, discussionsOf } from "../lib/discussions.js";
import {
  answersFrom,
  answerTexts,
  applyItemFieldValues,
  clearItemFieldValues,
  missingRequired,
  tooMuchUploaded,
} from "../lib/fields.js";
import { folderIdFrom } from "../lib/folders.js";
import {
  badRequest,
  idFrom,
  jsonBody,
  notFound,
  notYours,
  optionalIntBetween,
  optionalText,
  optionalUrl,
  text,
  unauthorized,
  visibilityOf,
} from "../lib/items.js";
import { clearItemLikes, likeStateOf } from "../lib/likes.js";
import { applyItemPhotos, clearItemPhotos, photoKeysFrom } from "../lib/photos.js";
import { mayManageItem } from "../lib/moderation.js";
import { unsafeText } from "../lib/safety.js";

export default async (req: Request, context: Context) => {
  const id = idFrom(context.params);
  if (id === null) return badRequest("Invalid book id.");

  const access = await admittedAccess();
  if (!access) return unauthorized();
  const user = access.user;

  const [existing] = await db.select().from(books).where(eq(books.id, id));
  if (!existing) return notFound("Book");
  // A share is its author's own work, and it is also something said in somebody's
  // circle. So the author may always correct or withdraw it, and so may whoever
  // keeps a circle it went into — its owner, an admin they chose, or the app admin
  // stepping in. Everybody else is told it is not theirs.
  if (!(await mayManageItem("book", id, existing.memberId, access))) {
    return notYours("books");
  }

  if (req.method === "PATCH") {
    const body = await jsonBody(req);
    if (!body) return badRequest("Expected a JSON body.");

    const title = text(body.title ?? existing.title);
    if (!title) return badRequest("Give the book a title.");

    const quotes =
      "quotes" in body || "quote" in body
        ? quotesFrom("quotes" in body ? body.quotes : body.quote)
        : quotesOf(existing);

    const author = "author" in body ? optionalText(body.author) : existing.author;
    const genre = "genre" in body ? optionalText(body.genre) : existing.genre;
    const review = "review" in body ? optionalText(body.review) : existing.review;

    // What the circles this book goes to ask about a book of their own. An edit
    // that says nothing about them leaves every answer as it was; one that names
    // them replaces the set, which is how an answer is taken back out.
    const wanted = circleIdsFrom(body);
    const fields = await fieldsForBuiltIn(
      "book",
      wanted ?? (await filingsOf("book", id, user)).map((filing) => filing.circleId),
    );
    const answers = answersFrom(body);
    if (answers) {
      const missing = missingRequired(fields, answers);
      if (missing) return badRequest(`${missing.label} is needed for this book.`);
      // Every upload on the share added up, which no per-field ceiling can see.
      const tooMuch = tooMuchUploaded(fields, answers);
      if (tooMuch) return tooMuch;
    }

    // An edit is checked as well as a create: the text that ends up stored is
    // what matters, not which request put it there.
    const refused = unsafeText(
      title,
      author,
      genre,
      review,
      ...quotes,
      ...(answers ? answerTexts(fields, answers) : []),
    );
    if (refused) return refused;

    const [updated] = await db
      .update(books)
      .set({
        title,
        author,
        genre,
        language: "language" in body ? optionalText(body.language) : existing.language,
        rating: "rating" in body ? optionalIntBetween(body.rating, 1, 5) : existing.rating,
        review,
        quote: quotes[0] ?? null,
        quotes: joinQuotes(quotes),
        buyUrl: "buyUrl" in body ? optionalUrl(body.buyUrl) : existing.buyUrl,
        visibility: "visibility" in body ? visibilityOf(body.visibility) : existing.visibility,
      })
      .where(eq(books.id, id))
      .returning();

    const circleIds = await applyItemCircles(
      "book",
      id,
      wanted,
      updated.visibility,
      user,
      shelfChoiceFrom(body),
      filedCategoryIdFrom(body),
      folderIdFrom(body),
    );

    // An edit that says nothing about photos leaves the ones already there.
    const photos = await applyItemPhotos("book", id, photoKeysFrom(body), user);
    const fieldValues = await applyItemFieldValues("book", id, fields, answers, user.id);

    return Response.json({
      book: {
        ...bookResponse(updated),
        circleIds,
        filings: await filingsOf("book", id, user),
        photos,
        fieldValues,
        // Editing a book leaves its discussions and its likes alone, and the client
        // replaces its copy of the row wholesale, so both are sent back with it.
        discussions: await discussionsOf("book", id, user),
        ...(await likeStateOf("book", id, user)),
      },
    });
  }

  await db.delete(books).where(eq(books.id, id));
  // Nobody's library should point at a book that no longer exists.
  await db.delete(savedItems).where(and(eq(savedItems.itemType, "book"), eq(savedItems.itemId, id)));
  await clearItemCircles("book", id);
  await clearItemPhotos("book", id);
  // Deleting for everyone means the conversation about it goes too — a discussion
  // with no book to hang on is unreadable, and a like on a deleted book is noise.
  await clearDiscussions("book", id);
  await clearItemLikes("book", id);
  await clearItemFieldValues("book", id);

  return Response.json({ ok: true });
};

export const config: Config = {
  path: "/api/books/:id",
  method: ["PATCH", "DELETE"],
};
