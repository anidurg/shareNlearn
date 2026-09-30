// netlify/functions/folders.mts
import type { Config, Context } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { admittedAccess } from "../lib/access.js";
import { db } from "../../db/index.js";
import { circles } from "../../db/schema.js";
import { circleIdFrom, membershipOf } from "../lib/circles.js";
import {
  addFolder,
  applyFolderOrder,
  circleFolderList,
  folderNameOf,
  foldersOf,
  nodeById,
  pathOf,
  siblingsOf,
  similarFolder,
} from "../lib/folders.js";
import { badRequest, jsonBody, notFound, unauthorized } from "../lib/items.js";
import { moderatorOf, notACircleManager } from "../lib/moderation.js";
import { unsafeText } from "../lib/safety.js";

/**
 * A circle's folders: reading them, adding one, and putting one level in order.
 *
 * Reading is for anybody who can see the circle, because folders are how the
 * circle is navigated and a listed circle is readable by whoever came to look —
 * the counts on them are derived through `visibleTo()`, so a visitor's read comes
 * back with the shape and none of the contents.
 *
 * Writing is the circle's keepers' alone, and that is the deliberate difference
 * between a folder and a subcategory: a subcategory is filing invented in the
 * middle of posting, while a folder is the circle's own structure that everybody
 * else then navigates. So there is no `memberTaxonomy` clause here — an ordinary
 * member browses folders and shares into them, and never reshapes them.
 */
export default async (req: Request, context: Context) => {
  const circleId = circleIdFrom(context.params);
  if (circleId === null) return badRequest("Invalid circle.");

  const access = await admittedAccess();
  if (!access) return unauthorized();
  const user = access.user;

  const [circle] = await db.select().from(circles).where(eq(circles.id, circleId));
  if (!circle) return notFound("Circle");

  const membership = await membershipOf(circleId, user);
  const canManage = (await moderatorOf(circleId, access)) !== null;

  if (!membership && !canManage && circle.privacy === "private") {
    return Response.json({ error: "Join the circle to see its folders." }, { status: 403 });
  }

  if (req.method === "GET") {
    return Response.json({ folders: await circleFolderList(circleId, user, canManage) });
  }

  if (!canManage) {
    return notACircleManager(
      req.method === "PATCH" ? "reorder its folders" : "add folders to it",
    );
  }

  const body = await jsonBody(req);
  if (!body) return badRequest("Expected a JSON body.");

  const existing = await foldersOf(circleId);

  if (req.method === "PATCH") {
    const wanted = Array.isArray(body.order) ? body.order.map(Number) : [];
    const sent = wanted
      .map((id) => nodeById(existing, id))
      .filter((node): node is NonNullable<typeof node> => node !== null);
    if (sent.length === 0) return badRequest("Send the folder ids in their new order.");

    // One level at a time: whatever parent the first folder sits under is the row
    // being reordered, and anything from elsewhere in the tree is left out rather
    // than interleaved into it.
    const parentId = sent[0].parentId ?? null;
    const ids = sent.filter((node) => (node.parentId ?? null) === parentId).map((node) => node.id);
    await applyFolderOrder(ids);
    return Response.json({ folders: await circleFolderList(circleId, user, true) });
  }

  const name = folderNameOf(body.name);
  if (!name) return badRequest("Give the folder a name.");

  const refused = unsafeText(name);
  if (refused) return refused;

  // Which folder the new one goes inside. A parent from another circle is a
  // request that cannot mean anything, so it is refused rather than flattened.
  const asked = Number(body.parentId);
  const parentId = Number.isInteger(asked) && asked > 0 ? asked : null;
  const parent = parentId === null ? null : nodeById(existing, parentId);
  if (parentId !== null && !parent) return notFound("Folder");

  const similar = similarFolder(name, siblingsOf(existing, parentId));

  // Unless the keeper has already been shown the near-match and said "anyway",
  // hand it back rather than quietly making a second folder for the same thing.
  if (similar && !body.confirm) {
    return Response.json({
      similar: { id: similar.id, name: similar.name, path: pathOf(existing, similar) },
      created: null,
      folders: await circleFolderList(circleId, user, true),
    });
  }

  const folder = await addFolder(circleId, name, user.id, parentId);
  if (!folder) return badRequest("That folder could not be added here.");

  const after = await foldersOf(circleId);
  return Response.json(
    {
      created: {
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        path: pathOf(after, folder),
      },
      similar: null,
      folders: await circleFolderList(circleId, user, true),
    },
    { status: 201 },
  );
};

export const config: Config = {
  path: "/api/circles/:circleId/folders",
  method: ["GET", "POST", "PATCH"],
};
