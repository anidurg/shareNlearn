// netlify/functions/subcategories.mts
import type { Config, Context } from "@netlify/functions";
import { admittedAccess } from "../lib/access.js";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { circles } from "../../db/schema.js";
import {
  addSubcategory,
  applyOrder,
  categoryById,
  circleCategoryList,
  forMember,
  nodeById,
  pathOf,
  siblingsOf,
  similarSubcategory,
  subcategoriesOf,
  subcategoryNameOf,
} from "../lib/categories.js";
import { circleIdFrom, membershipOf } from "../lib/circles.js";
import { badRequest, jsonBody, notFound, unauthorized } from "../lib/items.js";
import { moderatorOf, notACircleManager } from "../lib/moderation.js";
import { unsafeText } from "../lib/safety.js";

function categoryIdFromParams(params: Record<string, string | undefined>) {
  const id = Number(params.categoryId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * The taxonomy under one category, which is a tree: a node names its parent, and
 * `parentId` on the way in is which node the new one goes beneath — null for a
 * child of the category itself.
 *
 * Adding one is any member's when the circle allows it, because the share form is
 * where most nodes get invented — "+ Add new subcategory" is part of posting, not
 * an errand for whoever runs the circle. A circle that would rather keep its tree
 * to itself switches `memberTaxonomy` off, and then this route refuses everybody
 * but the people who look after the circle. Reordering is always theirs, because
 * it is the shape of the list rather than one more thing on it, and it works on
 * one set of siblings at a time — the order of a branch means nothing next to the
 * order of another.
 *
 * A new name is checked against its **siblings** rather than the whole tree:
 * "Sweets" typed twice under one parent is one shelf, while Karnataka under
 * Vegetarian and Karnataka under Non-Vegetarian are two different places and both
 * are allowed. A name that merely looks close is offered back so the member can
 * pick the existing node or insist on their own.
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

  const membership = await membershipOf(circleId, user);
  if (!membership) {
    return Response.json(
      { error: "Join the circle to add to its categories." },
      { status: 403 },
    );
  }

  const category = await categoryById(circleId, categoryId);
  if (!category) return notFound("Category");

  const body = await jsonBody(req);
  if (!body) return badRequest("Expected a JSON body.");

  const canManage = (await moderatorOf(circleId, access)) !== null;
  const shaped = async () => {
    const list = await circleCategoryList(circleId, user);
    return canManage ? list : forMember(list);
  };

  const existing = await subcategoriesOf([categoryId]);

  if (req.method === "PATCH") {
    if (!canManage) return notACircleManager("reorder its subcategories");
    const wanted = Array.isArray(body.order) ? body.order.map(Number) : [];
    const sent = wanted
      .map((id) => nodeById(existing, id))
      .filter((node): node is NonNullable<typeof node> => node !== null);
    if (sent.length === 0) return badRequest("Send the subcategory ids in their new order.");

    // One branch at a time: whatever parent the first node sits under is the row
    // being reordered, and anything from elsewhere in the tree is left out rather
    // than interleaved into it.
    const parentId = sent[0].parentId ?? null;
    const ids = sent.filter((node) => (node.parentId ?? null) === parentId).map((node) => node.id);
    await applyOrder(ids, "subcategory");
    return Response.json({ categories: await shaped() });
  }

  // Adding to the tree is the circle's own decision. Its owner and admins always
  // may; everybody else may only while the circle leaves it open.
  if (!canManage && !circle.memberTaxonomy) {
    return Response.json(
      { error: "This circle keeps its categories to its owner and admins." },
      { status: 403 },
    );
  }

  const name = subcategoryNameOf(body.name);
  if (!name) return badRequest("Give the subcategory a name.");

  // A member may make a node mid-post, so this is one of the few names somebody
  // who does not run the circle can put in front of everybody else.
  const refused = unsafeText(name);
  if (refused) return refused;

  // Which node the new one goes under. A parent from another category is a
  // request that cannot mean anything, so it is refused rather than flattened.
  const asked = Number(body.parentId);
  const parentId = Number.isInteger(asked) && asked > 0 ? asked : null;
  const parent = parentId === null ? null : nodeById(existing, parentId);
  if (parentId !== null && !parent) return notFound("Parent category");

  const similar = similarSubcategory(name, siblingsOf(existing, categoryId, parentId));

  // Unless the member has already been shown the near-match and said "anyway",
  // hand it back rather than quietly making a second shelf for the same thing.
  if (similar && !body.confirm) {
    return Response.json({
      similar: { id: similar.id, name: similar.name, path: pathOf(existing, similar) },
      created: null,
      categories: await shaped(),
    });
  }

  const shelf = await addSubcategory(categoryId, name, user.id, parentId);
  if (!shelf) return badRequest("That subcategory could not be added here.");

  const after = await subcategoriesOf([categoryId]);
  return Response.json(
    {
      created: {
        id: shelf.id,
        name: shelf.name,
        parentId: shelf.parentId,
        path: pathOf(after, shelf),
      },
      similar: null,
      categories: await shaped(),
    },
    { status: 201 },
  );
};

export const config: Config = {
  path: "/api/circles/:circleId/categories/:categoryId/subcategories",
  method: ["POST", "PATCH"],
};
