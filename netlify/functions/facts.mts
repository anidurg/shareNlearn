// netlify/functions/facts.mts
import type { Config } from "@netlify/functions";
import { admittedUser, sharingGate } from "../lib/access.js";
import { desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { facts } from "../../db/schema.js";
import { filedCategoryIdFrom, shelfChoiceFrom } from "../lib/categories.js";
import {
  announceShare,
  circleIdsFrom,
  filingsOf,
  setItemCircles,
  withCircleIds,
} from "../lib/circles.js";
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
      .from(facts)
      .where(visibleTo(facts, user, "fact"))
      .orderBy(desc(facts.createdAt));
    return Response.json({
      facts: await withPhotos("fact", await withCircleIds("fact", all, user)),
    });
  }

  // Everything shared here goes to a circle, so being in one comes before sharing.
  if (!user) return unauthorized();
  const gate = await sharingGate(user);
  if (gate) return gate;

  const body = await jsonBody(req);
  if (!body) return badRequest("Expected a JSON body.");

  const fact = text(body.fact);
  if (!fact) return badRequest("Write the fact you want to share.");

  const memberName = memberNameOf(user);
  const category = text(body.category) || "Other";
  const source = optionalText(body.source);

  const refused = unsafeText(fact, category, source);
  if (refused) return refused;

  const [created] = await db
    .insert(facts)
    .values({
      memberId: user.id,
      memberName,
      fact,
      category,
      source,
      visibility: visibilityOf(body.visibility),
    })
    .returning();

  // A private fact reaches nobody, so it keeps no circle links.
  const chosen =
    created.visibility === "shared"
      ? await setItemCircles(
          "fact",
          created.id,
          circleIdsFrom(body) ?? [],
          user,
          shelfChoiceFrom(body),
          filedCategoryIdFrom(body),
          folderIdFrom(body),
        )
      : [];

  // Photos are optional, so an empty list is the ordinary case.
  const photos = await setItemPhotos("fact", created.id, photoKeysFrom(body) ?? [], user);

  if (created.visibility === "shared") {
    await announceShare({
      itemType: "fact",
      message: `${memberName} shared a fun fact`,
      circles: chosen,
    });
  }

  return Response.json(
    {
      fact: {
        ...created,
        circleIds: chosen.map((circle) => circle.id),
        filings: await filingsOf("fact", created.id, user),
        photos,
      },
    },
    { status: 201 },
  );
};

export const config: Config = {
  path: "/api/facts",
  method: ["GET", "POST"],
};
