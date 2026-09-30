// netlify/functions/invites.mts
import type { Config } from "@netlify/functions";
import { admittedAccess } from "../lib/access.js";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { circles, invites } from "../../db/schema.js";
import { circlesForInvites, inviteForOwner, newInviteToken } from "../lib/invites.js";
import { moderatorOf, notACircleManager } from "../lib/moderation.js";
import {
  badRequest,
  jsonBody,
  memberNameOf,
  optionalEmail,
  optionalText,
  unauthorized,
} from "../lib/items.js";

/** Enough for a whole address book, low enough that a loose script cannot flood the table. */
const MAX_PENDING_INVITES = 30;

export default async (req: Request) => {
  const access = await admittedAccess();
  const user = access?.user ?? null;
  if (!user) return unauthorized();

  if (req.method === "GET") {
    const mine = await db
      .select()
      .from(invites)
      .where(eq(invites.inviterId, user.id))
      .orderBy(desc(invites.createdAt));
    const byCircle = await circlesForInvites(mine);
    return Response.json({
      invites: mine.map((invite) =>
        inviteForOwner(invite, invite.circleId ? byCircle.get(invite.circleId) ?? null : null),
      ),
    });
  }

  // A body is welcome but not required — an invite link with no details still works.
  const body = (await jsonBody(req)) ?? {};

  // An invite may carry a circle, so accepting it joins the group and that circle
  // at once. Whoever looks after the circle may hand out its links — its owner or
  // one of its admins — the same rule as inviting a contact into it.
  let circle = null;
  if (body.circleId !== undefined && body.circleId !== null) {
    const circleId = Number(body.circleId);
    if (!Number.isInteger(circleId) || circleId <= 0) return badRequest("Invalid circle id.");

    const [found] = await db.select().from(circles).where(eq(circles.id, circleId));
    if (!found) return badRequest("That circle no longer exists.");
    if (!access || !(await moderatorOf(circleId, access))) {
      return notACircleManager("invite people to it");
    }
    circle = found;
  }

  const pending = await db
    .select({ token: invites.token })
    .from(invites)
    .where(and(eq(invites.inviterId, user.id), eq(invites.status, "pending")));
  if (pending.length >= MAX_PENDING_INVITES) {
    return badRequest(
      `You already have ${MAX_PENDING_INVITES} invites waiting. Revoke one before making another.`,
    );
  }

  const [created] = await db
    .insert(invites)
    .values({
      token: newInviteToken(),
      inviterId: user.id,
      inviterName: memberNameOf(user),
      inviteeName: optionalText(body.inviteeName),
      inviteeEmail: optionalEmail(body.inviteeEmail),
      note: optionalText(body.note),
      circleId: circle?.id ?? null,
    })
    .returning();

  return Response.json(
    {
      invite: inviteForOwner(
        created,
        circle ? { id: circle.id, name: circle.name, icon: circle.icon } : null,
      ),
    },
    { status: 201 },
  );
};

export const config: Config = {
  path: "/api/invites",
  method: ["GET", "POST"],
};
