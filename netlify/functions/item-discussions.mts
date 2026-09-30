// netlify/functions/item-discussions.mts
// The discussions on one share: "Which chapter impacted you the most?" under a book,
// "Which raga is this based on?" under a recording of somebody singing. Starting one
// is a contribution rather than an edit, so any member the share reaches may open a
// thread on it — the same exception a word's language connections make.
import type { Config, Context } from "@netlify/functions";
import { admittedUser } from "../lib/access.js";
import { announceShare, circlesOfItem } from "../lib/circles.js";
import {
  countDiscussions,
  discussionGlyph,
  discussionLink,
  discussionNoun,
  discussionResponse,
  discussionsOf,
  isDiscussionItemType,
  MAX_DISCUSSIONS_PER_ITEM,
  promptFrom,
  startDiscussion,
  visibleDiscussable,
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
  const { itemType } = context.params;
  if (!isDiscussionItemType(itemType)) {
    return badRequest("Discussions only hang on a book or a song.");
  }

  const itemId = idFrom({ id: context.params.itemId });
  if (itemId === null) return badRequest(`Invalid ${discussionNoun(itemType)} id.`);

  const user = await admittedUser();

  const item = await visibleDiscussable(itemType, itemId, user);
  if (!item) return notFound(discussionNoun(itemType) === "book" ? "Book" : "Song");

  if (req.method === "GET") {
    return Response.json({ discussions: await discussionsOf(itemType, itemId, user) });
  }

  if (!user) return unauthorized();

  const body = await jsonBody(req);
  if (!body) return badRequest("Expected a JSON body.");

  const prompt = promptFrom(body);
  if (!prompt) return badRequest("Ask something to start the discussion.");

  // A question is written on somebody else's share, which is all the more reason
  // to read it first: the author cannot take it down, only the moderators can.
  const refused = unsafeText(prompt);
  if (refused) return refused;

  if ((await countDiscussions(itemType, itemId)) >= MAX_DISCUSSIONS_PER_ITEM) {
    return badRequest(
      `A ${discussionNoun(itemType)} can hold ${MAX_DISCUSSIONS_PER_ITEM} discussions.`,
    );
  }

  const created = await startDiscussion(itemType, itemId, prompt, user);
  if (!created) return badRequest("That discussion could not be started.");

  // A private share is nobody else's business, so nothing is announced about it.
  // Otherwise the news follows the share's own reach: the circles it went to, or
  // the whole group when it named none.
  if (item.visibility === "shared") {
    await announceShare({
      itemType,
      message: `${discussionGlyph(itemType)} ${memberNameOf(user)} started a discussion on ${item.title}: "${prompt}"`,
      link: discussionLink(itemType),
      circles: await circlesOfItem(itemType, itemId),
    });
  }

  return Response.json({ discussion: discussionResponse(created, []) }, { status: 201 });
};

export const config: Config = {
  path: "/api/items/:itemType/:itemId/discussions",
  method: ["GET", "POST"],
};
