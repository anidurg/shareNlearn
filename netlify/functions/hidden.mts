// netlify/functions/hidden.mts
import type { Config } from "@netlify/functions";
import { admittedAccess, notAdmitted } from "../lib/access.js";
import { badRequest, isItemType, jsonBody, optionalInt } from "../lib/items.js";
import { hideItem, moderationStateOf } from "../lib/moderation.js";

/**
 * Hiding a post is the reader's own business: nothing is deleted, nobody is told,
 * and no other member's view changes. It is a row against their id, and
 * `visibleTo()` reads it on every listing, so a hidden share is gone from the feed,
 * the category pages and the search results in one stroke.
 */
export default async (req: Request) => {
  const access = await admittedAccess();
  if (!access) return notAdmitted();

  if (req.method === "GET") {
    const { hidden } = await moderationStateOf(access.user);
    return Response.json({ hidden });
  }

  const body = await jsonBody(req);
  const itemType = body?.itemType;
  const itemId = optionalInt(body?.itemId);
  if (!isItemType(itemType) || !itemId) return badRequest("Tell us which post to hide.");

  await hideItem(itemType, itemId, access.user);
  return Response.json({ hidden: { itemType, itemId } }, { status: 201 });
};

export const config: Config = {
  path: "/api/hidden",
  method: ["GET", "POST"],
};
