// netlify/functions/invite.mts
import type { Config, Context } from "@netlify/functions";
import { getUser } from "@netlify/identity";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { invites } from "../../db/schema.js";
import { circlesForInvites, inviteForOwner, invitePreview, tokenFrom } from "../lib/invites.js";
import { badRequest, notFound, notYours, unauthorized } from "../lib/items.js";

export default async (req: Request, context: Context) => {
  const token = tokenFrom(context.params);
  if (token === null) return notFound("Invite");

  const [invite] = await db.select().from(invites).where(eq(invites.token, token));
  if (!invite) return notFound("Invite");

  const circle = invite.circleId
    ? (await circlesForInvites([invite])).get(invite.circleId) ?? null
    : null;

  // Reading an invite needs no account: this is what the friend sees before they
  // have one. It carries the inviter's name and note, never the invitee's email.
  if (req.method === "GET") {
    return Response.json({ invite: invitePreview(invite, circle) });
  }

  const user = await getUser();
  if (!user) return unauthorized();
  if (invite.inviterId !== user.id) return notYours("invites");
  if (invite.status === "accepted") {
    return badRequest("That invite has already been accepted, so there is nothing to revoke.");
  }

  const [revoked] = await db
    .update(invites)
    .set({ status: "revoked" })
    .where(eq(invites.token, token))
    .returning();

  return Response.json({ invite: inviteForOwner(revoked, circle) });
};

export const config: Config = {
  path: "/api/invites/:token",
  method: ["GET", "DELETE"],
};
