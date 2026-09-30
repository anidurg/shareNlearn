// netlify/functions/category-fields.mts
import type { Config, Context } from "@netlify/functions";
import { admittedAccess } from "../lib/access.js";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { circles } from "../../db/schema.js";
import { categoryById, circleCategoryList } from "../lib/categories.js";
import { circleIdFrom, membershipOf } from "../lib/circles.js";
import {
  addField,
  applyFieldOrder,
  categoryTakesFields,
  fieldResponse,
  fieldsOf,
} from "../lib/fields.js";
import { badRequest, jsonBody, notFound, unauthorized } from "../lib/items.js";
import { moderatorOf } from "../lib/moderation.js";
import { unsafeText } from "../lib/safety.js";

function categoryIdFromParams(params: Record<string, string | undefined>) {
  const id = Number(params.categoryId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * The extra questions one category asks. Adding one changes the form everybody
 * else in the circle fills in — and, once it is marked needed, what they have to
 * answer — so it belongs to the people who answer for the circle: its owner, the
 * admins they chose, and the app admin stepping in. A plain member who notices
 * the form should have asked something asks one of them for it. Renaming,
 * reordering, switching one off and removing it are the same set of people, for
 * the same reason: reshaping answers already given is running the circle.
 *
 * Which categories can be asked about is `categoryTakesFields()`: every category a
 * circle invented, and Songs, Books and Recipes, because what a circle wants
 * recorded about a recording — the deity, the tala, who taught it — about a book,
 * or about a dish — who can eat it, and what kind of dish it is — differs from
 * circle to circle in a way one hand-built form cannot cover. One circle's Recipes
 * offers Non-vegetarian and the next one does not, and that is the circle's answer
 * rather than the app's. The other three built-ins have hand-built forms that are
 * the same everywhere: a fact is its own sentence and a word is a dictionary entry.
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

  // Who answers for this circle: its owner, an admin they made, or the app admin
  // standing in. Membership alone is not enough for either verb here.
  const moderating = await moderatorOf(circleId, access);
  if (!moderating && !(await membershipOf(circleId, user))) {
    return Response.json({ error: "Join the circle to see its categories." }, { status: 403 });
  }
  if (!moderating) {
    return Response.json(
      {
        error:
          "Only the circle's owner or one of its admins can change what this category's form asks.",
      },
      { status: 403 },
    );
  }

  const category = await categoryById(circleId, categoryId);
  if (!category) return notFound("Category");
  if (!categoryTakesFields(category.itemType)) {
    return badRequest(
      `${category.name} is one of the built-in categories, and its form is the same in every circle.`,
    );
  }

  const body = await jsonBody(req);
  if (!body) return badRequest("Expected a JSON body.");

  // Everybody who reaches this line looks after the circle, so they see its
  // switched-off categories too — the same list `GET /api/circles/:id` gives them.
  const shaped = async () => circleCategoryList(circleId, user);

  if (req.method === "PATCH") {
    const wanted = Array.isArray(body.order) ? body.order.map(Number) : [];
    const mine = await fieldsOf([categoryId]);
    const ids = wanted.filter((id) => mine.some((field) => field.id === id));
    if (ids.length === 0) return badRequest("Send the field ids in their new order.");
    await applyFieldOrder(ids);
    return Response.json({ categories: await shaped() });
  }

  // The label and the dropdown's choices are words everybody in the circle will
  // read, so they go through the same filter every other member-written word does.
  const refused = unsafeText(
    String(body.label ?? ""),
    String(body.hint ?? ""),
    Array.isArray(body.options) ? body.options.join(" ") : String(body.options ?? ""),
  );
  if (refused) return refused;

  const outcome = await addField(
    categoryId,
    {
      label: String(body.label ?? ""),
      kind: body.kind,
      options: body.options,
      hint: body.hint,
      required: body.required,
      // An upload field's own rules; ignored on every other kind, and each half
      // of them ignored on the other sort of upload.
      uploadKind: body.uploadKind,
      fileTypes: body.fileTypes,
      maxBytes: body.maxBytes,
      multiple: body.multiple,
      audioWays: body.audioWays,
    },
    user.id,
  );

  if (outcome.full) {
    return badRequest("This category is asking as many questions as we allow.");
  }
  const field = outcome.field ?? outcome.existing;
  if (!field) return badRequest("Give the field a label.");

  return Response.json(
    {
      // `created` is null when the label was already there: the member gets the
      // field that exists rather than a second one asking the same thing.
      created: outcome.field ? fieldResponse(outcome.field) : null,
      field: fieldResponse(field),
      categories: await shaped(),
    },
    { status: outcome.field ? 201 : 200 },
  );
};

export const config: Config = {
  path: "/api/circles/:circleId/categories/:categoryId/fields",
  method: ["POST", "PATCH"],
};
