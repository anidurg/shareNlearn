// netlify/functions/circle-categories.mts
import type { Config, Context } from "@netlify/functions";
import { admittedAccess } from "../lib/access.js";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { circleCategories, circles, subcategories } from "../../db/schema.js";
import {
  applyOrder,
  builtInFor,
  categoriesOf,
  categoryIconOf,
  categoryNameOf,
  circleCategoryList,
  forMember,
  MAX_CATEGORIES_PER_CIRCLE,
  notTheManager,
} from "../lib/categories.js";
import { circleIdFrom, membershipOf } from "../lib/circles.js";
import { badRequest, jsonBody, notFound, text, unauthorized } from "../lib/items.js";
import { moderatorOf } from "../lib/moderation.js";
import { unsafeText } from "../lib/safety.js";

/**
 * The categories one circle is made of. Reading them is for anybody who can see
 * the circle; adding one, or putting them in a different order, belongs to
 * whoever looks after it — its owner or one of its admins.
 */
export default async (req: Request, context: Context) => {
  const id = circleIdFrom(context.params);
  if (id === null) return badRequest("Invalid circle id.");

  const access = await admittedAccess();
  const user = access?.user ?? null;
  const [circle] = await db.select().from(circles).where(eq(circles.id, id));
  if (!circle) return notFound("Circle");

  const membership = await membershipOf(id, user);
  const canManage = access ? (await moderatorOf(id, access)) !== null : false;
  if (circle.privacy === "private" && !membership) return notFound("Circle");
  // What a circle is for is the one thing a visitor is shown, and only for
  // Discover — the circle the app's link opens on. Its counts come back as
  // zeroes on their own, since a visitor can see none of the posts they count.
  if (!user && !circle.isDefault) return notFound("Circle");

  if (req.method === "GET") {
    const categories = await circleCategoryList(id, user);
    // A hidden category is still there for whoever looks after the circle to
    // bring back, and nobody else's business: to a member it is missing from the
    // circle rather than greyed out.
    return Response.json({ categories: canManage ? categories : forMember(categories) });
  }

  if (!user) return unauthorized();
  if (!canManage) return notTheManager();

  const body = await jsonBody(req);
  if (!body) return badRequest("Expected a JSON body.");

  if (req.method === "PATCH") {
    // Reordering: the ids somebody dragged into place, in their new order.
    const wanted = Array.isArray(body.order) ? body.order.map(Number) : [];
    const mine = await categoriesOf(id);
    const ids = wanted.filter((wantedId) => mine.some((category) => category.id === wantedId));
    if (ids.length === 0) return badRequest("Send the category ids in their new order.");
    await applyOrder(ids, "category");
    return Response.json({ categories: await circleCategoryList(id, user) });
  }

  const itemType = text(body.itemType);
  const builtIn = builtInFor(itemType);
  const name = categoryNameOf(body.name) || builtIn?.name || "";
  if (!name) return badRequest("Give the category a name.");

  const refused = unsafeText(name);
  if (refused) return refused;

  const existing = await categoriesOf(id);
  if (existing.length >= MAX_CATEGORIES_PER_CIRCLE) {
    return badRequest(`A circle can hold ${MAX_CATEGORIES_PER_CIRCLE} categories at most.`);
  }

  // Ticking a built-in the circle switched off before brings that same category
  // back, with the posts and shelves it already had — it was only ever hidden.
  if (builtIn) {
    const already = existing.find((category) => category.itemType === builtIn.itemType);
    if (already) {
      await db
        .update(circleCategories)
        .set({ status: "active", name, icon: categoryIconOf(body.icon, already.icon) })
        .where(eq(circleCategories.id, already.id));
      return Response.json({ categories: await circleCategoryList(id, user) });
    }
  }

  if (
    existing.some(
      (category) => category.itemType === null && category.name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    return badRequest(`This circle already has a category called "${name}".`);
  }

  const [created] = await db
    .insert(circleCategories)
    .values({
      circleId: id,
      itemType: builtIn ? builtIn.itemType : null,
      name,
      icon: categoryIconOf(body.icon, builtIn?.icon),
      sortOrder: existing.length,
    })
    .returning();

  // A built-in arrives with something to choose from; a category the owner
  // invented starts empty, because only they know what belongs in it.
  const seeds = builtIn?.seeds ?? [];
  if (seeds.length > 0) {
    await db
      .insert(subcategories)
      .values(
        seeds.map((seed, order) => ({
          categoryId: created.id,
          name: seed,
          sortOrder: order,
          createdById: null,
        })),
      )
      .onConflictDoNothing();
  }

  const categories = await circleCategoryList(id, user);
  return Response.json(
    {
      categories,
      category: categories.find((category) => category.id === created.id) ?? null,
    },
    { status: 201 },
  );
};

export const config: Config = {
  path: "/api/circles/:circleId/categories",
  method: ["GET", "POST", "PATCH"],
};
