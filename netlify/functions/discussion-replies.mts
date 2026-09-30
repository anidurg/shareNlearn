// netlify/functions/discussion-replies.mts
// Joining a discussion. Any member the share reaches may reply — a reply is a
// contribution rather than an edit of anything — and the two people most likely to
// care are told: whoever asked the question, and whoever shared the book or the song
// it was asked about.
import type { Config, Context } from "@netlify/functions";
import { admittedUser } from "../lib/access.js";
import { db } from "../../db/index.js";
import { notifications } from "../../db/schema.js";
import {
  addReply,
  discussionGlyph,
  discussionLink,
  discussionResponse,
  MAX_REPLIES_PER_DISCUSSION,
  repliesOf,
  replyFrom,
  visibleDiscussion,
} from "../lib/discussions.js";
import {
  badRequest,
  idFrom,
  jsonBody,
  memberNameOf,
  notFound,
  unauthorized,
} from "../lib/items.js";
import { unsafeText } from "../lib/safety.js";

export default async (req: Request, context: Context) => {
  const discussionId = idFrom({ id: context.params.id });
  if (discussionId === null) return badRequest("Invalid discussion id.");

  const user = await admittedUser();
  if (!user) return unauthorized();

  const found = await visibleDiscussion(discussionId, user);
  if (!found) return notFound("Discussion");

  const body = await jsonBody(req);
  if (!body) return badRequest("Expected a JSON body.");

  const written = replyFrom(body);
  if (!written) return badRequest("Write something to add to the discussion.");

  const refused = unsafeText(written);
  if (refused) return refused;

  const existing = await repliesOf(discussionId);
  if (existing.length >= MAX_REPLIES_PER_DISCUSSION) {
    return badRequest(`A discussion can hold ${MAX_REPLIES_PER_DISCUSSION} replies.`);
  }

  const created = await addReply(discussionId, written, user);
  if (!created) return badRequest("That reply could not be added.");

  const replies = [...existing, created];
  const discussion = discussionResponse(found.discussion, replies);

  // Addressed rather than group-wide: a thread ticking along is only news to the
  // two people it belongs to, and never to the member who just wrote in it.
  const audience = new Set([found.discussion.memberId, found.item.memberId]);
  audience.delete(user.id);
  if (audience.size > 0) {
    await db.insert(notifications).values(
      [...audience].map((memberId) => ({
        message: `${discussionGlyph(found.itemType)} ${memberNameOf(user)} joined the discussion on ${found.item.title}: "${found.discussion.prompt}" — ${discussion.participantCount} ${
          discussion.participantCount === 1 ? "person has" : "people have"
        } joined the discussion.`,
        itemType: found.itemType,
        memberId,
        link: discussionLink(found.itemType),
      })),
    );
  }

  return Response.json({ discussion }, { status: 201 });
};

export const config: Config = {
  path: "/api/discussions/:id/replies",
  method: ["POST"],
};
