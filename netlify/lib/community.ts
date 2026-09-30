// netlify/lib/community.ts
// The one circle everybody starts in.
//
// Circles are otherwise somebody's own: a member starts one, owns it, and
// decides who else is in it. That leaves a hole at the very beginning — an
// account that has just been admitted belongs to no circle, so it has nothing to
// read and nowhere to post, and the app can only send it to the Circles tab to
// go looking. Discover is the answer to that: it exists before anybody, every
// admitted member is joined to it, and it is what "log in and see something"
// means.
//
// It is owned by the app rather than by a member. `owner_id` is a sentinel that
// no Identity user can ever have, so no member is ever the owner of Discover and
// nobody inherits it by having been here first.
//
// That sentinel used to be the whole of its protection, back when every circle
// mutation asked `circle.ownerId === user.id` and therefore refused everybody
// here. It no longer is, because a circle is now run by whoever looks after it —
// `moderatorOf()` — and for Discover that means the app admin and anybody they
// make an admin of it, which is the right answer: somebody has to be able to
// tidy the circle every account lands in. What keeps Discover safe from the two
// things that would break the app is said where it is enforced rather than
// implied here: `circle.mts` refuses to delete a circle that `is_default`, and
// pins its privacy however the rest of it is edited, so the front door cannot be
// closed or locked.
import { and, asc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { circles } from "../../db/schema.js";
import { seedCategories } from "./categories.js";
import { joinCircle, type Circle } from "./circles.js";

/**
 * Not a real Identity id, and that is the point: it can never equal `user.id`,
 * so nobody is the owner of Discover and no route has to learn that this circle
 * is special in order to keep it that way.
 */
export const COMMUNITY_OWNER_ID = "system";
export const COMMUNITY_OWNER_NAME = "Share & Learn";

export const COMMUNITY_NAME = "Discover";
export const COMMUNITY_ICON = "🌏";

/**
 * Names this circle has been called before now. The constant above only names a
 * circle at the moment it is created, so a deploy where it already exists is
 * still holding whatever it was called then — which is what `upgradeDefaultName()`
 * below is for. Same trick as `upgradeLegacyNames()` in `categories.ts`: match on
 * the exact old default, so a name somebody deliberately changed is left alone.
 */
const PREVIOUS_DEFAULT_NAMES = ["Community"];

const COMMUNITY_DESCRIPTION =
  "Everybody's first circle. Books worth passing on, fun facts, words worth keeping, and where " +
  "we have been — open to every member of the group.";

/**
 * What Discover holds. Three of the built-ins, plus Travelogue, which is a
 * category the app invents here rather than one of the six kinds of share: it
 * holds ordinary posts, so a member writes a place, the story and photographs
 * without anything new having to be built for it.
 */
export const COMMUNITY_CATEGORIES: {
  itemType: string | null;
  name?: string;
  icon?: string;
  seeds?: string[];
}[] = [
  { itemType: "book" },
  { itemType: "fact" },
  { itemType: "word" },
  {
    itemType: null,
    name: "Travelogue",
    icon: "✈️",
    seeds: [
      "Temples & Pilgrimages",
      "Hill Stations",
      "Beaches",
      "Cities",
      "Heritage & Museums",
      "Wildlife & Nature",
      "Abroad",
      "Day Trips",
    ],
  },
];

/**
 * Brings the default circle's name up to date, in memory and in the row, for any
 * of the circle rows a caller has already read. Cheap on purpose: a set with
 * nothing stale in it returns straight away, so this costs one extra statement
 * once after a rename and nothing at all every time afterwards.
 *
 * A rename is done this way rather than in a migration because the circle is
 * created lazily — there may be no row to update at the moment a deploy lands,
 * and there is one the first time anybody logs in.
 */
export async function upgradeDefaultName<
  T extends { id: number; name: string; isDefault: boolean },
>(rows: T[]): Promise<T[]> {
  const stale = rows.filter((row) => row.isDefault && PREVIOUS_DEFAULT_NAMES.includes(row.name));
  if (stale.length === 0) return rows;

  await Promise.all(
    stale.map(async (row) => {
      // Matching the old name in the WHERE as well as the id means two requests
      // arriving together cannot fight over it, and a name somebody has since
      // changed by hand is not overwritten.
      await db
        .update(circles)
        .set({ name: COMMUNITY_NAME })
        .where(and(eq(circles.id, row.id), eq(circles.name, row.name)));
      row.name = COMMUNITY_NAME;
    }),
  );
  return rows;
}

/** The default circle as it stands, or null when nobody has needed it yet. */
async function findCommunity(): Promise<Circle | null> {
  // Ordered by id so that even if two requests once raced each other into
  // creating one, every later read agrees on which of them is the real one.
  const [row] = await db
    .select()
    .from(circles)
    .where(eq(circles.isDefault, true))
    .orderBy(asc(circles.id))
    .limit(1);
  if (!row) return null;
  const [upgraded] = await upgradeDefaultName([row]);
  return upgraded;
}

/**
 * Discover as it stands, for a caller who may not create it: somebody with no
 * account at all, reading the shop window. `communityCircle()` is the version
 * that makes one, and it is deliberately not this — a visitor's GET should never
 * be what writes a row, and on a deployment where nobody has logged in yet there
 * is simply nothing to show them.
 */
export async function defaultCircle(): Promise<Circle | null> {
  return findCommunity();
}

/**
 * The Discover circle, created with its categories the first time anybody asks.
 * Two members arriving at once is the ordinary case on a new deploy, so a lost
 * race is not an error: whichever insert landed first is the one everybody gets.
 *
 * Losing the race has to be *noticed*, though, which it was not. Nothing in the
 * table stops a second row from being marked default, so the insert never
 * conflicts and never throws — both racers would have kept the circle they made,
 * and every check downstream asks whether a member is in *a* default circle
 * rather than *the* one, so neither would have been repaired afterwards. Two
 * circles called Discover, and the members in them invisible to each other with
 * nothing on screen to explain it. So the row is read back the moment it exists
 * and the loser takes its own circle out again, before it has been seeded, and
 * before anybody can be joined to it.
 */
export async function communityCircle(): Promise<Circle> {
  const existing = await findCommunity();
  if (existing) return existing;

  try {
    const [created] = await db
      .insert(circles)
      .values({
        ownerId: COMMUNITY_OWNER_ID,
        ownerName: COMMUNITY_OWNER_NAME,
        name: COMMUNITY_NAME,
        description: COMMUNITY_DESCRIPTION,
        icon: COMMUNITY_ICON,
        // Open to All: the one door nobody has to answer, which is what a circle
        // everybody is already in should look like to anybody checking.
        privacy: "public",
        isDefault: true,
      })
      .returning();

    const canonical = await findCommunity();
    if (canonical && canonical.id !== created.id) {
      await db.delete(circles).where(eq(circles.id, created.id));
      return canonical;
    }

    await seedCategories(created.id, COMMUNITY_CATEGORIES);
    return created;
  } catch {
    const raced = await findCommunity();
    if (raced) return raced;
    throw new Error("Could not set up the Discover circle.");
  }
}

/**
 * Puts a member in Discover, making it first if it does not exist. Idempotent —
 * `joinCircle()` does nothing when they are already in — so callers may run it
 * whenever they like without checking first.
 *
 * Called from `accessOf()`, which is to say on every request that reaches a
 * route — but only when the membership read it already did says they are not in
 * Discover yet, so it does real work exactly once per member. That is what lets
 * a brand new account post the moment it is admitted, rather than being held at
 * the join-a-circle door until it has been to the Circles tab.
 */
export async function ensureCommunityMembership(member: {
  id: string;
  name: string;
}): Promise<Circle> {
  const circle = await communityCircle();
  await joinCircle(circle.id, member);
  return circle;
}
