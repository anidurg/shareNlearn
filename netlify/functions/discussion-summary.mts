// netlify/functions/discussion-summary.mts
// The AI reading of a long thread. Any member who can see the discussion may ask
// for it — it summarises what is already in front of them and changes nothing about
// the share, the thread or anybody's replies.
//
// The answer is cached on the discussion against the number of replies it covered,
// so asking twice for a thread that has not moved returns the same lines without
// calling the model again. The gateway key comes from Netlify's AI Gateway, which
// sets it on the deploy, so there is nothing to configure and no secret in the repo.
import type { Config, Context } from "@netlify/functions";
import { admittedUser } from "../lib/access.js";
import {
  discussionResponse,
  repliesOf,
  SUMMARY_MIN_REPLIES,
  summariesAvailable,
  summarize,
  visibleDiscussion,
} from "../lib/discussions.js";
import { badRequest, idFrom, notFound, unauthorized } from "../lib/items.js";

export default async (req: Request, context: Context) => {
  const discussionId = idFrom({ id: context.params.id });
  if (discussionId === null) return badRequest("Invalid discussion id.");

  const user = await admittedUser();
  if (!user) return unauthorized();

  const found = await visibleDiscussion(discussionId, user);
  if (!found) return notFound("Discussion");

  const replies = await repliesOf(discussionId);
  if (replies.length < SUMMARY_MIN_REPLIES) {
    return badRequest(
      `A discussion needs ${SUMMARY_MIN_REPLIES} replies before there is anything to summarise.`,
    );
  }

  // Already summarised, and nobody has replied since: the cache is the answer.
  const cached = found.discussion;
  if (cached.summary && cached.summaryReplyCount === replies.length) {
    return Response.json({ discussion: discussionResponse(cached, replies) });
  }

  if (!summariesAvailable()) {
    return Response.json(
      { error: "Discussion summaries are not switched on for this site yet." },
      { status: 503 },
    );
  }

  const updated = await summarize(cached, replies, user);
  if (!updated) {
    return Response.json(
      { error: "That discussion could not be summarised just now. Try again in a moment." },
      { status: 502 },
    );
  }

  return Response.json({ discussion: discussionResponse(updated, replies) });
};

export const config: Config = {
  path: "/api/discussions/:id/summary",
  method: ["POST"],
};
