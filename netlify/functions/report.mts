// netlify/functions/report.mts
import type { Config, Context } from "@netlify/functions";
import { admittedAccess, forbidden, notAdmitted } from "../lib/access.js";
import { badRequest, isItemType, jsonBody, optionalInt, text } from "../lib/items.js";
import {
  removeFromCircle,
  reportForModerator,
  reportResponse,
  resolveReport,
} from "../lib/moderation.js";

/**
 * Settling a report, which a circle's own moderators do and the app admin can do
 * anywhere. There are exactly two answers: leave the post alone, or take it out of
 * the circle it was reported in. Neither deletes anybody's work — a share removed
 * from its last circle becomes private to whoever wrote it, and they are told.
 */
export default async (req: Request, context: Context) => {
  const access = await admittedAccess();
  if (!access) return notAdmitted();

  const id = optionalInt(context.params.id);
  if (!id) return badRequest("Invalid report id.");

  const report = await reportForModerator(id, access);
  if (!report) {
    return forbidden("Only the circle's admins can act on a report about it.");
  }

  const body = await jsonBody(req);
  const decision = text(body?.decision);
  if (decision !== "dismiss" && decision !== "remove") {
    return badRequest('Say what to do: "dismiss" or "remove".');
  }

  let madePrivate = false;
  if (decision === "remove" && isItemType(report.itemType)) {
    ({ madePrivate } = await removeFromCircle(report.itemType, report.itemId, report.circleId));
  }

  const settled = await resolveReport(
    report,
    decision === "remove" ? "removed" : "dismissed",
    access,
  );

  return Response.json({ report: reportResponse(settled), madePrivate });
};

export const config: Config = {
  path: "/api/reports/:id",
  method: ["PATCH"],
};
