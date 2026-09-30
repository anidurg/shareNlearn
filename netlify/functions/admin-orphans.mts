// netlify/functions/admin-orphans.mts
import type { Config } from "@netlify/functions";
import { admittedAccess, forbidden } from "../lib/access.js";
import { badRequest, jsonBody, text, unauthorized } from "../lib/items.js";
import { MAX_ORPHANS_LISTED, deleteOrphans, orphanReport } from "../lib/orphans.js";

/**
 * The blobs nothing points at, and the button that removes them.
 *
 * Uploading and saving are two requests, so a form abandoned between them leaves
 * bytes behind that no row will ever name — the one part of storage that grows
 * without anybody sharing anything. Nothing in the app sweeps those up, and
 * nothing here does it automatically either: Blobs answers `list()` with keys and
 * etags and no dates, so a sweeper has no way to tell a picture uploaded a month
 * ago from one that is still on its way to a save. An app admin reading the list
 * has exactly the context the code is missing.
 *
 * It is the app admin's rather than a circle keeper's for the same reason the
 * circle roll is: a store is the whole group's and cuts across every circle, and
 * the question "does any row still name this?" cannot be asked of one circle's
 * worth of the app.
 *
 * The `POST` takes the keys the page was showing and re-derives the orphan set
 * before deleting a single one, so a stale page can only ever delete less than it
 * offered — never a photo that has since been saved onto a share.
 */
export default async (req: Request) => {
  const access = await admittedAccess();
  if (!access) return unauthorized();
  if (!access.isAppAdmin) {
    return forbidden("That is for the app admin, who looks after abuse and support only.");
  }

  if (req.method === "GET") {
    return Response.json({ stores: await orphanReport(), listLimit: MAX_ORPHANS_LISTED });
  }

  const body = await jsonBody(req);
  if (!body) return badRequest("Expected a JSON body.");
  if (text(body.action) !== "delete") return badRequest("Nothing to do.");

  const store = text(body.store);
  const keys = Array.isArray(body.keys)
    ? body.keys.filter((key: unknown): key is string => typeof key === "string" && key.length > 0)
    : [];
  if (!store) return badRequest("Which store?");
  if (keys.length === 0) return badRequest("Nothing was selected.");

  const result = await deleteOrphans(store, keys);
  if (!result) return badRequest("There is no such store.");

  // The report is read again so the page the admin is looking at is the state
  // after the deletion rather than the state they pressed the button on.
  return Response.json({
    ...result,
    stores: await orphanReport(),
    listLimit: MAX_ORPHANS_LISTED,
  });
};

export const config: Config = {
  path: "/api/admin/orphans",
  method: ["GET", "POST"],
};
