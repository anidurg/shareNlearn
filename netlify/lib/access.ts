// netlify/lib/access.ts
// Who is in the group, and what their account may do once inside.
//
// The door is open: anybody who can log in is a member, and is joined to
// Discover — the circle everybody shares — so a brand new account has something
// to read and somewhere to post from its very first request. What is still the
// app's own record rather than Identity's is everything that happens *after*
// that: whether an admin has paused the account, whether it is the one global
// admin, whether it has been here long enough to start circles of its own. Those
// live in the `members` table and are worked out here, and every content route
// goes through `admittedUser()` so a paused account reads nothing and writes
// nothing.
import { getUser, type User } from "@netlify/identity";
import { count, eq, isNotNull, type InferSelectModel } from "drizzle-orm";
import { db } from "../../db/index.js";
import { circleMembers, circles, members } from "../../db/schema.js";
import { ensureCommunityMembership } from "./community.js";
import { memberNameOf, unauthorized } from "./items.js";

export type MemberRow = InferSelectModel<typeof members>;

/**
 * How long an account has to have existed before it can start circles on its
 * own. Short enough not to be a punishment, long enough that a throwaway account
 * cannot arrive and immediately start rooms.
 *
 * It is the fallback rather than the main road: an account somebody has let into
 * a circle is trusted the moment that happens, and only one that has sat in
 * Discover alone waits this out.
 */
export const TRUSTED_AFTER_DAYS = 7;

/** The role an Identity user carries when the site owner has made them an admin. */
const ADMIN_ROLE = "admin";

export interface Access {
  user: User;
  /** The directory row, absent only for an account that has never been seen. */
  member: MemberRow | null;
  /** In the group. True for anybody who can log in — the door is open. */
  admitted: boolean;
  /** Stopped by the app admin: reads nothing, writes nothing, keeps everything. */
  suspended: boolean;
  /** The global admin, for abuse and support only. */
  isAppAdmin: boolean;
  /**
   * Allowed to read the usage report — the app admin, and anybody they have
   * made an App Manager. It is the one predicate in the app that is wider than
   * `isAppAdmin`, and it is wider by exactly one screen: an App Manager reads
   * what the deployment costs and has no lever over an account, a circle or a
   * share.
   */
  isAppManager: boolean;
  /** Allowed to start circles. */
  trusted: boolean;
  canCreateCircle: boolean;
  /** How many circles they are in, which is what "join one first" is measured on. */
  circleCount: number;
  /** True when nobody has been admitted yet: the first member founds the group. */
  founding: boolean;
  /**
   * Admitted, but not in a circle yet. Ordinarily nobody is — every account is
   * joined to Discover below — so this is the answer to a join that could not be
   * made rather than a step anybody is expected to take.
   */
  needsCircle: boolean;
  /**
   * Whether they have ticked "I agree" on the Community Guidelines. Nothing is
   * created until they have — it is asked once, before the first share, and
   * never again.
   */
  acceptedGuidelines: boolean;
  /** Days since the account was made, for the "active for a while" rule. */
  accountAgeDays: number;
  /** Days still to wait before the account qualifies on its own; 0 when it does. */
  trustedInDays: number;
}

/** The site owner can make somebody a global admin from the Netlify UI alone. */
function hasIdentityAdminRole(user: User) {
  return user.role === ADMIN_ROLE || (user.roles ?? []).includes(ADMIN_ROLE);
}

function daysSince(value: Date | string | null | undefined) {
  if (!value) return 0;
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

/** Whether anybody at all has been admitted, which is how the founder is spotted. */
export async function groupIsEmpty() {
  const [row] = await db
    .select({ total: count() })
    .from(members)
    .where(isNotNull(members.admittedAt));
  return Number(row?.total ?? 0) === 0;
}

/**
 * Everything a route needs to know about the caller, in three small reads. The
 * answers are derived rather than trusted: the columns record decisions somebody
 * made, and the rules for reading them live here in one place.
 */
export async function accessOf(user: User): Promise<Access> {
  // The circle read answers two questions rather than one — how many, and is
  // Discover among them — so that keeping everybody in Discover below costs no
  // extra query on a path that runs on every request.
  const [[row], joined] = await Promise.all([
    db.select().from(members).where(eq(members.id, user.id)),
    db
      .select({ isDefault: circles.isDefault })
      .from(circleMembers)
      .innerJoin(circles, eq(circles.id, circleMembers.circleId))
      .where(eq(circleMembers.memberId, user.id)),
  ]);

  const member = row ?? null;
  const circleCount = joined.length;
  const inCommunity = joined.some((entry) => entry.isDefault);
  // A circle somebody actually let them into, which Discover is not: everybody is
  // put in that one automatically, so counting it would make "in a circle" true
  // for every account from its first request and mean nothing.
  const inJoinedCircle = joined.some((entry) => !entry.isDefault);
  const isAppAdmin = member?.role === "app_admin" || hasIdentityAdminRole(user);
  const isAppManager = isAppAdmin || member?.role === "app_manager";
  const suspended = member?.status === "suspended";

  // Whoever founds the group is still worth spotting, because they become its
  // app admin — but nobody else is turned away for arriving after them. A real
  // login is membership: the account is written down below, joined to Discover,
  // and can post from its first visit.
  const founding = member?.admittedAt ? false : await groupIsEmpty();
  const admitted = Boolean(user.id);

  /**
   * Everybody starts in Discover, so an admitted account that is not in it is
   * put there here rather than being sent to the Circles tab to go looking. The
   * membership read above already answered whether they are in, so the common
   * case — a member who has been here before — costs nothing, which matters
   * because `accessOf()` runs on every request.
   *
   * A failure is survivable — they stay exactly where they were, and the next
   * request tries again — so it is not allowed to take the whole request down.
   */
  let circleTotal = circleCount;
  if (admitted && !suspended && !inCommunity) {
    try {
      await ensureCommunityMembership({ id: user.id, name: memberNameOf(user) });
      circleTotal += 1;
    } catch {
      // Left where they were; the next request tries again.
    }
  }

  const accountAgeDays = daysSince(member?.createdAt ?? user.createdAt);
  /**
   * Trust is earned by somebody letting them in, or failing that by time.
   *
   * Being accepted into a circle — invited and accepted, approved after asking,
   * or joining one that is open to all — is a person's decision about a person,
   * and it is worth more than any clock, so it counts the moment it happens.
   * Discover is excluded because it is not a decision: every account is joined to
   * it automatically, which is exactly what made the old rule read as a plain
   * seven-day wait. A member who had been approved into a circle that morning was
   * still told they could start one "in 7 days", and nothing they did shortened
   * it.
   *
   * The clock stays as the other way in, for an account that has only ever been
   * in Discover: after `TRUSTED_AFTER_DAYS` it qualifies on its own.
   *
   * Email confirmation is deliberately *not* part of this, even though it reads
   * like it belongs: Identity refuses the login of an unconfirmed account
   * outright, so by the time this function runs the account is already through
   * that door and asking again adds nothing. Worse, the answer is not reliably
   * knowable here — `getUser()` falls back to the JWT's claims when the Identity
   * API is unreachable, and a JWT carries no `confirmed_at`, so reading it made
   * `earnedTrust` unreachable for everybody on that path and told confirmed
   * members to go and confirm an email nothing had sent them.
   */
  const earnedTrust = inJoinedCircle || (accountAgeDays >= TRUSTED_AFTER_DAYS && circleTotal > 0);
  const trusted = member?.trustedAt != null || isAppAdmin || earnedTrust;

  // Writing the two decisions down keeps them from wobbling, and gives every new
  // account a directory row on its first request: a member who qualified for
  // trust once does not stop being trusted by leaving a circle, and the date they
  // joined the group is recorded once rather than re-derived.
  if (admitted && !suspended && (member?.admittedAt == null || (trusted && !member?.trustedAt))) {
    await db
      .insert(members)
      .values({
        id: user.id,
        name: memberNameOf(user),
        email: user.email ?? null,
        admittedAt: new Date(),
        trustedAt: trusted ? new Date() : null,
        role: founding ? "app_admin" : "member",
      })
      .onConflictDoUpdate({
        target: members.id,
        set: {
          admittedAt: member?.admittedAt ?? new Date(),
          ...(trusted && !member?.trustedAt ? { trustedAt: new Date() } : {}),
        },
      });
  }

  return {
    user,
    member,
    admitted,
    suspended,
    isAppAdmin,
    isAppManager,
    trusted,
    // The founder has nobody to be invited by and no circle to be trusted from,
    // so they may start the first one; everybody after them has both.
    canCreateCircle: (isAppAdmin || trusted || founding) && !suspended,
    circleCount: circleTotal,
    founding,
    needsCircle: admitted && !founding && circleTotal === 0,
    acceptedGuidelines: member?.guidelinesAcceptedAt != null,
    accountAgeDays,
    // Nobody who is already trusted is counting days: the wait is what is left
    // for an account that has no other way in yet, and it is what the browser
    // puts in front of somebody it has just refused.
    trustedInDays: trusted ? 0 : Math.max(0, TRUSTED_AFTER_DAYS - accountAgeDays),
  };
}

/**
 * The caller, and everything the group has decided about them — or null when
 * there is no account or the one there has been paused. Routes treat both the
 * same way on purpose: a paused account should learn no more about the group
 * than somebody who is not logged in at all.
 */
export async function admittedAccess(): Promise<Access | null> {
  const user = await getUser();
  if (!user) return null;
  const access = await accessOf(user);
  return access.admitted && !access.suspended ? access : null;
}

/** The same gate, for the routes that only need to know who is asking. */
export async function admittedUser(): Promise<User | null> {
  return (await admittedAccess())?.user ?? null;
}

/** What a member the app cannot let through is told, for the routes that say so. */
export function notAdmitted() {
  return Response.json(
    {
      error:
        "Log in to take part in Share & Learn. If your account has been paused, an admin can lift it.",
    },
    { status: 403 },
  );
}

/** A member the app could not put in a circle, which is normally nobody. */
export function needsCircleFirst() {
  return Response.json(
    { error: "Join a circle first — everything shared here goes to a circle you are in." },
    { status: 403 },
  );
}

/**
 * A member who has not agreed to the Community Guidelines yet. `needsGuidelines`
 * travels with the refusal so the browser can put the agreement in front of them
 * rather than showing an error and leaving them to guess what to do about it.
 */
export function needsGuidelines() {
  return Response.json(
    {
      error:
        "Agree to the Community Guidelines before you post — it is asked once, and takes a tap.",
      needsGuidelines: true,
    },
    { status: 403 },
  );
}

export function forbidden(message: string) {
  return Response.json({ error: message }, { status: 403 });
}

/**
 * The gate for anything that creates a share: admitted, not suspended, in at
 * least one circle, and agreed to the guidelines. The founder of a brand new
 * group is the exception to the circle rule, because there is no circle to be in
 * yet — but not to the guidelines, which everybody who posts has read.
 */
export async function sharingAccess(): Promise<Access | Response> {
  const access = await admittedAccess();
  if (!access) return notAdmitted();
  if (access.needsCircle) return needsCircleFirst();
  if (!access.acceptedGuidelines) return needsGuidelines();
  return access;
}

/**
 * The same gate for a route that already has the caller in hand: answers a
 * `Response` when they may not share and null when they may, so a create branch
 * reads as one check rather than four.
 */
export async function sharingGate(user: User): Promise<Response | null> {
  const access = await accessOf(user);
  if (!access.admitted || access.suspended) return notAdmitted();
  if (access.needsCircle) return needsCircleFirst();
  if (!access.acceptedGuidelines) return needsGuidelines();
  return null;
}

/** How an account travels to the browser, so the app knows which screen to show. */
export function accessResponse(access: Access) {
  return {
    admitted: access.admitted,
    suspended: access.suspended,
    /**
     * The stored role rather than a two-way derivation of it, because there are
     * three of them now and the old `isAppAdmin ? … : …` would have flattened an
     * App Manager into a plain member and left the panel unreachable. An
     * Identity-granted admin has no `members.role` saying so, so that case is
     * still derived.
     */
    role: access.isAppAdmin ? "app_admin" : access.isAppManager ? "app_manager" : "member",
    trusted: access.trusted,
    canCreateCircle: access.canCreateCircle,
    needsCircle: access.needsCircle,
    acceptedGuidelines: access.acceptedGuidelines,
    circleCount: access.circleCount,
    founding: access.founding,
    trustedInDays: access.trustedInDays,
    trustedAfterDays: TRUSTED_AFTER_DAYS,
  };
}
