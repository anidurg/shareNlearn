// netlify/functions/circle-member.mts
import type { Config, Context } from "@netlify/functions";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { circleInvites, circleMembers, circles, notifications } from "../../db/schema.js";
import { admittedAccess } from "../lib/access.js";
import { circleIdFrom, memberOf } from "../lib/circles.js";
import { badRequest, jsonBody, notFound, text, unauthorized } from "../lib/items.js";
import { moderatorOf, notACircleManager } from "../lib/moderation.js";

/**
 * Everything that changes somebody's standing in a circle. `DELETE` is every way
 * of stopping being part of one — leaving, being removed, turning down an
 * invitation, withdrawing a request — with `me` standing in for the caller's own
 * id. `PATCH` is whoever looks after the circle making a member an admin, or
 * taking it back.
 */
export default async (req: Request, context: Context) => {
  const id = circleIdFrom(context.params);
  if (id === null) return badRequest("Invalid circle id.");

  const access = await admittedAccess();
  if (!access) return unauthorized();
  const user = access.user;

  const [circle] = await db.select().from(circles).where(eq(circles.id, id));
  if (!circle) return notFound("Circle");

  const asked = text(context.params.memberId);
  const target = asked === "me" ? user.id : asked;
  if (!target) return badRequest("Say which member to remove.");

  const me = memberOf(user);
  const isOwner = circle.ownerId === user.id;
  // Whoever looks after the circle, which is the only question either verb asks.
  const moderating = await moderatorOf(id, access);

  const [membership] = await db
    .select()
    .from(circleMembers)
    .where(and(eq(circleMembers.circleId, id), eq(circleMembers.memberId, target)));

  if (req.method === "PATCH") {
    // Who looks after a circle is decided by the people already looking after it:
    // its owner, the admins they made, and the app admin standing in. An admin
    // handing the role on is the point of the role rather than a loophole in it —
    // the one member it cannot reach is the owner, just below.
    if (!moderating) return notACircleManager("choose its admins");
    if (!membership) return notFound("Circle membership");
    if (target === circle.ownerId) {
      return badRequest("The owner already moderates the circle.");
    }

    const body = await jsonBody(req);
    const role = text(body?.role) === "admin" ? "admin" : "member";
    if (membership.role === role) return Response.json({ member: membership });

    const [updated] = await db
      .update(circleMembers)
      .set({ role })
      .where(eq(circleMembers.id, membership.id))
      .returning();

    await db.insert(notifications).values({
      message:
        role === "admin"
          ? `${me.name} made you an admin of ${circle.icon} ${circle.name} — you can now act on reports there`
          : `${me.name} changed your role in ${circle.icon} ${circle.name} back to member`,
      itemType: null,
      memberId: target,
      link: `#/circles/${id}`,
    });

    return Response.json({ member: updated });
  }

  const removingSomeoneElse = target !== user.id;

  // Removing somebody belongs to whoever looks after the circle, and an admin is
  // one of those, so an admin may remove another. The owner is the exception and
  // the only one, which is what keeps a circle from being emptied of everybody
  // who could undo it.
  if (removingSomeoneElse && !moderating) {
    return notACircleManager("remove people from it");
  }
  if (target === circle.ownerId) {
    return badRequest(
      "A circle keeps its owner. Delete the circle instead if you are done with it.",
    );
  }
  /*
   * Discover is the circle every account is joined to, so nobody comes out of it.
   * This was allowed until now and looked as though it had worked: `accessOf()`
   * joins the member back on their very next request, so they were silently
   * returned to a circle they had just been told they had left — and, if it had
   * ever stuck, they would have had no way back to the circle that exists to be
   * everybody's way in.
   *
   * It is refused here rather than only in the browser because a hidden control
   * is never the check, and because removing somebody is a second door onto the
   * same row.
   */
  if (circle.isDefault) {
    return badRequest(
      removingSomeoneElse
        ? `Everybody in the group is in ${circle.name}, so nobody can be taken out of it.`
        : `${circle.name} is the circle everybody in the group is in, so it cannot be left.`,
    );
  }

  // Turning down an invitation, or withdrawing a request, is the same gesture.
  const [pending] = await db
    .select()
    .from(circleInvites)
    .where(
      and(
        eq(circleInvites.circleId, id),
        eq(circleInvites.memberId, target),
        eq(circleInvites.status, "pending"),
      ),
    );

  if (!membership && !pending) return notFound("Circle membership");

  if (membership) {
    await db.delete(circleMembers).where(eq(circleMembers.id, membership.id));
  }
  if (pending) {
    await db
      .update(circleInvites)
      .set({ status: "declined", respondedAt: new Date() })
      .where(eq(circleInvites.id, pending.id));
  }

  // Whoever did not press the button is the one who needs telling.
  if (removingSomeoneElse) {
    await db.insert(notifications).values({
      message: membership
        ? `${me.name} removed you from ${circle.icon} ${circle.name}`
        : `${me.name} withdrew your invitation to ${circle.icon} ${circle.name}`,
      itemType: null,
      memberId: target,
      link: "#/circles",
    });
  } else if (!isOwner) {
    await db.insert(notifications).values({
      message: membership
        ? `${me.name} left ${circle.icon} ${circle.name}`
        : pending?.kind === "invite"
          ? `${me.name} turned down your invitation to ${circle.icon} ${circle.name}`
          : `${me.name} withdrew their request to join ${circle.icon} ${circle.name}`,
      itemType: null,
      memberId: circle.ownerId,
      link: `#/circles/${id}`,
    });
  }

  return Response.json({ ok: true, left: Boolean(membership) });
};

export const config: Config = {
  path: "/api/circles/:id/members/:memberId",
  method: ["DELETE", "PATCH"],
};
