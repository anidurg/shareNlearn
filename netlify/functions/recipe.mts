// netlify/functions/recipe.mts
import type { Config, Context } from "@netlify/functions";
import { admittedAccess } from "../lib/access.js";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { recipes, savedItems } from "../../db/schema.js";
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
import { clearItemExperiences, experiencesOf } from "../lib/experiences.js";
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
  optionalInt,
  optionalText,
  text,
  unauthorized,
  visibilityOf,
} from "../lib/items.js";
import { applyItemPhotos, clearItemPhotos, photoKeysFrom } from "../lib/photos.js";
import { recipeMetaPatch, recipeResponse } from "../lib/recipes.js";
import { mayManageItem } from "../lib/moderation.js";
import { unsafeText } from "../lib/safety.js";

export default async (req: Request, context: Context) => {
  const id = idFrom(context.params);
  if (id === null) return badRequest("Invalid recipe id.");

  const access = await admittedAccess();
  if (!access) return unauthorized();
  const user = access.user;

  const [existing] = await db.select().from(recipes).where(eq(recipes.id, id));
  if (!existing) return notFound("Recipe");
  // A share is its author's own work, and it is also something said in somebody's
  // circle. So the author may always correct or withdraw it, and so may whoever
  // keeps a circle it went into — its owner, an admin they chose, or the app admin
  // stepping in. Everybody else is told it is not theirs.
  if (!(await mayManageItem("recipe", id, existing.memberId, access))) {
    return notYours("recipes");
  }

  if (req.method === "PATCH") {
    const body = await jsonBody(req);
    if (!body) return badRequest("Expected a JSON body.");

    const title = text(body.title ?? existing.title);
    const ingredients = text(body.ingredients ?? existing.ingredients);
    const method = text(body.method ?? existing.method);
    if (!title || !ingredients || !method) {
      return badRequest("A recipe needs a name, ingredients, and a method.");
    }

    const notes = "notes" in body ? optionalText(body.notes) : existing.notes;
    // An edit that says nothing about either question leaves all three columns as
    // they are; one that names either has been asked it, so the old single
    // "Category" is retired into the two that replaced it.
    const meta = recipeMetaPatch(body, existing);

    // What the circles this recipe goes to ask about a recipe of their own, Menu
    // type and Dish type included. An edit that says nothing about the answers
    // leaves every one of them as it was; one that names them replaces the set,
    // which is how an answer is taken back out.
    const wanted = circleIdsFrom(body);
    const fields = await fieldsForBuiltIn(
      "recipe",
      wanted ?? (await filingsOf("recipe", id, user)).map((filing) => filing.circleId),
    );
    const answers = answersFrom(body);
    if (answers) {
      const missing = missingRequired(fields, answers);
      if (missing) return badRequest(`${missing.label} is needed for this recipe.`);
      // Every upload on the share added up, which no per-field ceiling can see.
      const tooMuch = tooMuchUploaded(fields, answers);
      if (tooMuch) return tooMuch;
    }

    const refused = unsafeText(
      title,
      ingredients,
      method,
      notes,
      meta.dishType,
      ...(answers ? answerTexts(fields, answers) : []),
    );
    if (refused) return refused;

    const [recipe] = await db
      .update(recipes)
      .set({
        title,
        ingredients,
        method,
        notes,
        prepMinutes: "prepMinutes" in body ? optionalInt(body.prepMinutes) : existing.prepMinutes,
        ...meta,
        visibility: "visibility" in body ? visibilityOf(body.visibility) : existing.visibility,
      })
      .where(eq(recipes.id, id))
      .returning();

    const circleIds = await applyItemCircles(
      "recipe",
      id,
      wanted,
      recipe.visibility,
      user,
      shelfChoiceFrom(body),
      filedCategoryIdFrom(body),
      folderIdFrom(body),
    );

    // An edit that says nothing about photos leaves the ones already there.
    const photos = await applyItemPhotos("recipe", id, photoKeysFrom(body), user);
    const fieldValues = await applyItemFieldValues("recipe", id, fields, answers, user.id);

    return Response.json({
      recipe: {
        ...recipeResponse(recipe),
        circleIds,
        filings: await filingsOf("recipe", id, user),
        photos,
        fieldValues,
        // Editing a recipe leaves what members said about it untouched.
        experiences: await experiencesOf("recipe", id, user),
      },
    });
  }

  await db.delete(recipes).where(eq(recipes.id, id));
  await db
    .delete(savedItems)
    .where(and(eq(savedItems.itemType, "recipe"), eq(savedItems.itemId, id)));
  await clearItemCircles("recipe", id);
  await clearItemPhotos("recipe", id);
  await clearItemFieldValues("recipe", id);
  // Deleting for everyone takes the experiences and tips written on it too.
  await clearItemExperiences("recipe", id);

  return Response.json({ ok: true });
};

export const config: Config = {
  path: "/api/recipes/:id",
  method: ["PATCH", "DELETE"],
};
