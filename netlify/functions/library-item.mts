// netlify/functions/library-item.mts
import type { Config, Context } from "@netlify/functions";
import { admittedUser } from "../lib/access.js";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { savedItems } from "../../db/schema.js";
import { badRequest, isItemType, unauthorized } from "../lib/items.js";

// Removing a library entry only affects the member who saved it — the shared
// item itself stays with whoever contributed it.
export default async (_req: Request, context: Context) => {
  const user = await admittedUser();
  if (!user) return unauthorized();

  const itemType = context.params.itemType;
  const itemId = Number(context.params.itemId);
  if (!isItemType(itemType) || !Number.isInteger(itemId)) {
    return badRequest("Invalid library item.");
  }

  await db
    .delete(savedItems)
    .where(
      and(
        eq(savedItems.memberId, user.id),
        eq(savedItems.itemType, itemType),
        eq(savedItems.itemId, itemId),
      ),
    );

  return Response.json({ ok: true });
};

export const config: Config = {
  path: "/api/library/:itemType/:itemId",
  method: ["DELETE"],
};
