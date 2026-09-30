// netlify/functions/remedies.mts
import type { Config } from "@netlify/functions";
import { admittedUser, sharingGate } from "../lib/access.js";
import { desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { remedies } from "../../db/schema.js";
import { filedCategoryIdFrom, shelfChoiceFrom } from "../lib/categories.js";
import {
  announceShare,
  circleIdsFrom,
  filingsOf,
  setItemCircles,
  withCircleIds,
} from "../lib/circles.js";
import { withExperiences } from "../lib/experiences.js";
import { folderIdFrom } from "../lib/folders.js";
import {
  badRequest,
  jsonBody,
  memberNameOf,
  optionalText,
  text,
  visibilityOf,
  visibleTo,
  unauthorized,
} from "../lib/items.js";
import { photoKeysFrom, setItemPhotos, withPhotos } from "../lib/photos.js";
import { unsafeText } from "../lib/safety.js";

export default async (req: Request) => {
  const user = await admittedUser();

  if (req.method === "GET") {
    const all = await db
      .select()
      .from(remedies)
      .where(visibleTo(remedies, user, "remedy"))
      .orderBy(desc(remedies.createdAt));
    return Response.json({
      // What members added after trying it travels with the remedy itself.
      remedies: await withExperiences(
        "remedy",
        await withPhotos("remedy", await withCircleIds("remedy", all, user)),
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
  const usedFor = text(body.usedFor);
  const ingredients = text(body.ingredients);
  const preparation = text(body.preparation);
  if (!title || !usedFor || !ingredients || !preparation) {
    return badRequest("A remedy needs a name, what it is used for, ingredients, and how to prepare it.");
  }

  const memberName = memberNameOf(user);
  const howToUse = optionalText(body.howToUse);
  const passedDownFrom = optionalText(body.passedDownFrom);
  const notes = optionalText(body.notes);

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

  const [remedy] = await db
    .insert(remedies)
    .values({
      memberId: user.id,
      memberName,
      title,
      usedFor,
      ingredients,
      preparation,
      howToUse,
      passedDownFrom,
      notes,
      visibility: visibilityOf(body.visibility),
    })
    .returning();

  // A private remedy reaches nobody, so it keeps no circle links.
  const chosen =
    remedy.visibility === "shared"
      ? await setItemCircles(
          "remedy",
          remedy.id,
          circleIdsFrom(body) ?? [],
          user,
          shelfChoiceFrom(body),
          filedCategoryIdFrom(body),
          folderIdFrom(body),
        )
      : [];

  // Photos are optional, so an empty list is the ordinary case.
  const photos = await setItemPhotos("remedy", remedy.id, photoKeysFrom(body) ?? [], user);

  if (remedy.visibility === "shared") {
    await announceShare({
      itemType: "remedy",
      message: `${memberName} shared a remedy for ${usedFor}: "${title}"`,
      link: "#/remedies",
      circles: chosen,
    });
  }

  return Response.json(
    {
      remedy: {
        ...remedy,
        circleIds: chosen.map((circle) => circle.id),
        filings: await filingsOf("remedy", remedy.id, user),
        photos,
        // Nobody has tried it yet.
        experiences: [],
      },
    },
    { status: 201 },
  );
};

export const config: Config = {
  path: "/api/remedies",
  method: ["GET", "POST"],
};
