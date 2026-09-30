// netlify/lib/lyrics.ts
// The words of a song, and the same words written out in another script.
//
// A family that sings together does not all read the same script: the aunt who knows
// the song by heart writes it in Kannada, her nephew reads only Devanagari, and
// somebody else reads neither and would rather have the sounds in English letters. So a
// song carries one set of words — typed by the member who shared the recording, in
// whatever script they think in — and the app writes those words out in the script a
// reader asks for.
//
// Every one of them is a transliteration, and that is the whole of what this file
// does. A transliteration is a character mapping rather than a judgement: /ka/ is ಕ is
// క is क is `ka`. The mapping tables do them, exactly and at once, and they know the
// orthographic conventions each script layers on top of the mapping — vowel length,
// gemination, nasalisation — which is the part a naive swap gets wrong. English is that
// same table run the other way, for the reader who has been handed a verse in letters
// they do not read.
//
// Nothing here translates. Saying what a verse *means* in another language is a reading
// of it, and a reading is not what a member tapping "ಕನ್ನಡ" under a recording is asking
// for — they want to sing along. So the words are only ever re-lettered, no model is
// involved at any point, and a script that cannot be mapped exactly is simply not
// offered rather than approximated.
//
// A mapping needs to know what it is mapping *from*, and that is the one thing lyrics do
// not always say. Words in an Indic script declare themselves — the letters are the
// declaration — but `vakratuNDa mahaakaaya` could be four different conventions, and
// guessing between them is how `aa` becomes the wrong vowel. So the author is asked, once,
// on the form, and `songs.lyrics_scheme` remembers the answer. Romanised lyrics with a
// scheme convert by table like everything else; romanised lyrics without one cannot be
// converted at all, and the author is told so rather than shown a guess.
//
// Two rules shape everything here, and they are the same rule twice:
//
//   The words are the member's own. Nothing in this file fetches, recalls or
//   completes the lyrics of a song. What is converted is text that is already in the
//   database, and a song whose author typed no lyrics has no lyrics — the app says so
//   rather than inventing them.
//
//   A rendering is a convenience. Every failure path is null, and a song that cannot
//   be rendered simply keeps the words as they were typed.
//
// A rendering is cached against a digest of the words it was made from, so editing
// the lyrics quietly retires the old renderings instead of leaving a reader looking
// at a verse that is no longer there.
import { createHash } from "node:crypto";
import type { User } from "@netlify/identity";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { songLyricScripts, songs } from "../../db/schema.js";
import {
  type ConversionEngine,
  type IndicScript,
  type RomanScheme,
  type TransliterationSource,
  type TransliterationTarget,
  SCRIPT_LIST,
  detectScript,
  isIndicScript,
  isRomanScheme,
  transliterate,
} from "./aksharamukha.js";
import { optionalText, text, visibleTo } from "./items.js";

/** Long enough for a song, short enough that one request renders it in one answer. */
export const MAX_LYRICS = 6_000;
export const MAX_LYRICS_LANGUAGE = 60;

/**
 * The scripts a member can ask for. Every one of them is the same words in other
 * letters — the sounds are unchanged, so somebody who cannot read Kannada can still
 * sing along — and none of them is a translation: this app re-letters what the author
 * typed and never says what it means.
 *
 * There are more of them than there used to be because the choice is the author's now.
 * When the app decided, four was the whole list anybody would ever see; when the member
 * who shares a stotra ticks the scripts their own family reads, a list that stops at
 * three Indian languages is a list that leaves people out. So the offer is every script
 * the mapping tables know — the ten this group is likeliest to write in first, then the
 * rest — and each song shows only the handful its author asked for. The list is built
 * from `SCRIPT_LIST` rather than written out again, so a script added to the converter
 * is on the form the same day.
 *
 * English is the one that runs the mapping the other way: a member who has pasted a
 * stotra in a script they do not read wants the sounds of it in the alphabet they do,
 * and that is the same lookup table with the ends swapped rather than anything new.
 * IAST is what it writes, because among the four roman conventions it is the one meant
 * for reading rather than for typing — `vakratuṇḍa mahākāya` rather than `vakratuNDa
 * mahaakaaya` — and the diacritics can be ignored by anybody who only wants to sing
 * along. It is the one entry whose id is not a script's, which is why the type below
 * says so rather than being read off the array.
 *
 * `script` names what the mapping tables write each one in, and it is what every
 * request is routed by. There is nothing else to route to.
 */
export const LYRIC_SCRIPTS: readonly {
  id: LyricScript;
  label: string;
  native: string;
  script: TransliterationTarget;
}[] = [
  ...SCRIPT_LIST.map((entry) => ({ ...entry, script: entry.id as TransliterationTarget })),
  { id: "english", label: "English letters", native: "Aa", script: "iast" },
];

/**
 * A script a member can ask their words to be readable in: any script the converter
 * writes, or the English letters that are the same tables run the other way.
 */
export type LyricScript = IndicScript | "english";

export function isLyricScript(value: unknown): value is LyricScript {
  return isIndicScript(value) || value === "english";
}

function scriptById(id: LyricScript) {
  return LYRIC_SCRIPTS.find((script) => script.id === id)!;
}

/**
 * The script one of these writes. Every option has one, because every option is a
 * mapping — there is no second converter to route anything to.
 */
function scriptFor(id: LyricScript): TransliterationTarget {
  return scriptById(id).script;
}

/** The lyrics a form sent, bounded; null when the member typed none. */
export function lyricsFrom(value: unknown) {
  const written = text(value).slice(0, MAX_LYRICS);
  return written.length > 0 ? written : null;
}

export function lyricsLanguageFrom(value: unknown) {
  return optionalText(text(value).slice(0, MAX_LYRICS_LANGUAGE));
}

/**
 * Which roman convention the words were typed in, when the form said. Anything that is
 * not one of the four is null, and null is the ordinary answer: lyrics written in an
 * Indic script need no declaration, because the letters are the declaration.
 */
export function lyricsSchemeFrom(value: unknown): RomanScheme | null {
  return isRomanScheme(value) ? value : null;
}

/**
 * The scripts a form asked the words to be readable in, stored one per line the way a
 * post keeps its languages and a word keeps its synonyms.
 *
 * Three answers, and the third is why this cannot be a list of ids alone. Undefined
 * when the body said nothing, so an edit that only changes the title leaves the choice
 * alone. An empty string when the author was asked and said no, which is a decision and
 * has to be storable. And the joined list otherwise.
 *
 * The empty string is deliberately not null: null is reserved for the songs shared
 * before the question existed, which are offered every script their words allow. An
 * author who said no would otherwise be indistinguishable from one who was never asked.
 */
export function readIntoFrom(body: Record<string, unknown>) {
  if (!("readInto" in body)) return undefined;
  const raw = Array.isArray(body.readInto) ? body.readInto : text(body.readInto).split("\n");
  const chosen: LyricScript[] = [];
  for (const entry of raw) {
    const id = text(entry).toLowerCase();
    if (isLyricScript(id) && !chosen.includes(id)) chosen.push(id);
  }
  return chosen.join("\n");
}

/**
 * The stored list, back as the ids the browser reads — and null for a song nobody was
 * ever asked about, which is what tells the reader's side to fall back to offering
 * whatever the words can be converted into.
 */
export function readIntoOf(stored: string | null | undefined): LyricScript[] | null {
  if (stored === null || stored === undefined) return null;
  return stored
    .split("\n")
    .map((line) => line.trim())
    .filter(isLyricScript);
}

/**
 * What these words are written in, as far as anything can tell — the script they are in
 * when they are in one, and otherwise whichever roman convention their author declared.
 *
 * Null is the case nothing can convert: lyrics in Latin letters with nobody having said
 * what convention they follow. There is genuinely no exact answer then — `aa` may be a
 * long vowel or two short ones depending on the scheme — and an approximation is not
 * something this app offers, so no script is put on the buttons and the author is told
 * that answering the question on the form is what unlocks them.
 */
function sourceOf(lyrics: string, scheme: RomanScheme | null): TransliterationSource | null {
  return detectScript(lyrics) ?? scheme;
}

/**
 * Names the exact words a rendering was made from. When the author edits the lyrics
 * the digest stops matching and the rendering is treated as gone, which is the whole
 * reason it is stored: a reader should never be shown a verse the song no longer has.
 */
export function digestOf(lyrics: string) {
  return createHash("sha256").update(lyrics).digest("hex").slice(0, 32);
}

export type LyricScriptRow = typeof songLyricScripts.$inferSelect;

/**
 * One rendering on its way to the browser. The `engine` column stays out of it: every
 * rendering this app makes now is an exact mapping, so saying so on screen would be
 * saying the same thing under every panel, and the rows that were not — a model's
 * attempt, from when this also translated — never reach a reader at all. See
 * `stillBest()`.
 */
export function lyricScriptResponse(row: LyricScriptRow) {
  return {
    script: row.script as LyricScript,
    body: row.body,
    createdAt: row.createdAt,
  };
}

export type LyricScriptResponse = ReturnType<typeof lyricScriptResponse>;

/**
 * Whether a stored rendering is still the best one available for these words.
 *
 * There are three ways it stops being that. The words were edited, which the digest
 * catches — the whole reason the digest is stored. Or it was written by a model, back
 * when Hindi was on offer and romanised lyrics were handed to the gateway to be guessed
 * at: those rows are approximations, nothing here makes them any more, and an exact one
 * is a table lookup away, so they are retired rather than served for the rest of the
 * song's life. Or it is a rendering of a script that is no longer offered at all, which
 * is the same retirement by another name.
 */
function stillBest(row: LyricScriptRow, lyrics: string) {
  if (row.sourceDigest !== digestOf(lyrics)) return false;
  if (!isLyricScript(row.script)) return false;
  return row.engine !== "ai";
}

/**
 * The renderings of one song that still match its words. A rendering of lyrics that
 * have since been edited is left out rather than shown, so tapping that script again
 * remakes it from what the song says now.
 */
export async function lyricScriptsOf(song: {
  id: number;
  lyrics: string | null;
  lyricsScheme?: string | null;
}) {
  if (!song.lyrics) return [];
  const lyrics = song.lyrics;
  const rows = await db
    .select()
    .from(songLyricScripts)
    .where(eq(songLyricScripts.songId, song.id));
  return rows.filter((row) => stillBest(row, lyrics)).map(lyricScriptResponse);
}

/**
 * Adds `lyricScripts` to every row of a songs listing in one extra read, along with
 * `lyricScriptsAvailable` — which scripts can be made for these particular words, are
 * enabled for the Songs category, and were asked for by the author — and `readInto`,
 * the author's own list, which the edit form reads back.
 *
 * The availability list travels with the listing rather than being worked out in the
 * browser because the answer depends on which script the words are in, which is a
 * question about Unicode blocks and roman conventions that the server already knows how
 * to ask. It costs no query: it is derived from the lyrics on the row in hand.
 *
 * `enabled` is what the app admin has switched on, read once by the caller and passed
 * down rather than fetched here, so a listing of forty songs is still one settings read.
 *
 * `lyrics` is optional on the row type because a listing is decorated in layers and the
 * earlier ones widen the shape to "something with an id" — a row that arrives without
 * the words simply has no scripts to show.
 */
export async function withLyricScripts<
  T extends {
    id: number;
    lyrics?: string | null;
    lyricsScheme?: string | null;
    readInto?: string | null;
  },
>(rows: T[], enabled: LyricScript[]) {
  const bare = (row: T) => ({
    ...row,
    lyricScripts: [] as LyricScriptResponse[],
    lyricScriptsAvailable: [] as LyricScript[],
    readInto: readIntoOf(row.readInto),
  });

  const withWords = rows.filter((row) => row.lyrics);
  if (withWords.length === 0) return rows.map(bare);

  const found = await db
    .select()
    .from(songLyricScripts)
    .where(inArray(songLyricScripts.songId, withWords.map((row) => row.id)));

  const bySong = new Map<number, LyricScriptRow[]>();
  for (const row of found) {
    const list = bySong.get(row.songId);
    if (list) list.push(row);
    else bySong.set(row.songId, [row]);
  }

  return rows.map((row) => {
    if (!row.lyrics) return bare(row);
    const lyrics = row.lyrics;
    const scheme = lyricsSchemeFrom(row.lyricsScheme);
    const readInto = readIntoOf(row.readInto);
    const lyricScripts = (bySong.get(row.id) ?? [])
      .filter((found) => stillBest(found, lyrics))
      .map(lyricScriptResponse);
    return {
      ...row,
      lyricScripts,
      lyricScriptsAvailable: availableLyricScripts(lyrics, scheme, readInto, enabled),
      readInto,
    };
  });
}

/**
 * What these words can be exactly converted from, for this particular target, or null.
 *
 * Two things make it null, and they are different failures wearing the same face. The
 * words may be in Latin letters with no convention declared, where there is nothing to
 * map from. Or they may already be in the script being asked for, where there is nothing
 * to map to. Either way there is no conversion to offer, and the button is not drawn.
 */
function exactSourceFor(
  target: TransliterationTarget,
  lyrics: string,
  scheme: RomanScheme | null,
): TransliterationSource | null {
  const from = sourceOf(lyrics, scheme);
  if (from === null || from === target) return null;
  // English letters are only worth asking for when the words are in a script:
  // romanised lyrics are already in the alphabet being asked for, whichever of the
  // four conventions they follow, and re-spelling one convention as another is not
  // a question anybody has.
  if (!isIndicScript(target) && !isIndicScript(from)) return null;
  return from;
}

/**
 * Which scripts can be made for these words, are switched on for the Songs category,
 * and were asked for.
 *
 * Three filters, and they answer three different questions in a deliberate order.
 *
 * What the app admin has enabled bounds everything: the Songs category offers the
 * scripts this group reads, which is a setting rather than a constant precisely so that
 * adding Malayalam is a tick rather than a deploy. Nothing outside that list is ever put
 * in front of a reader, whatever an author ticked before it was narrowed.
 *
 * What the words allow is a fact about the text: a script they are already in is left
 * out because the answer is on screen above, English is left out of romanised lyrics for
 * the same reason, and romanised lyrics whose author has not said which convention they
 * follow can be converted into nothing at all, because there is no exact answer and an
 * inexact one is not something this app offers.
 *
 * What the author asked for is a decision, and it is theirs: `readInto` is the list they
 * ticked on the form, and a song shared before the form asked carries null, where every
 * enabled script its words allow stands.
 *
 * The buttons a reader sees are drawn from this, so a script that could only fail is
 * never offered — which is better than a button that answers "nothing came back" and
 * leaves the member wondering whether the app or the song is at fault.
 */
export function availableLyricScripts(
  lyrics: string,
  scheme: RomanScheme | null,
  readInto: LyricScript[] | null = null,
  enabled: LyricScript[] | null = null,
) {
  // Worked out once rather than once per script. There are fifty of them now, this
  // runs for every song in a listing, and reading 6,000 characters fifty times over to
  // reach the same answer fifty times is the kind of cost that only shows up in
  // production.
  const from = sourceOf(lyrics, scheme);
  // Nothing to map from: Latin letters whose author never said which convention they
  // follow. No script can be made, so none is offered.
  if (from === null) return [] as LyricScript[];

  return LYRIC_SCRIPTS.filter((entry) => {
    // Not switched on for the Songs category at all. Null is only ever "this caller
    // is not asking about a configured surface"; a configured one always sends a list,
    // and an empty one really does mean no scripts.
    if (enabled !== null && !enabled.includes(entry.id)) return false;
    // Not asked for. Null is "nobody was ever asked", which is not the same as "no".
    if (readInto !== null && !readInto.includes(entry.id)) return false;
    // The letters the words are already in are not on offer at any price: there is
    // nothing to convert, and the answer is on screen above the buttons.
    if (from === entry.script) return false;
    // Latin letters out of Latin letters is not a conversion, whichever conventions
    // the two ends follow.
    if (!isIndicScript(entry.script) && !isIndicScript(from)) return false;
    return true;
  }).map((entry) => entry.id);
}

/**
 * Whether this script can be made for these words at all. Asked per song rather than
 * per site: a transliteration of words whose script or convention is known is a
 * character mapping, which needs no gateway and no key, so it works on every
 * deployment. Words typed in Latin letters with no convention declared are the one
 * case nothing can convert.
 */
export function lyricScriptAvailableFor(
  script: LyricScript,
  lyrics: string,
  scheme: RomanScheme | null,
  readInto: LyricScript[] | null = null,
  enabled: LyricScript[] | null = null,
) {
  return availableLyricScripts(lyrics, scheme, readInto, enabled).includes(script);
}

/**
 * Whether asking for this script is asking for what is already on screen. Its own
 * export because the route says so plainly rather than letting it look like a failure:
 * "these words are already written in that script" is a different sentence from "that
 * could not be written".
 */
export function sameScriptAs(script: LyricScript, lyrics: string) {
  const target = scriptFor(script);
  const written = detectScript(lyrics);
  // English letters asked of words that are already in English letters. Whichever
  // convention they follow, re-spelling one as another is not what the button says
  // it does, so it counts as the same answer already being on screen.
  if (!isIndicScript(target)) return written === null;
  return written === target;
}

/**
 * Renders one song's lyrics into one script and caches the answer against the words
 * it was made from.
 *
 * Every script is a character mapping, so this is a table lookup in this process and
 * comes back at once — including for romanised lyrics, as long as their author said
 * which convention they typed in, which is the whole of what a mapping needs in order
 * to be exact.
 *
 * Answers null when the mapping cannot be made — words in Latin letters with no
 * convention declared, or an unreachable fallback service — so a script that cannot
 * be written is quietly unavailable rather than approximated by something else.
 */
export async function renderLyricScript(
  song: {
    id: number;
    lyrics: string;
    lyricsLanguage: string | null;
    lyricsScheme?: string | null;
  },
  script: LyricScript,
) {
  const source = song.lyrics.slice(0, MAX_LYRICS);
  const target = scriptFor(script);
  const scheme = lyricsSchemeFrom(song.lyricsScheme);

  const from = exactSourceFor(target, source, scheme);
  if (!from) return null;

  const converted = await transliterate({ source, from, to: target });
  if (!converted) return null;

  return save(song, script, converted, "aksharamukha");
}

/**
 * Stores one rendering against the words it came from, so the next reader pays nothing.
 * `engine` is written on every row and is always the mapping table now — it survives
 * because rows written before this app stopped translating say something else, and
 * saying so is how those get retired rather than served.
 */
async function save(
  song: { id: number; lyrics: string },
  script: LyricScript,
  body: string,
  engine: ConversionEngine,
) {
  const digest = digestOf(song.lyrics);
  const [saved] = await db
    .insert(songLyricScripts)
    .values({ songId: song.id, script, body, sourceDigest: digest, engine })
    .onConflictDoUpdate({
      target: [songLyricScripts.songId, songLyricScripts.script],
      set: { body, sourceDigest: digest, engine, createdAt: new Date() },
    })
    .returning();
  return saved ?? null;
}

/**
 * The rendering already stored for this script, when it is still the best one for the
 * words as they are now. See `stillBest()`.
 */
export async function cachedLyricScript(
  song: { id: number; lyrics: string; lyricsScheme?: string | null },
  script: LyricScript,
) {
  const [row] = await db
    .select()
    .from(songLyricScripts)
    .where(and(eq(songLyricScripts.songId, song.id), eq(songLyricScripts.script, script)));
  return row && stillBest(row, song.lyrics) ? row : null;
}

/**
 * What one song says about its scripts: the ones already written for the words as they
 * stand, the ones that could be, and the list its author actually asked for. All three
 * travel with a single song a route just wrote, the same shape `withLyricScripts` puts
 * on every row of a listing, so the browser reads one thing wherever a song came from.
 */
export async function lyricReadingOf(
  song: {
    id: number;
    lyrics: string | null;
    lyricsScheme?: string | null;
    readInto?: string | null;
  },
  enabled: LyricScript[],
) {
  const scheme = lyricsSchemeFrom(song.lyricsScheme);
  const readInto = readIntoOf(song.readInto);
  return {
    lyricScripts: await lyricScriptsOf(song),
    lyricScriptsAvailable: song.lyrics
      ? availableLyricScripts(song.lyrics, scheme, readInto, enabled)
      : [],
    readInto,
  };
}

/**
 * Writes every script the author asked for, as soon as the words are saved.
 *
 * Worth doing because a conversion is a table lookup in this process: a handful of them
 * together cost less than the database write that follows, so a recording arrives with
 * its Kannada, Tamil and Devanagari already on it and the buttons under it are instant
 * for the first reader rather than only the second. Only the chosen scripts are warmed,
 * because the list is long now and nobody should pay for a conversion nobody will read.
 *
 * A song whose author was never asked warms the enabled list instead of nothing, which
 * is a short list by design and is exactly what a reader will be offered under it.
 *
 * Nothing here is allowed to matter: a failure leaves the script unwritten, which is
 * the state it would have been in anyway, so the caller does not await a result and
 * never sees an error. Sharing a recording must not fail because a conversion did.
 */
export async function warmLyricScripts(
  song: {
    id: number;
    lyrics: string | null;
    lyricsLanguage: string | null;
    lyricsScheme?: string | null;
    readInto?: string | null;
  },
  enabled: LyricScript[],
) {
  if (!song.lyrics) return;
  const lyrics = song.lyrics;
  const scheme = lyricsSchemeFrom(song.lyricsScheme);
  const asked = readIntoOf(song.readInto);
  const wanted = availableLyricScripts(lyrics, scheme, asked, enabled);
  await Promise.all(
    wanted.map((script) => renderLyricScript({ ...song, lyrics }, script).catch(() => null)),
  );
}

/** Called when a recording is deleted for everyone: its renderings go with it. */
export async function clearLyricScripts(songId: number) {
  await db.delete(songLyricScripts).where(eq(songLyricScripts.songId, songId));
}

/**
 * The song behind an id, but only when it reaches this member. Asking to read the
 * words in another script is reading rather than editing, so the test is the one
 * that decides who may hear the song, not the one that decides who may change it.
 */
export async function visibleSong(id: number, user: User | null) {
  const [row] = await db
    .select()
    .from(songs)
    .where(and(eq(songs.id, id), visibleTo(songs, user, "song")));
  return row ?? null;
}
