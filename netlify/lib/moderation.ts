// netlify/lib/moderation.ts
// The three things the ⋮ on a post can do, and what a moderator does about them.
//
// Report, Hide and Block are deliberately different in kind. Hiding and blocking
// are the reader's own business: instant, silent, and affecting nobody else's view.
// Reporting asks somebody with authority to look, and authority here is local —
// the admins of the circle the post was read in — with the global app admin
// reserved for what a circle cannot settle on its own.
import type { User } from "@netlify/identity";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  blockedMembers,
  circleMembers,
  circles,
  contentReports,
  hiddenItems,
  itemCircles,
  members,
  notifications,
} from "../../db/schema.js";
import type { Access } from "./access.js";
import { ITEM_TABLES, memberNameOf, text, visibleTo, type ItemType } from "./items.js";

/** Why somebody reported a post. Free text lives in `details` beside it. */
export const REPORT_REASONS = ["spam", "abuse", "inappropriate", "wrong", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const MAX_REPORT_DETAILS = 1000;
/** What a moderation queue shows at once; older decisions are history, not work. */
export const MAX_REPORTS_LISTED = 100;

export function reasonOf(value: unknown): ReportReason {
  return (REPORT_REASONS as readonly string[]).includes(String(value))
    ? (value as ReportReason)
    : "other";
}

/** The roles that look after a circle. The owner is always one of them. */
export const MODERATOR_ROLES = ["owner", "admin"] as const;

/**
 * What the caller may do in one circle: "owner", "admin", "app_admin" for the
 * global admin standing in, or null.
 *
 * This is the whole of the answer, and it is deliberately one answer rather than
 * two. A circle used to be split down the middle — its admins answered the
 * reports and approved the requests, while everything that shaped the circle
 * itself stayed with whoever happened to start it — and that split is what left a
 * busy circle waiting on one person to rename a category or invite somebody.
 * Making somebody an admin of a circle now means exactly what it sounds like:
 * they look after it, all of it. So every circle mutation is gated on this and
 * none of them on `circle.ownerId === user.id`.
 *
 * Ownership survives as two facts and no third: the owner cannot be removed from
 * the circle or demoted, so there is always somebody left who cannot be locked
 * out of their own room.
 */
export async function moderatorOf(
  circleId: number,
  access: Access,
): Promise<"owner" | "admin" | "app_admin" | null> {
  const [row] = await db
    .select({ role: circleMembers.role })
    .from(circleMembers)
    .where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.memberId, access.user.id)));
  if (row?.role === "owner") return "owner";
  if (row?.role === "admin") return "admin";
  return access.isAppAdmin ? "app_admin" : null;
}

/**
 * The refusal when somebody who does not look after the circle tries to change
 * it. `what` finishes the sentence — "change its categories", "invite people to
 * it" — so the message names the thing that was actually attempted rather than
 * making the member guess which rule they met.
 */
export function notACircleManager(what: string) {
  return Response.json(
    { error: `Only the circle's owner or one of its admins can ${what}.` },
    { status: 403 },
  );
}

/** Every circle the caller moderates, which is the reach of their report queue. */
export async function moderatedCircleIds(access: Access): Promise<number[]> {
  const rows = await db
    .select({ circleId: circleMembers.circleId })
    .from(circleMembers)
    .where(
      and(
        eq(circleMembers.memberId, access.user.id),
        inArray(circleMembers.role, [...MODERATOR_ROLES]),
      ),
    );
  return rows.map((row) => row.circleId);
}

/**
 * Whether the caller answers for one particular share: an owner or admin of a
 * circle it was shared into, or the app admin standing in.
 *
 * This is the one place a share can be changed by somebody other than its author,
 * and it is deliberately narrow — the circle a thing was shared into is the room it
 * was said in, and whoever keeps that room may correct a title or take a bad
 * recording down without waiting for a member who may never open the app again. A
 * share that names no circle reaches the whole group and has no local moderator, so
 * only the app admin answers for it.
 */
export async function moderatesItem(
  itemType: ItemType,
  itemId: number,
  access: Access,
): Promise<boolean> {
  if (access.isAppAdmin) return true;

  const mine = await moderatedCircleIds(access);
  if (mine.length === 0) return false;

  const rows = await db
    .select({ circleId: itemCircles.circleId })
    .from(itemCircles)
    .where(
      and(
        eq(itemCircles.itemType, itemType),
        eq(itemCircles.itemId, itemId),
        inArray(itemCircles.circleId, mine),
      ),
    );
  return rows.length > 0;
}

/**
 * Whether the caller may correct or take down one particular share: its author
 * always, and otherwise whoever keeps a circle it went into.
 *
 * This is the one rule every per-item PATCH and DELETE is gated on, so the answer
 * is the same whichever kind of thing is being changed — a recipe, a book, a post
 * in a category a circle invented. A member's own work stays theirs to edit and to
 * delete, which has never moved; what is added is the room it was said in.
 */
export async function mayManageItem(
  itemType: ItemType,
  itemId: number,
  authorId: string,
  access: Access,
): Promise<boolean> {
  if (authorId === access.user.id) return true;
  return moderatesItem(itemType, itemId, access);
}

/** The row behind a report's item, but only when the caller may see it at all. */
export async function visibleItem(itemType: ItemType, itemId: number, user: User) {
  const table = ITEM_TABLES[itemType];
  const [row] = await db
    .select({ id: table.id, memberId: table.memberId, memberName: table.memberName })
    .from(table)
    .where(and(eq(table.id, itemId), visibleTo(table, user, itemType)));
  return row ?? null;
}

/**
 * One report, once. The unique index makes a second tap the same report rather
 * than a duplicate, and a reporter who changes their mind about the reason
 * replaces what they said instead of stacking another row on it.
 */
export async function fileReport(input: {
  itemType: ItemType;
  itemId: number;
  circleId: number | null;
  reason: ReportReason;
  details: string | null;
  author: { id: string; name: string };
  reporter: { id: string; name: string };
}) {
  const [report] = await db
    .insert(contentReports)
    .values({
      itemType: input.itemType,
      itemId: input.itemId,
      circleId: input.circleId,
      reporterId: input.reporter.id,
      reporterName: input.reporter.name,
      authorId: input.author.id,
      authorName: input.author.name,
      reason: input.reason,
      details: input.details,
      status: "open",
    })
    .onConflictDoUpdate({
      target: [contentReports.itemType, contentReports.itemId, contentReports.reporterId],
      set: {
        reason: input.reason,
        details: input.details,
        circleId: input.circleId,
        status: "open",
        handledById: null,
        handledByName: null,
        handledAt: null,
      },
    })
    .returning();
  return report;
}

export type ReportRow = typeof contentReports.$inferSelect;

export function reportResponse(row: ReportRow, circleName: string | null = null) {
  return {
    id: row.id,
    itemType: row.itemType,
    itemId: row.itemId,
    circleId: row.circleId,
    circleName,
    reporterName: row.reporterName,
    authorId: row.authorId,
    authorName: row.authorName,
    reason: row.reason,
    details: row.details,
    status: row.status,
    handledByName: row.handledByName,
    handledAt: row.handledAt,
    createdAt: row.createdAt,
  };
}

/**
 * The queue: reports about the circles the caller moderates, plus — for the app
 * admin — the group-wide ones nobody else can answer, and everything else besides.
 * A member who moderates nothing gets an empty list rather than an error, because
 * the app asks for this on every load.
 */
export async function reportsFor(access: Access) {
  const mine = await moderatedCircleIds(access);
  if (!access.isAppAdmin && mine.length === 0) return [];

  const rows = await db
    .select({ report: contentReports, circleName: circles.name })
    .from(contentReports)
    .leftJoin(circles, eq(circles.id, contentReports.circleId))
    .where(
      access.isAppAdmin
        ? undefined
        : or(inArray(contentReports.circleId, mine), isNull(contentReports.circleId)),
    )
    .orderBy(desc(contentReports.createdAt))
    .limit(MAX_REPORTS_LISTED);

  // A group-wide report is everybody's business only for the app admin; a circle
  // moderator sees one just because they might be the person who can explain it.
  return rows.map((row) => reportResponse(row.report, row.circleName));
}

/**
 * The reports about one circle, for its own page. Only ever asked for once the
 * caller has been found to moderate that circle.
 */
export async function reportsForCircle(circleId: number) {
  const rows = await db
    .select({ report: contentReports, circleName: circles.name })
    .from(contentReports)
    .leftJoin(circles, eq(circles.id, contentReports.circleId))
    .where(eq(contentReports.circleId, circleId))
    .orderBy(desc(contentReports.createdAt))
    .limit(MAX_REPORTS_LISTED);
  return rows.map((row) => reportResponse(row.report, row.circleName));
}

/** The report behind an id, only when the caller is allowed to act on it. */
export async function reportForModerator(id: number, access: Access) {
  const [row] = await db.select().from(contentReports).where(eq(contentReports.id, id));
  if (!row) return null;
  if (access.isAppAdmin) return row;
  if (row.circleId === null) return null;
  return (await moderatorOf(row.circleId, access)) ? row : null;
}

/**
 * The moderator's one destructive-looking action, which deletes nothing: the
 * share leaves the circle it was reported in and keeps every other circle it was
 * in. A share that was only ever in that one circle becomes private to whoever
 * wrote it, because falling back to "everybody in the group" would widen exactly
 * the thing a moderator just narrowed — the same rule deleting a circle follows.
 */
export async function removeFromCircle(itemType: ItemType, itemId: number, circleId: number | null) {
  if (circleId !== null) {
    await db
      .delete(itemCircles)
      .where(
        and(
          eq(itemCircles.itemType, itemType),
          eq(itemCircles.itemId, itemId),
          eq(itemCircles.circleId, circleId),
        ),
      );
  } else {
    // A group-wide share has no circle to be taken out of, so the only way to
    // stop it reaching the group is to hand it back to its author.
    await db
      .delete(itemCircles)
      .where(and(eq(itemCircles.itemType, itemType), eq(itemCircles.itemId, itemId)));
  }

  const [left] = await db
    .select({ circleId: itemCircles.circleId })
    .from(itemCircles)
    .where(and(eq(itemCircles.itemType, itemType), eq(itemCircles.itemId, itemId)));
  if (left) return { madePrivate: false };

  const table = ITEM_TABLES[itemType];
  await db.update(table).set({ visibility: "private" }).where(eq(table.id, itemId));
  return { madePrivate: true };
}

/**
 * Marks the report settled and tells the two people who need to know: the member
 * who raised it, so reporting does not feel like shouting into a well, and the
 * author, so nothing is taken out of a circle behind their back.
 */
export async function resolveReport(
  report: ReportRow,
  decision: "dismissed" | "removed",
  access: Access,
) {
  const [updated] = await db
    .update(contentReports)
    .set({
      status: decision,
      handledById: access.user.id,
      handledByName: memberNameOf(access.user),
      handledAt: new Date(),
    })
    .where(eq(contentReports.id, report.id))
    .returning();

  const rows: (typeof notifications.$inferInsert)[] = [
    {
      message:
        decision === "removed"
          ? "Thanks for the report — a moderator has taken that post out of the circle."
          : "Thanks for the report — a moderator looked at that post and left it up.",
      itemType: null,
      memberId: report.reporterId,
      link: "#/circles",
    },
  ];
  if (decision === "removed") {
    rows.push({
      message:
        "A moderator removed one of your shares from a circle after a report. It is private to you now unless it was shared elsewhere too.",
      itemType: report.itemType,
      memberId: report.authorId,
      link: "#/profile",
    });
  }
  await db.insert(notifications).values(rows);

  return updated ?? report;
}

/** Whoever should hear that a report has been filed, addressed one by one. */
export async function notifyModerators(report: ReportRow, circleName: string | null) {
  const moderators = new Set<string>();

  if (report.circleId !== null) {
    const rows = await db
      .select({ memberId: circleMembers.memberId })
      .from(circleMembers)
      .where(
        and(
          eq(circleMembers.circleId, report.circleId),
          inArray(circleMembers.role, [...MODERATOR_ROLES]),
        ),
      );
    for (const row of rows) moderators.add(row.memberId);
  } else {
    // Nothing else covers a share that reaches the whole group.
    const admins = await db
      .select({ id: members.id })
      .from(members)
      .where(eq(members.role, "app_admin"));
    for (const admin of admins) moderators.add(admin.id);
  }

  moderators.delete(report.reporterId);
  if (moderators.size === 0) return;

  const where = circleName ? ` in ${circleName}` : "";
  await db.insert(notifications).values(
    [...moderators].map((memberId) => ({
      message: `⚑ ${report.reporterName} reported a ${report.itemType}${where} — ${report.reason}`,
      itemType: report.itemType,
      memberId,
      link: "#/profile",
    })),
  );
}

// The reader's own two decisions ------------------------------------------------

export async function hideItem(itemType: ItemType, itemId: number, user: User) {
  await db
    .insert(hiddenItems)
    .values({ memberId: user.id, itemType, itemId })
    .onConflictDoNothing();
}

export async function unhideItem(itemType: ItemType, itemId: number, user: User) {
  await db
    .delete(hiddenItems)
    .where(
      and(
        eq(hiddenItems.memberId, user.id),
        eq(hiddenItems.itemType, itemType),
        eq(hiddenItems.itemId, itemId),
      ),
    );
}

export async function blockMember(blocked: { id: string; name: string | null }, user: User) {
  if (blocked.id === user.id) return false;
  await db
    .insert(blockedMembers)
    .values({ blockerId: user.id, blockedId: blocked.id, blockedName: blocked.name })
    .onConflictDoNothing();
  return true;
}

export async function unblockMember(blockedId: string, user: User) {
  await db
    .delete(blockedMembers)
    .where(and(eq(blockedMembers.blockerId, user.id), eq(blockedMembers.blockedId, blockedId)));
}

/**
 * Everybody either side of a block with this member. Listings filter with a
 * subquery, but the contributions hanging off a share — a reply, an experience, a
 * language connection — are read as rows and filtered against this.
 */
export async function blockedIdsFor(user: User | null): Promise<Set<string>> {
  if (!user) return new Set();
  const rows = await db
    .select({ blockerId: blockedMembers.blockerId, blockedId: blockedMembers.blockedId })
    .from(blockedMembers)
    .where(or(eq(blockedMembers.blockerId, user.id), eq(blockedMembers.blockedId, user.id)));
  const ids = new Set<string>();
  for (const row of rows) {
    ids.add(row.blockerId === user.id ? row.blockedId : row.blockerId);
  }
  return ids;
}

/** What the caller has hidden and who they have blocked, for their own app. */
export async function moderationStateOf(user: User) {
  const [hidden, blocked] = await Promise.all([
    db
      .select({ itemType: hiddenItems.itemType, itemId: hiddenItems.itemId })
      .from(hiddenItems)
      .where(eq(hiddenItems.memberId, user.id)),
    db
      .select({
        memberId: blockedMembers.blockedId,
        memberName: blockedMembers.blockedName,
        createdAt: blockedMembers.createdAt,
      })
      .from(blockedMembers)
      .where(eq(blockedMembers.blockerId, user.id))
      .orderBy(desc(blockedMembers.createdAt)),
  ]);
  return { hidden, blocked };
}

/** The name to record for somebody being blocked, when the app knows one. */
export async function nameOfMember(memberId: string) {
  const [row] = await db
    .select({ name: members.name })
    .from(members)
    .where(eq(members.id, memberId));
  return row?.name ?? null;
}

/** The directory names behind a set of ids, for a screen that lists both sides. */
async function namesOf(memberIds: string[]) {
  const names = new Map<string, string>();
  if (memberIds.length === 0) return names;
  const rows = await db
    .select({ id: members.id, name: members.name })
    .from(members)
    .where(inArray(members.id, memberIds));
  for (const row of rows) names.set(row.id, row.name);
  return names;
}

/**
 * Every block one member is on either side of.
 *
 * A block is mutual and silent by design: neither person sees the other's shares
 * afterwards, and neither is told. That is right for the member who asked for it
 * and wrong for the member who did not — somebody blocked by mistake watches half
 * the group disappear with nothing on screen to explain it, and cannot lift a row
 * they did not write. This is what lets the app admin see the pair and undo it.
 */
export async function blocksInvolving(memberId: string) {
  const rows = await db
    .select({
      blockerId: blockedMembers.blockerId,
      blockedId: blockedMembers.blockedId,
      blockedName: blockedMembers.blockedName,
      createdAt: blockedMembers.createdAt,
    })
    .from(blockedMembers)
    .where(or(eq(blockedMembers.blockerId, memberId), eq(blockedMembers.blockedId, memberId)))
    .orderBy(desc(blockedMembers.createdAt));

  // The stored name is the blocked party's, so the other direction needs the roll.
  const names = await namesOf([...new Set(rows.map((row) => row.blockerId))]);

  return {
    blocking: rows
      .filter((row) => row.blockerId === memberId)
      .map((row) => ({
        memberId: row.blockedId,
        memberName: row.blockedName ?? names.get(row.blockedId) ?? null,
        createdAt: row.createdAt,
      })),
    blockedBy: rows
      .filter((row) => row.blockedId === memberId)
      .map((row) => ({
        memberId: row.blockerId,
        memberName: names.get(row.blockerId) ?? null,
        createdAt: row.createdAt,
      })),
  };
}

/**
 * Lifts a block between two members, whichever way round it was written — and
 * both, when each had blocked the other. Answers the rows that were removed so
 * the caller can tell whoever placed one that it is gone: a block is the
 * blocker's own record, so having an admin undo it is not something to do to them
 * quietly.
 */
export async function liftBlock(memberId: string, otherId: string) {
  return db
    .delete(blockedMembers)
    .where(
      or(
        and(eq(blockedMembers.blockerId, memberId), eq(blockedMembers.blockedId, otherId)),
        and(eq(blockedMembers.blockerId, otherId), eq(blockedMembers.blockedId, memberId)),
      ),
    )
    .returning();
}

/** Reports still waiting, per circle, so a moderator sees where the work is. */
export async function openReportCounts(circleIds: number[]) {
  const counts = new Map<number, number>();
  if (circleIds.length === 0) return counts;
  const rows = await db
    .select({ circleId: contentReports.circleId, total: sql<number>`count(*)` })
    .from(contentReports)
    .where(
      and(eq(contentReports.status, "open"), inArray(contentReports.circleId, circleIds)),
    )
    .groupBy(contentReports.circleId);
  for (const row of rows) {
    if (row.circleId !== null) counts.set(row.circleId, Number(row.total));
  }
  return counts;
}

/** The optional free text on a report, trimmed to something a queue can read. */
export function detailsFrom(value: unknown) {
  const trimmed = text(value).slice(0, MAX_REPORT_DETAILS);
  return trimmed.length > 0 ? trimmed : null;
}
