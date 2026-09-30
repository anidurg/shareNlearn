// netlify/functions/posts.mts
import type { Config } from "@netlify/functions";
import { admittedUser, sharingGate } from "../lib/access.js";
import { desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { posts } from "../../db/schema.js";
import { categoryIdFrom, findCategory, shelfChoiceFrom } from "../lib/categories.js";
import {
  announceShare,
  filingsOf,
  membershipOf,
  setItemCircles,
  withCircleIds,
} from "../lib/circles.js";
import { folderIdFrom } from "../lib/folders.js";
import {
  badRequest,
  jsonBody,
  memberNameOf,
  notFound,
  optionalText,
  text,
  visibilityOf,
  visibleTo,
  unauthorized,
} from "../lib/items.js";
import { photoKeysFrom, setItemPhotos, withPhotos } from "../lib/photos.js";
import {
  answersFrom,
  answerTexts,
  fieldsOf,
  missingRequired,
  tooMuchUploaded,
  setItemFieldValues,
  withFieldValues,
} from "../lib/fields.js";
import { unsafeText } from "../lib/safety.js";
import {
  readableLanguages,
  translateIntoFrom,
  withTranslations,
} from "../lib/translations.js";

/**
 * Posts in the categories an owner invented — "Festivals", "Travel", whatever the
 * circle needed that the six built-in kinds do not cover.
 *
 * Unlike the other six, a post belongs to one category, and that category belongs
 * to one circle, so there is no "share with" choice to make: it goes where its
 * category is and nowhere else.
 */
export default async (req: Request) => {
  const user = await admittedUser();

  if (req.method === "GET") {
    const all = await db
      .select()
      .from(posts)
      .where(visibleTo(posts, user, "post"))
      .orderBy(desc(posts.createdAt));
    const decorated = await withFieldValues(
      "post",
      await withTranslations(await withPhotos("post", await withCircleIds("post", all, user))),
    );
    return Response.json({ posts: decorated.map(readableLanguages) });
  }

  // Everything shared here goes to a circle, so being in one comes before sharing.
  if (!user) return unauthorized();
  const gate = await sharingGate(user);
  if (gate) return gate;

  const body = await jsonBody(req);
  if (!body) return badRequest("Expected a JSON body.");

  const title = text(body.title);
  if (!title) return badRequest("Give the post a title.");

  const categoryId = categoryIdFrom(body);
  if (categoryId === null) return badRequest("Choose a category to post in.");

  const category = await findCategory(categoryId);
  if (!category || category.itemType !== null) return notFound("Category");
  if (category.status === "hidden") {
    return badRequest(`${category.name} is switched off in this circle at the moment.`);
  }
  if (!(await membershipOf(category.circleId, user))) {
    return Response.json({ error: "Join the circle to post in it." }, { status: 403 });
  }

  const memberName = memberNameOf(user);
  const postBody = optionalText(body.body);
  const happensOn = optionalText(body.happensOn);

  // Whatever else this category asks for. An answer is the member's own writing,
  // so it is filtered with the rest of the post, and a question the category
  // insists on is refused by name rather than as a nameless "something missing".
  const fields = await fieldsOf([category.id]);
  const answers = answersFrom(body) ?? new Map<number, string>();
  const missing = missingRequired(fields, answers);
  if (missing) return badRequest(`${missing.label} is needed for a post in ${category.name}.`);
  // Every upload on the share added up, which no per-field ceiling can see.
  const tooMuch = tooMuchUploaded(fields, answers);
  if (tooMuch) return tooMuch;

  const refused = unsafeText(title, postBody, happensOn, ...answerTexts(fields, answers));
  if (refused) return refused;

  const [created] = await db
    .insert(posts)
    .values({
      memberId: user.id,
      memberName,
      categoryId: category.id,
      title,
      body: postBody,
      happensOn,
      // Which languages the group should be able to read it in. Nothing is asked
      // of a model here — a translation is made the first time somebody taps one.
      translateInto: translateIntoFrom(body) ?? null,
      visibility: visibilityOf(body.visibility),
    })
    .returning();

  // The category's own circle, and only that one: a private post reaches nobody.
  // The category travels with it, because a category a circle invented is found by
  // id — it is what says the shelf belongs here and that the category still takes
  // new posts.
  const chosen =
    created.visibility === "shared"
      ? await setItemCircles(
          "post",
          created.id,
          [category.circleId],
          user,
          shelfChoiceFrom(body),
          category.id,
          folderIdFrom(body),
        )
      : [];

  // Photos are optional, so an empty list is the ordinary case.
  const photos = await setItemPhotos("post", created.id, photoKeysFrom(body) ?? [], user);

  // The category's own questions, answered or left alone: an empty answer writes
  // no row, so a post that skipped an optional field simply has nothing to show.
  const fieldValues = await setItemFieldValues("post", created.id, fields, answers, user.id);

  if (chosen.length > 0) {
    await announceShare({
      itemType: "post",
      message: `${memberName} posted "${title}" in ${category.name}`,
      link: `#/circles/${category.circleId}`,
      circles: chosen,
    });
  }

  return Response.json(
    {
      post: readableLanguages({
        ...created,
        circleIds: chosen.map((circle) => circle.id),
        filings: await filingsOf("post", created.id, user),
        photos,
        fieldValues,
        // Nothing has been rendered yet: the first reader who taps a language pays
        // for it, and everybody after them reads the cache.
        translations: [],
      }),
    },
    { status: 201 },
  );
};

export const config: Config = {
  path: "/api/posts",
  method: ["GET", "POST"],
};
