// netlify/lib/members.ts
// The people a member can pick from when they invite someone into a circle.
// Identity owns the accounts; this is the directory the app is allowed to show,
// built from members who have opened the app plus everyone who has ever shared
// something, so an established group has contacts from the first day.
import type { User } from "@netlify/identity";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db/index.js";
import { circleMembers, members } from "../../db/schema.js";
import { ITEM_TABLES, ITEM_TYPES, memberNameOf } from "./items.js";

export interface Contact {
  id: string;
  name: string;
}

/** Each member keeps their own row current; nothing here is ever written for anyone else. */
export async function registerMember(user: User) {
  await db
    .insert(members)
    .values({ id: user.id, name: memberNameOf(user), email: user.email ?? null })
    .onConflictDoUpdate({
      target: members.id,
      set: { name: memberNameOf(user), email: user.email ?? null, lastSeenAt: new Date() },
    });
}

/**
 * Records who brought somebody in, when they arrived on an invite. Anybody may
 * sign up, so `accessOf()` stamps `admitted_at` for an account that simply turned
 * up; this is the same stamp plus the one thing only an invite knows — whose link
 * it was — which is why accepting one still runs it.
 *
 * Admission is stamped once and never moved, so re-opening an old link on
 * another device does not reset the clock the trust rule is measured on.
 */
export async function admitMember(user: User, invitedById: string | null) {
  const name = memberNameOf(user);
  await db
    .insert(members)
    .values({
      id: user.id,
      name,
      email: user.email ?? null,
      admittedAt: new Date(),
      invitedById,
    })
    .onConflictDoUpdate({
      target: members.id,
      set: { name, email: user.email ?? null, lastSeenAt: new Date() },
    });
  await db
    .update(members)
    .set({ admittedAt: new Date(), invitedById })
    .where(and(eq(members.id, user.id), isNull(members.admittedAt)));
}

/**
 * Everyone the app knows about, by id and display name only — email addresses
 * stay server-side, the same way an invite's email never leaves the inviter.
 */
export async function directory(): Promise<Contact[]> {
  const [registered, circled, ...authored] = await Promise.all([
    db
      .select({ id: members.id, name: members.name, status: members.status })
      .from(members),
    db
      .selectDistinct({ id: circleMembers.memberId, name: circleMembers.memberName })
      .from(circleMembers),
    ...ITEM_TYPES.map((itemType) => {
      const table = ITEM_TABLES[itemType];
      return db.selectDistinct({ id: table.memberId, name: table.memberName }).from(table);
    }),
  ]);

  // A suspended account is not somebody to invite anywhere, so it leaves the
  // directory — including on the strength of anything it shared earlier.
  const suspended = new Set(
    registered.filter((row) => row.status === "suspended").map((row) => row.id),
  );

  // Registered rows win, because a member can change their display name and the
  // name frozen into an old shared item should not overrule it.
  const byId = new Map<string, string>();
  for (const row of [...registered, ...circled, ...authored.flat()]) {
    if (!row.id || byId.has(row.id) || suspended.has(row.id)) continue;
    byId.set(row.id, row.name || "A member");
  }

  return [...byId]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The directory as a lookup, for putting names on ids an owner sent us. */
export async function contactNames() {
  return new Map((await directory()).map((contact) => [contact.id, contact.name]));
}
