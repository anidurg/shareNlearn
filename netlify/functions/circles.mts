// netlify/functions/circles.mts
import type { Config } from "@netlify/functions";
import { admittedAccess, forbidden } from "../lib/access.js";
import { and, desc, eq, notInArray, or } from "drizzle-orm";
import { db } from "../../db/index.js";
import { circleInvites, circles } from "../../db/schema.js";
import {
  allBuiltIns,
  categoriesFrom,
  circleCategoryList,
  seedCategories,
} from "../lib/categories.js";
import {
  branchRefusal,
  circleById,
  circleResponse,
  iconOf,
  inviteMembers,
  joinCircle,
  MAX_CIRCLES_OWNED,
  memberCounts,
  memberOf,
  myCircleRows,
  memberTaxonomyFrom,
  parentCircleIdFrom,
  parentsOf,
  privacyOf,
  type Circle,
} from "../lib/circles.js";
import { moderatorOf } from "../lib/moderation.js";
import { badRequest, jsonBody, optionalText, text, unauthorized } from "../lib/items.js";
import { defaultCircle, upgradeDefaultName } from "../lib/community.js";
import { unsafeText } from "../lib/safety.js";

/** The one circle a visitor may look at, in the shape `myCircleRows` answers in. */
function visitorRows(circle: Circle | null) {
  return circle ? [{ circle, role: null }] : [];
}

/**
 * Everything the Circles tab needs in one call: the circles you are in, the ones
 * you could join, invitations waiting for you, and — if you own a circle — the
 * people asking to be let in.
 *
 * A visitor with no account is answered too, with exactly one circle: Discover.
 * They are not in it and the response says so — the role is null — but it is the
 * circle the app's link opens on, and handing it back here is what gives the
 * shell a circle in view to build a page from. Everything else is empty, because
 * a circle they would have to be let into is not something to offer somebody who
 * cannot yet be let in.
 */
export default async (req: Request) => {
  const access = await admittedAccess();
  const user = access?.user ?? null;

  if (req.method === "GET") {
    const mine: { circle: Circle; role: string | null }[] = user
      ? await myCircleRows(user)
      : visitorRows(await defaultCircle());
    const mineIds = mine.map((row) => row.circle.id);

    // A private circle is invisible until you are invited; the other two are
    // listed so somebody can find them. A visitor is offered none of them: joining
    // is a thing members do.
    const open = user
      ? await db
          .select()
          .from(circles)
          .where(
            and(
              or(eq(circles.privacy, "public"), eq(circles.privacy, "discoverable")),
              mineIds.length > 0 ? notInArray(circles.id, mineIds) : undefined,
            ),
          )
          .orderBy(desc(circles.createdAt))
      : [];

    // The default circle's name is in its row rather than in the code, so a
    // rename reaches it here: this is the read every session makes on startup,
    // and it does nothing at all once the row already agrees.
    await upgradeDefaultName([...mine.map((row) => row.circle), ...open]);

    const invitedRows = user
      ? await db
          .select({ invite: circleInvites, circle: circles })
          .from(circleInvites)
          .innerJoin(circles, eq(circles.id, circleInvites.circleId))
          .where(
            and(
              eq(circleInvites.memberId, user.id),
              eq(circleInvites.kind, "invite"),
              eq(circleInvites.status, "pending"),
            ),
          )
          .orderBy(desc(circleInvites.createdAt))
      : [];

    // Requests to look at are the ones for circles the caller owns.
    const requestRows = user
      ? await db
          .select({ request: circleInvites, circle: circles })
          .from(circleInvites)
          .innerJoin(circles, eq(circles.id, circleInvites.circleId))
          .where(
            and(
              eq(circles.ownerId, user.id),
              eq(circleInvites.kind, "request"),
              eq(circleInvites.status, "pending"),
            ),
          )
          .orderBy(desc(circleInvites.createdAt))
      : [];

    const myRequests = user
      ? await db
          .select({ circleId: circleInvites.circleId })
          .from(circleInvites)
          .where(
            and(
              eq(circleInvites.memberId, user.id),
              eq(circleInvites.kind, "request"),
              eq(circleInvites.status, "pending"),
            ),
          )
      : [];
    const asked = new Set(myRequests.map((row) => row.circleId));
    const invitedTo = new Set(invitedRows.map((row) => row.circle.id));

    // A branch says what it is a branch of, and that has to travel with it: a
    // member can be in Austin and not in SVKV, so the name is not always in a
    // list the browser already has. One read for all four collections.
    const parents = await parentsOf([
      ...mine.map((row) => row.circle),
      ...open,
      ...invitedRows.map((row) => row.circle),
    ]);
    const parentOf = (circle: Circle) =>
      circle.parentCircleId ? (parents.get(circle.parentCircleId) ?? null) : null;

    const counts = user
      ? await memberCounts([
          ...mineIds,
          ...open.map((circle) => circle.id),
          ...invitedRows.map((row) => row.circle.id),
        ])
      : // A head count is a fact about members, so a visitor is told nothing —
        // Discover reaches them as a name, an icon and what it holds.
        new Map<number, number>();

    return Response.json({
      circles: mine.map((row) =>
        circleResponse(row.circle, {
          role: row.role,
          memberCount: counts.get(row.circle.id) ?? 0,
          parent: parentOf(row.circle),
        }),
      ),
      discover: open.map((circle) =>
        circleResponse(circle, {
          memberCount: counts.get(circle.id) ?? 0,
          standing: invitedTo.has(circle.id) ? "invited" : asked.has(circle.id) ? "requested" : null,
          parent: parentOf(circle),
        }),
      ),
      invitations: invitedRows.map((row) => ({
        circle: circleResponse(row.circle, {
          memberCount: counts.get(row.circle.id) ?? 0,
          standing: "invited",
          parent: parentOf(row.circle),
        }),
        invitedByName: row.invite.invitedByName,
        createdAt: row.invite.createdAt,
      })),
      requests: requestRows.map((row) => ({
        circleId: row.request.circleId,
        circleName: row.circle.name,
        circleIcon: row.circle.icon,
        memberId: row.request.memberId,
        memberName: row.request.memberName,
        createdAt: row.request.createdAt,
      })),
    });
  }

  if (!user || !access) return unauthorized();

  // Starting a circle is the one thing a brand new account cannot do. A circle is
  // an audience — somewhere other members' shares land — so it waits until
  // somebody has let the account into a circle of their own, or, failing that,
  // until it has been here some days. The refusal names whichever of the two is
  // actually outstanding, so nobody is sent off to do something that would not
  // help.
  if (!access.canCreateCircle) {
    return forbidden(
      access.circleCount === 0
        ? "Join a circle first — being in one is what starting your own is built on."
        : access.trustedInDays > 0
          ? `Join a circle and you can start your own straight away — Discover, which everybody is in, does not count. Otherwise your account can start one in ${access.trustedInDays} ${access.trustedInDays === 1 ? "day" : "days"}, and an admin can vouch for it sooner.`
          : "Starting a circle is for established members. Ask an admin to vouch for your account, or ask a member to start one and make you an admin.",
    );
  }

  const body = await jsonBody(req);
  if (!body) return badRequest("Expected a JSON body.");

  const name = text(body.name);
  if (!name) return badRequest("Give the circle a name.");

  // A circle's name and description are read by everybody it is offered to, so
  // they go through the same check a share does.
  const refused = unsafeText(name, optionalText(body.description));
  if (refused) return refused;

  // Two members may each run a "Book Club"; the same member owning two is just
  // confusing, so that one is turned away.
  const owned = await db
    .select({ id: circles.id, name: circles.name })
    .from(circles)
    .where(eq(circles.ownerId, user.id));
  if (owned.length >= MAX_CIRCLES_OWNED) {
    return badRequest(`You already own ${MAX_CIRCLES_OWNED} circles, which is as many as we allow.`);
  }
  if (owned.some((circle) => circle.name.toLowerCase() === name.toLowerCase())) {
    return badRequest(`You already have a circle called "${name}".`);
  }

  // "Branch of", when the form asked it. The circle does not exist yet, so the
  // only structural questions are about the parent; the permission question is
  // the same one every circle mutation asks, and it is asked of the *parent* —
  // an organisation's own people decide what hangs under its name, which is what
  // stops anybody attaching their circle to somebody else's.
  const parentCircleId = parentCircleIdFrom(body) ?? null;
  if (parentCircleId !== null) {
    const refusedParent = await branchRefusal(parentCircleId, null);
    if (refusedParent) return refusedParent;
    if (!(await moderatorOf(parentCircleId, access))) {
      return forbidden(
        "Only that circle's owner or one of its admins can add a branch to it. Start the circle on its own and ask them to attach it.",
      );
    }
  }

  const owner = memberOf(user);
  const [circle] = await db
    .insert(circles)
    .values({
      ownerId: owner.id,
      ownerName: owner.name,
      name,
      description: optionalText(body.description),
      icon: iconOf(body.icon),
      coverKey: optionalText(body.coverKey),
      privacy: privacyOf(body.privacy),
      // The one piece of taxonomy configuration, and left on unless the form said
      // otherwise: inventing a shelf mid-post is how filing has always worked
      // here, so switching it off is the decision rather than switching it on.
      memberTaxonomy: memberTaxonomyFrom(body) ?? true,
      // Organisational only: a branch inherits nothing — not members, not
      // admins, not categories, not a single share — and is a full circle in
      // every other respect. All this changes is where it is drawn.
      parentCircleId,
    })
    .returning();

  await joinCircle(circle.id, owner, "owner");

  // What the circle is for, in the form of what can be shared into it. A form
  // that ticked nothing at all gets the usual six, so a circle made from the API
  // behaves the way every circle did before categories existed.
  await seedCategories(circle.id, categoriesFrom(body) ?? allBuiltIns());

  const invited = Array.isArray(body.inviteMemberIds)
    ? await inviteMembers(circle, owner, body.inviteMemberIds.map(String))
    : [];

  return Response.json(
    {
      circle: circleResponse(circle, {
        role: "owner",
        memberCount: 1,
        parent: parentCircleId ? await circleById(parentCircleId) : null,
      }),
      categories: await circleCategoryList(circle.id, user, { counts: false }),
      invited: invited.length,
    },
    { status: 201 },
  );
};

export const config: Config = {
  path: "/api/circles",
  method: ["GET", "POST"],
};
