// netlify/functions/admin-usage.mts
import type { Config } from "@netlify/functions";
import { admittedAccess, forbidden } from "../lib/access.js";
import { unauthorized } from "../lib/items.js";
import {
  MAX_USAGE_ROWS,
  currentMonth,
  monthBounds,
  usageByMember,
  usageMonths,
} from "../lib/usage.js";

/**
 * What the app cost, member by member, for one month.
 *
 * It is a read of `member_usage`, which is the only place the answer exists: a
 * Blobs listing carries no sizes, nothing but the serving routes knows that a
 * recording was played, and the platform's own dashboard answers for the site
 * rather than per member. So the three writers in `netlify/lib/usage.ts` record
 * it as it happens and this route groups it up.
 *
 * **Who may read it is the one predicate in the app wider than `isAppAdmin`.**
 * The app admin always, and anybody they have made an **App Manager** — a role
 * that grants this page and nothing else: no lever over an account, no reach
 * into a circle, no way to see anything anybody wrote. It exists because what a
 * deployment costs is worth another pair of eyes, and there was no way to show
 * this screen to somebody without also handing them abuse and support.
 *
 * The three caveats on the figures belong with the figures rather than in a
 * comment nobody reading the page will see, so the route sends them as `notes`.
 */
export default async (req: Request) => {
  const access = await admittedAccess();
  if (!access) return unauthorized();
  if (!access.isAppManager) {
    return forbidden("That is for the app admin and the App Managers they have named.");
  }

  // A month that is not a month reads as this one rather than as an error: the
  // page is a report, and a mistyped query string should still show something.
  const asked = new URL(req.url).searchParams.get("month") ?? "";
  const month = monthBounds(asked) ? asked : currentMonth();

  const [rows, months] = await Promise.all([usageByMember(month), usageMonths()]);

  return Response.json({
    month,
    // The month in progress may have nothing recorded yet, so it is offered
    // whether or not it has a row of its own.
    months: months.includes(month) ? months : [month, ...months],
    members: rows,
    listLimit: MAX_USAGE_ROWS,
    notes: [
      "Egress is charged to whoever uploaded the file, not whoever played it — three of the media routes need no login, so the reader is often unknown.",
      "Only bytes that reached a function are counted. A photo or document served from the CDN cache after its first read is invisible here, so these are a floor rather than the whole bill.",
      "AI is counted in calls rather than tokens, the gateway billing the account rather than the request.",
    ],
  });
};

export const config: Config = {
  path: "/api/admin/usage",
  method: ["GET"],
};
