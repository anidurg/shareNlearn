// netlify/functions/reports.mts
import type { Config } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { circles } from "../../db/schema.js";
import { admittedAccess, notAdmitted } from "../lib/access.js";
import { badRequest, isItemType, jsonBody, memberNameOf, optionalInt } from "../lib/items.js";
import {
  detailsFrom,
  fileReport,
  notifyModerators,
  reasonOf,
  reportResponse,
  reportsFor,
  visibleItem,
} from "../lib/moderation.js";
import { membershipOf } from "../lib/circles.js";

/**
 * Reporting a post, and the queue of what has been reported. Any member who can
 * see something can report it — that is the point of the ⋮ menu — and the report
 * goes to whoever moderates the circle it was read in, which is why the circle
 * travels with it.
 */
export default async (req: Request) => {
  const access = await admittedAccess();
  if (!access) return notAdmitted();

  if (req.method === "GET") {
    return Response.json({ reports: await reportsFor(access) });
  }

  const body = await jsonBody(req);
  if (!body) return badRequest("Expected a JSON body.");

  const itemType = body.itemType;
  const itemId = optionalInt(body.itemId);
  if (!isItemType(itemType) || !itemId) return badRequest("Tell us which post you are reporting.");

  // Reporting is not a way to find out that something exists: an item the member
  // cannot see is an item they cannot report.
  const item = await visibleItem(itemType, itemId, access.user);
  if (!item) return badRequest("That post is no longer available.");
  if (item.memberId === access.user.id) {
    return badRequest("That is your own post — you can delete it yourself.");
  }

  // The circle it was read in, when the reader named one they are actually in.
  const askedCircle = optionalInt(body.circleId);
  const circleId =
    askedCircle && (await membershipOf(askedCircle, access.user)) ? askedCircle : null;
  const [circle] = circleId
    ? await db.select({ name: circles.name }).from(circles).where(eq(circles.id, circleId))
    : [];

  const report = await fileReport({
    itemType,
    itemId,
    circleId,
    reason: reasonOf(body.reason),
    details: detailsFrom(body.details),
    author: { id: String(item.memberId), name: String(item.memberName ?? "A member") },
    reporter: { id: access.user.id, name: memberNameOf(access.user) },
  });

  await notifyModerators(report, circle?.name ?? null);

  return Response.json({ report: reportResponse(report, circle?.name ?? null) }, { status: 201 });
};

export const config: Config = {
  path: "/api/reports",
  method: ["GET", "POST"],
};
