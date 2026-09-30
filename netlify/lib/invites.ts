// netlify/lib/invites.ts
// Helpers for invitations to the group. An invite is a row with an unguessable
// token; the token is the whole secret, so a member can pass the link on however
// they like and nobody can walk the list of invites by guessing ids.
//
// An invite may also name a circle. That is how the owner of a brand new circle
// asks in somebody who has no account yet: the contact directory can only offer
// people the app already knows, so without this a circle's first invitation would
// have nobody to send it to.
import { inArray, type InferSelectModel } from "drizzle-orm";
import { db } from "../../db/index.js";
import { circles, type invites } from "../../db/schema.js";

export type Invite = InferSelectModel<typeof invites>;

/** Just enough of a circle to name it on the welcome screen. */
export interface InviteCircle {
  id: number;
  name: string;
  icon: string;
}

/** Kept short enough to paste into a message, long enough not to be guessable. */
export function newInviteToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

/** A token from the URL, normalised and length-checked before it hits the database. */
export function tokenFrom(params: Record<string, string | undefined>) {
  const token = String(params.token ?? "").trim().toLowerCase();
  return /^[a-z0-9]{16,64}$/.test(token) ? token : null;
}

/**
 * The circles behind a set of invites, in one query. A circle that has since been
 * deleted simply drops out, and its invite reads as a plain group invite.
 */
export async function circlesForInvites(rows: Invite[]) {
  const ids = [...new Set(rows.map((row) => row.circleId).filter((id): id is number => !!id))];
  const found = new Map<number, InviteCircle>();
  if (ids.length === 0) return found;

  const list = await db
    .select({ id: circles.id, name: circles.name, icon: circles.icon })
    .from(circles)
    .where(inArray(circles.id, ids));
  for (const circle of list) found.set(circle.id, circle);
  return found;
}

/**
 * What an invited friend is allowed to see before they have an account: who
 * invited them, what the inviter wrote, the circle they were asked into if there
 * is one, and whether the link is still good. The invitee's email address stays
 * out of it — anyone with the link can read this.
 */
export function invitePreview(invite: Invite, circle: InviteCircle | null = null) {
  return {
    token: invite.token,
    inviterName: invite.inviterName,
    inviteeName: invite.inviteeName,
    note: invite.note,
    status: invite.status,
    circle,
    createdAt: invite.createdAt,
  };
}

/** The inviter's own view: everything except the fields nobody needs. */
export function inviteForOwner(invite: Invite, circle: InviteCircle | null = null) {
  return {
    token: invite.token,
    inviterName: invite.inviterName,
    inviteeName: invite.inviteeName,
    inviteeEmail: invite.inviteeEmail,
    note: invite.note,
    status: invite.status,
    circle,
    acceptedMemberName: invite.acceptedMemberName,
    acceptedAt: invite.acceptedAt,
    createdAt: invite.createdAt,
  };
}
