// netlify/functions/member-blocks.mts
import type { Config, Context } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { members, notifications } from "../../db/schema.js";
import { admittedAccess, forbidden } from "../lib/access.js";
import { memberCircleList, outsideDefault, sharesWithoutCircles } from "../lib/admin.js";
import { badRequest, jsonBody, notFound, optionalText, text, unauthorized } from "../lib/items.js";
import { blocksInvolving, liftBlock } from "../lib/moderation.js";

/**
 * Why two members of the same group cannot see each other, and the one lever
 * that fixes it.
 *
 * A block is mutual and silent on purpose: it takes everything the other member
 * wrote out of the reader's app at once, and neither of them is told. That is
 * right for whoever asked for it. It is unhelpful when a block was a mistap,
 * because the member on the wrong end of it watches half the group's shares
 * vanish with nothing on screen explaining it, and cannot undo a row somebody
 * else wrote — Profile's "Hidden and blocked" only lists the blocks they placed
 * themselves. So this is the app admin's, alongside the other levers kept for
 * what a circle cannot settle on its own.
 *
 * The GET answers the circles the member is in as well, because the only other
 * reason two members are invisible to each other is that they are not in a
 * circle together — and the pair of answers together is the whole diagnosis.
 */
export default async (req: Request, context: Context) => {
  const access = await admittedAccess();
  if (!access) return unauthorized();
  if (!access.isAppAdmin) {
    return forbidden("That is for the app admin, who looks after abuse and support only.");
  }

  const memberId = text(context.params.memberId);
  if (!memberId) return badRequest("Say which member.");

  const [member] = await db.select().from(members).where(eq(members.id, memberId));
  if (!member) return notFound("Member");

  if (req.method === "GET") {
    const [blocks, circles, stranded, uncircled] = await Promise.all([
      blocksInvolving(memberId),
      memberCircleList(memberId),
      outsideDefault(memberId),
      sharesWithoutCircles(memberId),
    ]);
    return Response.json({ ...blocks, circles, outsideDefault: stranded, uncircled });
  }

  const otherId = text(context.params.otherId);
  if (!otherId) return badRequest("Say which block to lift.");

  const lifted = await liftBlock(memberId, otherId);
  if (lifted.length === 0) return notFound("Block");

  // Whoever placed a block is told it was lifted: it was their own record of
  // what they wanted not to read, so having it undone for them is not something
  // to do quietly. The member who was blocked is told nothing, because they were
  // never told about the block in the first place and there is nothing kind in
  // learning about it now.
  const body = await jsonBody(req);
  const reason = optionalText(body?.reason)?.slice(0, 200);
  for (const row of lifted) {
    await db.insert(notifications).values({
      message: reason
        ? `An admin lifted a block you had placed. ${reason}`
        : "An admin lifted a block you had placed. You can block again from the ⋮ on any post.",
      itemType: null,
      memberId: row.blockerId,
      link: "#/profile",
    });
  }

  const [blocks, circles, stranded, uncircled] = await Promise.all([
    blocksInvolving(memberId),
    memberCircleList(memberId),
    outsideDefault(memberId),
    sharesWithoutCircles(memberId),
  ]);
  return Response.json({
    lifted: lifted.length,
    ...blocks,
    circles,
    outsideDefault: stranded,
    uncircled,
  });
};

export const config: Config = {
  path: ["/api/members/:memberId/blocks", "/api/members/:memberId/blocks/:otherId"],
  method: ["GET", "DELETE"],
};
