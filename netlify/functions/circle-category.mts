// netlify/functions/circle-category.mts
import type { Config, Context } from "@netlify/functions";
import { admittedAccess } from "../lib/access.js";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  circleCategories,
  circles,
  itemCircles,
  notifications,
  posts,
  subcategories,
} from "../../db/schema.js";
import {
  categoryById,
  categoryIconOf,
  categoryNameOf,
  circleCategoryList,
  CUSTOM_ITEM_TYPE,
  nodeAtPath,
  notTheManager,
  pathOf,
  postsInCategory,
  releaseFiledItems,
  subcategoriesOf,
} from "../lib/categories.js";
import type { CategoryRow } from "../lib/categories.js";
import { circleIdFrom, memberOf } from "../lib/circles.js";
import { clearCategoryFields } from "../lib/fields.js";
import { badRequest, jsonBody, notFound, unauthorized } from "../lib/items.js";
import { moderatorOf } from "../lib/moderation.js";
import { unsafeText } from "../lib/safety.js";

function categoryIdFromParams(params: Record<string, string | undefined>) {
  const id = Number(params.categoryId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * One category: renaming it, changing its icon, hiding it, or — for a category
 * the circle invented and has already hidden — removing it for good. All four
 * belong to whoever looks after the circle: its owner or one of its admins.
 *
 * Hiding is the ordinary way to switch a category off, and it is reversible:
 * nothing is deleted, the posts stay where they are, and ticking the category
 * again brings the whole thing back. Removal is the rarer, deliberate act, and it
 * still never destroys somebody else's post.
 */
export default async (req: Request, context: Context) => {
  const circleId = circleIdFrom(context.params);
  const categoryId = categoryIdFromParams(context.params);
  if (circleId === null || categoryId === null) return badRequest("Invalid category.");

  const access = await admittedAccess();
  if (!access) return unauthorized();
  const user = access.user;

  const [circle] = await db.select().from(circles).where(eq(circles.id, circleId));
  if (!circle) return notFound("Circle");
  if (!(await moderatorOf(circleId, access))) return notTheManager();

  const category = await categoryById(circleId, categoryId);
  if (!category) return notFound("Category");

  if (req.method === "PATCH") {
    const body = await jsonBody(req);
    if (!body) return badRequest("Expected a JSON body.");

    const name = "name" in body ? categoryNameOf(body.name) : category.name;
    if (!name) return badRequest("Give the category a name.");

    const refused = unsafeText(name);
    if (refused) return refused;

    await db
      .update(circleCategories)
      .set({
        name,
        icon: "icon" in body ? categoryIconOf(body.icon, category.icon) : category.icon,
        status:
          "hidden" in body ? (body.hidden ? "hidden" : "active") : category.status,
      })
      .where(eq(circleCategories.id, categoryId));

    const categories = await circleCategoryList(circleId, user);
    return Response.json({
      categories,
      category: categories.find((row) => row.id === categoryId) ?? null,
    });
  }

  // One of the six is part of what the app is; a circle can switch it off, but
  // there is nothing to gain by tearing the category itself out.
  if (category.itemType !== null) {
    return badRequest(
      "A built-in category can be hidden but not removed. Hiding it leaves every post exactly where it is.",
    );
  }
  if (category.status !== "hidden") {
    return badRequest("Hide the category first, then remove it if you still want to.");
  }

  const url = new URL(req.url);
  const disposition = url.searchParams.get("posts");
  const held = await postsInCategory(categoryId);

  if (held.length > 0 && disposition !== "move" && disposition !== "release") {
    return Response.json(
      {
        error: "Decide what happens to the posts in this category first.",
        posts: held.length,
        authors: [...new Set(held.map((post) => post.memberId))].length,
      },
      { status: 409 },
    );
  }

  let moveTo: CategoryRow | null = null;
  if (disposition === "move") {
    const targetId = Number(url.searchParams.get("to"));
    const target = Number.isInteger(targetId) ? await categoryById(circleId, targetId) : null;
    const usable = target && target.id !== categoryId && target.itemType === null ? target : null;
    // A destination only has to be real when there is something of the category's
    // own to put in it. With no posts held, moving and removing are the same act,
    // and anything a member filed in here from another category goes home either
    // way, so an unusable target is not worth refusing over.
    if (!usable && held.length > 0) {
      return badRequest("Choose another of this circle's own categories to move the posts into.");
    }
    moveTo = usable;
  }

  const postIds = held.map((post) => post.id);
  const mine = await subcategoriesOf([categoryId]);

  if (moveTo) {
    // The node a post sat on belongs to the category being removed, so each one
    // lands on the node at the same **path** in the new category when there is
    // one, and unfiled when there is not. The whole path rather than the name,
    // because a name alone means nothing in a tree — Karnataka under Vegetarian
    // and Karnataka under Non-Vegetarian are two different places, and a partial
    // match would file a post somewhere its author never chose. Nothing invents
    // nodes in somebody else's list.
    const targetShelves = await subcategoriesOf([moveTo.id]);
    await Promise.all(
      mine.map(async (shelf) => {
        const wanted = pathOf(mine, shelf);
        const found = nodeAtPath(targetShelves, moveTo.id, wanted);
        const landing = found.matched === wanted.length ? found.node?.id ?? null : null;
        await db
          .update(itemCircles)
          .set({ subcategoryId: landing })
          .where(eq(itemCircles.subcategoryId, shelf.id));
      }),
    );
    await db.update(posts).set({ categoryId: moveTo.id }).where(eq(posts.categoryId, categoryId));
  } else if (postIds.length > 0) {
    // Letting them go: the posts survive, privately, for the members who wrote
    // them. A category disappearing must not hand anybody's writing to anyone.
    await db
      .delete(itemCircles)
      .where(and(eq(itemCircles.itemType, CUSTOM_ITEM_TYPE), inArray(itemCircles.itemId, postIds)));
    await db.update(posts).set({ visibility: "private" }).where(inArray(posts.id, postIds));
  }

  // A song somebody filed under Events is still a song, so it is never at risk
  // here: it follows the posts into the new category, or goes back to its own and
  // loses only the shelf, which belonged to the category going away. Only the
  // posts, whose category is the whole of where they live, needed deciding about.
  await releaseFiledItems(categoryId, moveTo ? moveTo.id : null);

  if (mine.length > 0) {
    await db.delete(subcategories).where(eq(subcategories.categoryId, categoryId));
  }

  // The questions this category asked go with it, and the answers with them. The
  // posts survive either way — moved into another category, or private to whoever
  // wrote them — so nothing anybody said is thrown away, only the form is.
  await clearCategoryFields([categoryId]);
  await db.delete(circleCategories).where(eq(circleCategories.id, categoryId));

  // The people who wrote in it hear what happened to their posts, from whom —
  // whoever actually pressed the button, which is no longer always the owner.
  const authors = [...new Set(held.map((post) => post.memberId))].filter((id) => id !== user.id);
  if (authors.length > 0) {
    const by = memberOf(user).name;
    const message = moveTo
      ? `${by} moved ${category.icon} ${category.name} into ${moveTo.icon} ${moveTo.name} in ${circle.name}`
      : `${by} removed ${category.icon} ${category.name} from ${circle.name}. Your posts there are now private to you.`;
    await db.insert(notifications).values(
      authors.map((memberId) => ({
        message,
        itemType: null,
        memberId,
        link: moveTo ? `#/circles/${circleId}` : "#/library",
      })),
    );
  }

  return Response.json({
    ok: true,
    moved: moveTo ? postIds.length : 0,
    released: moveTo ? 0 : postIds.length,
    categories: await circleCategoryList(circleId, user),
  });
};

export const config: Config = {
  path: "/api/circles/:circleId/categories/:categoryId",
  method: ["PATCH", "DELETE"],
};
