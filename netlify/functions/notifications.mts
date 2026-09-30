// netlify/functions/notifications.mts
import type { Config } from "@netlify/functions";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { admittedUser } from "../lib/access.js";
import { db } from "../../db/index.js";
import { notifications } from "../../db/schema.js";
import { myCircleIds } from "../lib/circles.js";

export default async (req: Request) => {
  const user = await admittedUser();

  // A notification is a member telling other members something they did, so
  // there is no such thing as one for a visitor: "Anita read Atomic Habits" is
  // member activity whether it names a circle or not. The bell is empty until
  // somebody logs in.
  if (!user) return Response.json({ notifications: [] });

  // Group notifications (member_id is null) are for everyone; an addressed one —
  // a welcome for an invited friend, or word that an invite was accepted — reaches
  // only the member it names.
  const audience = or(isNull(notifications.memberId), eq(notifications.memberId, user.id));

  // A share into a circle is only news to that circle's members, so a row that
  // names a circle is filtered out for everyone else. Rows with no circle keep
  // reaching the whole group, as they always have.
  const myCircles = await myCircleIds(user);
  const reach =
    myCircles.length > 0
      ? or(isNull(notifications.circleId), inArray(notifications.circleId, myCircles))
      : isNull(notifications.circleId);

  const recent = await db
    .select()
    .from(notifications)
    .where(and(audience, reach))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  return Response.json({ notifications: recent });
};

export const config: Config = {
  path: "/api/notifications",
  method: ["GET"],
};
