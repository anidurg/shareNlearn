// netlify/functions/hidden-item.mts
import type { Config, Context } from "@netlify/functions";
import { admittedAccess, notAdmitted } from "../lib/access.js";
import { badRequest, isItemType, optionalInt } from "../lib/items.js";
import { unhideItem } from "../lib/moderation.js";

/** Putting a hidden post back, from the list on Profile. */
export default async (_req: Request, context: Context) => {
  const access = await admittedAccess();
  if (!access) return notAdmitted();

  const itemType = context.params.itemType;
  const itemId = optionalInt(context.params.itemId);
  if (!isItemType(itemType) || !itemId) return badRequest("Tell us which post to show again.");

  await unhideItem(itemType, itemId, access.user);
  return Response.json({ ok: true });
};

export const config: Config = {
  path: "/api/hidden/:itemType/:itemId",
  method: ["DELETE"],
};
