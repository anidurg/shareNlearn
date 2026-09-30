// netlify/functions/invite-accept.mts
import type { Config, Context } from "@netlify/functions";
import { getUser } from "@netlify/identity";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { circleInvites, invites, notifications } from "../../db/schema.js";
import { joinCircle } from "../lib/circles.js";
import { circlesForInvites, invitePreview, tokenFrom, type Invite } from "../lib/invites.js";
import { badRequest, memberNameOf, notFound, unauthorized } from "../lib/items.js";
import { admitMember } from "../lib/members.js";

/**
 * A link made from a circle carries that circle, so the friend lands inside it
 * rather than in the group at large. Joining is idempotent, which is what lets a
 * re-opened link settle instead of failing.
 */
async function joinInvitedCircle(invite: Invite, member: { id: string; name: string }) {
  if (!invite.circleId) return null;
  const circle = (await circlesForInvites([invite])).get(invite.circleId);
  if (!circle) return null;

  await joinCircle(circle.id, member);
  // An invitation already waiting for them inside the app is answered by this.
  await db
    .update(circleInvites)
    .set({ status: "accepted", respondedAt: new Date() })
    .where(
      and(
        eq(circleInvites.circleId, circle.id),
        eq(circleInvites.memberId, member.id),
        eq(circleInvites.status, "pending"),
      ),
    );
  return circle;
}

/**
 * Accepting is what turns a link into a membership: the new member is welcomed
 * personally, the inviter hears that their friend arrived, and the group sees a
 * new face in the activity feed. Called once the invited friend is logged in.
 */
export default async (req: Request, context: Context) => {
  const token = tokenFrom(context.params);
  if (token === null) return notFound("Invite");

  const user = await getUser();
  if (!user) return unauthorized();

  const [invite] = await db.select().from(invites).where(eq(invites.token, token));
  if (!invite) return notFound("Invite");
  if (invite.status === "revoked") return badRequest("That invite is no longer active.");
  if (invite.inviterId === user.id) {
    return badRequest("That is your own invite link — send it to a friend instead.");
  }

  const memberName = memberNameOf(user);
  const member = { id: user.id, name: memberName };

  if (invite.status === "accepted") {
    // Re-opening the link on another device should be calm, not an error — and it
    // is a second chance to land in the circle if the first pass stopped short.
    if (invite.acceptedMemberId === user.id) {
      await admitMember(user, invite.inviterId);
      const circle = await joinInvitedCircle(invite, member);
      return Response.json({
        invite: invitePreview(invite, circle ?? null),
        alreadyAccepted: true,
      });
    }
    return badRequest("Someone has already joined with that invite.");
  }

  // Guarded on "pending" so two taps in a row cannot both claim the invite.
  const [accepted] = await db
    .update(invites)
    .set({
      status: "accepted",
      acceptedMemberId: user.id,
      acceptedMemberName: memberName,
      acceptedAt: new Date(),
    })
    .where(and(eq(invites.token, token), eq(invites.status, "pending")))
    .returning();

  if (!accepted) return badRequest("Someone has already joined with that invite.");

  // Being in the contact directory from the first moment is what lets everybody
  // else invite them into their own circles without waiting for them to share —
  // and this is the one place an account becomes an admitted member, which every
  // content route checks before it answers anything.
  await admitMember(user, invite.inviterId);

  const circle = await joinInvitedCircle(accepted, member);
  // A circle invitation lands on that circle's page; a plain group link has no
  // such answer and lands on the circles listing, which is the app's front page.
  const landing = circle ? `#/circles/${circle.id}` : "#/circles";

  await db.insert(notifications).values([
    {
      message: `${memberName} joined the group — invited by ${invite.inviterName}`,
      itemType: null,
      memberId: null,
      link: "#/circles",
    },
    {
      message: circle
        ? `${invite.inviterName} invited you to ${circle.icon} ${circle.name}. Welcome — have a look at what the circle has shared.`
        : `${invite.inviterName} invited you to Share & Learn. Welcome — have a look at what the group has shared.`,
      itemType: null,
      memberId: user.id,
      link: landing,
    },
    {
      message: circle
        ? `${memberName} accepted your invite and joined ${circle.icon} ${circle.name}`
        : `${memberName} accepted your invite and joined the group`,
      itemType: null,
      memberId: invite.inviterId,
      link: circle ? landing : "#/profile",
    },
  ]);

  // The circle itself hears about it too, the same as any other way in.
  if (circle) {
    await db.insert(notifications).values({
      message: `${memberName} joined ${circle.icon} ${circle.name}`,
      itemType: null,
      circleId: circle.id,
      link: landing,
    });
  }

  return Response.json({ invite: invitePreview(accepted, circle ?? null), alreadyAccepted: false });
};

export const config: Config = {
  path: "/api/invites/:token/accept",
  method: ["POST"],
};
