// netlify/functions/my-categories.mts
import type { Config } from "@netlify/functions";
import { admittedUser } from "../lib/access.js";
import { activeCategoriesByCircle } from "../lib/categories.js";
import { myCircleIds } from "../lib/circles.js";
import { defaultCircle } from "../lib/community.js";

/**
 * The shape of every circle the caller belongs to, in one read: which categories
 * each one has and what shelves are in them. This is what a share form needs to
 * offer a subcategory the moment somebody ticks a circle, so it loads with
 * everything else at startup rather than a request per circle per form.
 *
 * A visitor with no account belongs to nothing and is still looking at Discover,
 * so they get Discover's categories — which is what draws the grid on the page
 * they landed on. They have no share form for it to fill in; that is the point.
 *
 * Counts are deliberately left out — they belong to a circle's own page, and
 * counting posts across every circle to fill a dropdown would be work nobody
 * reads.
 */
export default async () => {
  const user = await admittedUser();
  const circleIds = user ? await myCircleIds(user) : visitorCircleIds(await defaultCircle());
  const byCircle = await activeCategoriesByCircle(circleIds);
  return Response.json({ categories: [...byCircle.values()].flat() });
};

/** Nothing at all on a deployment where Discover has not been created yet. */
function visitorCircleIds(circle: { id: number } | null) {
  return circle ? [circle.id] : [];
}

export const config: Config = {
  path: "/api/my-categories",
  method: ["GET"],
};
