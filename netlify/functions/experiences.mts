// netlify/functions/experiences.mts
// What happened when somebody tried it: a recipe's "Experiences & Tips", and the
// experiences and extras members add to a remedy. Any member the share reaches may
// add one, because it is a contribution rather than an edit — nothing already on the
// recipe or the remedy changes.
import type { Config } from "@netlify/functions";
import { admittedUser } from "../lib/access.js";
import {
  addExperience,
  experienceFrom,
  isExperienceItemType,
  MAX_EXPERIENCES_PER_ITEM,
  visibleShare,
} from "../lib/experiences.js";
import { badRequest, jsonBody, notFound, unauthorized } from "../lib/items.js";
import { unsafeText } from "../lib/safety.js";

export default async (req: Request) => {
  const user = await admittedUser();
  if (!user) return unauthorized();

  const body = await jsonBody(req);
  if (!body) return badRequest("Expected a JSON body.");

  if (!isExperienceItemType(body.itemType)) {
    return badRequest("Experiences can only be added to a recipe or a remedy.");
  }

  const itemId = Number(body.itemId);
  if (!Number.isInteger(itemId) || itemId <= 0) return badRequest("Invalid item id.");

  const share = await visibleShare(body.itemType, itemId, user);
  if (!share) return notFound(body.itemType === "recipe" ? "Recipe" : "Remedy");

  const values = experienceFrom(body);
  if (!values) return badRequest("Write what happened when you tried it.");

  const refused = unsafeText(values.body);
  if (refused) return refused;

  const experience = await addExperience(body.itemType, itemId, values, user);
  if (!experience) {
    return badRequest(`A share can hold ${MAX_EXPERIENCES_PER_ITEM} experiences and tips.`);
  }

  return Response.json({ experience }, { status: 201 });
};

export const config: Config = {
  path: "/api/experiences",
  method: ["POST"],
};
