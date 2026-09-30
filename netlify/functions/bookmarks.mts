// netlify/functions/bookmarks.mts
import type { Config } from "@netlify/functions";
import { admittedUser, sharingGate } from "../lib/access.js";
import { desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { bookmarks } from "../../db/schema.js";
import { filedCategoryIdFrom, shelfChoiceFrom } from "../lib/categories.js";
import {
  announceShare,
  circleIdsFrom,
  filingsOf,
  setItemCircles,
  withCircleIds,
} from "../lib/circles.js";
import { folderIdFrom } from "../lib/folders.js";
import {
  badRequest,
  jsonBody,
  memberNameOf,
  text,
  visibilityOf,
  visibleTo,
  unauthorized,
} from "../lib/items.js";
import { webAddressOf } from "../lib/fields.js";
import { unsafeText } from "../lib/safety.js";

/**
 * The smallest kind of share there is: a link and what to call it. It carries no
 * photos, which is the Word Explorer rule for the opposite reason — a word is its
 * meaning and a bookmark is its destination, so in both cases a picture beside it
 * would be decoration rather than the thing itself.
 *
 * The address goes through `webAddressOf()`, the same parse a category's Link
 * field uses, so a missing scheme is filled in and anything that is not http or
 * https is refused before it is stored. A bookmark is read back as something a
 * member taps, and that is the whole reason it is parsed rather than trimmed.
 */
export default async (req: Request) => {
  const user = await admittedUser();

  if (req.method === "GET") {
    const all = await db
      .select()
      .from(bookmarks)
      .where(visibleTo(bookmarks, user, "bookmark"))
      .orderBy(desc(bookmarks.createdAt));
    return Response.json({ bookmarks: await withCircleIds("bookmark", all, user) });
  }

  if (!user) return unauthorized();
  const gate = await sharingGate(user);
  if (gate) return gate;

  const body = await jsonBody(req);
  if (!body) return badRequest("Expected a JSON body.");

  const title = text(body.title);
  if (!title) return badRequest("Give the bookmark a name.");

  const url = webAddressOf(text(body.url));
  if (!url) return badRequest("That does not look like a web address.");

  const refused = unsafeText(title);
  if (refused) return refused;

  const memberName = memberNameOf(user);

  const [created] = await db
    .insert(bookmarks)
    .values({
      memberId: user.id,
      memberName,
      title,
      url,
      visibility: visibilityOf(body.visibility),
    })
    .returning();

  // A private bookmark reaches nobody, so it keeps no circle links.
  const chosen =
    created.visibility === "shared"
      ? await setItemCircles(
          "bookmark",
          created.id,
          circleIdsFrom(body) ?? [],
          user,
          shelfChoiceFrom(body),
          filedCategoryIdFrom(body),
          folderIdFrom(body),
        )
      : [];

  if (created.visibility === "shared") {
    await announceShare({
      itemType: "bookmark",
      message: `${memberName} shared a bookmark: ${title}`,
      circles: chosen,
    });
  }

  return Response.json(
    {
      bookmark: {
        ...created,
        circleIds: chosen.map((circle) => circle.id),
        filings: await filingsOf("bookmark", created.id, user),
      },
    },
    { status: 201 },
  );
};

export const config: Config = {
  path: "/api/bookmarks",
  method: ["GET", "POST"],
};
