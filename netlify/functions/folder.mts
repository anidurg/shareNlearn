// netlify/functions/folder.mts
import type { Config, Context } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { admittedAccess } from "../lib/access.js";
import { db } from "../../db/index.js";
import { circles, folders } from "../../db/schema.js";
import { circleIdFrom } from "../lib/circles.js";
import {
  circleFolderList,
  deleteFolder,
  folderById,
  folderNameOf,
  foldersOf,
  mergeFolder,
  moveFolder,
  nodeById,
  normalizeName,
  notTheFolderKeeper,
  pathOf,
  siblingsOf,
  subtreeIds,
} from "../lib/folders.js";
import { badRequest, jsonBody, notFound, unauthorized } from "../lib/items.js";
import { moderatorOf } from "../lib/moderation.js";
import { unsafeText } from "../lib/safety.js";

function idFromParam(value: string | undefined) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * One folder of a circle: renaming it, moving it inside another, hiding it,
 * merging it into another, or removing it — all five belonging to whoever looks
 * after the circle, its owner or an admin.
 *
 * None of these touch a share's text or its author, and none of them can strand a
 * branch. Moving takes everything inside along, because a folder names its parent
 * and nothing else. Hiding takes the branch with it as it is read, and changes
 * nothing on the way in. Merging hands this folder's subfolders to the folder it
 * goes into, and deleting promotes them one level rather than cutting them off,
 * with everything filed here landing in the folder above — or in the circle
 * itself, at the top. Tidying up the folders is an update, never a rewrite of
 * somebody's share.
 */
export default async (req: Request, context: Context) => {
  const circleId = circleIdFrom(context.params);
  const folderId = idFromParam(context.params.folderId);
  if (circleId === null || folderId === null) return badRequest("Invalid folder.");

  const access = await admittedAccess();
  if (!access) return unauthorized();
  const user = access.user;

  const [circle] = await db.select().from(circles).where(eq(circles.id, circleId));
  if (!circle) return notFound("Circle");
  if (!(await moderatorOf(circleId, access))) return notTheFolderKeeper();

  const folder = await folderById(circleId, folderId);
  if (!folder) return notFound("Folder");

  if (req.method === "PATCH") {
    const body = await jsonBody(req);
    if (!body) return badRequest("Expected a JSON body.");

    const rows = await foldersOf(circleId);

    // Merging: everything in here moves there, this folder's subfolders are
    // handed over with it, and the folder itself goes. Anywhere in the circle
    // will do — the two need not be siblings — but never into its own branch,
    // which would be merging a folder into something about to disappear with it.
    if (body.mergeIntoId !== undefined && body.mergeIntoId !== null) {
      const target = nodeById(rows, Number(body.mergeIntoId));
      if (!target || target.id === folder.id) {
        return badRequest("Choose another folder in this circle to merge into.");
      }
      if (subtreeIds(rows, folder.id).includes(target.id)) {
        return badRequest("That folder sits inside this one, so it cannot be the merge target.");
      }

      await mergeFolder(folder, target);

      return Response.json({
        merged: { from: folder.name, into: target.name, into_path: pathOf(rows, target) },
        folders: await circleFolderList(circleId, user, true),
      });
    }

    // Moving: a folder's parent is the whole of where it sits, so this is one
    // update and everything inside comes along. `moveFolder()` is what refuses a
    // move onto itself, into its own branch, or past the depth cap.
    if ("parentId" in body) {
      const asked = Number(body.parentId);
      const parentId = Number.isInteger(asked) && asked > 0 ? asked : null;
      if (parentId !== null && !nodeById(rows, parentId)) {
        return badRequest("Choose a folder in this circle to move it into.");
      }
      const refusal = await moveFolder(folder, parentId);
      if (refusal) return badRequest(refusal);

      const after = await foldersOf(circleId);
      const moved = nodeById(after, folder.id);
      return Response.json({
        moved: moved ? { id: moved.id, path: pathOf(after, moved) } : null,
        folders: await circleFolderList(circleId, user, true),
      });
    }

    const name = "name" in body ? folderNameOf(body.name) : folder.name;
    if (!name) return badRequest("Give the folder a name.");

    const refused = unsafeText(name);
    if (refused) return refused;

    // Renaming onto a name a sibling already has is a merge in disguise, so say so
    // rather than failing on the unique index or making a confusing pair. Only
    // siblings, because the same name in two branches is two different places.
    const clash = siblingsOf(rows, folder.parentId ?? null, folder.id).find(
      (row) => normalizeName(row.name) === normalizeName(name),
    );
    if (clash) {
      return Response.json(
        {
          error: `There is already a "${clash.name}" here.`,
          mergeInto: { id: clash.id, name: clash.name },
        },
        { status: 409 },
      );
    }

    await db
      .update(folders)
      .set({
        name,
        status: "hidden" in body ? (body.hidden ? "hidden" : "active") : folder.status,
      })
      .where(eq(folders.id, folder.id));

    return Response.json({ folders: await circleFolderList(circleId, user, true) });
  }

  // Removing a folder puts what was in it one level up — which at the top of a
  // circle is no folder at all, so the shares land back in the circle itself —
  // and promotes its subfolders to the same place, so nothing is cut off and
  // nothing anybody shared goes anywhere.
  await deleteFolder(folder);

  return Response.json({ ok: true, folders: await circleFolderList(circleId, user, true) });
};

export const config: Config = {
  path: "/api/circles/:circleId/folders/:folderId",
  method: ["PATCH", "DELETE"],
};
