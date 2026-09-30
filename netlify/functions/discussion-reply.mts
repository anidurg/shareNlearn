// netlify/functions/discussion-reply.mts
// Taking a reply back. Whoever wrote it may remove it, and so may the member who
// started the discussion, the member who shared the book or song it hangs on, and
// whoever keeps a circle that share went into — the same widening circle of
// responsibility a language connection has, ending where moderation begins. Removing a
// reply leaves the thread and every other reply exactly where they were.
import type { Config, Context } from "@netlify/functions";
import { admittedAccess } from "../lib/access.js";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { discussionReplies } from "../../db/schema.js";
import { discussionResponse, repliesOf, visibleDiscussion } from "../lib/discussions.js";
import { badRequest, idFrom, notFound, notYours, unauthorized } from "../lib/items.js";
import { moderatesItem } from "../lib/moderation.js";

export default async (req: Request, context: Context) => {
  const discussionId = idFrom({ id: context.params.id });
  const replyId = idFrom({ id: context.params.replyId });
  if (discussionId === null || replyId === null) return badRequest("Invalid reply id.");

  const access = await admittedAccess();
  if (!access) return unauthorized();
  const user = access.user;

  const found = await visibleDiscussion(discussionId, user);
  if (!found) return notFound("Discussion");

  const [reply] = await db
    .select()
    .from(discussionReplies)
    .where(
      and(eq(discussionReplies.id, replyId), eq(discussionReplies.discussionId, discussionId)),
    );
  if (!reply) return notFound("Reply");

  const mayRemove =
    reply.memberId === user.id ||
    found.discussion.memberId === user.id ||
    found.item.memberId === user.id ||
    (await moderatesItem(found.itemType, found.itemId, access));
  if (!mayRemove) return notYours("replies");

  await db.delete(discussionReplies).where(eq(discussionReplies.id, replyId));

  return Response.json({
    discussion: discussionResponse(found.discussion, await repliesOf(discussionId)),
  });
};

export const config: Config = {
  path: "/api/discussions/:id/replies/:replyId",
  method: ["DELETE"],
};
