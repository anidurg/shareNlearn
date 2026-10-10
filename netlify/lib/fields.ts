// The extra questions one category asks, and the answers shares give to them.
// Every category a circle invents shares the same hand-built form, so this is how
// a circle makes that form its own: Stotras wants a "Deity", Travelogue wants a
// "Country" and a "Went with", Festivals wants a "Tried it?" tick.
//
// Songs, Books and Recipes are the built-in kinds that join them. A recording's
// form is hand-built — a title, a composer, a raga, the words — but what a circle
// wants recorded about a song is its own business: a bhajan circle asks which
// deity, a class asks which tala, and neither belongs in a form every circle
// shares. A reading circle wants the same freedom about a book: which shelf it came
// off, whether there is a copy to lend, a link to the review somebody wrote. And a
// recipe's classifications turned out to be the clearest case of all: who can eat
// the dish and what kind of dish it is were hard-coded lists until a circle that
// shares only vegetarian food had to be offered "Non-vegetarian" anyway, so they
// are now that circle's own tick boxes and its own dropdown. All three may be asked
// questions exactly as an invented category may, and the answers are stored here
// beside a post's.
//
// A field is shaped like a subcategory on purpose — added from the share form by
// any member of the circle, renamed, reordered and switched off by the owner, and
// never deleted in a way that quietly rewrites what somebody already posted.
import { and, asc, eq, inArray, isNull, like, or, type SQL } from "drizzle-orm";
import { db } from "../../db/index.js";
import { categoryFields, circleCategories, postFieldValues } from "../../db/schema.js";
import {
  attachmentKeysIn,
  attachmentTypeFor,
  ATTACHMENT_TYPE_IDS,
  deleteAttachment,
  encodeAttachments,
  isAttachmentTypeId,
  MAX_ATTACHMENT_BYTES,
  parseAttachments,
  type AttachmentTypeId,
} from "./attachments.js";
import { MAX_UPLOAD_BYTES as MAX_AUDIO_BYTES } from "./audio-uploads.js";
import { optionalText, text } from "./items.js";
import { RECIPE_STARTER_FIELDS } from "./recipes.js";

export type FieldRow = typeof categoryFields.$inferSelect;

/**
 * The kinds of share whose form a category can reshape: a post in a category the
 * circle invented, a song, a book, and a recipe. Everything else has a hand-built
 * form that is the same in every circle — a fact is its own sentence, and a word
 * is a dictionary entry.
 */
export const FIELDED_ITEM_TYPES = ["post", "song", "book", "recipe"] as const;
export type FieldItemType = (typeof FIELDED_ITEM_TYPES)[number];

/** The built-in kinds a category may ask its own questions of. */
const FIELDED_BUILT_INS = new Set<string>(["song", "book", "recipe"]);

/**
 * Whether this category can be asked anything beyond its built-in form. A custom
 * category (no `item_type`) always can; of the six, Songs, Books and Recipes do.
 */
export function categoryTakesFields(itemType: string | null): boolean {
  return itemType === null || FIELDED_BUILT_INS.has(itemType);
}

/**
 * What a category's fields are answered by: a post, unless the category is one of
 * the built-in kinds that has been opened up to questions of its own.
 */
export function fieldItemTypeOf(itemType: string | null): FieldItemType {
  return itemType !== null && FIELDED_BUILT_INS.has(itemType)
    ? (itemType as FieldItemType)
    : "post";
}

/**
 * Which rows answer for these items. A post's answer may have been written before
 * this table knew about anything but posts, in which case it names its post the old
 * way and `item_id` is null — so a post is matched either way, and a song only ever
 * the new one. The same read-time normalization `book_discussions` uses, and for the
 * same reason: nobody's answers had to be moved.
 */
function matching(itemType: FieldItemType, ids: number[]): SQL {
  const byRef = and(eq(postFieldValues.itemType, itemType), inArray(postFieldValues.itemId, ids));
  if (itemType !== "post") return byRef!;
  return or(inArray(postFieldValues.postId, ids), byRef)!;
}

/** The item a stored row answers for, whichever way it names it. */
function itemRefOf(row: typeof postFieldValues.$inferSelect): number | null {
  return row.itemId ?? row.postId;
}

/**
 * What the form draws for a field. Five of the seven are something the member
 * types or picks — `select` being one of the field's own choices and
 * `multiselect` any number of them, which is the difference between what kind of
 * dish something is and who can eat it; `file` is the one whose answer is a
 * document they upload — a PDF, a Word file or an Excel workbook — because some
 * of what a circle wants recorded was written somewhere else first, and `link` is
 * the one whose answer is somewhere else entirely: a web address, stored on its
 * own so it can be read back as something to tap rather than as a line of text to
 * copy out by hand.
 */
export const FIELD_KINDS = [
  "text",
  "textarea",
  "checkbox",
  "select",
  "multiselect",
  "file",
  "link",
] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

export const MAX_FIELDS_PER_CATEGORY = 12;
export const MAX_FIELD_LABEL = 60;
export const MAX_FIELD_HINT = 120;
export const MAX_FIELD_OPTIONS = 24;
export const MAX_OPTION_LABEL = 60;
/** A field answer is a note, never an essay — the details box is for those. */
export const MAX_FIELD_VALUE = 600;
/** And a web address is shorter still, being a place rather than a thought. */
export const MAX_LINK_VALUE = 400;
/**
 * How many documents one field takes when its circle set it to take more than
 * one. A ceiling rather than a policy: an answer is still one row, and a list
 * long enough to need paging is a category rather than a field.
 */
export const MAX_FILES_PER_FIELD = 6;

/**
 * How much everything uploaded onto one share may come to, added up across every
 * question its category asks.
 *
 * The per-field rules are each reasonable and their product is not: twelve upload
 * fields, six documents on each of the ones that take several, and an audio field
 * whose ceiling is the recording one, and a single Save asks the app to write over
 * a gigabyte — which nobody would do on purpose and which no per-field rule can
 * see, each one having been kept. So the share itself is asked the question the
 * fields cannot: what does all of this come to?
 *
 * Fifty megabytes is chosen to be past what an honest share reaches — two
 * recordings at the 20 MB ceiling and a PDF beside them still fits — and far
 * short of what the product of the per-field rules allows. It is counted from the
 * sizes the answers carry, which is the same number `valueFor()` already keeps
 * each field to, so a member who wants more than this than the app will store has
 * to say so in the envelope and the honest case is the one being protected. What
 * stops the dishonest one is the rate limit on the way in, where the bytes are
 * real.
 */
export const MAX_ITEM_UPLOAD_BYTES = 50 * 1024 * 1024;

/**
 * A web address as it will be stored, or null when what was typed is not one.
 * Somebody pasting `example.com/page` means `https://example.com/page`, so the
 * scheme is added rather than the answer refused — but anything that is not
 * http or https is refused outright, which is the whole reason this is a parse
 * and not a trim: the answer is read back as something a member taps, and
 * `javascript:` is not a place.
 */
export function webAddressOf(raw: string): string | null {
  const value = raw.trim().replace(/\s+/g, "");
  if (!value) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  // Something with no dot in it is a word somebody typed, not a host.
  if (!url.hostname.includes(".")) return null;
  const stored = url.toString();
  return stored.length > MAX_LINK_VALUE ? null : stored;
}

export function isFieldKind(value: unknown): value is FieldKind {
  return typeof value === "string" && (FIELD_KINDS as readonly string[]).includes(value);
}

export function fieldKindOf(value: unknown, fallback: FieldKind = "text"): FieldKind {
  return isFieldKind(value) ? value : fallback;
}

/**
 * Whether a kind draws its answers from a list the circle wrote — a dropdown of
 * one of them, or tick boxes over any number of them. Asked in one place because
 * both the write routes and the validator have to agree about it: a field of
 * either kind needs choices to be worth asking, and a field of neither keeps
 * none, so a question changed from a dropdown to a line of text does not keep a
 * list that means nothing.
 */
export function takesOptions(kind: FieldKind): boolean {
  return kind === "select" || kind === "multiselect";
}

export function fieldLabelOf(value: unknown) {
  return text(value).replace(/\s+/g, " ").slice(0, MAX_FIELD_LABEL);
}

/**
 * Two labels count as the same when they differ only in case, spacing or
 * punctuation, which is all the duplicate-catching a short label needs. A field
 * is not offered back as "did you mean?" the way a shelf is: the member is adding
 * a question to a form they are looking at, so the list is already in front of
 * them.
 */
function labelKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The dropdown's choices, however the form sent them: a list or one per line. */
export function optionsFrom(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value.map((entry) => text(entry))
    : text(value).split(/\r?\n/);
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const entry of raw) {
    const clean = entry.replace(/\s+/g, " ").trim().slice(0, MAX_OPTION_LABEL);
    if (!clean) continue;
    const key = labelKey(clean);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(clean);
    if (kept.length >= MAX_FIELD_OPTIONS) break;
  }
  return kept;
}

export function splitOptions(stored: string | null): string[] {
  return (stored ?? "").split(/\r?\n/).filter((line) => line.trim().length > 0);
}

/**
 * What an upload field accepts, as the form sent it: a list of the three ids, or
 * one per line. An empty list means "any of the three", which is what every field
 * written before the question could be asked already says by holding null.
 */
export function fileTypesFrom(value: unknown): AttachmentTypeId[] {
  const raw = Array.isArray(value) ? value.map((entry) => text(entry)) : text(value).split(/\r?\n/);
  const kept: AttachmentTypeId[] = [];
  for (const entry of raw) {
    const id = entry.trim().toLowerCase();
    if (isAttachmentTypeId(id) && !kept.includes(id)) kept.push(id);
  }
  // Ticking all three is the same answer as ticking none, so it is stored as none.
  return kept.length >= ATTACHMENT_TYPE_IDS.length ? [] : kept;
}

/** And the stored side of it, read back. Empty means all three. */
export function fileTypesOf(row: FieldRow): AttachmentTypeId[] {
  return fileTypesFrom(row.fileTypes);
}

/**
 * The ceiling a circle asked this field to keep, or null for the platform's own.
 * A circle may ask for less than `MAX_ATTACHMENT_BYTES` and never for more, since
 * anything larger is refused as it is uploaded whatever the field says.
 */
export function maxBytesFrom(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const bytes = Math.floor(Number(value));
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  return Math.min(bytes, MAX_ATTACHMENT_BYTES);
}

/**
 * What this field actually refuses a file for being bigger than. An audio field
 * keeps the recording ceiling instead of the document one, since its answer
 * travels the chunked path a song's does and a sung verse is not a PDF.
 */
export function maxBytesOf(row: FieldRow): number {
  if (uploadKindOf(row) === "audio") return MAX_AUDIO_BYTES;
  if (uploadKindOf(row) === "video") return MAX_ITEM_UPLOAD_BYTES;
  return maxBytesFrom(row.maxBytes) ?? MAX_ATTACHMENT_BYTES;
}

/**
 * What an upload field takes: a document a member wrote somewhere else, or audio
 * they record or pick off the device. Null is `document`, which is what every
 * upload field written before a field could take audio already meant — so
 * nothing had to be back-filled and nothing stored changed its meaning.
 */
export const UPLOAD_KINDS = ["document", "audio", "video"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

export function isUploadKind(value: unknown): value is UploadKind {
  return typeof value === "string" && (UPLOAD_KINDS as readonly string[]).includes(value);
}

export function uploadKindFrom(value: unknown): UploadKind {
  return isUploadKind(value) ? value : "document";
}

export function uploadKindOf(row: FieldRow): UploadKind {
  return uploadKindFrom(row.uploadKind);
}

/**
 * The two ways of answering an audio field, and a circle may offer either or
 * both: the microphone the songs form already uses, and a file already on the
 * device. An empty list means both, which is the same "no preference is
 * everything" rule the document types follow — and what a field holding null
 * says.
 */
export const AUDIO_WAYS = ["record", "upload"] as const;
export type AudioWay = (typeof AUDIO_WAYS)[number];

export function audioWaysFrom(value: unknown): AudioWay[] {
  const raw = Array.isArray(value) ? value.map((entry) => text(entry)) : text(value).split(/\r?\n/);
  const kept: AudioWay[] = [];
  for (const entry of raw) {
    const way = entry.trim().toLowerCase();
    if ((AUDIO_WAYS as readonly string[]).includes(way) && !kept.includes(way as AudioWay)) {
      kept.push(way as AudioWay);
    }
  }
  // Offering both is the same answer as offering neither, so it is stored as none.
  return kept.length >= AUDIO_WAYS.length ? [] : kept;
}

/** And the stored side of it, read back. Empty means both ways. */
export function audioWaysOf(row: FieldRow): AudioWay[] {
  return audioWaysFrom(row.audioWays);
}

/** How a field travels over the API, on the category it belongs to. */
export function fieldResponse(row: FieldRow) {
  return {
    id: row.id,
    categoryId: row.categoryId,
    label: row.label,
    kind: fieldKindOf(row.kind),
    options: splitOptions(row.options),
    hint: row.hint,
    required: row.required,
    /** An upload field's own rules. Empty types means any of the three. */
    uploadKind: uploadKindOf(row),
    fileTypes: fileTypesOf(row),
    maxBytes: maxBytesFrom(row.maxBytes),
    multiple: row.multiple,
    /** And an audio field's, which are the ways of answering it. Empty means both. */
    audioWays: audioWaysOf(row),
    sortOrder: row.sortOrder,
    /** Switched off by the owner: the form stops asking, the answers stay. */
    hidden: row.status === "hidden",
  };
}

export type FieldResponse = ReturnType<typeof fieldResponse>;

/** Every field of these categories, in the order the owner put them in. */
export async function fieldsOf(categoryIds: number[]): Promise<FieldRow[]> {
  if (categoryIds.length === 0) return [];
  return db
    .select()
    .from(categoryFields)
    .where(inArray(categoryFields.categoryId, categoryIds))
    .orderBy(asc(categoryFields.sortOrder), asc(categoryFields.id));
}

export async function fieldById(categoryId: number, fieldId: number) {
  const [row] = await db
    .select()
    .from(categoryFields)
    .where(and(eq(categoryFields.id, fieldId), eq(categoryFields.categoryId, categoryId)));
  return row ?? null;
}

/**
 * Adds a question to a category, or hands back the one already asking it. Two
 * members typing "Deity" at the same moment end up with one field, the same way
 * two members typing "Sweets" end up with one shelf.
 */
export async function addField(
  categoryId: number,
  input: {
    label: string;
    kind?: unknown;
    options?: unknown;
    hint?: unknown;
    required?: unknown;
    uploadKind?: unknown;
    fileTypes?: unknown;
    maxBytes?: unknown;
    multiple?: unknown;
    audioWays?: unknown;
  },
  memberId: string | null,
): Promise<{ field: FieldRow | null; existing: FieldRow | null; full: boolean }> {
  const label = fieldLabelOf(input.label);
  if (!label) return { field: null, existing: null, full: false };

  const existing = await fieldsOf([categoryId]);
  const same = existing.find((row) => labelKey(row.label) === labelKey(label));
  // Asking again for a question that is already there simply switches it back on.
  if (same) {
    if (same.status === "hidden") {
      const [revived] = await db
        .update(categoryFields)
        .set({ status: "active" })
        .where(eq(categoryFields.id, same.id))
        .returning();
      return { field: null, existing: revived ?? same, full: false };
    }
    return { field: null, existing: same, full: false };
  }
  if (existing.length >= MAX_FIELDS_PER_CATEGORY) {
    return { field: null, existing: null, full: true };
  }

  const kind = fieldKindOf(input.kind);
  const options = takesOptions(kind) ? optionsFrom(input.options) : [];
  // The upload rules only mean anything on an upload, so nothing else keeps them —
  // and the two halves of one never both apply: a document has file types and a
  // size, and audio has the ways of answering it.
  const uploadKind = kind === "file" ? uploadKindFrom(input.uploadKind) : null;
  const document = uploadKind === "document";
  const fileTypes = document ? fileTypesFrom(input.fileTypes) : [];
  const maxBytes = document ? maxBytesFrom(input.maxBytes) : null;
  const audioWays = uploadKind === "audio" ? audioWaysFrom(input.audioWays) : [];

  const [created] = await db
    .insert(categoryFields)
    .values({
      categoryId,
      label,
      kind,
      options: options.length > 0 ? options.join("\n") : null,
      hint: optionalText(input.hint)?.slice(0, MAX_FIELD_HINT) ?? null,
      required: input.required === true,
      uploadKind,
      fileTypes: fileTypes.length > 0 ? fileTypes.join("\n") : null,
      maxBytes,
      multiple: document && input.multiple === true,
      audioWays: audioWays.length > 0 ? audioWays.join("\n") : null,
      sortOrder: existing.length,
      createdById: memberId,
    })
    .onConflictDoNothing()
    .returning();
  if (created) return { field: created, existing: null, full: false };

  // Lost a race against somebody adding the same label; theirs is the field.
  const [settled] = await db
    .select()
    .from(categoryFields)
    .where(and(eq(categoryFields.categoryId, categoryId), eq(categoryFields.label, label)));
  return { field: null, existing: settled ?? null, full: false };
}

/**
 * The questions a category is given the first time it is read, per built-in kind.
 * Only Recipes has any: its Menu type and Dish type were two hard-coded controls
 * on the share form, so every circle that already exists would otherwise have a
 * Recipes form that had quietly stopped asking either of them.
 *
 * A starter field is a starting point and nothing more — once it is there it is an
 * ordinary field, and a keeper renames it, reorders it, rewrites its choices,
 * marks it needed, switches it off or deletes it exactly as they would one they
 * added themselves. Which is why the seeding has to happen **once** rather than
 * whenever the list looks empty: a circle that took "Non-vegetarian" off its Menu
 * type, or deleted Dish type altogether, has said something, and putting it back
 * on the next read would be arguing with them.
 */
const STARTER_FIELDS: Record<string, readonly StarterField[]> = {
  recipe: RECIPE_STARTER_FIELDS,
};

interface StarterField {
  label: string;
  kind: string;
  options: readonly string[];
  hint?: string;
}

/**
 * Gives each of these categories its starter questions, exactly once, and says
 * nothing and reads nothing when there are none to give — which is every call
 * after the first and every call about a category with no starter list at all.
 *
 * `fields_seeded_at` is what makes it once: it is stamped under a `null` guard, so
 * two requests arriving together cannot both win, and the loser does no work. The
 * fields themselves are added with `addField()`, which is idempotent on the label
 * anyway, so the worst a lost race could do is nothing.
 *
 * The rows are the ones the caller has already read, and the mark is written back
 * onto them, so a caller holding them does not have to re-read to know the pass
 * has happened.
 */
export async function seedStarterFields(
  categories: { id: number; itemType: string | null; fieldsSeededAt: Date | null }[],
) {
  const owed = categories.filter(
    (category) =>
      category.fieldsSeededAt === null &&
      category.itemType !== null &&
      STARTER_FIELDS[category.itemType],
  );
  if (owed.length === 0) return;

  await Promise.all(
    owed.map(async (category) => {
      const starters = STARTER_FIELDS[category.itemType as string] ?? [];
      const stamped = new Date();
      const [won] = await db
        .update(circleCategories)
        .set({ fieldsSeededAt: stamped })
        .where(
          and(eq(circleCategories.id, category.id), isNull(circleCategories.fieldsSeededAt)),
        )
        .returning({ id: circleCategories.id });
      category.fieldsSeededAt = stamped;
      if (!won) return;
      // One at a time rather than in parallel: `addField()` reads the category's
      // fields to work out the next `sort_order`, so two at once would both think
      // they were first and the form would open in an order nobody chose.
      for (const starter of starters) {
        await addField(category.id, { ...starter, options: [...starter.options] }, null);
      }
    }),
  );
}

/** Puts a category's fields in the order the owner moved them into. */
export async function applyFieldOrder(ids: number[]) {
  await Promise.all(
    ids.map((id, index) =>
      db.update(categoryFields).set({ sortOrder: index }).where(eq(categoryFields.id, id)),
    ),
  );
}

/**
 * The answers a share form sent, as `{ "12": "Ganesha", "13": "yes" }`. Undefined
 * when the body said nothing about them at all, so an edit that only changes the
 * title leaves every answer exactly where it was.
 */
export function answersFrom(body: Record<string, unknown>): Map<number, string> | undefined {
  if (!("fieldValues" in body)) return undefined;
  const answers = new Map<number, string>();
  const raw = body.fieldValues;
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Record<string, unknown>;
      const id = Number(row.fieldId);
      if (Number.isInteger(id) && id > 0) answers.set(id, text(row.value));
    }
    return answers;
  }
  if (raw && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const id = Number(key);
      if (Number.isInteger(id) && id > 0) answers.set(id, text(value));
    }
  }
  return answers;
}

/**
 * What a choice field will accept: its own list, plus anything this share already
 * answered that the list no longer holds. The second half is what makes narrowing
 * a field safe — a circle rewriting its Menu type options changes the question,
 * and the recipes already answered keep their answers.
 */
function choicesFor(field: FieldRow, stored?: string): string[] {
  const options = splitOptions(field.options);
  if (!stored) return options;
  const known = new Set(options.map((option) => labelKey(option)));
  const extra = splitOptions(stored).filter((entry) => !known.has(labelKey(entry)));
  return extra.length > 0 ? [...options, ...extra] : options;
}

/**
 * What one field's answer actually stores. A tick is the word "Yes", a dropdown
 * has to name one of its own choices, a link is a web address rather than
 * whatever was typed, a file is the document the member uploaded, and anything
 * else is their own text with the ends trimmed. An empty answer is no answer,
 * and no row is written.
 *
 * A document answers with the key it was uploaded under, and `memberId` is what
 * makes that safe: a key names its uploader, so a member can only put on a share
 * a file they uploaded themselves. Without it — reading an answer back rather
 * than writing one — the key is taken as it stands.
 *
 * `keeping` is the other half of that rule, and it is what lets somebody other
 * than the author save the form at all: the keys already stored on this share are
 * allowed through whoever is saving. A circle's owner correcting a title on
 * somebody else's post sends the document back exactly as the form gave it to
 * them, and without this it would be a key with the wrong id on it and the file
 * would quietly vanish. The same rule photos follow, for the same reason.
 *
 * `stored` is that same idea for a choice: whatever this share already answered,
 * so a choice the circle has since taken off the list is still an answer for the
 * shares that already gave it. Removing "Non-vegetarian" from a Menu type field
 * takes it out of the question rather than out of the dishes already described
 * with it, and an edit that never touched the field must not be the thing that
 * quietly loses it.
 */
function valueFor(
  field: FieldRow,
  raw: string,
  memberId?: string,
  keeping?: Set<string>,
  stored?: string,
): string | null {
  const kind = fieldKindOf(field.kind);
  const value = raw.trim();
  if (kind === "checkbox") {
    return /^(yes|true|on|1|checked)$/i.test(value) ? "Yes" : null;
  }
  if (!value) return null;
  if (kind === "link") {
    return webAddressOf(value);
  }
  if (kind === "file") {
    // Audio is not a document and is not asked the document questions: what it
    // takes is a recording, so there are no formats to tick and only ever one of
    // them. Its ceiling is the recording one, which `maxBytesOf()` already knows.
    const uploadKind = uploadKindOf(field);
    const audio = uploadKind === "audio";
    const video = uploadKind === "video";
    const allowed = audio || video ? [] : fileTypesOf(field);
    const ceiling = maxBytesOf(field);
    const kept = parseAttachments(value).filter((file) => {
      // A key names its uploader, so a member can only attach their own — or one
      // already on this share, which is what lets a circle's keeper save the form.
      const mine = file.key.startsWith(`${memberId}_`);
      if (memberId && !mine && !keeping?.has(file.key)) return false;
      // The rules the circle set for this particular field. A file already stored
      // is kept whatever they say now, since narrowing a field should retire
      // nothing anybody already answered.
      if (keeping?.has(file.key)) return true;
      if (file.size > ceiling) return false;
      // The attachment envelope carries its name but not its MIME type. Do not
      // allow an MP4 to be filed as audio/document, or vice versa.
      if (video && !/\.mp4$/i.test(file.name)) return false;
      if (uploadKind === "document" && /\.mp4$/i.test(file.name)) return false;
      if (allowed.length > 0) {
        const type = attachmentTypeFor("", file.name);
        if (!type || !allowed.includes(type.id)) return false;
      }
      return true;
    });
    const room = !audio && !video && field.multiple ? MAX_FILES_PER_FIELD : 1;
    return encodeAttachments(kept.slice(0, room)) || null;
  }
  if (kind === "select") {
    const match = choicesFor(field, stored).find(
      (option) => labelKey(option) === labelKey(value),
    );
    return match ?? null;
  }
  if (kind === "multiselect") {
    // Several of the field's own choices, stored one per line — the shape a word
    // keeps its synonyms in and a recipe kept its menu types in. Each is matched
    // against the list rather than trusted, so a word nobody offered is not an
    // answer, and the answer comes back in the order the choices were offered
    // rather than the order they were ticked, so it is stable however the form
    // was filled in.
    const wanted = new Set(splitOptions(value).map((entry) => labelKey(entry)));
    const chosen = choicesFor(field, stored).filter((option) =>
      wanted.has(labelKey(option)),
    );
    return chosen.length > 0 ? chosen.join("\n") : null;
  }
  return value.slice(0, MAX_FIELD_VALUE);
}

/**
 * The first field that insists on an answer and did not get one, so the route can
 * say which question is missing rather than refusing the whole post vaguely. A
 * field switched off asks nothing, however required it used to be.
 */
export function missingRequired(fields: FieldRow[], answers: Map<number, string>) {
  for (const field of fields) {
    if (field.status !== "active" || !field.required) continue;
    if (!valueFor(field, answers.get(field.id) ?? "")) return field;
  }
  return null;
}

/**
 * The refusal when one share's uploads come to more than `MAX_ITEM_UPLOAD_BYTES`,
 * and null when they do not — the shape `unsafeText()` has, because it is the
 * same kind of thing: a rule about the whole of what a form sent rather than
 * about any one answer in it, checked by every route that stores answers and
 * returned as it stands.
 *
 * It counts what would actually be kept rather than everything sent, taking each
 * field's own `MAX_FILES_PER_FIELD` room into account exactly as `valueFor()`
 * does, so a member is never refused for files the save was going to drop anyway.
 * An edit is counted whole, documents already stored included, since the ceiling
 * is on what the share holds rather than on what this particular Save added.
 */
export function tooMuchUploaded(
  fields: FieldRow[],
  answers: Map<number, string>,
): Response | null {
  let total = 0;
  for (const field of fields) {
    if (field.status !== "active" || fieldKindOf(field.kind) !== "file") continue;
    const room = uploadKindOf(field) === "document" && field.multiple ? MAX_FILES_PER_FIELD : 1;
    for (const file of parseAttachments(answers.get(field.id) ?? "").slice(0, room)) {
      if (Number.isFinite(file.size) && file.size > 0) total += file.size;
    }
  }
  if (total <= MAX_ITEM_UPLOAD_BYTES) return null;

  const ceiling = Math.round(MAX_ITEM_UPLOAD_BYTES / (1024 * 1024));
  const asked = Math.round(total / (1024 * 1024));
  return Response.json(
    {
      error: `Everything uploaded on one share has to come to under ${ceiling} MB, and this comes to ${asked} MB. Taking a file back out will save it.`,
    },
    { status: 413 },
  );
}

/**
 * Every answer a form gave, as text, for the safety filter to read in one go. A
 * document contributes the name it was uploaded under and a link the address
 * itself, both of which are words a member wrote and everybody reading the post
 * will see.
 */
export function answerTexts(fields: FieldRow[], answers: Map<number, string>) {
  const texts: string[] = [];
  for (const field of fields) {
    const kind = fieldKindOf(field.kind);
    const raw = answers.get(field.id) ?? "";
    if (kind === "text" || kind === "textarea" || kind === "link") {
      if (raw.trim()) texts.push(raw);
    } else if (kind === "file") {
      for (const file of parseAttachments(raw)) texts.push(file.name);
    }
  }
  return texts;
}

/**
 * Drops the bytes behind documents no answer names any more. Asked one key at a
 * time because the question is per key and the answer is usually "nothing else
 * points at it" — a share replacing its file leaves the old one referred to by
 * nobody, and a share deleted takes its own with it.
 */
async function sweepAttachments(keys: string[]) {
  for (const key of keys) {
    const [still] = await db
      .select({ id: postFieldValues.id })
      .from(postFieldValues)
      .where(like(postFieldValues.value, `%${key}%`))
      .limit(1);
    // A key still named somewhere is left alone: a row is the record, and the one
    // failure worth avoiding is deleting a document somebody's post still shows.
    if (!still) await deleteAttachment(key);
  }
}

/** The documents these stored rows point at, for a sweep once they are gone. */
async function attachmentsOn(where: SQL) {
  const rows = await db.select({ value: postFieldValues.value }).from(postFieldValues).where(where);
  return attachmentKeysIn(rows.map((row) => row.value));
}

/**
 * What these questions were already answered, by field. Read before a save
 * replaces them, because two of the rules about an answer are about the answer
 * that is already there: which documents this save is dropping and can therefore
 * sweep up, and which choices are still answers even though the circle has since
 * taken them off the list.
 */
async function answersOn(where: SQL) {
  const rows = await db
    .select({ fieldId: postFieldValues.fieldId, value: postFieldValues.value })
    .from(postFieldValues)
    .where(where);
  return new Map(rows.map((row) => [row.fieldId, row.value]));
}

/**
 * Writes a share's answers, replacing whatever was there — but only for the
 * questions the form actually asked. An answer to a field the owner has since
 * switched off is left exactly where it is: switching off is reversible, and an
 * edit made while a question is not being asked must not be the thing that
 * quietly loses the answer to it.
 *
 * A post writes both ways of naming itself, so a row is found by either read.
 */
export async function setItemFieldValues(
  itemType: FieldItemType,
  itemId: number,
  fields: FieldRow[],
  answers: Map<number, string>,
  memberId?: string,
) {
  const asked = fields.filter((field) => field.status === "active");

  const askedIds = asked.map((field) => field.id);
  const scope =
    askedIds.length > 0
      ? and(matching(itemType, [itemId]), inArray(postFieldValues.fieldId, askedIds))!
      : null;
  // What these questions already said. Read first rather than after the rows are
  // worked out, because it answers three questions at once: which bytes this save
  // replaces and can therefore be swept up, which keys the member saving is
  // allowed to send back even though somebody else uploaded them, and which
  // choices are still answers although the circle has stopped offering them.
  const prior = scope ? await answersOn(scope) : new Map<number, string>();
  const before = attachmentKeysIn([...prior.values()]);
  const keeping = new Set(before);

  const rows = asked
    .map((field) => ({
      field,
      value: valueFor(
        field,
        answers.get(field.id) ?? "",
        memberId,
        keeping,
        prior.get(field.id),
      ),
    }))
    .filter((row): row is { field: FieldRow; value: string } => row.value !== null);

  if (scope) await db.delete(postFieldValues).where(scope);

  if (rows.length > 0) {
    await db
      .insert(postFieldValues)
      .values(
        rows.map((row) => ({
          postId: itemType === "post" ? itemId : null,
          itemType,
          itemId,
          fieldId: row.field.id,
          value: row.value,
        })),
      )
      .onConflictDoNothing();
  }

  const kept = attachmentKeysIn(rows.map((row) => row.value));
  await sweepAttachments(before.filter((key) => !kept.includes(key)));

  return valueResponses(rows.map((row) => ({ field: row.field, value: row.value })));
}

/**
 * An edit. A body that said nothing about answers keeps the ones already there;
 * one that named them replaces the set, which is how an answer is cleared.
 */
export async function applyItemFieldValues(
  itemType: FieldItemType,
  itemId: number,
  fields: FieldRow[],
  answers: Map<number, string> | undefined,
  memberId?: string,
) {
  if (answers) return setItemFieldValues(itemType, itemId, fields, answers, memberId);
  return fieldValuesOf(itemType, [itemId], fields).then((byItem) => byItem.get(itemId) ?? []);
}

export async function clearItemFieldValues(itemType: FieldItemType, itemId: number) {
  const scope = matching(itemType, [itemId]);
  const files = await attachmentsOn(scope);
  await db.delete(postFieldValues).where(scope);
  await sweepAttachments(files);
}

/** A field the owner removed takes its answers with it — nothing else moves. */
export async function clearFieldValues(fieldId: number) {
  const scope = eq(postFieldValues.fieldId, fieldId);
  const files = await attachmentsOn(scope);
  await db.delete(postFieldValues).where(scope);
  await sweepAttachments(files);
}

/**
 * Every field of these categories, and every answer given to one, for a category
 * or a whole circle being torn down. The posts themselves are moved or released
 * elsewhere; what goes here is only the questions nobody will ever ask again.
 */
export async function clearCategoryFields(categoryIds: number[]) {
  if (categoryIds.length === 0) return;
  const rows = await db
    .select({ id: categoryFields.id })
    .from(categoryFields)
    .where(inArray(categoryFields.categoryId, categoryIds));
  if (rows.length > 0) {
    const scope = inArray(
      postFieldValues.fieldId,
      rows.map((row) => row.id),
    );
    const files = await attachmentsOn(scope);
    await db.delete(postFieldValues).where(scope);
    await sweepAttachments(files);
  }
  await db.delete(categoryFields).where(inArray(categoryFields.categoryId, categoryIds));
}

/**
 * An answer as a reader sees it: the question is carried alongside it so a saved
 * copy in somebody's library still reads properly, long after they left the
 * circle whose category asked it.
 */
function valueResponses(rows: { field: FieldRow; value: string }[]) {
  return rows
    .slice()
    .sort((a, b) => a.field.sortOrder - b.field.sortOrder || a.field.id - b.field.id)
    .map((row) => ({
      fieldId: row.field.id,
      label: row.field.label,
      kind: fieldKindOf(row.field.kind),
      value: row.value,
    }));
}

export type FieldValueResponse = ReturnType<typeof valueResponses>[number];

/**
 * The answers of several shares of one kind at once, keyed by id. A field the
 * owner switched off is not read back, the same way a hidden category is missing
 * rather than greyed out — and the answer is still in the table if it is switched
 * on again.
 */
export async function fieldValuesOf(
  itemType: FieldItemType,
  itemIds: number[],
  known?: FieldRow[],
) {
  const byItem = new Map<number, FieldValueResponse[]>();
  if (itemIds.length === 0) return byItem;

  const rows = await db.select().from(postFieldValues).where(matching(itemType, itemIds));
  if (rows.length === 0) return byItem;

  const missing = rows
    .map((row) => row.fieldId)
    .filter((id) => !known?.some((field) => field.id === id));
  const extra =
    missing.length > 0
      ? await db.select().from(categoryFields).where(inArray(categoryFields.id, missing))
      : [];
  const fields = new Map([...(known ?? []), ...extra].map((field) => [field.id, field]));

  const grouped = new Map<number, { field: FieldRow; value: string }[]>();
  for (const row of rows) {
    const field = fields.get(row.fieldId);
    if (!field || field.status !== "active") continue;
    const itemId = itemRefOf(row);
    if (itemId === null) continue;
    const list = grouped.get(itemId);
    if (list) list.push({ field, value: row.value });
    else grouped.set(itemId, [{ field, value: row.value }]);
  }
  for (const [itemId, list] of grouped) byItem.set(itemId, valueResponses(list));
  return byItem;
}

/** Decorates a listing with its answers, in one extra read. */
export async function withFieldValues<T extends { id: number }>(
  itemType: FieldItemType,
  items: T[],
) {
  const byItem = await fieldValuesOf(
    itemType,
    items.map((item) => item.id),
  );
  return items.map((item) => ({ ...item, fieldValues: byItem.get(item.id) ?? [] }));
}
