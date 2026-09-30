// netlify/functions/subcategory.mts
import type { Config, Context } from "@netlify/functions";
import { admittedAccess } from "../lib/access.js";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { circles, subcategories } from "../../db/schema.js";
import {
  categoryById,
  circleCategoryList,
  deleteSubcategory,
  mergeSubcategory,
  moveSubcategory,
  nodeById,
  normalizeName,
  notTheManager,
  pathOf,
  siblingsOf,
  subcategoriesOf,
  subcategoryById,
  subcategoryNameOf,
  subtreeIds,
} from "../lib/categories.js";
import { circleIdFrom } from "../lib/circles.js";
import { badRequest, jsonBody, notFound, unauthorized } from "../lib/items.js";
import { moderatorOf } from "../lib/moderation.js";
import { unsafeText } from "../lib/safety.js";

function idFromParam(value: string | undefined) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * One node of a circle's taxonomy: renaming it, moving it under another parent,
 * hiding it, merging it into another node, or removing it — all five belonging to
 * whoever looks after the circle, its owner or an admin.
 *
 * None of these touch a post's text or its author, and none of them can strand a
 * branch. Moving takes the whole subtree along, because a node names its parent
 * and nothing else. Hiding takes the branch with it as it is read, and changes
 * nothing on the way in. Merging hands this node's children to the node it goes
 * into, and deleting promotes them one level rather than cutting them off. The
 * point of keeping the taxonomy as rows is that tidying it up is an update, never
 * a rewrite of somebody's post.
 */
export default async (req: Request, context: Context) => {
  const circleId = circleIdFrom(context.params);
  const categoryId = idFromParam(context.params.categoryId);
  const subcategoryId = idFromParam(context.params.subcategoryId);
  if (circleId === null || categoryId === null || subcategoryId === null) {
    return badRequest("Invalid subcategory.");
  }

  const access = await admittedAccess();
  if (!access) return unauthorized();
  const user = access.user;

  const [circle] = await db.select().from(circles).where(eq(circles.id, circleId));
  if (!circle) return notFound("Circle");
  if (!(await moderatorOf(circleId, access))) return notTheManager();

  const category = await categoryById(circleId, categoryId);
  if (!category) return notFound("Category");
  const shelf = await subcategoryById(categoryId, subcategoryId);
  if (!shelf) return notFound("Subcategory");

  if (req.method === "PATCH") {
    const body = await jsonBody(req);
    if (!body) return badRequest("Expected a JSON body.");

    const rows = await subcategoriesOf([categoryId]);

    // Merging: everything filed here moves there, this node's children are handed
    // over with it, and the node itself goes. Anywhere in the category will do —
    // the two need not be siblings — but never into its own branch, which would
    // be merging a node into something that is about to disappear with it.
    if (body.mergeIntoId !== undefined && body.mergeIntoId !== null) {
      const targetId = Number(body.mergeIntoId);
      const target = nodeById(rows, targetId);
      if (!target || target.id === shelf.id) {
        return badRequest("Choose another subcategory in this category to merge into.");
      }
      if (subtreeIds(rows, shelf.id).includes(target.id)) {
        return badRequest("That subcategory sits under this one, so it cannot be the merge target.");
      }

      await mergeSubcategory(shelf, target);

      return Response.json({
        merged: { from: shelf.name, into: target.name, into_path: pathOf(rows, target) },
        categories: await circleCategoryList(circleId, user),
      });
    }

    // Moving: a node's parent is the whole of where it sits, so this is one
    // update and the branch under it comes along. `moveSubcategory()` is what
    // refuses a move onto itself, into its own branch, or past the depth cap.
    if ("parentId" in body) {
      const asked = Number(body.parentId);
      const parentId = Number.isInteger(asked) && asked > 0 ? asked : null;
      if (parentId !== null && !nodeById(rows, parentId)) {
        return badRequest("Choose a subcategory in this category to move it under.");
      }
      const refusal = await moveSubcategory(shelf, parentId);
      if (refusal) return badRequest(refusal);

      const after = await subcategoriesOf([categoryId]);
      const moved = nodeById(after, shelf.id);
      return Response.json({
        moved: moved ? { id: moved.id, path: pathOf(after, moved) } : null,
        categories: await circleCategoryList(circleId, user),
      });
    }

    const name = "name" in body ? subcategoryNameOf(body.name) : shelf.name;
    if (!name) return badRequest("Give the subcategory a name.");

    const refused = unsafeText(name);
    if (refused) return refused;

    // Renaming onto a name a sibling already has is a merge in disguise, so say
    // so rather than failing on the unique index or making a confusing pair. Only
    // siblings, because the same name in two different branches is two different
    // places — Karnataka under Vegetarian is not Karnataka under Non-Vegetarian.
    const clash = siblingsOf(rows, categoryId, shelf.parentId ?? null, shelf.id).find(
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
      .update(subcategories)
      .set({
        name,
        status: "hidden" in body ? (body.hidden ? "hidden" : "active") : shelf.status,
      })
      .where(eq(subcategories.id, shelf.id));

    return Response.json({ categories: await circleCategoryList(circleId, user) });
  }

  // Removing a node files what was on it one level up — which at the top of a
  // category is no shelf at all, exactly what deleting a shelf has always done —
  // and promotes its children to the same place, so nothing is cut off from the
  // category and nothing anybody wrote goes anywhere.
  await deleteSubcategory(shelf);

  return Response.json({ ok: true, categories: await circleCategoryList(circleId, user) });
};

export const config: Config = {
  path: "/api/circles/:circleId/categories/:categoryId/subcategories/:subcategoryId",
  method: ["PATCH", "DELETE"],
};
