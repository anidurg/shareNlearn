// netlify/functions/recipes.mts
import type { Config } from "@netlify/functions";
import { admittedUser, sharingGate } from "../lib/access.js";
import { desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { recipes } from "../../db/schema.js";
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
import { withExperiences } from "../lib/experiences.js";
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
  optionalInt,
  optionalText,
  text,
  visibilityOf,
  visibleTo,
  unauthorized,
} from "../lib/items.js";
import { photoKeysFrom, setItemPhotos, withPhotos } from "../lib/photos.js";
import { recipeMetaFrom, recipeResponse } from "../lib/recipes.js";
import { unsafeText } from "../lib/safety.js";

export default async (req: Request) => {
  const user = await admittedUser();

  if (req.method === "GET") {
    const all = await db
      .select()
      .from(recipes)
      .where(visibleTo(recipes, user, "recipe"))
      .orderBy(desc(recipes.createdAt));
    return Response.json({
      // A recipe carries what happened when other people cooked it, so the
      // experiences and tips travel with the listing rather than per card.
      // `recipeResponse` first, so every row hands over its menu types and its
      // dish type whether they are stored in the two columns or still only in the
      // single "Category" the form used to ask for.
      recipes: await withExperiences(
        "recipe",
        await withFieldValues(
          "recipe",
          await withPhotos("recipe", await withCircleIds("recipe", all.map(recipeResponse), user)),
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
  const ingredients = text(body.ingredients);
  const method = text(body.method);
  if (!title || !ingredients || !method) {
    return badRequest("A recipe needs a name, ingredients, and a method.");
  }

  const memberName = memberNameOf(user);
  const notes = optionalText(body.notes);
  // The two columns behind the questions Recipes used to ask on every form. They
  // are still read and still written, because a recipe shared before the circle's
  // own Menu type and Dish type fields existed keeps its answers there — but the
  // form no longer sends them, so this is now the legacy half of the same idea.
  const meta = recipeMetaFrom(body);
  const visibility = visibilityOf(body.visibility);

  // Whatever the circles it is going to ask about a recipe of their own — Menu
  // type and Dish type among them, those two being ordinary configurable fields
  // now rather than a hard-coded pair. A private recipe reaches no circle, so
  // nobody's questions apply to it.
  const wanted = circleIdsFrom(body) ?? [];
  const fields = visibility === "shared" ? await fieldsForBuiltIn("recipe", wanted) : [];
  const answers = answersFrom(body) ?? new Map<number, string>();
  const missing = missingRequired(fields, answers);
  if (missing) return badRequest(`${missing.label} is needed.`);
  // Every upload on the share added up, which no per-field ceiling can see.
  const tooMuch = tooMuchUploaded(fields, answers);
  if (tooMuch) return tooMuch;

  const refused = unsafeText(
    title,
    ingredients,
    method,
    notes,
    meta.dishType,
    ...answerTexts(fields, answers),
  );
  if (refused) return refused;

  const [recipe] = await db
    .insert(recipes)
    .values({
      memberId: user.id,
      memberName,
      title,
      ingredients,
      method,
      notes,
      prepMinutes: optionalInt(body.prepMinutes),
      ...meta,
      visibility,
    })
    .returning();

  // A private recipe reaches nobody, so it keeps no circle links.
  const chosen =
    recipe.visibility === "shared"
      ? await setItemCircles(
          "recipe",
          recipe.id,
          wanted,
          user,
          shelfChoiceFrom(body),
          filedCategoryIdFrom(body),
          folderIdFrom(body),
        )
      : [];

  // Photos are optional, so an empty list is the ordinary case.
  const photos = await setItemPhotos("recipe", recipe.id, photoKeysFrom(body) ?? [], user);
  const fieldValues = await setItemFieldValues("recipe", recipe.id, fields, answers, user.id);

  if (recipe.visibility === "shared") {
    await announceShare({
      itemType: "recipe",
      message: `${memberName} shared a recipe for "${title}"`,
      circles: chosen,
    });
  }

  return Response.json(
    {
      recipe: {
        ...recipeResponse(recipe),
        circleIds: chosen.map((circle) => circle.id),
        filings: await filingsOf("recipe", recipe.id, user),
        photos,
        fieldValues,
        // Nobody has cooked it yet.
        experiences: [],
      },
    },
    { status: 201 },
  );
};

export const config: Config = {
  path: "/api/recipes",
  method: ["GET", "POST"],
};
