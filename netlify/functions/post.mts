// netlify/functions/post.mts
import type { Config, Context } from "@netlify/functions";
import { admittedAccess } from "../lib/access.js";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { posts, savedItems } from "../../db/schema.js";
import { findCategory, shelfChoiceFrom } from "../lib/categories.js";
import { applyItemCircles, clearItemCircles, filingsOf } from "../lib/circles.js";
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
import { applyItemPhotos, clearItemPhotos, photoKeysFrom } from "../lib/photos.js";
import {
  answersFrom,
  answerTexts,
  applyItemFieldValues,
  clearItemFieldValues,
  fieldsOf,
  missingRequired,
  tooMuchUploaded,
} from "../lib/fields.js";
import { mayManageItem } from "../lib/moderation.js";
import { unsafeText } from "../lib/safety.js";
import {
  clearTranslations,
  readableLanguages,
  translateIntoFrom,
  withTranslations,
} from "../lib/translations.js";

/**
 * Editing or deleting one post in a custom category. Its circle is settled by the
 * category it is in, so an edit changes the words, the shelf and whether it is
 * shared — never where it goes.
 */
export default async (req: Request, context: Context) => {
  const id = idFrom(context.params);
  if (id === null) return badRequest("Invalid post id.");

  const access = await admittedAccess();
  if (!access) return unauthorized();
  const user = access.user;

  const [existing] = await db.select().from(posts).where(eq(posts.id, id));
  if (!existing) return notFound("Post");
  // A share is its author's own work, and it is also something said in somebody's
  // circle. So the author may always correct or withdraw it, and so may whoever
  // keeps a circle it went into — its owner, an admin they chose, or the app admin
  // stepping in. Everybody else is told it is not theirs.
  if (!(await mayManageItem("post", id, existing.memberId, access))) {
    return notYours("posts");
  }

  if (req.method === "PATCH") {
    const body = await jsonBody(req);
    if (!body) return badRequest("Expected a JSON body.");

    const title = text(body.title ?? existing.title);
    if (!title) return badRequest("Give the post a title.");

    const written = "body" in body ? optionalText(body.body) : existing.body;
    const happensOn = "happensOn" in body ? optionalText(body.happensOn) : existing.happensOn;

    // An edit that says nothing about the category's questions leaves every answer
    // as it was; one that names them replaces the set, which is how an answer is
    // taken back out. A required question still has to be answered either way.
    const fields = await fieldsOf([existing.categoryId]);
    const answers = answersFrom(body);
    if (answers) {
      const missing = missingRequired(fields, answers);
      if (missing) return badRequest(`${missing.label} is needed for this post.`);
      // Every upload on the share added up, which no per-field ceiling can see.
      const tooMuch = tooMuchUploaded(fields, answers);
      if (tooMuch) return tooMuch;
    }

    const refused = unsafeText(
      title,
      written,
      happensOn,
      ...(answers ? answerTexts(fields, answers) : []),
    );
    if (refused) return refused;

    // A form that says nothing about languages leaves the author's choice alone.
    // Editing the details themselves needs no cleanup: every translation is stored
    // against a digest of the text it came from, so the old ones simply stop being
    // read and the next tap remakes them from what the post says now.
    const languages = translateIntoFrom(body);

    const [updated] = await db
      .update(posts)
      .set({
        title,
        body: written,
        happensOn,
        translateInto: languages === undefined ? existing.translateInto : languages,
        visibility: "visibility" in body ? visibilityOf(body.visibility) : existing.visibility,
      })
      .where(eq(posts.id, id))
      .returning();

    // Sharing it again after making it private puts it back in its own circle.
    const category = await findCategory(updated.categoryId);
    const circleIds = await applyItemCircles(
      "post",
      id,
      category ? [category.circleId] : null,
      updated.visibility,
      user,
      shelfChoiceFrom(body),
      category?.id,
      folderIdFrom(body),
    );

    // An edit that says nothing about photos leaves the ones already there.
    const photos = await applyItemPhotos("post", id, photoKeysFrom(body), user);
    const fieldValues = await applyItemFieldValues("post", id, fields, answers, user.id);

    const [readable] = await withTranslations([updated]);
    return Response.json({
      post: readableLanguages({
        ...readable,
        circleIds,
        filings: await filingsOf("post", id, user),
        photos,
        fieldValues,
      }),
    });
  }

  await db.delete(posts).where(eq(posts.id, id));
  await db.delete(savedItems).where(and(eq(savedItems.itemType, "post"), eq(savedItems.itemId, id)));
  await clearItemCircles("post", id);
  await clearItemPhotos("post", id);
  await clearItemFieldValues("post", id);
  await clearTranslations(id);

  return Response.json({ ok: true });
};

export const config: Config = {
  path: "/api/posts/:id",
  method: ["PATCH", "DELETE"],
};
