// netlify/functions/shares.mts
import type { Config } from "@netlify/functions";
import { admittedAccess, notAdmitted } from "../lib/access.js";
import { myCircleIds } from "../lib/circles.js";
import { badRequest, isItemType, jsonBody, memberNameOf, optionalInt } from "../lib/items.js";
import { mintShare, shareTarget } from "../lib/item-shares.js";

/**
 * The link a member hands to somebody outside the app: one item, out of one
 * circle.
 *
 * This is deliberately not the invite route beside it. An invite says "come and
 * join this circle" and is minted per friend; a share says "I thought you would
 * enjoy this" and is minted per item, so sharing the same recipe into three chats
 * hands out the same link three times rather than three links nobody can tell
 * apart. Both still exist and neither replaces the other.
 *
 * The whole of the sharer-side rule is `shareTarget()`: the member can already
 * see the item, it is shared rather than private, and the circle the link speaks
 * for is one the item actually reaches. Nothing about the circle's privacy is
 * asked here — a link to one item is not a way into the circle, which is enforced
 * where it matters, in what `GET /api/shared/:token` will answer with.
 */
export default async (req: Request) => {
  const access = await admittedAccess();
  if (!access) return notAdmitted();

  const body = await jsonBody(req);
  if (!body) return badRequest("Expected a JSON body.");

  const itemType = body.itemType;
  const itemId = optionalInt(body.itemId);
  if (!isItemType(itemType) || !itemId) return badRequest("Tell us which item you are sharing.");

  const target = await shareTarget(
    itemType,
    itemId,
    optionalInt(body.circleId),
    access.user,
    await myCircleIds(access.user),
  );
  if (target instanceof Response) return target;

  const share = await mintShare(itemType, itemId, target.circleId, {
    id: access.user.id,
    name: memberNameOf(access.user),
  });

  return Response.json({ token: share.token }, { status: 201 });
};

export const config: Config = {
  path: "/api/shares",
  method: ["POST"],
};
