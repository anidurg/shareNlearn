// netlify/functions/my-members.mts
import type { Config } from "@netlify/functions";
import { admittedAccess, notAdmitted } from "../lib/access.js";
import { groupRoll, myCircleIds } from "../lib/circles.js";

/**
 * Who the caller shares a circle with, across every circle they are in — the
 * roll for **All circles**, which is where the app opens and therefore the
 * question Members is most often asked while nothing is narrowed.
 *
 * It is not the contact directory (`GET /api/members`), which is everybody the
 * app knows about and exists so an invite can name somebody. This is the people
 * the caller actually shares a room with, each carrying the rooms they share, so
 * one tap moves from "who is here?" to a circle's own roll with its roles and
 * its waiting list.
 *
 * Nothing about it is a wider reach than a circle page already gives: every
 * member listed is in a circle the caller is in, and reading that circle's roll
 * would name them anyway. Somebody with no account gets nothing — they are in no
 * circle, so there is nobody they share one with.
 */
export default async () => {
  const access = await admittedAccess();
  if (!access) return notAdmitted();

  const circleIds = await myCircleIds(access.user);
  const roll = await groupRoll(circleIds);
  return Response.json({ members: roll });
};

export const config: Config = {
  path: "/api/my-members",
  method: ["GET"],
};
