// netlify/functions/fact.mts
import type { Config, Context } from "@netlify/functions";
import { admittedAccess } from "../lib/access.js";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { facts, savedItems } from "../../db/schema.js";
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
import { applyItemPhotos, clearItemPhotos, photoKeysFrom } from "../lib/photos.js";
import { mayManageItem } from "../lib/moderation.js";
import { unsafeText } from "../lib/safety.js";

export default async (req: Request, context: Context) => {
  const id = idFrom(context.params);
  if (id === null) return badRequest("Invalid fact id.");

  const access = await admittedAccess();
  if (!access) return unauthorized();
  const user = access.user;

  const [existing] = await db.select().from(facts).where(eq(facts.id, id));
  if (!existing) return notFound("Fact");
  // A share is its author's own work, and it is also something said in somebody's
  // circle. So the author may always correct or withdraw it, and so may whoever
  // keeps a circle it went into — its owner, an admin they chose, or the app admin
  // stepping in. Everybody else is told it is not theirs.
  if (!(await mayManageItem("fact", id, existing.memberId, access))) {
    return notYours("fun facts");
  }

  if (req.method === "PATCH") {
    const body = await jsonBody(req);
    if (!body) return badRequest("Expected a JSON body.");

    const fact = text(body.fact ?? existing.fact);
    if (!fact) return badRequest("Write the fact you want to share.");

    const category = "category" in body ? text(body.category) || "Other" : existing.category;
    const source = "source" in body ? optionalText(body.source) : existing.source;

    const refused = unsafeText(fact, category, source);
    if (refused) return refused;

    const [updated] = await db
      .update(facts)
      .set({
        fact,
        category,
        source,
        visibility: "visibility" in body ? visibilityOf(body.visibility) : existing.visibility,
      })
      .where(eq(facts.id, id))
      .returning();

    const circleIds = await applyItemCircles(
      "fact",
      id,
      circleIdsFrom(body),
      updated.visibility,
      user,
      shelfChoiceFrom(body),
      filedCategoryIdFrom(body),
      folderIdFrom(body),
    );

    // An edit that says nothing about photos leaves the ones already there.
    const photos = await applyItemPhotos("fact", id, photoKeysFrom(body), user);

    return Response.json({
      fact: { ...updated, circleIds, filings: await filingsOf("fact", id, user), photos },
    });
  }

  await db.delete(facts).where(eq(facts.id, id));
  await db.delete(savedItems).where(and(eq(savedItems.itemType, "fact"), eq(savedItems.itemId, id)));
  await clearItemCircles("fact", id);
  await clearItemPhotos("fact", id);

  return Response.json({ ok: true });
};

export const config: Config = {
  path: "/api/facts/:id",
  method: ["PATCH", "DELETE"],
};
