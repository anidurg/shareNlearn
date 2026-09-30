// netlify/lib/experiences.ts
// What happened when somebody actually tried it. A recipe and a remedy are the two
// kinds of share that get made rather than read, and the useful part often arrives
// after the fact: the substitution that worked, the step a family adds, the warning
// that it needs an hour longer than it says.
//
// Adding one is not an edit of the share, so it is not restricted to the author —
// any member the share reaches may add what they know, the same rule a word's
// language connections follow. Whoever wrote a note may take it back, and so may
// the author of the share it sits on.
import type { User } from "@netlify/identity";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { itemExperiences, recipes, remedies } from "../../db/schema.js";
import { memberNameOf, text, visibleTo } from "./items.js";
import { blockedIdsFor } from "./moderation.js";

/** The two kinds of share a member can come back and report on. */
export const EXPERIENCE_ITEM_TYPES = ["recipe", "remedy"] as const;
export type ExperienceItemType = (typeof EXPERIENCE_ITEM_TYPES)[number];

/**
 * "experience" is "I made this and here is how it went", "tip" is advice for the
 * next person, and "extra" is anything else a member added — the note that does not
 * fit either, which a remedy attracts more than a recipe does.
 */
export const EXPERIENCE_KINDS = ["experience", "tip", "extra"] as const;
export type ExperienceKind = (typeof EXPERIENCE_KINDS)[number];

export const MAX_EXPERIENCE_BODY = 1200;
export const MAX_EXPERIENCES_PER_ITEM = 60;

export type ExperienceRow = typeof itemExperiences.$inferSelect;

export function isExperienceItemType(value: unknown): value is ExperienceItemType {
  return typeof value === "string" && (EXPERIENCE_ITEM_TYPES as readonly string[]).includes(value);
}

export function experienceKindOf(value: unknown): ExperienceKind {
  return (EXPERIENCE_KINDS as readonly string[]).includes(String(value))
    ? (value as ExperienceKind)
    : "experience";
}

/** What the form sends, trimmed and bounded; null when nobody typed anything. */
export function experienceFrom(body: Record<string, unknown>) {
  const written = text(body.body).slice(0, MAX_EXPERIENCE_BODY);
  if (!written) return null;
  return { kind: experienceKindOf(body.kind), body: written };
}

/**
 * The recipe or remedy behind an id, but only when this member is allowed to see
 * it. Adding a note is not an edit, so the test is the one that decides who may
 * save the share, not the one that decides who may change it.
 */
export async function visibleShare(itemType: ExperienceItemType, id: number, user: User | null) {
  if (itemType === "recipe") {
    const [row] = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, id), visibleTo(recipes, user, "recipe")));
    return row ?? null;
  }
  const [row] = await db
    .select()
    .from(remedies)
    .where(and(eq(remedies.id, id), visibleTo(remedies, user, "remedy")));
  return row ?? null;
}

/**
 * Adds a note, oldest first as they will be read. Answers null once an item has as
 * many as it can hold, so a single share cannot grow without limit.
 */
export async function addExperience(
  itemType: ExperienceItemType,
  itemId: number,
  values: { kind: ExperienceKind; body: string },
  user: User,
): Promise<ExperienceRow | null> {
  const already = await experiencesOf(itemType, itemId);
  if (already.length >= MAX_EXPERIENCES_PER_ITEM) return null;

  const [created] = await db
    .insert(itemExperiences)
    .values({
      itemType,
      itemId,
      ...values,
      memberId: user.id,
      memberName: memberNameOf(user),
    })
    .returning();
  return created ?? null;
}

/** One item's notes, in the order they were added. */
export async function experiencesOf(
  itemType: ExperienceItemType,
  itemId: number,
  user: User | null = null,
) {
  return (
    (await experiencesByItem(itemType, [itemId], await blockedIdsFor(user))).get(itemId) ?? []
  );
}

/** Every listed item's notes, in one query. */
export async function experiencesByItem(
  itemType: ExperienceItemType,
  itemIds: number[],
  blocked?: Set<string>,
) {
  const byItem = new Map<number, ExperienceRow[]>();
  if (itemIds.length === 0) return byItem;

  const rows = await db
    .select()
    .from(itemExperiences)
    .where(
      and(eq(itemExperiences.itemType, itemType), inArray(itemExperiences.itemId, itemIds)),
    )
    .orderBy(asc(itemExperiences.id));

  for (const row of rows) {
    // A block covers what somebody wrote under another member's recipe as much as
    // what they shared themselves.
    if (blocked?.has(row.memberId)) continue;
    const list = byItem.get(row.itemId);
    if (list) list.push(row);
    else byItem.set(row.itemId, [row]);
  }
  return byItem;
}

/** Adds `experiences` to every row of a listing, so a card can count them. */
export async function withExperiences<T extends { id: number }>(
  itemType: ExperienceItemType,
  rows: T[],
  user: User | null = null,
) {
  const byItem = await experiencesByItem(
    itemType,
    rows.map((row) => row.id),
    await blockedIdsFor(user),
  );
  return rows.map((row) => ({ ...row, experiences: byItem.get(row.id) ?? [] }));
}

/** Called when a share is deleted for everyone: what members added goes with it. */
export async function clearItemExperiences(itemType: ExperienceItemType, itemId: number) {
  await db
    .delete(itemExperiences)
    .where(and(eq(itemExperiences.itemType, itemType), eq(itemExperiences.itemId, itemId)));
}
