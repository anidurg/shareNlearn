// netlify/functions/access.mts
import type { Config } from "@netlify/functions";
import { getUser } from "@netlify/identity";
import { desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { members } from "../../db/schema.js";
import { accessOf, accessResponse } from "../lib/access.js";
import { moderatedCircleIds, moderationStateOf, openReportCounts } from "../lib/moderation.js";

/**
 * Where the caller stands: whether the group has let them in, whether they still
 * have to join a circle, whether they may start one, what they have hidden, who
 * they have blocked, and — for a moderator — where the reports are waiting.
 *
 * Deliberately answers for a logged-out visitor too, with everything false, so
 * the app can show its welcome and a way to sign up instead of an error.
 */
export default async () => {
  const user = await getUser();
  if (!user) {
    return Response.json({
      loggedIn: false,
      access: {
        admitted: false,
        suspended: false,
        role: "member",
        trusted: false,
        canCreateCircle: false,
        needsCircle: false,
        acceptedGuidelines: false,
        circleCount: 0,
        founding: false,
        trustedInDays: 0,
        trustedAfterDays: 0,
      },
      moderating: [],
      openReports: {},
      hidden: [],
      blocked: [],
      directory: [],
    });
  }

  const access = await accessOf(user);
  // A paused account has nothing else to tell them about, and the gate screen is
  // all they are going to see.
  if (!access.admitted || access.suspended) {
    return Response.json({
      loggedIn: true,
      access: accessResponse(access),
      moderating: [],
      openReports: {},
      hidden: [],
      blocked: [],
      directory: [],
    });
  }

  const moderating = await moderatedCircleIds(access);
  const [counts, mine] = await Promise.all([
    openReportCounts(moderating),
    moderationStateOf(user),
  ]);

  // The roll travels with the app admin's own access, because the support screen
  // that shows it is the only place it is ever read, and nobody else may see it.
  const directory = access.isAppAdmin
    ? await db
        .select({
          id: members.id,
          name: members.name,
          role: members.role,
          status: members.status,
          admittedAt: members.admittedAt,
          trustedAt: members.trustedAt,
          lastSeenAt: members.lastSeenAt,
          createdAt: members.createdAt,
        })
        .from(members)
        .orderBy(desc(members.createdAt))
    : [];

  return Response.json({
    loggedIn: true,
    access: accessResponse(access),
    moderating,
    openReports: Object.fromEntries(counts),
    hidden: mine.hidden,
    blocked: mine.blocked,
    directory,
  });
};

export const config: Config = {
  path: "/api/my-access",
  method: ["GET"],
};
