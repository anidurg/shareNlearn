// netlify/functions/item-discussion.mts
// Closing a discussion. Whoever started it may close it, and so may the member who
// shared the book or the song it hangs on — it sits on their share, so they keep the
// last word on what is asked there — and so may whoever keeps a circle that share went
// into, since a thread asked in their circle is theirs to answer for. Its replies go
// with it; nobody else's share, library or notifications are touched.
import type { Config, Context } from "@netlify/functions";
import { admittedAccess } from "../lib/access.js";
import {
  deleteDiscussion,
  isDiscussionItemType,
  visibleDiscussion,
} from "../lib/discussions.js";
import { badRequest, idFrom, notFound, notYours, unauthorized } from "../lib/items.js";
import { moderatesItem } from "../lib/moderation.js";

export default async (_req: Request, context: Context) => {
  const { itemType } = context.params;
  if (!isDiscussionItemType(itemType)) {
    return badRequest("Discussions only hang on a book or a song.");
  }

  const itemId = idFrom({ id: context.params.itemId });
  const discussionId = idFrom({ id: context.params.discussionId });
  if (itemId === null || discussionId === null) return badRequest("Invalid discussion id.");

  const access = await admittedAccess();
  if (!access) return unauthorized();
  const user = access.user;

  const found = await visibleDiscussion(discussionId, user);
  // The thread has to be the one on the share the caller named, so a thread cannot
  // be closed through something it does not belong to.
  if (!found || found.itemType !== itemType || found.itemId !== itemId) {
    return notFound("Discussion");
  }

  const mayClose =
    found.discussion.memberId === user.id ||
    found.item.memberId === user.id ||
    (await moderatesItem(itemType, itemId, access));
  if (!mayClose) return notYours("discussions");

  await deleteDiscussion(discussionId);

  return Response.json({ ok: true });
};

export const config: Config = {
  path: "/api/items/:itemType/:itemId/discussions/:discussionId",
  method: ["DELETE"],
};
