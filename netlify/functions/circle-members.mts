// netlify/functions/circle-members.mts
import type { Config, Context } from "@netlify/functions";
import { admittedAccess } from "../lib/access.js";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { circleInvites, circles, notifications } from "../../db/schema.js";
import {
  circleIdFrom,
  joinCircle,
  memberOf,
  membershipOf,
  pendingFor,
} from "../lib/circles.js";
import { badRequest, jsonBody, notFound, text, unauthorized } from "../lib/items.js";
import { contactNames } from "../lib/members.js";
import { moderatorOf } from "../lib/moderation.js";

/**
 * Joining a circle, from either end: a member accepting an invitation or walking
 * into a public circle, and an owner approving somebody who asked to be let in.
 */
export default async (req: Request, context: Context) => {
  const id = circleIdFrom(context.params);
  if (id === null) return badRequest("Invalid circle id.");

  const access = await admittedAccess();
  if (!access) return unauthorized();
  const user = access.user;

  const [circle] = await db.select().from(circles).where(eq(circles.id, id));
  if (!circle) return notFound("Circle");

  const me = memberOf(user);
  const body = (await jsonBody(req)) ?? {};
  const target = text(body.memberId);

  // A moderator letting somebody in who asked. The owner's admins can do this
  // too: deciding who is in the room is part of looking after it.
  if (target && target !== user.id) {
    if (!(await moderatorOf(id, access))) {
      return Response.json(
        { error: "Only a circle's owner or one of its admins can add people to it." },
        { status: 403 },
      );
    }

    const request = await pendingFor(id, target, "request");
    if (!request) return notFound("Request to join");

    await joinCircle(id, { id: target, name: request.memberName });
    await db
      .update(circleInvites)
      .set({ status: "accepted", respondedAt: new Date() })
      .where(eq(circleInvites.id, request.id));

    await db.insert(notifications).values({
      message: `You are in ${circle.icon} ${circle.name} — ${me.name} let you in`,
      itemType: null,
      memberId: target,
      link: `#/circles/${id}`,
    });

    return Response.json({ joined: true, memberId: target });
  }

  // From here on the caller is acting for themselves.
  if (await membershipOf(id, user)) {
    return Response.json({ joined: true, memberId: user.id });
  }

  const invitation = await pendingFor(id, user.id, "invite");
  const welcome = invitation !== null || circle.privacy === "public";

  if (!welcome && circle.privacy === "private") {
    return Response.json(
      { error: "That circle is invite only. Ask its owner for an invitation." },
      { status: 403 },
    );
  }

  if (!welcome) {
    // Discoverable: the owner decides, so this is a knock at the door.
    const names = await contactNames();
    const [request] = await db
      .insert(circleInvites)
      .values({
        circleId: id,
        kind: "request",
        memberId: user.id,
        memberName: names.get(user.id) ?? me.name,
        invitedById: user.id,
        invitedByName: me.name,
      })
      .onConflictDoUpdate({
        target: [circleInvites.circleId, circleInvites.memberId, circleInvites.kind],
        set: { status: "pending", respondedAt: null, memberName: me.name },
      })
      .returning();

    await db.insert(notifications).values({
      message: `${me.name} would like to join ${circle.icon} ${circle.name}`,
      itemType: null,
      memberId: circle.ownerId,
      link: `#/circles/${id}`,
    });

    return Response.json({ requested: true, createdAt: request.createdAt }, { status: 202 });
  }

  await joinCircle(id, me);
  if (invitation) {
    await db
      .update(circleInvites)
      .set({ status: "accepted", respondedAt: new Date() })
      .where(eq(circleInvites.id, invitation.id));
  }
  // Any request they had made is answered by them being in.
  await db
    .update(circleInvites)
    .set({ status: "accepted", respondedAt: new Date() })
    .where(
      and(
        eq(circleInvites.circleId, id),
        eq(circleInvites.memberId, user.id),
        eq(circleInvites.kind, "request"),
        eq(circleInvites.status, "pending"),
      ),
    );

  await db.insert(notifications).values([
    {
      message: `${me.name} joined ${circle.icon} ${circle.name}`,
      itemType: null,
      circleId: id,
      link: `#/circles/${id}`,
    },
    {
      message: `${me.name} joined your circle ${circle.icon} ${circle.name}`,
      itemType: null,
      memberId: circle.ownerId,
      link: `#/circles/${id}`,
    },
  ]);

  return Response.json({ joined: true, memberId: user.id }, { status: 201 });
};

export const config: Config = {
  path: "/api/circles/:id/members",
  method: ["POST"],
};
