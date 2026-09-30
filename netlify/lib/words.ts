// netlify/lib/words.ts
// Word Explorer's own shapes. A word carries two lists — synonyms and antonyms —
// in one column each, one entry per line, the same way a book carries its quotes,
// and they travel over the API as arrays so the browser never splits strings.
//
// Language connections are different: they are rows, because a word may have none
// or many, each one names its own language, and any member who can see a word may
// add one. A connection is something another member knows, not an edit to the word.
import type { User } from "@netlify/identity";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { wordConnections, words } from "../../db/schema.js";
import { memberNameOf, text, visibleTo } from "./items.js";
import { blockedIdsFor } from "./moderation.js";

/** Long enough for a well-explored word, short enough to keep a row bounded. */
export const MAX_WORD_LIST = 20;
export const MAX_CONNECTIONS_PER_WORD = 24;
export const MAX_LANGUAGE_NAME = 40;
export const MAX_TERM = 80;
export const MAX_CONNECTION_NOTE = 280;

export type WordRow = typeof words.$inferSelect;
export type WordConnectionRow = typeof wordConnections.$inferSelect;

type WordListColumns = { synonyms: string | null; antonyms: string | null };

/** Accepts either the array the browser sends or the newline-joined column value. */
export function wordListFrom(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split("\n") : [];
  const entries: string[] = [];
  for (const candidate of raw) {
    const entry = text(candidate).replace(/\s+/g, " ").slice(0, MAX_TERM);
    // Case-insensitively unique: "Lavish" and "lavish" are the same synonym.
    if (entry && !entries.some((kept) => kept.toLowerCase() === entry.toLowerCase())) {
      entries.push(entry);
    }
  }
  return entries.slice(0, MAX_WORD_LIST);
}

export function joinWordList(entries: string[]) {
  return entries.length > 0 ? entries.join("\n") : null;
}

/**
 * The one place a PATCH decides what to do with a list: a body that names it
 * replaces it — which is how the last synonym is removed — and a body that says
 * nothing about it leaves what is already stored alone.
 */
export function wordListPatch(body: Record<string, unknown>, field: string, existing: string | null) {
  return field in body ? joinWordList(wordListFrom(body[field])) : existing;
}

/** The shape the API returns: the stored row with its two lists as arrays. */
export function wordResponse<T extends WordListColumns>(row: T) {
  return {
    ...row,
    synonyms: wordListFrom(row.synonyms),
    antonyms: wordListFrom(row.antonyms),
  };
}

/**
 * Every listed word's connections, in one read.
 *
 * `blocked` is the set of members either side of a block with the reader. A block
 * has to reach contributions as well as shares, or somebody blocked would still be
 * adding to a word both members can see.
 */
export async function connectionsOf(wordIds: number[], blocked?: Set<string>) {
  const byWord = new Map<number, WordConnectionRow[]>();
  if (wordIds.length === 0) return byWord;

  const rows = await db
    .select()
    .from(wordConnections)
    .where(inArray(wordConnections.wordId, wordIds))
    .orderBy(asc(wordConnections.id));

  for (const row of rows) {
    if (blocked?.has(row.memberId)) continue;
    const list = byWord.get(row.wordId);
    if (list) list.push(row);
    else byWord.set(row.wordId, [row]);
  }
  return byWord;
}

/** Decorates a listing of words with the connections members have added to them. */
export async function withConnections<T extends { id: number }>(
  rows: T[],
  user: User | null = null,
) {
  const byWord = await connectionsOf(
    rows.map((row) => row.id),
    await blockedIdsFor(user),
  );
  return rows.map((row) => ({ ...row, connections: byWord.get(row.id) ?? [] }));
}

/**
 * The word behind an id, but only when this member is allowed to see it. Adding a
 * connection is not an edit of the word, so it is not restricted to the author —
 * it is restricted to the people the word reaches, the same rule that decides who
 * may save it.
 */
export async function visibleWord(id: number, user: User | null) {
  const [row] = await db
    .select()
    .from(words)
    .where(and(eq(words.id, id), visibleTo(words, user, "word")));
  return row ?? null;
}

export function connectionFrom(body: Record<string, unknown>) {
  const language = text(body.language).replace(/\s+/g, " ").slice(0, MAX_LANGUAGE_NAME);
  const term = text(body.term).replace(/\s+/g, " ").slice(0, MAX_TERM);
  const note = text(body.note).slice(0, MAX_CONNECTION_NOTE);
  if (!language || !term) return null;
  return { language, term, note: note || null };
}

/**
 * The connections typed on the add-word form itself, alongside the meaning: a
 * member offering "asthi" usually already knows the Greek and the German for it,
 * so the word arrives with them rather than being opened again afterwards.
 *
 * A row missing either half is dropped, the same pair twice is one, and the
 * ceiling is the one a word keeps anyway.
 */
export function connectionsFrom(value: unknown) {
  if (!Array.isArray(value)) return [];
  const offered: { language: string; term: string; note: string | null }[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const values = connectionFrom(entry as Record<string, unknown>);
    if (!values) continue;
    const already = offered.some(
      (kept) =>
        kept.language.toLowerCase() === values.language.toLowerCase() &&
        kept.term.toLowerCase() === values.term.toLowerCase(),
    );
    if (!already) offered.push(values);
  }
  return offered.slice(0, MAX_CONNECTIONS_PER_WORD);
}

/**
 * Adds each of them to a word just created, and hands back the rows so the
 * browser has the word complete without a reload.
 */
export async function addConnections(
  wordId: number,
  offered: { language: string; term: string; note: string | null }[],
  user: User,
) {
  const rows: WordConnectionRow[] = [];
  for (const values of offered) {
    const row = await addConnection(wordId, values, user);
    if (row) rows.push(row);
  }
  return rows;
}

/**
 * Adds a connection, or hands back the one already there. Two members adding
 * "Greek / osteon" at the same moment end up with one row, the way two members
 * adding the same subcategory do.
 */
export async function addConnection(
  wordId: number,
  values: { language: string; term: string; note: string | null },
  user: User,
): Promise<WordConnectionRow | null> {
  const existing = await db
    .select()
    .from(wordConnections)
    .where(eq(wordConnections.wordId, wordId));
  const same = existing.find(
    (row) =>
      row.language.toLowerCase() === values.language.toLowerCase() &&
      row.term.toLowerCase() === values.term.toLowerCase(),
  );
  if (same) return same;
  if (existing.length >= MAX_CONNECTIONS_PER_WORD) return null;

  const [created] = await db
    .insert(wordConnections)
    .values({ wordId, ...values, memberId: user.id, memberName: memberNameOf(user) })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  // Lost a race against somebody adding the same connection; theirs is fine.
  const [settled] = await db
    .select()
    .from(wordConnections)
    .where(
      and(
        eq(wordConnections.wordId, wordId),
        eq(wordConnections.language, values.language),
        eq(wordConnections.term, values.term),
      ),
    );
  return settled ?? null;
}

/** A deleted word takes its connections with it: they only mean anything on it. */
export async function clearConnections(wordId: number) {
  await db.delete(wordConnections).where(eq(wordConnections.wordId, wordId));
}
