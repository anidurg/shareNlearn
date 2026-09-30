// netlify/functions/circle.mts
import type { Config, Context } from "@netlify/functions";
import { admittedAccess } from "../lib/access.js";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { circleInvites, circleMembers, circles, notifications } from "../../db/schema.js";
import { circleCategoryList, forMember } from "../lib/categories.js";
import {
  branchRefusal,
  circleById,
  circleIdFrom,
  circleResponse,
  coverStore,
  deleteCircle,
  iconOf,
  memberCounts,
  memberOf,
  membershipOf,
  memberTaxonomyFrom,
  parentCircleIdFrom,
  privacyOf,
} from "../lib/circles.js";
import { badRequest, jsonBody, notFound, optionalText, text, unauthorized } from "../lib/items.js";
import { moderatorOf, notACircleManager, reportsForCircle } from "../lib/moderation.js";
import { unsafeText } from "../lib/safety.js";

export default async (req: Request, context: Context) => {
  const id = circleIdFrom(context.params);
  if (id === null) return badRequest("Invalid circle id.");

  const access = await admittedAccess();
  const user = access?.user ?? null;
  const [circle] = await db.select().from(circles).where(eq(circles.id, id));
  if (!circle) return notFound("Circle");

  const membership = await membershipOf(id, user);
  // Whoever looks after this circle: its owner, an admin they made, or the app
  // admin stepping in. An admin of a circle manages the circle, so this one
  // answer gates the waiting room, the reports and every change to the circle
  // itself — there is no second, narrower question about ownership to ask.
  const moderating = access ? await moderatorOf(id, access) : null;
  const canManage = moderating !== null;

  /**
   * The organisation a branch hangs under, when it has one. It travels with the
   * circle rather than being looked up in the browser's circle list, because a
   * member can be in Austin without being in SVKV and the page still has to say
   * "Branch of SVKV".
   */
  async function parentOf(row: { parentCircleId: number | null }) {
    return row.parentCircleId ? await circleById(row.parentCircleId) : null;
  }

  if (req.method === "GET") {
    /**
     * A visitor is answered with the shop window and nothing behind it. Discover
     * is the one circle the app's link opens on, so its name, icon and the
     * categories it holds travel — that is what draws the grid somebody landing
     * on the page is there to see. The roll does not, and neither does any other
     * circle: who is in a room is the members' business, and a circle they would
     * have to be let into is not something to describe to somebody who cannot yet
     * be let in.
     */
    if (!user) {
      if (!circle.isDefault) return notFound("Circle");
      const categories = await circleCategoryList(id, null);
      return Response.json({
        circle: circleResponse(circle, { role: null, parent: await parentOf(circle) }),
        categories: forMember(categories),
        members: [],
        moderating: null,
        reports: [],
        invitations: [],
        requests: [],
      });
    }

    // A private circle is nobody's business until they are in it or invited to it.
    const invitation = user
      ? await db
          .select({ id: circleInvites.id })
          .from(circleInvites)
          .where(
            and(
              eq(circleInvites.circleId, id),
              eq(circleInvites.memberId, user.id),
              eq(circleInvites.status, "pending"),
            ),
          )
      : [];
    if (circle.privacy === "private" && !membership && invitation.length === 0) {
      return notFound("Circle");
    }

    const people = await db
      .select({
        memberId: circleMembers.memberId,
        memberName: circleMembers.memberName,
        role: circleMembers.role,
        createdAt: circleMembers.createdAt,
      })
      .from(circleMembers)
      .where(eq(circleMembers.circleId, id))
      .orderBy(desc(circleMembers.role), asc(circleMembers.memberName));

    // The waiting room is for whoever looks after the circle, not the whole circle.
    const waiting = moderating
      ? await db
          .select()
          .from(circleInvites)
          .where(and(eq(circleInvites.circleId, id), eq(circleInvites.status, "pending")))
          .orderBy(desc(circleInvites.createdAt))
      : [];

    const categories = await circleCategoryList(id, user);
    // Reports about this circle, for the people who can act on them.
    const reports = moderating ? await reportsForCircle(id) : [];

    return Response.json({
      circle: circleResponse(circle, {
        role: membership?.role ?? null,
        memberCount: people.length,
        parent: await parentOf(circle),
      }),
      categories: canManage ? categories : forMember(categories),
      members: people,
      moderating,
      reports,
      invitations: waiting
        .filter((row) => row.kind === "invite")
        .map((row) => ({
          memberId: row.memberId,
          memberName: row.memberName,
          createdAt: row.createdAt,
        })),
      requests: waiting
        .filter((row) => row.kind === "request")
        .map((row) => ({
          memberId: row.memberId,
          memberName: row.memberName,
          createdAt: row.createdAt,
        })),
    });
  }

  if (!user) return unauthorized();

  if (req.method === "PATCH") {
    if (!canManage) return notACircleManager("change it");
    const body = await jsonBody(req);
    if (!body) return badRequest("Expected a JSON body.");

    const name = text(body.name ?? circle.name);
    if (!name) return badRequest("Give the circle a name.");

    const description =
      "description" in body ? optionalText(body.description) : circle.description;
    const refused = unsafeText(name, description);
    if (refused) return refused;

    const previousCover = circle.coverKey;
    const coverKey = "coverKey" in body ? optionalText(body.coverKey) : previousCover;

    /**
     * "Branch of". Three states, the same way filing and photos read: a circle
     * id attaches this one under it, an explicit null detaches it and leaves it
     * independent, and a form that never asked leaves it exactly as it was.
     *
     * Attaching is asked of *both* circles: `canManage` above says the caller
     * looks after this one, and `moderatorOf()` below says they look after the
     * organisation it is going under — otherwise anybody could hang their circle
     * off somebody else's name. Detaching needs only the first, since taking
     * your own circle back out from under an organisation harms nothing.
     */
    const askedParent = parentCircleIdFrom(body);
    const parentCircleId = askedParent === undefined ? circle.parentCircleId : askedParent;
    if (askedParent !== undefined && askedParent !== circle.parentCircleId && askedParent !== null) {
      const refusedParent = await branchRefusal(askedParent, circle);
      if (refusedParent) return refusedParent;
      if (!(await moderatorOf(askedParent, access!))) {
        return Response.json(
          {
            error:
              "Only that circle's owner or one of its admins can add a branch to it. Ask them to attach this one.",
          },
          { status: 403 },
        );
      }
    }

    const [updated] = await db
      .update(circles)
      .set({
        name,
        description,
        icon: "icon" in body ? iconOf(body.icon) : circle.icon,
        coverKey,
        // Discover keeps its door open whatever else is changed about it: every
        // account is joined to it and it is where a member with no circle of
        // their own lands, so a private Discover would shut the app's front door.
        privacy:
          "privacy" in body && !circle.isDefault ? privacyOf(body.privacy) : circle.privacy,
        // Whether a plain member may add to the circle's taxonomy while posting.
        // A form that never asked leaves it alone.
        memberTaxonomy: memberTaxonomyFrom(body) ?? circle.memberTaxonomy,
        // Organisational only: attaching or detaching a branch moves nothing
        // and grants nothing. Members, admins, categories, subcategories,
        // fields and shares all stay exactly where they were.
        parentCircleId,
      })
      .where(eq(circles.id, id))
      .returning();

    // A replaced cover image has nothing pointing at it any more.
    if (previousCover && previousCover !== coverKey) {
      await coverStore().delete(previousCover);
    }

    const counts = await memberCounts([id]);
    return Response.json({
      circle: circleResponse(updated, {
        role: membership?.role ?? null,
        memberCount: counts.get(id) ?? 0,
        parent: await parentOf(updated),
      }),
    });
  }

  /**
   * Deleting belongs to whoever looks after the circle — its owner and the admins
   * they chose — and to the app admin for the circle whose owner has gone, an
   * abandoned room being exactly the kind of thing nobody inside it can settle.
   * Discover is nobody's: it is the circle every account is joined to, it belongs
   * to the app rather than to a member, and deleting it would leave every new
   * member with nowhere to land.
   */
  if (circle.isDefault) {
    return Response.json(
      {
        error:
          "That is the circle everybody starts in, so it cannot be deleted. Rename it or change what it holds instead.",
      },
      { status: 403 },
    );
  }
  if (!canManage) return notACircleManager("close it");
  // Only the last of the three is somebody from outside the circle, and that is
  // the one worth saying so about: the others are named, because a member losing
  // a circle deserves to know which of the people running it closed it.
  const asAppAdmin = moderating === "app_admin";

  // Deleting takes the circle away for everyone in it, so they hear about it.
  const people = await db
    .select({ memberId: circleMembers.memberId })
    .from(circleMembers)
    .where(eq(circleMembers.circleId, id));
  const others = people.filter((row) => row.memberId !== user.id);

  await deleteCircle(id);
  if (circle.coverKey) await coverStore().delete(circle.coverKey);

  if (others.length > 0) {
    await db.insert(notifications).values(
      others.map((row) => ({
        message: asAppAdmin
          ? `An admin closed the circle ${circle.icon} ${circle.name}`
          : `${memberOf(user).name} closed the circle ${circle.icon} ${circle.name}`,
        itemType: null,
        memberId: row.memberId,
        link: "#/circles",
      })),
    );
  }

  return Response.json({ ok: true });
};

export const config: Config = {
  path: "/api/circles/:id",
  method: ["GET", "PATCH", "DELETE"],
};
