// netlify/functions/admin-circles.mts
import type { Config } from "@netlify/functions";
import { admittedAccess, forbidden } from "../lib/access.js";
import {
  canonicalDefault,
  circleRoll,
  duplicateDefaults,
  mergeDuplicateDefaults,
} from "../lib/admin.js";
import { badRequest, jsonBody, text, unauthorized } from "../lib/items.js";

/**
 * Every circle in the group, for the one person who can see across all of them.
 *
 * A circle is looked after by its own people and this is not a way in to what
 * they contain: the roll carries a name, a privacy, an owner and two counts, and
 * the only thing that can be done from here is deleting one — for the circle
 * whose owner is gone, and for the duplicate default circle, which is the one
 * fault nobody inside a circle can even see.
 *
 * Discover is created on first use rather than by a migration, so two members
 * arriving at the same moment could each create one. Everything downstream then
 * asks "is this member in *a* default circle?", which is true for both of them,
 * so the two never meet: same name, same icon, different id, neither able to
 * read the other's shares. `merge-defaults` folds the strays into the canonical
 * one, keeping every share and every membership.
 */
export default async (req: Request) => {
  const access = await admittedAccess();
  if (!access) return unauthorized();
  if (!access.isAppAdmin) {
    return forbidden("That is for the app admin, who looks after abuse and support only.");
  }

  if (req.method === "GET") {
    const roll = await circleRoll();
    return Response.json({
      circles: roll,
      duplicateDefaults: duplicateDefaults(roll).map((entry) => entry.id),
      defaultCircleId: canonicalDefault(roll)?.id ?? null,
    });
  }

  const body = await jsonBody(req);
  if (!body) return badRequest("Expected a JSON body.");
  if (text(body.action) !== "merge-defaults") return badRequest("Nothing to do.");

  const result = await mergeDuplicateDefaults();
  const roll = await circleRoll();
  return Response.json({
    ...result,
    circles: roll,
    duplicateDefaults: duplicateDefaults(roll).map((entry) => entry.id),
    defaultCircleId: canonicalDefault(roll)?.id ?? null,
  });
};

export const config: Config = {
  path: "/api/admin/circles",
  method: ["GET", "POST"],
};
