// netlify/functions/remedy.mts
import type { Config, Context } from "@netlify/functions";
import { admittedAccess } from "../lib/access.js";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { remedies, savedItems } from "../../db/schema.js";
import { filedCategoryIdFrom, shelfChoiceFrom } from "../lib/categories.js";
import {
  applyItemCircles,
  circleIdsFrom,
  clearItemCircles,
  filingsOf,
} from "../lib/circles.js";
import { clearItemExperiences, experiencesOf } from "../lib/experiences.js";
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
import { mayManageItem } from "../lib/moderation.js";
import { unsafeText } from "../lib/safety.js";

export default async (req: Request, context: Context) => {
  const id = idFrom(context.params);
  if (id === null) return badRequest("Invalid remedy id.");

  const access = await admittedAccess();
  if (!access) return unauthorized();
  const user = access.user;

  const [existing] = await db.select().from(remedies).where(eq(remedies.id, id));
  if (!existing) return notFound("Remedy");
  // A share is its author's own work, and it is also something said in somebody's
  // circle. So the author may always correct or withdraw it, and so may whoever
  // keeps a circle it went into — its owner, an admin they chose, or the app admin
  // stepping in. Everybody else is told it is not theirs.
  if (!(await mayManageItem("remedy", id, existing.memberId, access))) {
    return notYours("remedies");
  }

  if (req.method === "PATCH") {
    const body = await jsonBody(req);
    if (!body) return badRequest("Expected a JSON body.");

    const title = text(body.title ?? existing.title);
    const usedFor = text(body.usedFor ?? existing.usedFor);
    const ingredients = text(body.ingredients ?? existing.ingredients);
    const preparation = text(body.preparation ?? existing.preparation);
    if (!title || !usedFor || !ingredients || !preparation) {
      return badRequest("A remedy needs a name, what it is used for, ingredients, and how to prepare it.");
    }

    const howToUse = "howToUse" in body ? optionalText(body.howToUse) : existing.howToUse;
    const passedDownFrom =
      "passedDownFrom" in body ? optionalText(body.passedDownFrom) : existing.passedDownFrom;
    const notes = "notes" in body ? optionalText(body.notes) : existing.notes;

    const refused = unsafeText(
      title,
      usedFor,
      ingredients,
      preparation,
      howToUse,
      passedDownFrom,
      notes,
    );
    if (refused) return refused;

    const [updated] = await db
      .update(remedies)
      .set({
        title,
        usedFor,
        ingredients,
        preparation,
        howToUse,
        passedDownFrom,
        notes,
        visibility: "visibility" in body ? visibilityOf(body.visibility) : existing.visibility,
      })
      .where(eq(remedies.id, id))
      .returning();

    const circleIds = await applyItemCircles(
      "remedy",
      id,
      circleIdsFrom(body),
      updated.visibility,
      user,
      shelfChoiceFrom(body),
      filedCategoryIdFrom(body),
      folderIdFrom(body),
    );

    // An edit that says nothing about photos leaves the ones already there.
    const photos = await applyItemPhotos("remedy", id, photoKeysFrom(body), user);

    return Response.json({
      remedy: {
        ...updated,
        circleIds,
        filings: await filingsOf("remedy", id, user),
        photos,
        // Editing a remedy leaves what members added to it untouched.
        experiences: await experiencesOf("remedy", id, user),
      },
    });
  }

  await db.delete(remedies).where(eq(remedies.id, id));
  // Nobody's library should point at a remedy that no longer exists.
  await db
    .delete(savedItems)
    .where(and(eq(savedItems.itemType, "remedy"), eq(savedItems.itemId, id)));
  await clearItemCircles("remedy", id);
  await clearItemPhotos("remedy", id);
  // Deleting for everyone takes the experiences members added with it.
  await clearItemExperiences("remedy", id);

  return Response.json({ ok: true });
};

export const config: Config = {
  path: "/api/remedies/:id",
  method: ["PATCH", "DELETE"],
};
