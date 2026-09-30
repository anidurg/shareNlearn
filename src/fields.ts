// src/fields.ts
// The shared vocabulary behind a category's own questions — the one place the
// client answers "may this member reshape this form?", "which questions is it
// asking?" and "what does this field say it wants?", so that Books, Songs and
// every category a circle invents are the same feature rather than three of them.
//
// It lives beside `src/categories.ts` rather than inside a component for the same
// reason that one does: the form, the reader, the admin panel and every door into
// it need the same handful of answers, and a component is a bad place to keep a
// rule the server also keeps.
import {
  AUDIO_WAY_OPTIONS,
  FIELD_KIND_OPTIONS,
  fieldFileTypesLabel,
  type AudioWay,
  type CategoryField,
  type CircleCategory,
  type FieldKind,
} from "./api";
import type { ShareAndLearn } from "./store";

/**
 * The built-in kinds a circle may ask its own questions of. Kept here rather than
 * inferred per surface, so the client and `categoryTakesFields()` in
 * `netlify/lib/fields.ts` say the same thing — and so opening up a fourth kind is
 * one entry here and one there.
 */
export const FIELDED_BUILT_INS = ["song", "book", "recipe"] as const;
export type FieldedBuiltIn = (typeof FIELDED_BUILT_INS)[number];

/** Whether a category can be asked anything beyond the form its kind ships with. */
export function categoryTakesFields(itemType: string | null): boolean {
  return itemType === null || (FIELDED_BUILT_INS as readonly string[]).includes(itemType);
}

/**
 * Whether this member may change what a category's form asks. The same answer
 * the server gives: the circle's owner, one of its admins, or the app admin.
 * `moderating` is exactly that set of circles, read once from `GET /api/my-access`.
 *
 * A plain member never sees "Manage fields" and the route refuses them anyway,
 * because a hidden control is a courtesy rather than a check.
 */
export function canAddFields(store: ShareAndLearn, category: CircleCategory) {
  // The same test the server makes: a category a circle invented, or one of the
  // built-ins whose hand-built form was opened up so a circle can ask what it
  // actually wants to know — which deity a recording is to, whether there is a
  // copy of the book to lend. The other four built-ins are the same everywhere.
  if (!categoryTakesFields(category.itemType)) return false;
  return store.moderating.has(category.circleId) || store.access.role === "app_admin";
}

/** Only the questions still being asked, in the order the keepers put them in. */
export function askedFields(category: CircleCategory, extra: CategoryField[] = []) {
  const byId = new Map<number, CategoryField>();
  for (const field of [...category.fields, ...extra]) {
    if (field.hidden) continue;
    byId.set(field.id, field);
  }
  return [...byId.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

/**
 * Every question, including the ones switched off, in that same order. This is
 * the admin's list rather than the form's: a field switched off still has to be
 * findable, since switching it back on is the whole point of it being reversible.
 */
export function orderedFields(category: CircleCategory) {
  return [...category.fields].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

/**
 * Whether a field's answers come from a list the circle wrote — a dropdown of one
 * of them, or tick boxes over any number. The same predicate the server keeps, and
 * the one question every surface that draws or validates a choice has to ask: the
 * manager offers a "The choices" box for these two kinds and nothing else, and the
 * share form draws a `<select>` or a row of tick boxes over the same list.
 */
export function takesOptions(kind: FieldKind): boolean {
  return kind === "select" || kind === "multiselect";
}

/**
 * The answers to a field whose value is several of its own choices, read back out
 * of the one line-per-choice string the column holds — the same shape a word
 * keeps its synonyms in.
 */
export function answerList(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * What a choice control actually offers: the field's own list, plus anything
 * already answered that the circle has since taken off it, at the end.
 *
 * That second half is the whole of "do not silently delete existing selections".
 * A circle that removes "Non-vegetarian" from its Menu type field has removed it
 * from the question rather than from the dishes already described with it, so a
 * recipe already carrying it keeps it ticked and re-saving the form leaves it
 * where it is. It is the same rule the recipe form used to apply by hand to a
 * dish type read off a legacy column.
 */
export function choicesOffered(
  options: readonly string[],
  answered: readonly string[],
): string[] {
  const extra = answered.filter((entry) => entry && !options.includes(entry));
  return extra.length > 0 ? [...options, ...extra] : [...options];
}

/**
 * What a row in the manager says a field is: "Short text", "Dropdown", and for an
 * upload what it takes as well — "Upload (PDF)", "Upload (record or upload
 * audio)" — because that is the part of an upload field a keeper is actually
 * deciding about.
 */
export function fieldTypeText(field: CategoryField): string {
  const label = FIELD_KIND_OPTIONS.find((option) => option.id === field.kind)?.label ?? field.kind;
  if (field.kind !== "file") return label;
  if (field.uploadKind === "audio") return `${label} (${audioWaysLabel(field.audioWays)})`;
  return `${label} (${fieldFileTypesLabel(field.fileTypes)})`;
}

/**
 * How an audio field's row says it may be answered. Empty is both ways, which is
 * what a field configured before the question existed reads as.
 */
export function audioWaysLabel(ways: readonly AudioWay[]): string {
  const only = ways.length === 1 ? ways[0] : null;
  if (only === "record") return "record audio";
  if (only === "upload") return "upload audio";
  return "record or upload audio";
}

/**
 * The ways this particular field actually offers, as a list rather than as the
 * "empty means both" the column stores — which every surface drawing the control
 * would otherwise have to remember.
 */
export function audioWaysOf(field: CategoryField): AudioWay[] {
  const kept = AUDIO_WAY_OPTIONS.filter((option) => field.audioWays.includes(option.id));
  return (kept.length > 0 ? kept : AUDIO_WAY_OPTIONS).map((option) => option.id);
}

/**
 * One circle's copy of a built-in category — the Books category of the circle in
 * view, which is the one whose form a "Manage fields" door reshapes. A category
 * belongs to one circle, so with no circle in view there is no single answer and
 * the door is simply not drawn rather than picking one.
 */
export function builtInCategoryFor(
  categories: CircleCategory[],
  itemType: FieldedBuiltIn,
  circleId: number | null,
): CircleCategory | null {
  if (circleId === null) return null;
  return (
    categories.find(
      (category) => category.itemType === itemType && category.circleId === circleId,
    ) ?? null
  );
}

/**
 * One of the questions a category's form asks before anybody adds a field to it —
 * the built-in half of the form, which the keeper has to be able to see in order
 * to decide what is missing from it.
 *
 * It is a description rather than a definition: a built-in field is written into
 * the form's own markup (`SongModal`, `BookModal`, `RecipeModal`, `PostModal`), so
 * there is no
 * row anywhere to rename, reorder, switch off or delete, and the manager draws
 * these with a lock and no actions rather than inventing rules the forms do not
 * have. What they are for is a keeper reading the whole form in one list, so that
 * "the form already asks for the composer" is something the manager says rather
 * than something they have to remember.
 *
 * **Keep this in step with the four forms.** Nothing enforces it — a built-in
 * field is JSX — so a question added to one of those forms belongs here too. The
 * other way round is worth knowing as well: a question that stops being JSX and
 * becomes a configurable field leaves this list, which is what happened to a
 * recipe's Menu type and Dish type.
 */
export interface BuiltInFormField {
  /** Stable enough for a React key; never sent anywhere. */
  key: string;
  /** As the form itself words it, minus the "(optional)" the label carries. */
  label: string;
  /** In the same words `fieldTypeText()` uses, so the two kinds of row read alike. */
  type: string;
  required: boolean;
  /** Takes more than one answer, the way a custom upload field can. */
  several?: boolean;
}

/**
 * The built-in fields of one category's Add/Edit form, in the order they are asked.
 *
 * Three things are deliberately left out, being the form's frame rather than what
 * it collects about the entry: "Share with" and the circle tick-list, "File under"
 * and the subcategory picker — which is Manage subcategories' business, not this
 * screen's — and Cancel/Save. A song's "Start a discussion" is out for the same
 * reason: what it writes is a discussion, which the app treats as a contribution
 * to the share rather than part of it, and the edit form has a live thread there
 * instead of a field.
 */
export function builtInFormFields(itemType: string | null): BuiltInFormField[] {
  if (itemType === "song") {
    return [
      // "How are you sharing it?" is three ways of answering one question, and a
      // song may be words alone, so the recording itself is optional.
      { key: "audio", label: "Recording", type: "Audio (recorded or uploaded)", required: false },
      { key: "songName", label: "Song title", type: "Short text", required: true },
      { key: "composer", label: "Composer", type: "Short text", required: false },
      { key: "raga", label: "Raga or style", type: "Short text", required: false },
      { key: "lyrics", label: "Lyrics", type: "Long text", required: false },
      { key: "lyricsLanguage", label: "Language of the words", type: "Short text", required: false },
      // Only asked when the words are typed in Latin letters, which is why it is
      // worded as the form words it rather than as "Roman scheme".
      {
        key: "lyricsScheme",
        label: "Which way you typed English letters",
        type: "Dropdown",
        required: false,
      },
      { key: "readInto", label: "Scripts the words can be read in", type: "Choices", required: false, several: true },
      { key: "photos", label: "Photos", type: "Upload (pictures)", required: false, several: true },
    ];
  }
  if (itemType === "book") {
    return [
      { key: "title", label: "Book title", type: "Short text", required: true },
      { key: "author", label: "Author", type: "Short text", required: false },
      { key: "language", label: "Language", type: "Dropdown", required: false },
      { key: "genre", label: "Genre", type: "Dropdown", required: false },
      { key: "rating", label: "Your rating", type: "Stars, 1 to 5", required: false },
      {
        key: "why",
        label: "Why should someone else read it?",
        type: "Long text",
        required: false,
      },
      {
        key: "quotes",
        label: "A line worth remembering",
        type: "Long text",
        required: false,
        several: true,
      },
      { key: "buyUrl", label: "Where to buy it", type: "Link", required: false },
      { key: "photos", label: "Photos", type: "Upload (pictures)", required: false, several: true },
    ];
  }
  if (itemType === "recipe") {
    // Menu type and Dish type are deliberately absent: they used to be two
    // hard-coded lists in this form and are now the circle's own configurable
    // fields, which is the whole point of Recipes having a field builder — one
    // circle offers Non-vegetarian and the next one does not.
    return [
      { key: "title", label: "Item name", type: "Short text", required: true },
      { key: "ingredients", label: "Ingredients", type: "Long text", required: true, several: true },
      { key: "method", label: "Method", type: "Long text", required: true, several: true },
      {
        key: "prepMinutes",
        label: "Preparation time (minutes)",
        type: "Number",
        required: false,
      },
      { key: "notes", label: "Notes", type: "Long text", required: false },
      { key: "photos", label: "Photos", type: "Upload (pictures)", required: false, several: true },
    ];
  }
  if (itemType === null) {
    // Every category a circle invents shares one hand-built form, which is the
    // whole reason fields exist: these four are all it asks on its own.
    return [
      { key: "title", label: "Title", type: "Short text", required: true },
      { key: "body", label: "Details", type: "Long text", required: false },
      {
        key: "translateInto",
        label: "Languages it can be read in",
        type: "Choices",
        required: false,
        several: true,
      },
      { key: "photos", label: "Photos", type: "Upload (pictures)", required: false, several: true },
    ];
  }
  // One of the three built-in kinds that takes no fields at all: nothing to
  // manage, so nothing to describe.
  return [];
}
