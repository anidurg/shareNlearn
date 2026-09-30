// netlify/lib/settings.ts
// The handful of things the app admin decides for the whole group, and the one that
// exists so far: which scripts the Songs category offers a reader.
//
// The list used to be a constant in the code, which meant that a circle who wanted
// Malayalam wanted a deploy. It is a row now, and the shape of the decision is the
// point: an admin ticks a script, everybody's songs offer it that afternoon, and a
// script added to the converter is available to be enabled the day it lands rather
// than the day somebody remembers to widen an array.
//
// Two rules, both of which the caller gets for free.
//
//   A key nobody has saved answers with its default. A deployment where no admin has
//   ever opened the panel behaves exactly as the app did before this file existed, so
//   there is no seeding step and nothing to go wrong on a fresh site.
//
//   Anything stored is re-validated on the way out. `isLyricScript()` filters the list
//   every time it is read, so a script removed from the converter simply stops being
//   offered rather than throwing somewhere downstream, and a row hand-edited into
//   nonsense degrades to the default rather than to an empty Songs page.
//
// Nothing here is memoised. A setting is read a few times per request at most, it is
// one indexed row, and an admin who saves a change and reloads should see the change —
// a cache measured in minutes is exactly how somebody comes to believe the panel is
// broken.
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { appSettings } from "../../db/schema.js";
import { isLyricScript, type LyricScript } from "./lyrics.js";
import { text } from "./items.js";

/** The key the Songs script list is stored under. */
export const SONG_SCRIPTS_KEY = "songs.scripts";

/**
 * What the Songs category offers where no admin has said otherwise: the scripts this
 * group actually writes in. Deliberately short — a reader looking at five links picks
 * one, and a reader looking at fifty picks none — and deliberately not the whole of
 * what the converter knows, which is what the panel is for.
 */
export const DEFAULT_SONG_SCRIPTS: readonly LyricScript[] = [
  "kannada",
  "devanagari",
  "telugu",
  "tamil",
  "malayalam",
];

/** The stored text for one key, or null when nobody has ever saved it. */
async function read(key: string) {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key));
  return row?.value ?? null;
}

/**
 * Turns a stored or submitted list into script ids: one per line, trimmed, unknown
 * entries dropped and duplicates collapsed. The same parse both ways round, so what an
 * admin can save is exactly what a reader can be offered.
 */
export function scriptListFrom(value: unknown): LyricScript[] {
  const raw = Array.isArray(value) ? value : text(value).split("\n");
  const chosen: LyricScript[] = [];
  for (const entry of raw) {
    const id = text(entry).trim().toLowerCase();
    if (isLyricScript(id) && !chosen.includes(id)) chosen.push(id);
  }
  return chosen;
}

/**
 * The scripts the Songs category offers, as configured — falling back to the default
 * when no admin has saved a list, and when the saved one has been emptied of everything
 * the converter still recognises.
 *
 * An admin *can* deliberately save an empty list, and that is a real answer meaning
 * "offer no scripts at all", so it is honoured: the fallback is for the absence of a
 * row, not for a row that says nothing.
 */
export async function songScripts(): Promise<LyricScript[]> {
  const stored = await read(SONG_SCRIPTS_KEY);
  if (stored === null) return [...DEFAULT_SONG_SCRIPTS];
  return scriptListFrom(stored);
}

/**
 * Saves the Songs script list. Stored one per line, the shape every other list in this
 * app uses, and returns what was actually kept so the panel shows the admin the list
 * the app will now use rather than the one they submitted.
 */
export async function setSongScripts(chosen: unknown, memberId: string) {
  const list = scriptListFrom(chosen);
  const value = list.join("\n");
  await db
    .insert(appSettings)
    .values({ key: SONG_SCRIPTS_KEY, value, updatedById: memberId })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedById: memberId, updatedAt: new Date() },
    });
  return list;
}
