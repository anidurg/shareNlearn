// netlify/lib/translations.ts
// A post's details, read in another set of letters.
//
// A circle that invents Travelogue or Stotras writes in whichever script comes
// naturally to whoever is writing, and the group reading it does not all read the
// same one. So the author says which scripts the post should be readable in, and the
// details are written out in each of them when somebody actually asks.
//
// Only the letters change. Writing the same words in another script is a character
// mapping: /ka/ is ಕ is క is क, and the mapping tables settle it in the time one
// request takes, knowing the orthographic conventions each script layers on top —
// vowel length, gemination, nasalisation — which is the part a naive swap gets wrong.
// A stotra keeps every syllable it had, which is what somebody who wants to sing it
// needs.
//
// What this file deliberately does not do is say what the words *mean* in another
// language. That is a reading rather than a mapping, only a model can do it, and a
// paraphrase of somebody's post presented under their name is not what a reader
// tapping "ಕನ್ನಡ" is asking for. So no model is involved at any point, nothing here
// needs the AI Gateway, and a conversion that cannot be made exactly is simply not
// offered.
//
// The rest is the same as the lyrics side:
//
//   The words are the member's own. Nothing is added to them, nothing is explained,
//   and nothing that was not typed by their author appears under their name.
//
//   A conversion is a convenience, never a dependency. Every failure path is null,
//   and a post whose conversion cannot be made simply reads in the script it was
//   written in. Details in Latin letters have nothing to map from — nobody can tell
//   romanised Sanskrit from an English paragraph by looking — so those are offered
//   nothing rather than guessed at.
//
// A conversion is cached against a digest of the details it came from, so editing
// the post retires the old ones rather than leaving a reader looking at a paragraph
// that is no longer there.
import { createHash } from "node:crypto";
import type { User } from "@netlify/identity";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { postTranslations, posts } from "../../db/schema.js";
import {
  type ConversionEngine,
  type IndicScript,
  type TransliterationTarget,
  SCRIPT_LIST,
  detectScript,
  isIndicScript,
  transliterateDetected,
} from "./aksharamukha.js";
import { text, visibleTo } from "./items.js";

/** Long enough for a travelogue, short enough to come back in one answer. */
export const MAX_TRANSLATION_SOURCE = 6_000;

/**
 * The ways a post can be offered, in the order the form and the links draw them.
 *
 * Every one of them keeps the words and changes only the letters, and `script` names
 * what the mapping tables write them in. There is no second kind on this list any
 * more: a post is re-lettered or it is left alone.
 *
 * It is built from the converter's own table rather than written out again, so the
 * scripts a post can be read in and the scripts a song's words can be read in are the
 * same list by construction — a member who ticked Sharada under a recording is not
 * told it does not exist under a post.
 *
 * English letters is the same mapping run the other way, and it is the one a member
 * asks for when they have pasted a verse in a script they cannot read: it says the
 * sounds in the alphabet they can, and it translates nothing. Its id keeps the
 * `-script` suffix every option used to carry, because it is stored on posts that
 * already exist and an id is not worth renaming.
 */
export const POST_LANGUAGES: readonly {
  id: PostLanguage;
  label: string;
  native: string;
  script: TransliterationTarget;
}[] = [
  ...SCRIPT_LIST.map((entry) => ({ ...entry, script: entry.id as TransliterationTarget })),
  { id: "english-script", label: "English letters", native: "Aa", script: "iast" },
];

/**
 * A script a post can be offered in: any script the converter writes, or the English
 * letters that are those same tables run the other way.
 */
export type PostLanguage = IndicScript | "english-script";

/**
 * What the four ids this list used to hold mean now.
 *
 * Three of them named a script twice — `kannada-script` was Kannada, and Kannada was
 * the only thing it could have been once the app stopped translating — so they are the
 * plain script ids today. The rows that already hold the old spelling are an author's
 * decision about their own post, and a rename is not a reason to drop it: what is read
 * back is normalised on the way through, here, rather than by a migration that would
 * have to be right the first time.
 */
const RENAMED: Record<string, PostLanguage> = {
  "kannada-script": "kannada",
  "telugu-script": "telugu",
  "tamil-script": "tamil",
};

export function isPostLanguage(value: unknown): value is PostLanguage {
  return isIndicScript(value) || value === "english-script";
}

/**
 * One id, as this app spells it now — which is the same id for everything written
 * since, and the current spelling for the handful written before. Null for anything
 * that is not an option at all.
 */
export function postLanguageOf(value: unknown): PostLanguage | null {
  if (isPostLanguage(value)) return value;
  if (typeof value === "string" && value in RENAMED) return RENAMED[value];
  return null;
}

function languageById(id: PostLanguage) {
  return POST_LANGUAGES.find((entry) => entry.id === id)!;
}

/**
 * The script an option writes. Every option has one, because every option is a
 * mapping — there is nothing else for a request to be routed to.
 */
function scriptFor(id: PostLanguage): TransliterationTarget {
  return languageById(id).script;
}

/**
 * The languages a form asked for, stored one per line the way a word keeps its
 * synonyms. Undefined when the body said nothing about them, so an edit that only
 * changes the title leaves the author's choice alone; null when it said "none".
 */
export function translateIntoFrom(body: Record<string, unknown>) {
  if (!("translateInto" in body)) return undefined;
  const raw = Array.isArray(body.translateInto)
    ? body.translateInto
    : text(body.translateInto).split("\n");
  const chosen: PostLanguage[] = [];
  for (const entry of raw) {
    const id = postLanguageOf(text(entry).toLowerCase());
    if (id && !chosen.includes(id)) chosen.push(id);
  }
  return chosen.length > 0 ? chosen.join("\n") : null;
}

/** The stored list, back as the ids the browser reads. */
export function translateIntoOf(stored: string | null) {
  if (!stored) return [] as PostLanguage[];
  const chosen: PostLanguage[] = [];
  for (const line of stored.split("\n")) {
    // Normalised on the way out rather than in place, so a post whose author ticked
    // "Kannada script" before the option was called Kannada still opens in Kannada.
    const id = postLanguageOf(line.trim());
    if (id && !chosen.includes(id)) chosen.push(id);
  }
  return chosen;
}

/** One post on its way out, with its languages as the list the browser reads. */
export function readableLanguages<T extends { translateInto?: string | null }>(row: T) {
  return { ...row, translateInto: translateIntoOf(row.translateInto ?? null) };
}

/**
 * Names the exact text a translation was made from. When the author edits the
 * details the digest stops matching and the translation is treated as gone, which
 * is the whole reason it is stored.
 */
export function digestOf(body: string) {
  return createHash("sha256").update(body).digest("hex").slice(0, 32);
}

export type PostTranslationRow = typeof postTranslations.$inferSelect;

/**
 * One conversion on its way to the browser. The `engine` column stays out of it: every
 * conversion this app makes now is an exact mapping, so saying so under every panel
 * would be saying nothing, and the rows that were not — a model's attempt, from when
 * this also translated — never reach a reader at all. See `stillBest()`.
 */
export function translationResponse(row: PostTranslationRow) {
  return {
    language: row.language as PostLanguage,
    body: row.body,
    createdAt: row.createdAt,
  };
}

export type PostTranslationResponse = ReturnType<typeof translationResponse>;

/**
 * Whether a cached row is still the best answer for what it holds.
 *
 * A row goes stale for three reasons. The obvious one is that the details it was made
 * from have been edited, which the digest catches. The second is that it was written by
 * a model, back when this app translated as well as re-lettered: those rows are
 * approximations of an exact answer, nothing here makes them any more, and the exact
 * answer is one table lookup away. The third is that it holds a language that is no
 * longer offered at all, which is the same retirement by another name.
 */
function stillBest(row: PostTranslationRow, body: string) {
  if (row.sourceDigest !== digestOf(body)) return false;
  if (!isPostLanguage(row.language)) return false;
  return row.engine !== "ai";
}

/**
 * Adds `translations` to every row of a posts listing in one extra read, so a script
 * already written opens without a request, along with `translationsAvailable` — which
 * of the options can actually be made for these particular details.
 *
 * The availability list travels with the listing rather than being worked out in the
 * browser because the answer depends on which script the details are in, which is a
 * question about Unicode blocks the server already knows how to ask. It costs no query:
 * it is derived from the details on the row in hand.
 */
export async function withTranslations<T extends { id: number; body?: string | null }>(
  rows: T[],
) {
  const bare = (row: T) => ({
    ...row,
    translations: [] as PostTranslationResponse[],
    translationsAvailable: [] as PostLanguage[],
  });

  const withBody = rows.filter((row) => row.body);
  if (withBody.length === 0) return rows.map(bare);

  const found = await db
    .select()
    .from(postTranslations)
    .where(
      inArray(
        postTranslations.postId,
        withBody.map((row) => row.id),
      ),
    );

  const byPost = new Map<number, PostTranslationRow[]>();
  for (const row of found) {
    const list = byPost.get(row.postId);
    if (list) list.push(row);
    else byPost.set(row.postId, [row]);
  }

  return rows.map((row) => {
    if (!row.body) return bare(row);
    const body = row.body;
    const translations = (byPost.get(row.id) ?? [])
      .filter((entry) => stillBest(entry, body))
      .map(translationResponse);
    return { ...row, translations, translationsAvailable: availableTranslations(body) };
  });
}

/**
 * Whether one option can be served at all for one post's details.
 *
 * A character mapping needs to know what it is mapping from, and details in an Indic
 * script say so by being in one. That needs no gateway and no key, so it works on every
 * deployment. Details in Latin letters say nothing — nobody can tell romanised Sanskrit
 * from an English paragraph by looking — so they are offered nothing, and a post whose
 * details are already in the script being asked for is offered nothing either, there
 * being nothing to convert.
 */
export function translationAvailableFor(language: PostLanguage, body: string) {
  return canWrite(scriptFor(language), detectScript(body));
}

/**
 * The same question with the detection already done, which is the form that matters
 * once there are fifty scripts: reading a 6,000 character post to work out what it is
 * written in is worth doing once per post rather than once per option.
 */
function canWrite(target: TransliterationTarget, from: IndicScript | null) {
  if (from === null || from === target) return false;
  // English letters out of English letters is not a conversion, and the check above
  // has already established that the details are in a script.
  return isIndicScript(target) || isIndicScript(from);
}

/**
 * Which of the options can be made for these details at all, so the browser can draw
 * only the links that lead somewhere. Derived from the details in hand, at no cost.
 */
export function availableTranslations(body: string) {
  const from = detectScript(body);
  if (from === null) return [] as PostLanguage[];
  return POST_LANGUAGES.filter((entry) => canWrite(entry.script, from)).map(
    (entry) => entry.id,
  );
}

/**
 * Writes one post's details in one script, and caches the answer against the text it
 * was made from. Answers null when the mapping cannot be made, so an option that
 * cannot be served is quietly unavailable rather than approximated by something else.
 */
export async function renderTranslation(
  post: { id: number; title: string; body: string },
  language: PostLanguage,
) {
  const source = post.body.slice(0, MAX_TRANSLATION_SOURCE);
  const converted = await transliterateDetected(source, scriptFor(language));
  if (!converted) return null;
  return save(post, language, converted, "aksharamukha");
}

/** One conversion, written down against the exact text it came from. */
async function save(
  post: { id: number; body: string },
  language: PostLanguage,
  body: string,
  engine: ConversionEngine,
) {
  const digest = digestOf(post.body);
  const [saved] = await db
    .insert(postTranslations)
    .values({ postId: post.id, language, body, sourceDigest: digest, engine })
    .onConflictDoUpdate({
      target: [postTranslations.postId, postTranslations.language],
      set: { body, sourceDigest: digest, engine, createdAt: new Date() },
    })
    .returning();
  return saved ?? null;
}

/**
 * The conversion already stored, when it is still the best answer available — which
 * means the details have not been edited under it, and it is not left over from when
 * this app also translated. See `stillBest()`.
 */
export async function cachedTranslation(
  post: { id: number; body: string },
  language: PostLanguage,
) {
  const [row] = await db
    .select()
    .from(postTranslations)
    .where(and(eq(postTranslations.postId, post.id), eq(postTranslations.language, language)));
  return row && stillBest(row, post.body) ? row : null;
}

/** Called when a post is deleted for everyone: its translations go with it. */
export async function clearTranslations(postId: number) {
  await db.delete(postTranslations).where(eq(postTranslations.postId, postId));
}

/**
 * The post behind an id, but only when it reaches this member. Asking to read it in
 * another language is reading rather than editing, so the test is the one that
 * decides who may see the post, not the one that decides who may change it.
 */
export async function visiblePost(id: number, user: User | null) {
  const [row] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, id), visibleTo(posts, user, "post")));
  return row ?? null;
}
