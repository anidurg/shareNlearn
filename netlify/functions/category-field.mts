// netlify/functions/category-field.mts
import type { Config, Context } from "@netlify/functions";
import { admittedAccess } from "../lib/access.js";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { categoryFields, circles } from "../../db/schema.js";
import { categoryById, circleCategoryList, notTheManager } from "../lib/categories.js";
import { circleIdFrom } from "../lib/circles.js";
import {
  audioWaysFrom,
  clearFieldValues,
  fieldById,
  fieldKindOf,
  fieldLabelOf,
  fileTypesFrom,
  MAX_FIELD_HINT,
  maxBytesFrom,
  optionsFrom,
  takesOptions,
  uploadKindFrom,
} from "../lib/fields.js";
import { badRequest, jsonBody, notFound, optionalText, unauthorized } from "../lib/items.js";
import { moderatorOf } from "../lib/moderation.js";
import { unsafeText } from "../lib/safety.js";

function idFromParams(params: Record<string, string | undefined>, key: string) {
  const id = Number(params[key]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * One of a category's questions: renaming it, changing what it asks for, or
 * switching it off — and removing it, which is the only one of the four that
 * throws anything away.
 *
 * Hiding is the ordinary move and it is reversible: the form stops asking, and
 * every answer already given is kept for the day somebody switches it back on.
 * Removing takes the answers with it, so it says how many there were.
 */
export default async (req: Request, context: Context) => {
  const circleId = circleIdFrom(context.params);
  const categoryId = idFromParams(context.params, "categoryId");
  const fieldId = idFromParams(context.params, "fieldId");
  if (circleId === null || categoryId === null || fieldId === null) {
    return badRequest("Invalid field.");
  }

  const access = await admittedAccess();
  if (!access) return unauthorized();
  const user = access.user;

  const [circle] = await db.select().from(circles).where(eq(circles.id, circleId));
  if (!circle) return notFound("Circle");
  // Reshaping a form everybody else fills in belongs to whoever looks after the
  // circle, exactly as renaming a subcategory does: a plain member who wants one
  // more question can still add one, and nothing more.
  if (!(await moderatorOf(circleId, access))) return notTheManager();

  const category = await categoryById(circleId, categoryId);
  if (!category) return notFound("Category");

  const field = await fieldById(categoryId, fieldId);
  if (!field) return notFound("Field");

  if (req.method === "PATCH") {
    const body = await jsonBody(req);
    if (!body) return badRequest("Expected a JSON body.");

    const label = "label" in body ? fieldLabelOf(body.label) : field.label;
    if (!label) return badRequest("Give the field a label.");

    const kind = "kind" in body ? fieldKindOf(body.kind, fieldKindOf(field.kind)) : fieldKindOf(field.kind);
    // The choices belong to the two kinds that ask them — a dropdown of one, tick
    // boxes over any number — so a question changed to a line of text drops the
    // list rather than keeping one that means nothing.
    const options = !takesOptions(kind)
      ? null
      : "options" in body
        ? optionsFrom(body.options).join("\n") || null
        : field.options;
    if (takesOptions(kind) && !options) {
      return badRequest(
        kind === "select"
          ? "A dropdown needs something to choose from."
          : "Tick boxes need something to tick.",
      );
    }

    const hint =
      "hint" in body ? (optionalText(body.hint)?.slice(0, MAX_FIELD_HINT) ?? null) : field.hint;

    // The upload rules, read the same three-state way everything else here is:
    // absent leaves the answer alone, and a kind that is no longer an upload drops
    // them, since they would mean nothing on a line of text. What an upload takes
    // splits them in two — a document is asked which formats and how big, audio is
    // asked how it may be answered — and the half that does not apply is dropped
    // the same way, so switching a field from one to the other cannot leave a
    // document's ceiling sitting on a recording.
    const upload = kind === "file";
    const uploadKind = !upload
      ? null
      : "uploadKind" in body
        ? uploadKindFrom(body.uploadKind)
        : uploadKindFrom(field.uploadKind);
    const document = uploadKind === "document";
    const fileTypes = !document
      ? null
      : "fileTypes" in body
        ? fileTypesFrom(body.fileTypes).join("\n") || null
        : field.fileTypes;
    const maxBytes = !document
      ? null
      : "maxBytes" in body
        ? maxBytesFrom(body.maxBytes)
        : maxBytesFrom(field.maxBytes);
    const multiple = !document ? false : "multiple" in body ? body.multiple === true : field.multiple;
    const audioWays =
      uploadKind !== "audio"
        ? null
        : "audioWays" in body
          ? audioWaysFrom(body.audioWays).join("\n") || null
          : field.audioWays;

    const refused = unsafeText(label, hint ?? "", options ?? "");
    if (refused) return refused;

    await db
      .update(categoryFields)
      .set({
        label,
        kind,
        options,
        hint,
        required: "required" in body ? body.required === true : field.required,
        uploadKind,
        fileTypes,
        maxBytes,
        multiple,
        audioWays,
        status: "hidden" in body ? (body.hidden ? "hidden" : "active") : field.status,
      })
      .where(eq(categoryFields.id, fieldId));

    return Response.json({ categories: await circleCategoryList(circleId, user) });
  }

  // Deleting it. The answers go too — they are answers to this question and mean
  // nothing without it — and no post is touched beyond losing that one line.
  await clearFieldValues(fieldId);
  await db.delete(categoryFields).where(eq(categoryFields.id, fieldId));

  return Response.json({ categories: await circleCategoryList(circleId, user) });
};

export const config: Config = {
  path: "/api/circles/:circleId/categories/:categoryId/fields/:fieldId",
  method: ["PATCH", "DELETE"],
};
