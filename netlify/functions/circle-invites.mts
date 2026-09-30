// netlify/functions/circle-invites.mts
import type { Config, Context } from "@netlify/functions";
import { admittedAccess } from "../lib/access.js";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { circles } from "../../db/schema.js";
import { circleIdFrom, inviteMembers, memberOf } from "../lib/circles.js";
import { badRequest, jsonBody, notFound, unauthorized } from "../lib/items.js";
import { moderatorOf, notACircleManager } from "../lib/moderation.js";

/**
 * Whoever looks after the circle picks people from their contacts; each one
 * decides for themselves. Inviting is part of running a circle rather than a
 * privilege of having started it, which is why an admin may do it too.
 */
export default async (req: Request, context: Context) => {
  const id = circleIdFrom(context.params);
  if (id === null) return badRequest("Invalid circle id.");

  const access = await admittedAccess();
  if (!access) return unauthorized();
  const user = access.user;

  const [circle] = await db.select().from(circles).where(eq(circles.id, id));
  if (!circle) return notFound("Circle");
  if (!(await moderatorOf(id, access))) return notACircleManager("invite people to it");

  const body = await jsonBody(req);
  const memberIds = Array.isArray(body?.memberIds) ? body.memberIds.map(String) : [];
  if (memberIds.length === 0) return badRequest("Choose at least one person to invite.");

  const invited = await inviteMembers(circle, memberOf(user), memberIds);

  return Response.json(
    {
      invited: invited.map((row) => ({
        memberId: row.memberId,
        memberName: row.memberName,
        createdAt: row.createdAt,
      })),
    },
    { status: 201 },
  );
};

export const config: Config = {
  path: "/api/circles/:id/invites",
  method: ["POST"],
};
