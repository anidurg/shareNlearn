// netlify/functions/experience.mts
// Taking an experience or a tip back. Whoever wrote it may remove it, and so may
// the member who shared the recipe or remedy it sits on, and whoever keeps a circle
// that share went into — the same rule a word's language connections follow. Nothing
// else about the share is touched.
import type { Config, Context } from "@netlify/functions";
import { admittedAccess } from "../lib/access.js";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { itemExperiences } from "../../db/schema.js";
import { isExperienceItemType, visibleShare } from "../lib/experiences.js";
import { badRequest, idFrom, notFound, notYours, unauthorized } from "../lib/items.js";
import { moderatesItem } from "../lib/moderation.js";

export default async (req: Request, context: Context) => {
  const id = idFrom(context.params);
  if (id === null) return badRequest("Invalid experience id.");

  const access = await admittedAccess();
  if (!access) return unauthorized();
  const user = access.user;

  const [experience] = await db
    .select()
    .from(itemExperiences)
    .where(eq(itemExperiences.id, id));
  if (!experience || !isExperienceItemType(experience.itemType)) return notFound("Experience");

  const share = await visibleShare(experience.itemType, experience.itemId, user);
  if (!share) return notFound("Experience");

  const mayRemove =
    experience.memberId === user.id ||
    share.memberId === user.id ||
    (await moderatesItem(experience.itemType, experience.itemId, access));
  if (!mayRemove) return notYours("experiences and tips");

  await db.delete(itemExperiences).where(eq(itemExperiences.id, id));

  return Response.json({ ok: true });
};

export const config: Config = {
  path: "/api/experiences/:id",
  method: ["DELETE"],
};
