// netlify/functions/bookmark.mts
import type { Config, Context } from "@netlify/functions";
import { admittedAccess } from "../lib/access.js";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { bookmarks, savedItems } from "../../db/schema.js";
import { filedCategoryIdFrom, shelfChoiceFrom } from "../lib/categories.js";
import { applyItemCircles, circleIdsFrom, clearItemCircles, filingsOf } from "../lib/circles.js";
import { folderIdFrom } from "../lib/folders.js";
import {
  badRequest,
  idFrom,
  jsonBody,
  notFound,
  notYours,
  text,
  unauthorized,
  visibilityOf,
} from "../lib/items.js";
import { clearItemPhotos } from "../lib/photos.js";
import { webAddressOf } from "../lib/fields.js";
import { mayManageItem } from "../lib/moderation.js";
import { unsafeText } from "../lib/safety.js";

export default async (req: Request, context: Context) => {
  const id = idFrom(context.params);
  if (id === null) return badRequest("Invalid bookmark id.");

  const access = await admittedAccess();
  if (!access) return unauthorized();
  const user = access.user;

  const [existing] = await db.select().from(bookmarks).where(eq(bookmarks.id, id));
  if (!existing) return notFound("Bookmark");
  // A share is its author's own work, and it is also something said in somebody's
  // circle. So the author may always correct or withdraw it, and so may whoever
  // keeps a circle it went into — its owner, an admin they chose, or the app admin
  // stepping in. Everybody else is told it is not theirs.
  if (!(await mayManageItem("bookmark", id, existing.memberId, access))) {
    return notYours("bookmarks");
  }

  if (req.method === "PATCH") {
    const body = await jsonBody(req);
    if (!body) return badRequest("Expected a JSON body.");

    const title = text(body.title ?? existing.title);
    if (!title) return badRequest("Give the bookmark a name.");

    // An edit that says nothing about the address keeps the one already stored,
    // which is already known to be a web address; one that names it is parsed
    // again, because the member can have typed anything the second time too.
    const url = "url" in body ? webAddressOf(text(body.url)) : existing.url;
    if (!url) return badRequest("That does not look like a web address.");

    const refused = unsafeText(title);
    if (refused) return refused;

    const [updated] = await db
      .update(bookmarks)
      .set({
        title,
        url,
        visibility: "visibility" in body ? visibilityOf(body.visibility) : existing.visibility,
      })
      .where(eq(bookmarks.id, id))
      .returning();

    const circleIds = await applyItemCircles(
      "bookmark",
      id,
      circleIdsFrom(body),
      updated.visibility,
      user,
      shelfChoiceFrom(body),
      filedCategoryIdFrom(body),
      folderIdFrom(body),
    );

    return Response.json({
      bookmark: { ...updated, circleIds, filings: await filingsOf("bookmark", id, user) },
    });
  }

  await db.delete(bookmarks).where(eq(bookmarks.id, id));
  await db
    .delete(savedItems)
    .where(and(eq(savedItems.itemType, "bookmark"), eq(savedItems.itemId, id)));
  await clearItemCircles("bookmark", id);
  // A bookmark takes no photos, but the sweep is harmless and is what keeps the
  // delete path identical to every other kind's.
  await clearItemPhotos("bookmark", id);

  return Response.json({ ok: true });
};

export const config: Config = {
  path: "/api/bookmarks/:id",
  method: ["PATCH", "DELETE"],
};
