// netlify/functions/block.mts
import type { Config, Context } from "@netlify/functions";
import { admittedAccess, notAdmitted } from "../lib/access.js";
import { badRequest, text } from "../lib/items.js";
import { unblockMember } from "../lib/moderation.js";

/** Unblocking, from the list on Profile. Everything they shared comes back. */
export default async (_req: Request, context: Context) => {
  const access = await admittedAccess();
  if (!access) return notAdmitted();

  const memberId = text(context.params.memberId);
  if (!memberId) return badRequest("Tell us which member to unblock.");

  await unblockMember(memberId, access.user);
  return Response.json({ ok: true });
};

export const config: Config = {
  path: "/api/blocks/:memberId",
  method: ["DELETE"],
};
