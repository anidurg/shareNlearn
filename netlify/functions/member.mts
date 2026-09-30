// netlify/functions/member.mts
import type { Config, Context } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { members, notifications } from "../../db/schema.js";
import { admittedAccess, forbidden } from "../lib/access.js";
import { badRequest, jsonBody, notFound, text, unauthorized } from "../lib/items.js";

/**
 * The global admin's few levers, and nothing else. They exist for the cases a
 * circle cannot settle on its own — abuse, and somebody needing help getting in —
 * so the list is deliberately short: trust an account to start circles, suspend
 * one, make somebody an App Manager, and hand the global role to somebody else.
 *
 * Everything about what a circle contains is moderated inside that circle by its
 * own admins, and none of it is reachable from here.
 */
export default async (req: Request, context: Context) => {
  const access = await admittedAccess();
  if (!access) return unauthorized();
  if (!access.isAppAdmin) {
    return forbidden("That is for the app admin, who looks after abuse and support only.");
  }

  const targetId = text(context.params.memberId);
  if (!targetId) return badRequest("Say which member.");

  const [member] = await db.select().from(members).where(eq(members.id, targetId));
  if (!member) return notFound("Member");

  const body = await jsonBody(req);
  if (!body) return badRequest("Expected a JSON body.");

  const changes: Partial<typeof members.$inferInsert> = {};
  const said: string[] = [];

  if ("trusted" in body) {
    const trusted = body.trusted !== false;
    changes.trustedAt = trusted ? (member.trustedAt ?? new Date()) : null;
    said.push(trusted ? "trusted" : "untrusted");
  }

  if ("status" in body) {
    const status = text(body.status) === "suspended" ? "suspended" : "active";
    if (status === "suspended" && member.id === access.user.id) {
      return badRequest("Suspending your own account would leave nobody to undo it.");
    }
    changes.status = status;
    said.push(status);
  }

  if ("role" in body) {
    const asked = text(body.role);
    const role = asked === "app_admin" ? "app_admin" : asked === "app_manager" ? "app_manager" : "member";
    // The admin's own row is the one that cannot lose the role, so the group is
    // never left without one. Standing down to App Manager is giving it up just
    // as plainly as standing down to a member, so both are refused.
    if (role !== "app_admin" && member.id === access.user.id) {
      return badRequest("Hand the admin role to somebody else before giving up your own.");
    }
    changes.role = role;
    // A global admin is trusted by definition; nothing else would make sense. An
    // App Manager is deliberately not, reading the usage report saying nothing
    // about whether the account should be starting circles.
    if (role === "app_admin") changes.trustedAt = member.trustedAt ?? new Date();
    said.push(
      role === "app_admin"
        ? "app admin"
        : role === "app_manager"
          ? "an app manager, who can read what the app costs to run"
          : member.role === "app_manager"
            ? "no longer an app manager"
            : "no longer an app admin",
    );
  }

  if (said.length === 0) return badRequest("Nothing to change.");

  const [updated] = await db
    .update(members)
    .set(changes)
    .where(eq(members.id, targetId))
    .returning();

  // Nothing is done to an account behind its back.
  await db.insert(notifications).values({
    message:
      changes.status === "suspended"
        ? "Your account has been suspended. Get in touch with the group's admin if you think that is a mistake."
        : `An admin updated your account: ${said.join(", ")}.`,
    itemType: null,
    memberId: targetId,
    link: "#/profile",
  });

  return Response.json({
    member: {
      id: updated.id,
      name: updated.name,
      role: updated.role,
      status: updated.status,
      trustedAt: updated.trustedAt,
      admittedAt: updated.admittedAt,
    },
  });
};

export const config: Config = {
  path: "/api/members/:memberId",
  method: ["PATCH"],
};
