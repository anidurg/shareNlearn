// netlify/functions/shared-item.mts
import type { Config, Context } from "@netlify/functions";
import { admittedUser } from "../lib/access.js";
import { myCircleIds } from "../lib/circles.js";
import { sharedItem, shareByToken, shareTokenFrom } from "../lib/item-shares.js";
import { notFound } from "../lib/items.js";

/**
 * One shared item, read by somebody who may have no account at all.
 *
 * This is the second public read in the app, after an invite's preview, and it is
 * public for the same reason: the content *is* the invitation, so a recipient has
 * to be able to read the recipe before being asked whether they would like more
 * of where it came from. Sending them to a login screen first would be asking
 * them to join a group whose point they have not been shown.
 *
 * What makes that safe is how narrow the answer is. The token names one item, and
 * `sharedItem()` derives everything from that item and nothing wider — the item
 * itself, and the circle's own shell for the "Shared from" line. Never its roll,
 * never its head count, never a sibling item, never the folder's contents. There
 * is no public route in this app that takes a circle id, so a link to one thing
 * cannot be walked into a way of reading a private circle.
 *
 * Every failure is the same answer, because the alternative is an oracle: a
 * withdrawn link, a deleted item, one its author has since made private and one
 * a moderator took out of the circle all read as "not available" rather than
 * telling a stranger which of those happened.
 *
 * Public does not mean the answer is the same for everybody. Whoever is asking is
 * read if they have a session — `admittedUser()` answers null for a visitor and
 * for a paused account, and `myCircleIds()` answers `[]` for null, so no branch is
 * needed — and the payload says whether they are in the circle the link came out
 * of. That is what lets an invite-only circle's share name itself without handing
 * over what is inside it, and what lets a member who already belongs read the
 * thing straight away rather than being offered a circle they are in.
 */
export default async (req: Request, context: Context) => {
  const token = shareTokenFrom(context.params);
  if (token === null) return notFound("Shared item");

  const share = await shareByToken(token);
  if (!share) return notFound("Shared item");

  const user = await admittedUser();
  const payload = await sharedItem(share, await myCircleIds(user));
  if (!payload) return notFound("Shared item");

  return Response.json({ shared: payload });
};

export const config: Config = {
  path: "/api/shared/:token",
  method: ["GET"],
};
