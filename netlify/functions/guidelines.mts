// netlify/functions/guidelines.mts
import type { Config } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { members } from "../../db/schema.js";
import { accessOf, accessResponse, notAdmitted } from "../lib/access.js";
import { memberNameOf, unauthorized } from "../lib/items.js";
import { getUser } from "@netlify/identity";

/**
 * Agreeing to the Community Guidelines, which is asked once and then never
 * again.
 *
 * Deliberately *not* behind `sharingGate()`, unlike every other write in the
 * app: the gate is the thing this route exists to open, so routing it through
 * one would leave a member unable to agree and unable to post, with no way out.
 * `admittedUser()` is the whole of the check — somebody the group has let in,
 * agreeing on their own behalf.
 *
 * The answer carries the caller's refreshed access, so the browser does not have
 * to re-read `/api/my-access` before opening the form the member was heading for.
 */
export default async () => {
  const user = await getUser();
  if (!user) return unauthorized();

  const access = await accessOf(user);
  if (!access.admitted || access.suspended) return notAdmitted();

  // Written as a timestamp rather than a flag, because the question support
  // actually gets asked is "when did they agree?" — and because re-agreeing
  // after a wording change is then a comparison rather than a migration.
  // Already agreed is not an error: the member taps once, whatever the network
  // did with the first tap.
  const acceptedAt = access.member?.guidelinesAcceptedAt ?? new Date();
  if (!access.member?.guidelinesAcceptedAt) {
    await db
      .insert(members)
      .values({
        id: user.id,
        name: memberNameOf(user),
        email: user.email ?? null,
        guidelinesAcceptedAt: acceptedAt,
      })
      .onConflictDoUpdate({
        target: members.id,
        set: { guidelinesAcceptedAt: acceptedAt },
      });
  }

  return Response.json({
    acceptedAt: acceptedAt.toISOString(),
    access: accessResponse({ ...access, acceptedGuidelines: true }),
  });
};

export const config: Config = {
  path: "/api/guidelines",
  method: ["POST"],
};
