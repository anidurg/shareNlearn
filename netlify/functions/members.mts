// netlify/functions/members.mts
import type { Config } from "@netlify/functions";
import { getUser } from "@netlify/identity";
import { admittedAccess, notAdmitted } from "../lib/access.js";
import { directory, registerMember } from "../lib/members.js";
import { unauthorized } from "../lib/items.js";

/**
 * The contacts an owner picks from when inviting people into a circle. `POST` is
 * how a member keeps their own entry current — the app calls it once on load —
 * and `GET` returns names and ids only, never email addresses.
 *
 * The two halves are gated differently on purpose. Anyone logged in may write
 * their own row, because an account has to exist in the directory before an
 * invite can be accepted for it; reading the directory is a look at the group's
 * membership, so that waits until somebody has been let in.
 */
export default async (req: Request) => {
  if (req.method === "POST") {
    const user = await getUser();
    if (!user) return unauthorized();
    await registerMember(user);
    return Response.json({ ok: true });
  }

  const access = await admittedAccess();
  if (!access) return notAdmitted();

  const contacts = await directory();
  return Response.json({
    members: contacts.filter((contact) => contact.id !== access.user.id),
  });
};

export const config: Config = {
  path: "/api/members",
  method: ["GET", "POST"],
};
