// netlify/functions/blocks.mts
import type { Config } from "@netlify/functions";
import { admittedAccess, notAdmitted } from "../lib/access.js";
import { badRequest, jsonBody, text } from "../lib/items.js";
import { blockMember, moderationStateOf, nameOfMember } from "../lib/moderation.js";

/**
 * Blocking somebody, and the list of who is blocked. A block is mutual and silent:
 * neither member sees the other's shares or contributions from then on, and the
 * blocked member is never told. Nothing is deleted, and unblocking brings
 * everything back — it is a filter on two people's views, not a punishment.
 */
export default async (req: Request) => {
  const access = await admittedAccess();
  if (!access) return notAdmitted();

  if (req.method === "GET") {
    const { blocked } = await moderationStateOf(access.user);
    return Response.json({ blocked });
  }

  const body = await jsonBody(req);
  const memberId = text(body?.memberId);
  if (!memberId) return badRequest("Tell us which member to block.");
  if (memberId === access.user.id) return badRequest("You cannot block yourself.");

  const name = text(body?.memberName) || (await nameOfMember(memberId));
  await blockMember({ id: memberId, name: name || null }, access.user);

  return Response.json({ blocked: { memberId, memberName: name || null } }, { status: 201 });
};

export const config: Config = {
  path: "/api/blocks",
  method: ["GET", "POST"],
};
