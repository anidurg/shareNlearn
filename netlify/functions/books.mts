// netlify/functions/books.mts
import type { Config } from "@netlify/functions";
import { admittedUser, sharingGate } from "../lib/access.js";
import { desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { books } from "../../db/schema.js";
import { bookResponse, joinQuotes, quotesFrom } from "../lib/books.js";
import {
  fieldsForBuiltIn,
  filedCategoryIdFrom,
  shelfChoiceFrom,
} from "../lib/categories.js";
import {
  announceShare,
  circleIdsFrom,
  filingsOf,
  setItemCircles,
  withCircleIds,
} from "../lib/circles.js";
import { withDiscussions } from "../lib/discussions.js";
import {
  answersFrom,
  answerTexts,
  missingRequired,
  tooMuchUploaded,
  setItemFieldValues,
  withFieldValues,
} from "../lib/fields.js";
import { folderIdFrom } from "../lib/folders.js";
import {
  badRequest,
  jsonBody,
  memberNameOf,
  optionalIntBetween,
  optionalText,
  optionalUrl,
  text,
  visibilityOf,
  visibleTo,
  unauthorized,
} from "../lib/items.js";
import { withLikes } from "../lib/likes.js";
import { photoKeysFrom, setItemPhotos, withPhotos } from "../lib/photos.js";
import { unsafeText } from "../lib/safety.js";

export default async (req: Request) => {
  const user = await admittedUser();

  if (req.method === "GET") {
    const all = await db
      .select()
      .from(books)
      .where(visibleTo(books, user, "book"))
      .orderBy(desc(books.createdAt));
    return Response.json({
      // A card reads "12 Discussions / 18 Likes", so both travel with the listing
      // and neither is a second request per book.
      books: await withDiscussions(
        "book",
        await withLikes(
          "book",
          await withFieldValues(
            "book",
            await withPhotos("book", await withCircleIds("book", all.map(bookResponse), user)),
          ),
          user,
        ),
        user,
      ),
    });
  }

  // Everything shared here goes to a circle, so being in one comes before sharing.
  if (!user) return unauthorized();
  const gate = await sharingGate(user);
  if (gate) return gate;

  const body = await jsonBody(req);
  if (!body) return badRequest("Expected a JSON body.");

  const title = text(body.title);
  if (!title) return badRequest("Give the book a title.");

  const memberName = memberNameOf(user);
  const quotes = quotesFrom("quotes" in body ? body.quotes : body.quote);
  const author = optionalText(body.author);
  const genre = optionalText(body.genre);
  const review = optionalText(body.review);
  const visibility = visibilityOf(body.visibility);

  // Whatever the circles it is going to ask about a book of their own. A private
  // book reaches no circle, so nobody's questions apply to it.
  const wanted = circleIdsFrom(body) ?? [];
  const fields = visibility === "shared" ? await fieldsForBuiltIn("book", wanted) : [];
  const answers = answersFrom(body) ?? new Map<number, string>();
  const missing = missingRequired(fields, answers);
  if (missing) return badRequest(`${missing.label} is needed.`);
  // Every upload on the share added up, which no per-field ceiling can see.
  const tooMuch = tooMuchUploaded(fields, answers);
  if (tooMuch) return tooMuch;

  // Everything the member wrote, read once before any of it is stored.
  const refused = unsafeText(
    title,
    author,
    genre,
    review,
    ...quotes,
    ...answerTexts(fields, answers),
  );
  if (refused) return refused;

  const [created] = await db
    .insert(books)
    .values({
      memberId: user.id,
      memberName,
      title,
      author,
      genre,
      language: optionalText(body.language),
      rating: optionalIntBetween(body.rating, 1, 5),
      review,
      quote: quotes[0] ?? null,
      quotes: joinQuotes(quotes),
      buyUrl: optionalUrl(body.buyUrl),
      visibility,
    })
    .returning();

  // A private book reaches nobody, so it keeps no circle links.
  const chosen =
    created.visibility === "shared"
      ? await setItemCircles(
          "book",
          created.id,
          wanted,
          user,
          shelfChoiceFrom(body),
          filedCategoryIdFrom(body),
          folderIdFrom(body),
        )
      : [];

  // Photos are optional, so an empty list is the ordinary case.
  const photos = await setItemPhotos("book", created.id, photoKeysFrom(body) ?? [], user);
  const fieldValues = await setItemFieldValues("book", created.id, fields, answers, user.id);

  if (created.visibility === "shared") {
    await announceShare({
      itemType: "book",
      message: `${memberName} read "${title}"`,
      circles: chosen,
    });
  }

  return Response.json(
    {
      book: {
        ...bookResponse(created),
        circleIds: chosen.map((circle) => circle.id),
        filings: await filingsOf("book", created.id, user),
        photos,
        fieldValues,
        // A new book has been read by one person and discussed by nobody yet.
        discussions: [],
        likeCount: 0,
        likedByMe: false,
      },
    },
    { status: 201 },
  );
};

export const config: Config = {
  path: "/api/books",
  method: ["GET", "POST"],
};
