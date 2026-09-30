// netlify/lib/usage.ts
// Writing down what a member cost, which nothing else in the app is in a position
// to work out afterwards.
//
// The gap this fills is a property of the platform rather than an oversight. A
// Blobs listing answers `{ key, etag }` and no sizes, so the size of an upload is
// knowable at exactly one moment — the moment it arrives — and never again.
// Bandwidth, which is the dominant charge, is worse still: nothing anywhere
// records that a recording was played, so the bytes that actually cost money leave
// no trace at all unless the route serving them writes one. And `upload_rates`,
// which looks like it already answers this, cannot: it is an hourly window that
// resets by design, so it says whether somebody is uploading too fast and can
// never say what they have used.
//
// So there are three writers and they sit at the three choke points rather than
// per route: `recordUpload()` inside `throttleUpload()`, which every ingest route
// already calls; `recordServed()` in the five routes that hand member media back;
// and `recordAi()` at the app's single model call site.
//
// The read side sits at the bottom of the same file rather than in one of its
// own, because what a report may ask is decided by how the writers key a row:
// `usageByMember()` is a `GROUP BY` over the day column these three write, and
// splitting the two apart would be two files that only make sense read together.
//
// **Every writer here is fail-soft, and that is the whole of its error handling.**
// A counter is worth less than the request it is counting: a member playing a
// recording must not be shown an error because a usage row would not write, so
// every function swallows its own failure and the caller does not check. The cost
// of that is an undercount when the database is unhappy, which is the right thing
// to lose.
import { and, desc, eq, gte, lt, sql, sum } from "drizzle-orm";
import { db } from "../../db/index.js";
import { memberUsage, members } from "../../db/schema.js";

/** Enough of a member to count against, so a caller can pass the user it has. */
type Uploader = { id: string };

/** What one call is adding to today's row. Anything absent is not touched. */
type Delta = {
  uploadBytes?: number;
  uploadCount?: number;
  servedBytes?: number;
  servedRequests?: number;
  aiCalls?: number;
};

/**
 * The UTC day a row is keyed on, as `YYYY-MM-DD`.
 *
 * UTC rather than anybody's local time because two functions in two regions have
 * to agree on which row they are adding to, and a member's own midnight is not
 * something a counter can know. The consequence is worth stating plainly: a day
 * here is not the member's day, so a single evening's uploading can land either
 * side of the boundary. For "what did this member cost over a month" that is
 * immaterial, which is the only question the table exists to answer.
 */
function utcDay(at = new Date()): string {
  return at.toISOString().slice(0, 10);
}

/** Only the counters this call actually names, and only where they are real numbers. */
function amountsOf(delta: Delta): Delta {
  const clean: Delta = {};
  for (const [key, value] of Object.entries(delta)) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      clean[key as keyof Delta] = Math.ceil(value);
    }
  }
  return clean;
}

/**
 * Adds to one member's row for today, creating it on the first write of the day.
 *
 * An upsert rather than a read-then-write because these are counters and two
 * requests arriving together must each be counted: `onConflictDoUpdate` with
 * `column + excluded` lets the database do the addition, so nothing is lost to a
 * race and no row is ever read back. Only the counters the caller named are added
 * to, which is what lets one table serve three unrelated writers.
 */
async function record(memberId: string, delta: Delta): Promise<void> {
  const amounts = amountsOf(delta);
  if (!memberId || Object.keys(amounts).length === 0) return;

  const day = utcDay();
  try {
    await db
      .insert(memberUsage)
      .values({ memberId, day, ...amounts })
      .onConflictDoUpdate({
        target: [memberUsage.memberId, memberUsage.day],
        set: {
          ...(amounts.uploadBytes !== undefined && {
            uploadBytes: sql`${memberUsage.uploadBytes} + ${amounts.uploadBytes}`,
          }),
          ...(amounts.uploadCount !== undefined && {
            uploadCount: sql`${memberUsage.uploadCount} + ${amounts.uploadCount}`,
          }),
          ...(amounts.servedBytes !== undefined && {
            servedBytes: sql`${memberUsage.servedBytes} + ${amounts.servedBytes}`,
          }),
          ...(amounts.servedRequests !== undefined && {
            servedRequests: sql`${memberUsage.servedRequests} + ${amounts.servedRequests}`,
          }),
          ...(amounts.aiCalls !== undefined && {
            aiCalls: sql`${memberUsage.aiCalls} + ${amounts.aiCalls}`,
          }),
          updatedAt: new Date(),
        },
      });
  } catch {
    // Deliberately silent. See the note at the top of the file: a member's upload
    // or playback must not fail because a counter would not write.
  }
}

/**
 * One upload's worth of bytes, charged to whoever sent them.
 *
 * Called from inside `throttleUpload()` rather than from the ingest routes, so
 * every route that can store a blob is counted by having already been written —
 * and the one route that deliberately charges zero (`upload-complete.mts`, whose
 * bytes were counted part by part on the way in) is deliberately counted as zero
 * here too, for the same reason: a recording billed twice is worse than one billed
 * once.
 *
 * What this measures is the bytes that arrived, which on the chunked path is the
 * parts rather than the stitched blob. They are the same number today, the stitch
 * being a concatenation, and the parts are what the request bandwidth was actually
 * spent on either way.
 */
export async function recordUpload(user: Uploader, bytes: number): Promise<void> {
  await record(user.id, { uploadBytes: bytes, uploadCount: 1 });
}

/**
 * Bytes handed back out of a media route, charged to whoever uploaded them.
 *
 * Attributed to the **uploader** rather than to the reader, which is the one
 * judgement in this file worth arguing about. Three of the five serving routes are
 * deliberately login-free — a photo, a document and a circle cover are served on
 * an unguessable key so a share can be read without a session — so the reader is
 * frequently unknown and would have to be null for a large share of the traffic,
 * which is the traffic most worth knowing about. The uploader is always known,
 * being written into the key. And it is the more useful of the two answers
 * besides: "this member's uploads cost 40 GB of egress last month" is what decides
 * whether anything needs metering, while "this member read 40 GB" describes
 * somebody using the app as intended.
 *
 * **It counts origin egress and not the whole bill.** A read served from
 * Netlify's edge cache never reaches the function, and the three immutable routes
 * are cached hard on purpose, so their second and subsequent reads are invisible
 * here. What this number is, then, is the egress that cost compute as well as
 * bandwidth — a floor on the true figure and an honest one, which is worth more
 * than a guess at the rest.
 */
export async function recordServed(memberId: string | null, bytes: number): Promise<void> {
  if (!memberId) return;
  await record(memberId, { servedBytes: bytes, servedRequests: 1 });
}

/**
 * One call to the AI Gateway, charged to the member who asked for it.
 *
 * A count rather than tokens, because `askText()` reads the answer's text and not
 * the usage block the gateway returns, and because the gateway bills the account
 * rather than the request — so what is worth knowing per member is how often they
 * ask, the per-call cost being roughly constant for a bounded prompt. Tokens are
 * the obvious next column if the answer ever needs to be sharper than that.
 */
export async function recordAi(memberId: string | null): Promise<void> {
  if (!memberId) return;
  await record(memberId, { aiCalls: 1 });
}

/**
 * Who uploaded the blob behind a key, read off the key itself.
 *
 * Every store in the app mints keys that name their uploader — `photoKeyFor()`,
 * `attachmentKeyFor()` and a circle cover are `<memberId>_<uuid>`, and song audio
 * is `<memberId>/<uuid>` — and an Identity id contains neither separator, so the
 * first one found ends the id. That is what makes counting egress on the
 * login-free routes possible at all: the alternative is a database read per media
 * request, on the routes least able to afford one.
 *
 * Null for anything that does not split, so a key from some older shape is not
 * counted against a member who does not exist.
 */
export function uploaderOf(key: string): string | null {
  const at = key.search(/[_/]/);
  if (at <= 0) return null;
  return key.slice(0, at);
}

/** One member's month, as the report reads it back. */
export type MemberUsage = {
  memberId: string;
  /** The member's current name, or null for a row whose account has gone. */
  name: string | null;
  uploadBytes: number;
  uploadCount: number;
  servedBytes: number;
  servedRequests: number;
  aiCalls: number;
};

/** How many members one report lists, newest cost first. */
export const MAX_USAGE_ROWS = 100;

/** The `YYYY-MM` a report defaults to, which is the month in progress. */
export function currentMonth(at = new Date()): string {
  return at.toISOString().slice(0, 7);
}

/**
 * The bounds of a `YYYY-MM`, as the two `YYYY-MM-DD` strings the `day` column is
 * compared against — or null for anything that is not a month.
 *
 * A string comparison rather than a date one because `day` is text, which is
 * what makes it sortable and comparable without a cast: `'2026-09-01' <= day <
 * '2026-10-01'` is exactly the month and reads as what it is. December is the
 * one case worth checking, and it rolls to `'2027-01-01'` rather than month 13.
 */
export function monthBounds(month: string): { from: string; to: string } | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7));
  const nextYear = index === 12 ? year + 1 : year;
  const nextIndex = index === 12 ? 1 : index + 1;
  return {
    from: `${month}-01`,
    to: `${String(nextYear).padStart(4, "0")}-${String(nextIndex).padStart(2, "0")}-01`,
  };
}

/** `sum()` answers a string or null, being a numeric; a counter reads as a number. */
function total(value: string | null): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * What each member cost over one month, heaviest egress first.
 *
 * A `GROUP BY` over the daily rows rather than a second table of monthly ones:
 * the recording is per day so that a month can be asked for afterwards without
 * having decided in advance which months matter, and at one row per member per
 * day the whole group's year is small enough that the grouping is the cheaper
 * half of the query.
 *
 * The join to `members` is a left one on purpose. A usage row outlives the
 * account it counts — nothing deletes one when a member goes — and the bytes
 * still cost what they cost, so an unnamed row is listed against its id rather
 * than dropped from the total.
 */
export async function usageByMember(month: string): Promise<MemberUsage[]> {
  const bounds = monthBounds(month);
  if (!bounds) return [];

  const rows = await db
    .select({
      memberId: memberUsage.memberId,
      name: members.name,
      uploadBytes: sum(memberUsage.uploadBytes),
      uploadCount: sum(memberUsage.uploadCount),
      servedBytes: sum(memberUsage.servedBytes),
      servedRequests: sum(memberUsage.servedRequests),
      aiCalls: sum(memberUsage.aiCalls),
    })
    .from(memberUsage)
    .leftJoin(members, eq(members.id, memberUsage.memberId))
    .where(and(gte(memberUsage.day, bounds.from), lt(memberUsage.day, bounds.to)))
    .groupBy(memberUsage.memberId, members.name)
    .orderBy(desc(sum(memberUsage.servedBytes)))
    .limit(MAX_USAGE_ROWS);

  return rows.map((row) => ({
    memberId: row.memberId,
    name: row.name,
    uploadBytes: total(row.uploadBytes),
    uploadCount: total(row.uploadCount),
    servedBytes: total(row.servedBytes),
    servedRequests: total(row.servedRequests),
    aiCalls: total(row.aiCalls),
  }));
}

/**
 * The months there is anything at all recorded for, newest first, so the report
 * offers the months that exist rather than a date picker over empty ones.
 */
export async function usageMonths(): Promise<string[]> {
  const month = sql<string>`substr(${memberUsage.day}, 1, 7)`;
  const rows = await db
    .select({ month })
    .from(memberUsage)
    .groupBy(month)
    .orderBy(desc(month))
    .limit(24);
  return rows.map((row) => row.month).filter((value): value is string => Boolean(value));
}
