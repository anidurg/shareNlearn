import { withFreshSession } from "./session";

export type ItemType =
  | "song"
  | "recipe"
  | "fact"
  | "word"
  | "book"
  | "remedy"
  | "bookmark"
  | "post";

export type Visibility = "shared" | "private";

/**
 * Where a share form said the share should sit in the circle's taxonomy: the node
 * the member tapped, and that node's path written out. Both halves travel because
 * a node belongs to one circle's tree and a share reaches several — the id settles
 * it exactly in its own circle, and the words are what the other circles are
 * matched on, or make for themselves when they allow it.
 *
 * `{ id: null, name: null }` is "no subcategory", which is a real answer and the
 * ordinary one.
 */
export interface ShelfChoice {
  id: number | null;
  name: string | null;
}

/** Nothing chosen, which every share form starts on. */
export const NO_SHELF: ShelfChoice = { id: null, name: null };

/**
 * What a share form sends: the item's own fields, the category and the one
 * taxonomy node it picked, and the photos to keep, by key. The node travels as
 * both its id and its path, resolved circle by circle on the way in, and the keys
 * are what the photo upload returned.
 */
export type Shared<T> = Omit<Partial<T>, "photos"> & {
  /** The node the member tapped, in the circle whose tree it belongs to. */
  subcategoryId?: number | null;
  /** That node's path — "Vegetarian › South Indian" — for every other circle. */
  subcategoryName?: string | null;
  /**
   * The category the share is filed under, when its author picked one of the
   * circle's own rather than letting it land where its kind usually does — a song
   * under Events. Null is that ordinary case; leaving it out entirely says nothing
   * about filing, so an edit that only changes the title leaves it alone.
   */
  filedCategoryId?: number | null;
  /**
   * The folder in the circle the member shared into — where the item belongs, as
   * against what kind of thing it is. It names one circle, since a folder tree is
   * a circle's own, so it is kept against that circle and nowhere else. Null puts
   * the share in the circle itself; leaving it out says nothing, so an edit that
   * never asked keeps whatever folder it is already in.
   */
  folderId?: number | null;
  /** In the order they should appear; leaving it out changes nothing. */
  photos?: string[];
};

/**
 * Where one post sits in one circle: the circle it went to, the category it was
 * filed under there, and the shelf within it. Both belong to a circle, so the same
 * song can be an Events entry filed under "Rathotsava" in one circle and an
 * ordinary, unfiled song in another.
 *
 * A null `categoryId` is the ordinary case and means "wherever this kind of thing
 * goes in that circle" — which is what every filing said before a share could be
 * put anywhere else.
 */
export interface CircleFiling {
  circleId: number;
  categoryId: number | null;
  subcategoryId: number | null;
  /** The circle's own folder the share sits in; null for the circle itself. */
  folderId: number | null;
  /**
   * That folder written out — `["Austin", "Thursday Bhajane"]` — so a form can
   * say where a share already sits without having the circle's folder tree in
   * hand. An edit form is opened from anywhere, and most of those places never
   * load one. Absent on a response written before the server sent it.
   */
  folderPath?: string[] | null;
}

/**
 * One photo hung off a share. `key` is what a form sends back to keep it, `url`
 * is where to draw it from.
 */
export interface ItemPhoto {
  /** Absent on a photo that has just been uploaded and not attached yet. */
  id?: number;
  key: string;
  url: string;
}

/**
 * Photos are optional on everything shared, and there may be several: the form
 * offers a "+" so a member can add as many as the thing needs.
 */
export interface HasPhotos {
  /** Absent on something this member made a moment ago and has not reloaded. */
  photos?: ItemPhoto[];
}

/**
 * Every shared thing carries the circles it was shared into — none means it went
 * to the whole group, the way sharing worked before circles existed. The list a
 * member receives only ever names circles they are in themselves.
 */
export interface InCircles {
  circleIds: number[];
  /** Absent on something this member made a moment ago and has not reloaded. */
  filings?: CircleFiling[];
}

/**
 * A script somebody asked for: the song's own words written out in another writing
 * system. Every one of them keeps the sounds — the Indian scripts in their own
 * letters, English for the reader who reads none of them — because this app re-letters
 * what the author typed and never says what it means.
 */
export type LyricScript =
  | "devanagari"
  | "bengali"
  | "gurmukhi"
  | "gujarati"
  | "oriya"
  | "tamil"
  | "telugu"
  | "kannada"
  | "malayalam"
  | "sinhala"
  | "ahom"
  | "avestan"
  | "balinese"
  | "bhaiksuki"
  | "brahmi"
  | "burmese"
  | "cham"
  | "dogra"
  | "grantha"
  | "gunjala-gondi"
  | "hanifi-rohingya"
  | "javanese"
  | "kharoshthi"
  | "khmer"
  | "khudawadi"
  | "lao"
  | "lepcha"
  | "limbu"
  | "mahajani"
  | "marchen"
  | "masaram-gondi"
  | "meetei-mayek"
  | "modi"
  | "mro"
  | "multani"
  | "newa"
  | "ol-chiki"
  | "old-persian"
  | "phags-pa"
  | "sharada"
  | "siddham"
  | "sora-sompeng"
  | "takri"
  | "thai"
  | "tibetan"
  | "tirhuta"
  | "arabic"
  | "wancho"
  | "warang-citi"
  | "zanabazar-square"
  | "english";

/**
 * Every script a member can ask their words to be readable in, in the order the form
 * offers them and the buttons under a recording are drawn. The native spelling is what
 * somebody who reads that script looks for first, so it is on the button beside the
 * English name.
 *
 * A reader never sees the whole list: a recording shows the handful its author ticked,
 * narrowed again to the ones its particular words can actually be converted into.
 */
export const LYRIC_SCRIPT_OPTIONS: {
  id: LyricScript;
  label: string;
  native: string;
  /** What tapping it does, said plainly. */
  note: string;
  /**
   * What the conversion tables write it in, so the form can preview a script before
   * the song is shared. The same routing the server does, said once on this side too
   * because the preview goes straight to `/api/transliterate` and hangs on no song.
   */
  target: IndicScript | RomanScheme;
}[] = [
  {
    id: "devanagari",
    label: "Devanagari",
    native: "देवनागरी",
    note: "same words, Devanagari letters",
    target: "devanagari",
  },
  {
    id: "bengali",
    label: "Bengali",
    native: "বাংলা",
    note: "same words, Bengali letters",
    target: "bengali",
  },
  {
    id: "gurmukhi",
    label: "Gurmukhi",
    native: "ਗੁਰਮੁਖੀ",
    note: "same words, Gurmukhi letters",
    target: "gurmukhi",
  },
  {
    id: "gujarati",
    label: "Gujarati",
    native: "ગુજરાતી",
    note: "same words, Gujarati letters",
    target: "gujarati",
  },
  {
    id: "oriya",
    label: "Odia",
    native: "ଓଡ଼ିଆ",
    note: "same words, Odia letters",
    target: "oriya",
  },
  {
    id: "tamil",
    label: "Tamil",
    native: "தமிழ்",
    note: "same words, Tamil letters",
    target: "tamil",
  },
  {
    id: "telugu",
    label: "Telugu",
    native: "తెలుగు",
    note: "same words, Telugu letters",
    target: "telugu",
  },
  {
    id: "kannada",
    label: "Kannada",
    native: "ಕನ್ನಡ",
    note: "same words, Kannada letters",
    target: "kannada",
  },
  {
    id: "malayalam",
    label: "Malayalam",
    native: "മലയാളം",
    note: "same words, Malayalam letters",
    target: "malayalam",
  },
  {
    id: "sinhala",
    label: "Sinhala",
    native: "සිංහල",
    note: "same words, Sinhala letters",
    target: "sinhala",
  },
  {
    id: "ahom",
    label: "Ahom",
    native: "𑜒𑜀𑜫𑜏𑜍",
    note: "same words, Ahom letters",
    target: "ahom",
  },
  {
    id: "avestan",
    label: "Avestan",
    native: "𐬀𐬐𐬴𐬀𐬀𐬭𐬀𐬀",
    note: "same words, Avestan letters",
    target: "avestan",
  },
  {
    id: "balinese",
    label: "Balinese",
    native: "ᬅᬓ᭄ᬱᬭ",
    note: "same words, Balinese letters",
    target: "balinese",
  },
  {
    id: "bhaiksuki",
    label: "Bhaiksuki",
    native: "𑰀𑰎𑰿𑰬𑰨",
    note: "same words, Bhaiksuki letters",
    target: "bhaiksuki",
  },
  {
    id: "brahmi",
    label: "Brahmi",
    native: "𑀅𑀓𑁆𑀱𑀭",
    note: "same words, Brahmi letters",
    target: "brahmi",
  },
  {
    id: "burmese",
    label: "Burmese",
    native: "မြန်မာ",
    note: "same words, Burmese letters",
    target: "burmese",
  },
  {
    id: "cham",
    label: "Cham",
    native: "ꨀꩀꨦꨣ",
    note: "same words, Cham letters",
    target: "cham",
  },
  {
    id: "dogra",
    label: "Dogra",
    native: "𑠀𑠊𑠹𑠨𑠤",
    note: "same words, Dogra letters",
    target: "dogra",
  },
  {
    id: "grantha",
    label: "Grantha",
    native: "𑌅𑌕𑍍𑌷𑌰",
    note: "same words, Grantha letters",
    target: "grantha",
  },
  {
    id: "gunjala-gondi",
    label: "Gunjala Gondi",
    native: "𑵠𑵱𑶗𑶉𑶈",
    note: "same words, Gunjala Gondi letters",
    target: "gunjala-gondi",
  },
  {
    id: "hanifi-rohingya",
    label: "Hanifi Rohingya",
    native: "𐴀𐴝𐴑𐴐𐴝𐴌𐴝",
    note: "same words, Hanifi Rohingya letters",
    target: "hanifi-rohingya",
  },
  {
    id: "javanese",
    label: "Javanese",
    native: "ꦄꦏ꧀ꦰꦫ",
    note: "same words, Javanese letters",
    target: "javanese",
  },
  {
    id: "kharoshthi",
    label: "Kharoshthi",
    native: "𐨀𐨐𐨿𐨮𐨪",
    note: "same words, Kharoshthi letters",
    target: "kharoshthi",
  },
  {
    id: "khmer",
    label: "Khmer",
    native: "ខ្មែរ",
    note: "same words, Khmer letters",
    target: "khmer",
  },
  {
    id: "khudawadi",
    label: "Khudawadi",
    native: "𑊰𑊺𑋪𑋜𑋩𑋙",
    note: "same words, Khudawadi letters",
    target: "khudawadi",
  },
  {
    id: "lao",
    label: "Lao",
    native: "ລາວ",
    note: "same words, Lao letters",
    target: "lao",
  },
  {
    id: "lepcha",
    label: "Lepcha",
    native: "ᰣᰀᰡ᰷ᰛ",
    note: "same words, Lepcha letters",
    target: "lepcha",
  },
  {
    id: "limbu",
    label: "Limbu",
    native: "ᤀᤁ᤻ᤙᤖ",
    note: "same words, Limbu letters",
    target: "limbu",
  },
  {
    id: "mahajani",
    label: "Mahajani",
    native: "𑅐𑅕𑅖𑅳𑅐𑅭𑅐",
    note: "same words, Mahajani letters",
    target: "mahajani",
  },
  {
    id: "marchen",
    label: "Marchen",
    native: "𑲏𑱲𑲬𑲊",
    note: "same words, Marchen letters",
    target: "marchen",
  },
  {
    id: "masaram-gondi",
    label: "Masaram Gondi",
    native: "𑴀𑴮𑴦",
    note: "same words, Masaram Gondi letters",
    target: "masaram-gondi",
  },
  {
    id: "meetei-mayek",
    label: "Meetei Mayek",
    native: "ꯑꯛꯁꯔ",
    note: "same words, Meetei Mayek letters",
    target: "meetei-mayek",
  },
  {
    id: "modi",
    label: "Modi",
    native: "𑘀𑘎𑘿𑘬𑘨",
    note: "same words, Modi letters",
    target: "modi",
  },
  {
    id: "mro",
    label: "Mro",
    native: "𖩒𖩌𖩔𖩒𖩓𖩒",
    note: "same words, Mro letters",
    target: "mro",
  },
  {
    id: "multani",
    label: "Multani",
    native: "𑊀𑊄𑊥𑊀𑊢𑊀",
    note: "same words, Multani letters",
    target: "multani",
  },
  {
    id: "newa",
    label: "Newa",
    native: "𑐀𑐎𑑂𑐲𑐬",
    note: "same words, Newa letters",
    target: "newa",
  },
  {
    id: "ol-chiki",
    label: "Ol Chiki",
    native: "ᱚᱠᱥᱚᱨᱚ",
    note: "same words, Ol Chiki letters",
    target: "ol-chiki",
  },
  {
    id: "old-persian",
    label: "Old Persian",
    native: "𐎠𐎣𐏂𐎠𐎼𐎠",
    note: "same words, Old Persian letters",
    target: "old-persian",
  },
  {
    id: "phags-pa",
    label: "Phags-pa",
    native: "ꡝꡀꡚꡘ",
    note: "same words, Phags-pa letters",
    target: "phags-pa",
  },
  {
    id: "sharada",
    label: "Sharada",
    native: "𑆃𑆑𑇀𑆰𑆫",
    note: "same words, Sharada letters",
    target: "sharada",
  },
  {
    id: "siddham",
    label: "Siddham",
    native: "𑖀𑖎𑖿𑖬𑖨",
    note: "same words, Siddham letters",
    target: "siddham",
  },
  {
    id: "sora-sompeng",
    label: "Sora Sompeng",
    native: "𑃦𑃨𑃟𑃐𑃨𑃝",
    note: "same words, Sora Sompeng letters",
    target: "sora-sompeng",
  },
  {
    id: "takri",
    label: "Takri",
    native: "𑚀𑚊𑚶𑚋𑚤",
    note: "same words, Takri letters",
    target: "takri",
  },
  {
    id: "thai",
    label: "Thai",
    native: "ไทย",
    note: "same words, Thai letters",
    target: "thai",
  },
  {
    id: "tibetan",
    label: "Tibetan",
    native: "བོད་ཡིག",
    note: "same words, Tibetan letters",
    target: "tibetan",
  },
  {
    id: "tirhuta",
    label: "Tirhuta",
    native: "𑒁𑒏𑓂𑒭𑒩",
    note: "same words, Tirhuta letters",
    target: "tirhuta",
  },
  {
    id: "arabic",
    label: "Urdu",
    native: "اردو",
    note: "same words, Urdu letters",
    target: "arabic",
  },
  {
    id: "wancho",
    label: "Wancho",
    native: "𞋁𞋔𞋏𞋁𞋗𞋁",
    note: "same words, Wancho letters",
    target: "wancho",
  },
  {
    id: "warang-citi",
    label: "Warang Citi",
    native: "𑣁𑣌𑣞𑣜",
    note: "same words, Warang Citi letters",
    target: "warang-citi",
  },
  {
    id: "zanabazar-square",
    label: "Zanabazar Square",
    native: "𑨀𑨲𑨫",
    note: "same words, Zanabazar Square letters",
    target: "zanabazar-square",
  },
  {
    id: "english",
    label: "English letters",
    native: "Aa",
    note: "same words, English letters — not translated",
    target: "iast",
  },
];

/** The lyrics of one song in one script. */
export interface SongLyricScript {
  script: LyricScript;
  body: string;
  createdAt: string;
}

export interface Song extends InCircles, HasPhotos {
  id: number;
  memberId: string;
  memberName: string;
  songName: string;
  composer: string | null;
  raga: string | null;
  /**
   * The words as whoever shared the recording wrote them down. Null on the many
   * recordings that are humming, and always their own text — the app never goes
   * looking for the words of a song.
   */
  lyrics: string | null;
  /** What language those words are in: "Kannada", "Sanskrit", "Hindi". */
  lyricsLanguage: string | null;
  /**
   * Which roman convention the words are typed in, when they are in Latin letters:
   * without it there is no exact way to read `aa`, so a scheme is what lets romanised
   * lyrics be converted by table rather than guessed at by a model. Null on words
   * written in an Indic script, where the letters say what they are.
   */
  lyricsScheme: RomanScheme | null;
  /**
   * The recording itself, and null when there is none. A song may be words alone —
   * somebody who knows a stotra and cannot sing it today still has the whole of it
   * to give — so the audio is optional and every surface has to cope with its
   * absence rather than assume a player.
   */
  blobKey: string | null;
  durationSeconds: number | null;
  visibility: Visibility;
  createdAt: string;
  /** Its answers to whatever its circles' Songs categories ask. */
  fieldValues?: PostFieldValue[];
  /** The scripts already rendered. Absent on a song just shared from this browser. */
  lyricScripts?: SongLyricScript[];
  /**
   * Which scripts can actually be made for these particular words, out of the ones the
   * author asked for. The server works it out, because the answer depends on the script
   * the words are in and on the roman convention behind them — neither of which the
   * browser can see. A script the words are already in is not in it, and neither is one
   * that could only fail, so the buttons drawn from this never promise something that
   * will not arrive.
   */
  lyricScriptsAvailable?: LyricScript[];
  /**
   * The scripts the member who shared it asked the words to be readable in. Null on a
   * recording shared before the form asked, where whatever the words allow is offered
   * exactly as it was before; an empty list is an author who was asked and said no.
   */
  readInto?: LyricScript[] | null;
  /** What the group is asking about it — which raga it is, mostly. */
  discussions?: Discussion[];
}

// Menu type and Dish type used to be two lists written into this file and drawn
// straight onto the recipe form. They are the circle's own configurable fields
// now — one circle offers Non-vegetarian and the next one need not — so the only
// copy left is `RECIPE_MENU_TYPES` / `RECIPE_DISH_TYPES` in
// `netlify/lib/recipes.ts`, where they are the *starter* questions a Recipes
// category is seeded with once and a keeper may then rewrite. Nothing in the
// browser needs them: the form draws whatever the circle actually asks.

/**
 * The two answers as a card reads them, in the order a menu would say them: what
 * kind of dish it is, then who can eat it. One function rather than one per
 * surface, because the recipe card, the open recipe and the mixed feed row all
 * printed the single "Category" in the same slot and now all print these.
 *
 * A recipe answered neither question contributes nothing, exactly as an
 * unanswered "Category" did — a quiet row stays quiet.
 */
export function recipeMenuBits(recipe: {
  menuTypes: string[];
  dishType: string | null;
  fieldValues?: PostFieldValue[] | null;
}): string[] {
  // Anything the circle's own Menu type and Dish type fields already answered.
  // Those two used to be hard-coded columns and are configurable fields now, so
  // a recipe shared before the change carries the old columns and one shared
  // after it carries the answers — and a recipe edited across the change can
  // carry both, saying the same thing twice. The columns are never cleared (an
  // answer nobody asked for again is still what its author typed), so the
  // duplicate is dropped here, where the words are printed, rather than in the
  // database, where dropping it would lose it.
  const answered = new Set(
    (recipe.fieldValues ?? []).flatMap((value) =>
      value.value
        .split(/\r?\n/)
        .map((line) => line.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
  const dishType = recipe.dishType && !answered.has(recipe.dishType.toLowerCase())
    ? recipe.dishType
    : null;
  const menuTypes = recipe.menuTypes.filter((entry) => !answered.has(entry.toLowerCase()));
  return [dishType, menuTypes.join(", ")].filter((bit): bit is string => Boolean(bit));
}

export interface Recipe extends InCircles, HasPhotos, HasExperiences {
  id: number;
  memberId: string;
  memberName: string;
  title: string;
  ingredients: string;
  method: string;
  notes: string | null;
  prepMinutes: number | null;
  /** Who can eat it, any number of `RECIPE_MENU_TYPES`. Empty when unanswered. */
  menuTypes: string[];
  /** What kind of dish it is, one of `RECIPE_DISH_TYPES` — or anything a legacy
   * `category` held, which is offered back rather than dropped. */
  dishType: string | null;
  /**
   * The single "Category" the form asked for before Menu type and Dish type
   * replaced it. Still stored and still sent, and read by nothing on screen: the
   * server has already folded it into the two fields above, so a card that showed
   * both would say "Vegetarian · Vegetarian".
   */
  category: string | null;
  /**
   * The answers to whatever the recipe's circles ask about a recipe of their
   * own — Menu type and Dish type among them now, those two having become
   * ordinary configurable fields so that one circle can offer Non-vegetarian and
   * the next one need not.
   */
  fieldValues?: PostFieldValue[];
  visibility: Visibility;
  createdAt: string;
}

export interface Fact extends InCircles, HasPhotos {
  id: number;
  memberId: string;
  memberName: string;
  fact: string;
  category: string;
  source: string | null;
  visibility: Visibility;
  createdAt: string;
}

/**
 * A link worth passing on, and the name somebody gave it. The whole of a bookmark
 * is where it points, which is why it extends `InCircles` and not `HasPhotos`: the
 * thing being shared is somewhere else, and a picture beside the link would be
 * decoration rather than the share itself — the same reason a word carries none.
 *
 * `url` is what the server stored rather than what was typed: the scheme filled in
 * where it was missing, and known to be http or https, because it is rendered as
 * something to tap.
 */
export interface Bookmark extends InCircles {
  id: number;
  memberId: string;
  memberName: string;
  title: string;
  url: string;
  visibility: Visibility;
  createdAt: string;
}

/**
 * The same word somewhere else: a Greek root, the German for it, the Hindi
 * spelling. Anybody who can see a word may add one, so a connection names its own
 * author rather than borrowing the word's.
 */
export interface WordConnection {
  id: number;
  wordId: number;
  language: string;
  term: string;
  note: string | null;
  memberId: string;
  memberName: string;
  createdAt: string;
}

/** What the "+ Add Connection" form sends. */
export interface NewWordConnection {
  language: string;
  term: string;
  note?: string;
}

/** As many as one word can hold; the same ceiling the server keeps. */
export const MAX_WORD_CONNECTIONS = 24;

/**
 * What a word form sends. A word is the one share whose contributions can be
 * typed before it exists: the member adding "asthi" already knows the Greek and
 * the German for it, so the add-word form takes the connections alongside the
 * meaning and the server creates them with the word. They travel as the
 * connection form's shape rather than as stored rows, since a draft has no id
 * and no author yet.
 */
export type SharedWord = Omit<Shared<Word>, "connections"> & {
  connections?: NewWordConnection[];
};

export interface Word extends InCircles {
  id: number;
  memberId: string;
  memberName: string;
  word: string;
  meaning: string;
  example: string | null;
  language: string | null;
  pronunciation: string | null;
  /** Words that mean nearly the same. Empty when nobody added any. */
  synonyms: string[];
  /** Words that mean the opposite. Empty when nobody added any. */
  antonyms: string[];
  notes: string | null;
  source: string | null;
  visibility: Visibility;
  createdAt: string;
  /** Absent only on a word this member added a moment ago. */
  connections?: WordConnection[];
}

/**
 * One reply in a discussion. It names its own author, because a discussion is
 * something the group does rather than something the share's owner wrote.
 */
export interface DiscussionReply {
  id: number;
  discussionId: number;
  body: string;
  memberId: string;
  memberName: string;
  createdAt: string;
}

/** The kinds of share that carry a conversation: a book, and a recording. */
export type DiscussionItemType = "book" | "song";

/**
 * A question somebody asked about a share, and what the group said back:
 * "Which chapter impacted you the most?" with twelve people answering, or "Which
 * raga is this?" under a recording.
 *
 * `summary` is the AI reading of a thread long enough to be worth reducing to a few
 * lines, cached on the server; `summaryStale` says the thread has moved on since it
 * was made, and `summarizable` whether there is yet enough to summarise at all.
 */
export interface Discussion {
  id: number;
  itemType: DiscussionItemType;
  itemId: number;
  prompt: string;
  memberId: string;
  memberName: string;
  createdAt: string;
  replyCount: number;
  /** Distinct members who replied — the "12 people joined the discussion". */
  participantCount: number;
  replies: DiscussionReply[];
  summary: string | null;
  summaryAt: string | null;
  summaryStale: boolean;
  summarizable: boolean;
}

/** How many liked something, and whether this member is one of them. */
export interface LikeState {
  likeCount: number;
  likedByMe: boolean;
}

export interface Book extends InCircles, HasPhotos {
  id: number;
  memberId: string;
  memberName: string;
  title: string;
  author: string | null;
  genre: string | null;
  /** The language the book was read in — a picked option or one typed under "Other". */
  language: string | null;
  rating: number | null;
  review: string | null;
  /** The first line worth remembering, mirrored from `quotes` by the API. */
  quote: string | null;
  /** Every line worth remembering, in the order the member added them. */
  quotes: string[];
  /** Where another member can buy a copy, or null when nobody added a link. */
  buyUrl: string | null;
  visibility: Visibility;
  createdAt: string;
  /** Its answers to whatever its circles' Books categories ask. */
  fieldValues?: PostFieldValue[];
  /** Newest thread first. Absent only on a book added a moment ago. */
  discussions?: Discussion[];
  likeCount?: number;
  likedByMe?: boolean;
}

/**
 * What happened when somebody tried it: a recipe's experiences and tips, and the
 * experiences and extras members add to a remedy. Like a language connection, it
 * belongs to whoever wrote it rather than to the share's author.
 */
export interface ItemExperience {
  id: number;
  itemType: "recipe" | "remedy";
  itemId: number;
  kind: ExperienceKind;
  body: string;
  memberId: string;
  memberName: string;
  createdAt: string;
}

/**
 * "experience" is how it went, "tip" is advice for the next person, and "extra" is
 * anything else somebody added — the note that fits neither.
 */
export type ExperienceKind = "experience" | "tip" | "extra";

/** What the "+ Add" form on a recipe or a remedy sends. */
export interface NewExperience {
  kind: ExperienceKind;
  body: string;
}

/** A recipe and a remedy both collect what members found when they tried them. */
export interface HasExperiences {
  /** Absent only on something this member shared a moment ago. */
  experiences?: ItemExperience[];
}


/** A home remedy passed down in a family. Shared knowledge, not medical advice. */
export interface Remedy extends InCircles, HasPhotos, HasExperiences {
  id: number;
  memberId: string;
  memberName: string;
  title: string;
  /** What it helps with — "sore throat", "cough", "indigestion". */
  usedFor: string;
  /** One ingredient per line. */
  ingredients: string;
  /** One preparation step per line. */
  preparation: string;
  howToUse: string | null;
  /** Who it came down from, when the member wanted to credit them. */
  passedDownFrom: string | null;
  notes: string | null;
  visibility: Visibility;
  createdAt: string;
}

/**
 * A script a post can be read in. Every one of them keeps the words and changes only
 * the letters, which is a mapping and is exact — a post is re-lettered or it is left
 * as written, and nothing here says what it means in another language.
 */
export type PostLanguage =
  | "devanagari"
  | "bengali"
  | "gurmukhi"
  | "gujarati"
  | "oriya"
  | "tamil"
  | "telugu"
  | "kannada"
  | "malayalam"
  | "sinhala"
  | "ahom"
  | "avestan"
  | "balinese"
  | "bhaiksuki"
  | "brahmi"
  | "burmese"
  | "cham"
  | "dogra"
  | "grantha"
  | "gunjala-gondi"
  | "hanifi-rohingya"
  | "javanese"
  | "kharoshthi"
  | "khmer"
  | "khudawadi"
  | "lao"
  | "lepcha"
  | "limbu"
  | "mahajani"
  | "marchen"
  | "masaram-gondi"
  | "meetei-mayek"
  | "modi"
  | "mro"
  | "multani"
  | "newa"
  | "ol-chiki"
  | "old-persian"
  | "phags-pa"
  | "sharada"
  | "siddham"
  | "sora-sompeng"
  | "takri"
  | "thai"
  | "tibetan"
  | "tirhuta"
  | "arabic"
  | "wancho"
  | "warang-citi"
  | "zanabazar-square"
  | "english-script";

/**
 * The scripts a post's author can offer, in the order they are drawn. The native
 * spelling is what somebody who reads that script looks for first, so it sits
 * beside the English name on both the form and the links under the post.
 */
export const POST_LANGUAGE_OPTIONS: {
  id: PostLanguage;
  label: string;
  native: string;
  /** What tapping it does, said plainly. */
  note: string;
}[] = [
  {
    id: "devanagari",
    label: "Devanagari",
    native: "देवनागरी",
    note: "same words, Devanagari letters",
  },
  {
    id: "bengali",
    label: "Bengali",
    native: "বাংলা",
    note: "same words, Bengali letters",
  },
  {
    id: "gurmukhi",
    label: "Gurmukhi",
    native: "ਗੁਰਮੁਖੀ",
    note: "same words, Gurmukhi letters",
  },
  {
    id: "gujarati",
    label: "Gujarati",
    native: "ગુજરાતી",
    note: "same words, Gujarati letters",
  },
  {
    id: "oriya",
    label: "Odia",
    native: "ଓଡ଼ିଆ",
    note: "same words, Odia letters",
  },
  {
    id: "tamil",
    label: "Tamil",
    native: "தமிழ்",
    note: "same words, Tamil letters",
  },
  {
    id: "telugu",
    label: "Telugu",
    native: "తెలుగు",
    note: "same words, Telugu letters",
  },
  {
    id: "kannada",
    label: "Kannada",
    native: "ಕನ್ನಡ",
    note: "same words, Kannada letters",
  },
  {
    id: "malayalam",
    label: "Malayalam",
    native: "മലയാളം",
    note: "same words, Malayalam letters",
  },
  {
    id: "sinhala",
    label: "Sinhala",
    native: "සිංහල",
    note: "same words, Sinhala letters",
  },
  {
    id: "ahom",
    label: "Ahom",
    native: "𑜒𑜀𑜫𑜏𑜍",
    note: "same words, Ahom letters",
  },
  {
    id: "avestan",
    label: "Avestan",
    native: "𐬀𐬐𐬴𐬀𐬀𐬭𐬀𐬀",
    note: "same words, Avestan letters",
  },
  {
    id: "balinese",
    label: "Balinese",
    native: "ᬅᬓ᭄ᬱᬭ",
    note: "same words, Balinese letters",
  },
  {
    id: "bhaiksuki",
    label: "Bhaiksuki",
    native: "𑰀𑰎𑰿𑰬𑰨",
    note: "same words, Bhaiksuki letters",
  },
  {
    id: "brahmi",
    label: "Brahmi",
    native: "𑀅𑀓𑁆𑀱𑀭",
    note: "same words, Brahmi letters",
  },
  {
    id: "burmese",
    label: "Burmese",
    native: "မြန်မာ",
    note: "same words, Burmese letters",
  },
  {
    id: "cham",
    label: "Cham",
    native: "ꨀꩀꨦꨣ",
    note: "same words, Cham letters",
  },
  {
    id: "dogra",
    label: "Dogra",
    native: "𑠀𑠊𑠹𑠨𑠤",
    note: "same words, Dogra letters",
  },
  {
    id: "grantha",
    label: "Grantha",
    native: "𑌅𑌕𑍍𑌷𑌰",
    note: "same words, Grantha letters",
  },
  {
    id: "gunjala-gondi",
    label: "Gunjala Gondi",
    native: "𑵠𑵱𑶗𑶉𑶈",
    note: "same words, Gunjala Gondi letters",
  },
  {
    id: "hanifi-rohingya",
    label: "Hanifi Rohingya",
    native: "𐴀𐴝𐴑𐴐𐴝𐴌𐴝",
    note: "same words, Hanifi Rohingya letters",
  },
  {
    id: "javanese",
    label: "Javanese",
    native: "ꦄꦏ꧀ꦰꦫ",
    note: "same words, Javanese letters",
  },
  {
    id: "kharoshthi",
    label: "Kharoshthi",
    native: "𐨀𐨐𐨿𐨮𐨪",
    note: "same words, Kharoshthi letters",
  },
  {
    id: "khmer",
    label: "Khmer",
    native: "ខ្មែរ",
    note: "same words, Khmer letters",
  },
  {
    id: "khudawadi",
    label: "Khudawadi",
    native: "𑊰𑊺𑋪𑋜𑋩𑋙",
    note: "same words, Khudawadi letters",
  },
  {
    id: "lao",
    label: "Lao",
    native: "ລາວ",
    note: "same words, Lao letters",
  },
  {
    id: "lepcha",
    label: "Lepcha",
    native: "ᰣᰀᰡ᰷ᰛ",
    note: "same words, Lepcha letters",
  },
  {
    id: "limbu",
    label: "Limbu",
    native: "ᤀᤁ᤻ᤙᤖ",
    note: "same words, Limbu letters",
  },
  {
    id: "mahajani",
    label: "Mahajani",
    native: "𑅐𑅕𑅖𑅳𑅐𑅭𑅐",
    note: "same words, Mahajani letters",
  },
  {
    id: "marchen",
    label: "Marchen",
    native: "𑲏𑱲𑲬𑲊",
    note: "same words, Marchen letters",
  },
  {
    id: "masaram-gondi",
    label: "Masaram Gondi",
    native: "𑴀𑴮𑴦",
    note: "same words, Masaram Gondi letters",
  },
  {
    id: "meetei-mayek",
    label: "Meetei Mayek",
    native: "ꯑꯛꯁꯔ",
    note: "same words, Meetei Mayek letters",
  },
  {
    id: "modi",
    label: "Modi",
    native: "𑘀𑘎𑘿𑘬𑘨",
    note: "same words, Modi letters",
  },
  {
    id: "mro",
    label: "Mro",
    native: "𖩒𖩌𖩔𖩒𖩓𖩒",
    note: "same words, Mro letters",
  },
  {
    id: "multani",
    label: "Multani",
    native: "𑊀𑊄𑊥𑊀𑊢𑊀",
    note: "same words, Multani letters",
  },
  {
    id: "newa",
    label: "Newa",
    native: "𑐀𑐎𑑂𑐲𑐬",
    note: "same words, Newa letters",
  },
  {
    id: "ol-chiki",
    label: "Ol Chiki",
    native: "ᱚᱠᱥᱚᱨᱚ",
    note: "same words, Ol Chiki letters",
  },
  {
    id: "old-persian",
    label: "Old Persian",
    native: "𐎠𐎣𐏂𐎠𐎼𐎠",
    note: "same words, Old Persian letters",
  },
  {
    id: "phags-pa",
    label: "Phags-pa",
    native: "ꡝꡀꡚꡘ",
    note: "same words, Phags-pa letters",
  },
  {
    id: "sharada",
    label: "Sharada",
    native: "𑆃𑆑𑇀𑆰𑆫",
    note: "same words, Sharada letters",
  },
  {
    id: "siddham",
    label: "Siddham",
    native: "𑖀𑖎𑖿𑖬𑖨",
    note: "same words, Siddham letters",
  },
  {
    id: "sora-sompeng",
    label: "Sora Sompeng",
    native: "𑃦𑃨𑃟𑃐𑃨𑃝",
    note: "same words, Sora Sompeng letters",
  },
  {
    id: "takri",
    label: "Takri",
    native: "𑚀𑚊𑚶𑚋𑚤",
    note: "same words, Takri letters",
  },
  {
    id: "thai",
    label: "Thai",
    native: "ไทย",
    note: "same words, Thai letters",
  },
  {
    id: "tibetan",
    label: "Tibetan",
    native: "བོད་ཡིག",
    note: "same words, Tibetan letters",
  },
  {
    id: "tirhuta",
    label: "Tirhuta",
    native: "𑒁𑒏𑓂𑒭𑒩",
    note: "same words, Tirhuta letters",
  },
  {
    id: "arabic",
    label: "Urdu",
    native: "اردو",
    note: "same words, Urdu letters",
  },
  {
    id: "wancho",
    label: "Wancho",
    native: "𞋁𞋔𞋏𞋁𞋗𞋁",
    note: "same words, Wancho letters",
  },
  {
    id: "warang-citi",
    label: "Warang Citi",
    native: "𑣁𑣌𑣞𑣜",
    note: "same words, Warang Citi letters",
  },
  {
    id: "zanabazar-square",
    label: "Zanabazar Square",
    native: "𑨀𑨲𑨫",
    note: "same words, Zanabazar Square letters",
  },
  {
    id: "english-script",
    label: "English letters",
    native: "Aa",
    note: "same words, English letters — not translated",
  },
];

/** One post's details in one script. */
export interface PostTranslation {
  language: PostLanguage;
  body: string;
  createdAt: string;
}

/**
 * A post in a category a circle invented. One form for all of them, because a
 * category made up at runtime cannot have a hand-built form of its own.
 */
export interface Post extends InCircles, HasPhotos {
  id: number;
  memberId: string;
  memberName: string;
  /** The circle category it belongs to, which settles the circle it is in. */
  categoryId: number;
  title: string;
  body: string | null;
  /**
   * Free text, so "Every Ekadashi" is as valid as a date. No form asks for it any
   * more; posts written while one did still carry what was typed.
   */
  happensOn: string | null;
  /**
   * The scripts the author asked for the details in. Empty on a post that is
   * read only in the letters it was written in.
   */
  translateInto: PostLanguage[];
  /** The scripts already written out. Absent on a post just shared from here. */
  translations?: PostTranslation[];
  /**
   * Which of them can actually be made for these particular details — a mapping has to
   * know what it is mapping from, and details in Latin letters say nothing about what
   * they are. Absent on a post just shared from here, and on an older response, where
   * the author's own list stands on its own as it always did.
   */
  translationsAvailable?: PostLanguage[];
  /**
   * What this post answered to its category's own questions, in the order the
   * category asks them. A question left blank has no row here at all.
   */
  fieldValues?: PostFieldValue[];
  visibility: Visibility;
  createdAt: string;
}

/**
 * What the post form sends. Its answers travel as `{ fieldId: value }` rather
 * than as the rows a post is read back with, because a form knows which question
 * it is answering and nothing else about it — the label and the kind are the
 * category's, not the post's.
 */
export type SharedPost = Omit<Shared<Post>, "fieldValues"> & {
  fieldValues?: Record<number, string>;
};

export interface Notification {
  id: number;
  message: string;
  itemType: ItemType | null;
  /** Null when the whole group sees it; a member id when it is addressed to one member. */
  memberId: string | null;
  /** The circle the news belongs to, when it belongs to one; null reaches everyone. */
  circleId: number | null;
  /** An in-app hash route to open when the notification is tapped, when there is one. */
  link: string | null;
  createdAt: string;
}

export type InviteStatus = "pending" | "accepted" | "revoked";

/**
 * The circle an invite was made from, when it was made from one. Accepting such a
 * link joins the group and that circle together, so an owner can bring in someone
 * who has no account yet.
 */
export interface InviteCircle {
  id: number;
  name: string;
  icon: string;
}

/** An invite as its sender sees it, in the Profile tab. */
export interface Invite {
  token: string;
  inviterName: string;
  inviteeName: string | null;
  inviteeEmail: string | null;
  note: string | null;
  status: InviteStatus;
  circle: InviteCircle | null;
  acceptedMemberName: string | null;
  acceptedAt: string | null;
  createdAt: string;
}

/** What the invited friend sees before they have an account. */
export interface InvitePreview {
  token: string;
  inviterName: string;
  inviteeName: string | null;
  note: string | null;
  status: InviteStatus;
  circle: InviteCircle | null;
  createdAt: string;
}

export interface NewInvite {
  inviteeName?: string;
  inviteeEmail?: string;
  note?: string;
  /** Set to invite straight into a circle you own. */
  circleId?: number;
}


/**
 * One item as somebody outside the app is answered with it.
 *
 * The same per-type shapes every card already reads, minus the two things a
 * stranger has no business with: `memberId`, an Identity id, and a song's
 * `blobKey`, the audio being served by the token instead — `hasAudio` is all the
 * shell needs. The circle lists are absent too, and that is the point rather than
 * an omission: a shared link answers with one item and the one circle it came out
 * of, so there is nothing on it to walk sideways from.
 */
type PublicItem<T> = Omit<T, "memberId" | "blobKey" | "circleIds" | "filings">;

/** Which kind of thing was shared, and the thing itself. */
export type SharedThing =
  | ({ itemType: "song"; hasAudio: boolean } & PublicItem<Song>)
  | ({ itemType: "recipe" } & PublicItem<Recipe>)
  | ({ itemType: "fact" } & PublicItem<Fact>)
  | ({ itemType: "word" } & PublicItem<Word>)
  | ({ itemType: "book" } & PublicItem<Book>)
  | ({ itemType: "remedy" } & PublicItem<Remedy>)
  | ({ itemType: "bookmark" } & PublicItem<Bookmark>)
  | ({
      itemType: "post";
      /** The name of the thing it is — "Travelogue" rather than "a post". */
      categoryName: string | null;
      categoryIcon: string | null;
    } & PublicItem<Post>);

/**
 * Where a shared item came from, as much of it as a recipient is told: enough to
 * want more of it, and nothing that would let them read it. No head count, no
 * roll, no list of what else is in there.
 */
export interface SharedCircle {
  id: number;
  name: string;
  icon: string;
  description: string | null;
  privacy: CirclePrivacy;
  isDefault: boolean;
  /** `["Madhwa Festivals", "Krishna Janmashtami"]`, where the item sits in one. */
  folderPath: string[];
}

/**
 * Everything behind a share link: one item, and where it came from.
 *
 * `item` is nullable, and the two flags beside it say why. **`locked` is an
 * invite-only circle read by somebody who is not in it**: the link answers with
 * what kind of thing was shared, its name and who sent it, and withholds the
 * thing itself, because a circle whose members were let in one at a time is not
 * readable by anybody holding a link. Every other circle — Open to All and Ask to
 * Join, both of which are listed in the app for anybody to look at — answers in
 * full, the content being the invitation. `member` is whether the reader is
 * already in the circle, which decides whether they are offered it or simply
 * shown the way in.
 */
export interface SharedView {
  token: string;
  /** Who handed the link out, so the page can say who thought of them. */
  sharedByName: string;
  /** Whether the reader is already in the circle this came out of. */
  member: boolean;
  /** An invite-only circle, and the reader is not in it: identity only. */
  locked: boolean;
  /** What kind of thing it is, which a locked link says as well as an open one. */
  itemType: ItemType;
  /** Its own name, or null for a fun fact, whose name would be its content. */
  title: string | null;
  /** Null exactly when `locked` — there is nothing else that empties it. */
  item: SharedThing | null;
  /** Null for something shared before circles existed, which reached the group. */
  circle: SharedCircle | null;
}

export interface SavedRef {
  itemType: ItemType;
  itemId: number;
  createdAt: string;
}

/**
 * The saved items themselves, sent alongside the references. A library keeps what
 * a member saved even after they leave the circle it was shared into, so these
 * rows can include items that no longer appear in any listing.
 */
export interface LibraryItems {
  song?: Song[];
  recipe?: Recipe[];
  fact?: Fact[];
  word?: Word[];
  book?: Book[];
  remedy?: Remedy[];
  bookmark?: Bookmark[];
  post?: Post[];
}

export interface LibraryState {
  saves: SavedRef[];
  items: LibraryItems;
  learnedWordIds: number[];
}

// Circles --------------------------------------------------------------------

/**
 * The three doors a circle can have: "private" is invite only, "discoverable" is
 * **Ask to Join** — listed, and the owner decides — and "public" is **Open to
 * All**, listed and joined on the spot.
 */
export type CirclePrivacy = "private" | "discoverable" | "public";

/**
 * "owner" starts a circle and keeps it; "admin" looks after it alongside them,
 * with the same say over its details, its categories, its people and its
 * closure; "member" reads and shares. An owner cannot be demoted — deleting the
 * circle is their way out — so the admin role is the only one that ever changes
 * hands. What is left of ownership is that one exemption and nothing else.
 */
export type CircleRole = "owner" | "admin" | "member";

/** Where a member stands with a circle they are not in yet. */
export type CircleStanding = "invited" | "requested" | null;

export interface Circle {
  id: number;
  name: string;
  description: string | null;
  icon: string;
  coverUrl: string | null;
  privacy: CirclePrivacy;
  ownerId: string;
  ownerName: string;
  /** True for Discover, the one circle every member is joined to. */
  isDefault: boolean;
  /**
   * Whether a plain member may add to this circle's taxonomy while posting. The
   * circle's one piece of configuration, and on unless its owner switched it off;
   * whoever looks after the circle may always add, whatever it says.
   */
  memberTaxonomy: boolean;
  /**
   * The circle this one is a branch of, or null when it stands on its own.
   *
   * An organisation with chapters — SVKV with Austin, Houston and Phoenix — is
   * one circle with three branches, and this id is the whole of what says so.
   * It used to be read off the name: anything starting "SVKV - " was treated as
   * a branch of SVKV, which meant the relationship could not be set, could not
   * be undone, and forced every chapter to be named after its parent. Now it is
   * a fact somebody decided, so a branch can simply be called Austin.
   *
   * It is **organisational only** and nothing is inherited: a branch keeps its
   * own members, admins, categories, shelves, fields and shares, and being in
   * Austin says nothing about being in SVKV. What it changes is presentation —
   * grouped under its parent on the listing, nested in the header dropdown, and
   * "Branch of SVKV" on its own page.
   */
  parentCircleId: number | null;
  /**
   * The parent's name and icon, sent with the circle rather than looked up in
   * the browser's own list. A member can be in Austin without being in SVKV, and
   * Austin's page still has to be able to say which organisation it belongs to.
   */
  parentName: string | null;
  parentIcon: string | null;
  memberCount: number;
  /** The caller's role, or null when they are not a member. */
  role: CircleRole | null;
  standing: CircleStanding;
  createdAt: string;
}

export interface CircleMember {
  memberId: string;
  memberName: string;
  role: CircleRole;
  createdAt: string;
}

/** Someone waiting: invited by a manager of the circle, or asking to be let in. */
export interface CirclePending {
  memberId: string;
  memberName: string;
  createdAt: string;
}

export interface CircleInvitation {
  circle: Circle;
  invitedByName: string;
  createdAt: string;
}

/** A request to join one of the circles the caller owns. */
export interface CircleRequest {
  circleId: number;
  circleName: string;
  circleIcon: string;
  memberId: string;
  memberName: string;
  createdAt: string;
}

export interface CirclesState {
  circles: Circle[];
  discover: Circle[];
  invitations: CircleInvitation[];
  requests: CircleRequest[];
}

export interface CircleDetail {
  circle: Circle;
  /** What can be shared into this circle, in the order its managers put them. */
  categories: CircleCategory[];
  members: CircleMember[];
  /** Moderators only: people invited who have not answered yet. */
  invitations: CirclePending[];
  /** Moderators only: people asking to join. */
  requests: CirclePending[];
  /** How the caller moderates this circle, or null when they do not. */
  moderating: "owner" | "admin" | "app_admin" | null;
  /** Moderators only: what has been reported here. */
  reports: ContentReport[];
}

/**
 * One person the member shares a circle with, and which circles those are. This
 * is the roll for **All circles** — the scope the app opens on — where the
 * question is who is around rather than who is in one particular room. A
 * circle's own roll (`CircleDetail.members`) is the narrower answer and the one
 * that carries roles, a waiting list and the controls that go with them.
 */
export interface GroupMember {
  memberId: string;
  memberName: string;
  circles: { circleId: number; circleName: string; circleIcon: string; role: CircleRole }[];
}

export interface NewCircle {
  name: string;
  description?: string | null;
  icon?: string;
  coverKey?: string | null;
  privacy?: CirclePrivacy;
  /**
   * Whether plain members may add to the circle's taxonomy while posting. Left
   * out means the default, which is yes — a circle keeps its tree to its owner
   * and admins by deciding to, not by forgetting to say.
   */
  memberTaxonomy?: boolean;
  /**
   * "Branch of": the circle this one hangs under, or null for an independent
   * circle, which is the default and what leaving it out means on a create.
   *
   * On an edit the three states are all meaningful, the same way filing and
   * photos read: an id attaches, an explicit null detaches, and the key being
   * absent says nothing at all, so a form that never asked leaves the answer
   * alone. Attaching is refused unless the member also looks after the circle it
   * is going under — nobody hangs their circle off somebody else's name.
   */
  parentCircleId?: number | null;
  inviteMemberIds?: string[];
  /** What the circle is for: the built-ins it uses, plus any it invents. */
  categories?: NewCategory[];
}

// Categories and subcategories ----------------------------------------------

/**
 * A category is what a circle can hold: the six built-in kinds, plus whatever the
 * circle invented. `itemType` says which — null means a category of this circle's
 * own, whose posts are plain `Post` rows.
 *
 * Every category belongs to one circle. Two circles may both have "Recipes" and
 * neither one's shelves show up in the other.
 */
export interface CircleCategory {
  id: number;
  circleId: number;
  itemType: Exclude<ItemType, "post"> | null;
  name: string;
  icon: string;
  sortOrder: number;
  /** Switched off by a manager: reversible, and nothing was deleted. */
  hidden: boolean;
  /** Everything in the category the caller can see, filed or not. */
  count: number;
  /** How many of those are on no shelf at all. */
  uncategorizedCount: number;
  subcategories: Subcategory[];
  /**
   * The extra questions this category asks on the share form. Always empty for
   * the six built-ins, which have hand-built forms of their own.
   */
  fields: CategoryField[];
}

/**
 * One node of a circle's taxonomy. The list is flat and depth-first, and the tree
 * is in `parentId` — null for a node directly under the category, which is the
 * top level of the tree the category roots.
 *
 * `path` is the node's ancestors and itself by name, so a breadcrumb costs no
 * walking, and `depth` is how far down it sits (1 directly under the category).
 * The two counts are different questions: `count` is what is filed on this exact
 * node, `totalCount` is that plus everything in the branch under it.
 */
export interface Subcategory {
  id: number;
  name: string;
  /** Null for a node at the top of the category. */
  parentId: number | null;
  /** The names from the top of the category down to and including this one. */
  path: string[];
  /** 1 for a node directly under the category. */
  depth: number;
  sortOrder: number;
  /** Switched off by a manager: reversible, and the branch under it goes too. */
  hidden: boolean;
  /** Filed on this exact node. */
  count: number;
  /** This node and everything under it. */
  totalCount: number;
  /** How many nodes sit directly beneath it. */
  childCount: number;
}

/**
 * One folder of a circle — where a share belongs, as against what kind of thing
 * it is. The list is flat and depth-first and the tree is in `parentId`, exactly
 * as a `Subcategory` list is, but it hangs off the **circle** rather than off one
 * category: a folder holds songs, recipes and books together, which is the whole
 * reason it exists beside the shelves rather than instead of them.
 *
 * `path` is its ancestors and itself by name, so a breadcrumb costs no walking,
 * and the two counts are two questions: `count` is what sits in this exact
 * folder, `totalCount` is that plus everything in the subfolders under it.
 */
export interface Folder {
  id: number;
  name: string;
  /** Null for a folder at the top of the circle. */
  parentId: number | null;
  /** The names from the top of the circle down to and including this one. */
  path: string[];
  /** 1 for a folder directly in the circle. */
  depth: number;
  sortOrder: number;
  /** Hidden by a keeper: reversible, and the branch under it goes too. */
  hidden: boolean;
  /** Shared into this exact folder. */
  count: number;
  /** This folder and everything under it. */
  totalCount: number;
  /** How many subfolders sit directly inside it. */
  childCount: number;
}

/**
 * What a field asks for, and so what the share form draws: one line, a paragraph,
 * a tick, a dropdown of the field's own choices, tick boxes over that same list
 * where more than one answer applies at once, an upload — the one answer a
 * member does not type, because the recipe sheet or the itinerary was written
 * somewhere else first — or a link, which is the same thought about somewhere
 * else that was never a file: a recording on YouTube, the shop the ingredient
 * came from, the article the fact was read in.
 */
export type FieldKind =
  | "text"
  | "textarea"
  | "checkbox"
  | "select"
  | "multiselect"
  | "file"
  | "link";

/** The seven kinds as the "+ Add a field" picker offers them. */
export const FIELD_KIND_OPTIONS: { id: FieldKind; label: string; note: string }[] = [
  { id: "text", label: "Short text", note: "One line — a name, a place, a raga." },
  { id: "textarea", label: "Long text", note: "A paragraph or several." },
  { id: "checkbox", label: "Tick box", note: "A yes or no." },
  { id: "select", label: "Dropdown", note: "One of a list you write." },
  // The same list of choices, asked where several of them are true of the same
  // entry at once — a sweet that is Vegetarian and No onion & garlic both.
  {
    id: "multiselect",
    label: "Tick boxes",
    note: "Any number of a list you write.",
  },
  // No note: an upload is a document or a recording, and the difference is the
  // next question rather than something a sentence here could cover.
  { id: "file", label: "Upload", note: "" },
  { id: "link", label: "Link", note: "A web address, shown as a link everybody can tap." },
];

/**
 * A web address as it can safely be put in an `href`, or null when it is not one.
 * `http` and `https` and nothing else — a stored answer is read back as something
 * a member taps, so `javascript:` is refused here as well as on the server rather
 * than trusted because the server saw it first.
 */
export function webAddress(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * How an address reads when it is the whole of what a field says: the host and
 * the path, without the scheme or a trailing slash nobody needs to see. The
 * address itself is still what the link goes to.
 */
export function linkLabel(href: string): string {
  try {
    const url = new URL(href);
    const rest = `${url.pathname}${url.search}`.replace(/\/$/, "");
    return `${url.host}${rest}`;
  } catch {
    return href;
  }
}

export const MAX_FIELDS_PER_CATEGORY = 12;

/**
 * What an upload field takes. A document is the ordinary case and the one every
 * upload field written before this question existed already means, which is why
 * the server reads a missing answer as `document` rather than making anybody
 * revisit a field they already configured.
 */
export type UploadKind = "document" | "audio";

/** The two, as the field form asks about them. */
export const UPLOAD_KIND_OPTIONS: { id: UploadKind; label: string }[] = [
  { id: "document", label: "Document" },
  { id: "audio", label: "Audio" },
];

/**
 * How a member may answer an audio field: sing it into the browser, pick a
 * recording off the device, or either. Both is the ordinary answer and is what a
 * field with nothing stored reads as.
 */
export type AudioWay = "record" | "upload";

export const AUDIO_WAY_OPTIONS: { id: AudioWay; label: string }[] = [
  { id: "record", label: "Record audio" },
  { id: "upload", label: "Upload an audio file" },
];

/**
 * An extra question one custom category asks. Every category a circle invents
 * shares the same form — a title, details, a shelf — and these are how a circle
 * makes that form its own: "Deity" on Stotras, "Country" on Travelogue.
 */
export interface CategoryField {
  id: number;
  categoryId: number;
  label: string;
  kind: FieldKind;
  /** The dropdown's choices. Empty for every other kind. */
  options: string[];
  hint: string | null;
  required: boolean;
  /**
   * Whether an upload field asks for a document or a recording. It decides which
   * of the two sets of rules below mean anything: a document is asked which
   * formats and how big, audio is asked how it may be answered.
   */
  uploadKind: UploadKind;
  /**
   * What an upload field takes. An empty list is any of the three, which is what
   * every field written before a circle could narrow it already says.
   */
  fileTypes: FieldFileType[];
  /** The biggest file this field accepts, or null for the platform's own ceiling. */
  maxBytes: number | null;
  /** Whether it takes several documents rather than one. */
  multiple: boolean;
  /**
   * The ways an audio field may be answered. Empty means both, so a field that
   * has never been asked the question offers everything rather than nothing.
   */
  audioWays: AudioWay[];
  sortOrder: number;
  /** Switched off by a manager: the form stops asking, the answers are kept. */
  hidden: boolean;
}

/**
 * One post's answer to one of those questions. The question travels with it, so a
 * saved copy in My Library still reads properly after the member leaves the circle.
 */
export interface PostFieldValue {
  fieldId: number;
  label: string;
  kind: FieldKind;
  value: string;
}

/** What came back from asking for a field: the new one, or the one already asking it. */
export interface FieldOutcome {
  created: CategoryField | null;
  /** Either the field just made or the one that was already there — never null. */
  field: CategoryField;
  categories: CircleCategory[];
}

/** What the "+ Add field" form sends. */
export interface NewCategoryField {
  label: string;
  kind: FieldKind;
  options?: string[];
  hint?: string | null;
  required?: boolean;
  uploadKind?: UploadKind;
  fileTypes?: FieldFileType[];
  maxBytes?: number | null;
  multiple?: boolean;
  audioWays?: AudioWay[];
}

/** A category a create-circle form is asking for. */
export interface NewCategory {
  /** Set for one of the six; leave it out for a category of the circle's own. */
  itemType?: Exclude<ItemType, "post">;
  name?: string;
  icon?: string;
}

/** What came back from asking for a new node: the node, or one much like it. */
export interface SubcategoryOutcome {
  created: { id: number; name: string; parentId?: number | null; path?: string[] } | null;
  /**
   * A node already under the same parent that the new name probably meant. Only a
   * sibling, because the same name in two branches is two different places.
   */
  similar: { id: number; name: string; path?: string[] } | null;
  categories: CircleCategory[];
}

/** What came back from asking for a folder: the folder, or one much like it. */
export interface FolderOutcome {
  created: { id: number; name: string; parentId: number | null; path: string[] } | null;
  /**
   * A folder already inside the same parent whose name the new one probably
   * meant. Only a sibling, because "Songs" in two branches is two real places.
   */
  similar: { id: number; name: string; path?: string[] } | null;
  folders: Folder[];
}

/** Somebody in the group, as the invite checkbox list sees them. */
export interface Contact {
  id: string;
  name: string;
}

// Access, moderation and the ⋮ menu ------------------------------------------

/**
 * Asks for a sign-in link to be emailed to an address — the "Continue with Email"
 * button, and the whole of what passwordless sign-in costs the browser.
 *
 * The one call in this file made by somebody who is not logged in, and the one
 * whose answer deliberately says nothing: `{ sent: true }` comes back whether the
 * address was already a member or has just become one, because the login form is
 * a place anybody can type anybody's address. Which of the two happened is worked
 * out on the server and never travels.
 *
 * `retryAfter` is the exception, and it is about this browser rather than about
 * the address: a 429 carries the seconds left on the cooldown so the resend button
 * can say how long instead of failing again.
 */
export async function requestEmailSignIn(email: string, inviteToken?: string | null) {
  const res = await send("/api/email-signin", "POST", {
    email,
    ...(inviteToken ? { inviteToken } : {}),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const error = new Error(body?.error ?? "The link could not be sent just now.") as Error & {
      retryAfter?: number;
    };
    if (typeof body?.retryAfter === "number") error.retryAfter = body.retryAfter;
    throw error;
  }
  return (await res.json()) as { sent: true };
}

/**
 * Where the member stands with the group. Read once at startup and after
 * anything that could move it — joining a circle, starting one — because it is
 * what decides between the app and one of the gate screens.
 */
/**
 * What an account is to the app as a whole, as against to any one circle.
 *
 * `app_manager` is narrower than its position in this list suggests and is not a
 * rank between the other two: it grants the usage report and nothing else — no
 * lever over an account, no reach into a circle, nothing anybody wrote. Every
 * other check in the app tests `=== "app_admin"`, so a manager is a plain member
 * everywhere but that one panel.
 */
export type AppRole = "member" | "app_manager" | "app_admin";

export interface AccessState {
  admitted: boolean;
  suspended: boolean;
  role: AppRole;
  trusted: boolean;
  canCreateCircle: boolean;
  /** Admitted but in no circle, which normally means a join that did not land. */
  needsCircle: boolean;
  /** Agreed to the Community Guidelines, which is asked once before posting. */
  acceptedGuidelines: boolean;
  circleCount: number;
  /** The first member of an empty group, who has nobody to be invited by. */
  founding: boolean;
  /** Days still to wait before the account may start circles on its own. */
  trustedInDays: number;
  trustedAfterDays: number;
}

export type ReportReason = "spam" | "abuse" | "inappropriate" | "wrong" | "other";

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam or an advert" },
  { value: "abuse", label: "Abusive or hurtful" },
  { value: "inappropriate", label: "Not appropriate for this circle" },
  { value: "wrong", label: "Wrong or misleading" },
  { value: "other", label: "Something else" },
];

/** The picker's own wording, reused wherever a report is read back. */
export function reasonLabel(reason: ReportReason) {
  return REPORT_REASONS.find((option) => option.value === reason)?.label ?? "Reported";
}

export type ReportStatus = "open" | "dismissed" | "removed";

/** A reported post, as its circle's moderators read it. */
export interface ContentReport {
  id: number;
  itemType: ItemType;
  itemId: number;
  circleId: number | null;
  circleName: string | null;
  reporterName: string;
  authorId: string;
  authorName: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  handledByName: string | null;
  handledAt: string | null;
  createdAt: string;
}

/** A post this member hid: theirs alone, and reversible from Profile. */
export interface HiddenRef {
  itemType: ItemType;
  itemId: number;
}

export interface BlockedMember {
  memberId: string;
  memberName: string | null;
  createdAt: string;
}

/** A row of the roll, which only the app admin ever sees. */
export interface MemberRecord {
  id: string;
  name: string;
  role: AppRole;
  status: "active" | "suspended";
  admittedAt: string | null;
  trustedAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface MyAccess {
  loggedIn: boolean;
  access: AccessState;
  /** The circles this member moderates, as owner or as admin. */
  moderating: number[];
  /** Open reports per circle, so a moderator sees where the work is waiting. */
  openReports: Record<string, number>;
  hidden: HiddenRef[];
  blocked: BlockedMember[];
  directory: MemberRecord[];
}

/**
 * What the app assumes before the server has answered, and what it falls back to
 * when it cannot: nothing is allowed yet. Anybody who can log in is a member, so
 * this is no longer a judgement about the account — it is the app not yet knowing
 * where it stands, and the screen it produces says so and offers a reload.
 */
export const NO_ACCESS: AccessState = {
  admitted: false,
  suspended: false,
  role: "member",
  trusted: false,
  canCreateCircle: false,
  needsCircle: false,
  acceptedGuidelines: false,
  circleCount: 0,
  founding: false,
  trustedInDays: 0,
  trustedAfterDays: 7,
};

export async function fetchMyAccess(): Promise<MyAccess> {
  return parseOrThrow(await get("/api/my-access"));
}

/**
 * Agreeing to the Community Guidelines. Asked once, before the first share, and
 * the answer carries the caller's refreshed access so the form the member was
 * heading for can open without a second read.
 */
export async function acceptGuidelines(): Promise<AccessState> {
  const data = await parseOrThrow(await send("/api/guidelines", "POST", {}));
  return data.access;
}

export async function reportItem(input: {
  itemType: ItemType;
  itemId: number;
  reason: ReportReason;
  details?: string;
  circleId?: number | null;
}): Promise<ContentReport> {
  const data = await parseOrThrow(await send("/api/reports", "POST", input));
  return data.report;
}

export async function fetchReports(): Promise<ContentReport[]> {
  const data = await parseOrThrow(await get("/api/reports"));
  return data.reports;
}

/**
 * A moderator's answer. "remove" takes the post out of the circle it was
 * reported in and never deletes it, so the response says whether that left it
 * private to its author.
 */
export async function resolveReport(
  id: number,
  decision: "dismiss" | "remove",
): Promise<{ report: ContentReport; madePrivate: boolean }> {
  return parseOrThrow(await send(`/api/reports/${id}`, "PATCH", { decision }));
}

export async function hideItem(itemType: ItemType, itemId: number): Promise<void> {
  await parseOrThrow(await send("/api/hidden", "POST", { itemType, itemId }));
}

export async function unhideItem(itemType: ItemType, itemId: number): Promise<void> {
  await parseOrThrow(await send(`/api/hidden/${itemType}/${itemId}`, "DELETE"));
}

export async function blockMember(
  memberId: string,
  memberName?: string | null,
): Promise<BlockedMember> {
  const data = await parseOrThrow(await send("/api/blocks", "POST", { memberId, memberName }));
  return { ...data.blocked, createdAt: new Date().toISOString() };
}

export async function unblockMember(memberId: string): Promise<void> {
  await parseOrThrow(await send(`/api/blocks/${memberId}`, "DELETE"));
}

/** A manager of the circle making somebody an admin of it, or taking it back. */
export async function setCircleMemberRole(
  circleId: number,
  memberId: string,
  role: "admin" | "member",
): Promise<CircleMember> {
  const data = await parseOrThrow(
    await send(`/api/circles/${circleId}/members/${memberId}`, "PATCH", { role }),
  );
  return data.member;
}

/**
 * The app admin's few levers: trust an account, suspend one, name an App
 * Manager, hand the role over.
 */
export async function updateMemberStanding(
  memberId: string,
  changes: { trusted?: boolean; status?: "active" | "suspended"; role?: AppRole },
): Promise<MemberRecord> {
  const data = await parseOrThrow(await send(`/api/members/${memberId}`, "PATCH", changes));
  return data.member;
}

/** One circle a member is in, as the admin's diagnosis panel lists them. */
export interface MemberCircleRef {
  circleId: number;
  name: string;
  icon: string;
  isDefault: boolean;
  role: "owner" | "admin" | "member";
}

/**
 * Why two members cannot see each other, answered in one read: the blocks either
 * of them placed, and the circles they are actually in. Those are the only two
 * reasons — a block hides a member's shares both ways round and silently, and a
 * share reaches nobody outside the circles it named.
 */
export interface MemberBlocks {
  /** Blocks this member placed, which is what their own Profile lists. */
  blocking: BlockedMember[];
  /** Blocks placed on them, which nothing in the app tells them about. */
  blockedBy: BlockedMember[];
  circles: MemberCircleRef[];
  /** True when they are somehow not in the circle everybody starts in. */
  outsideDefault: boolean;
  /**
   * Shares of theirs that name no circle at all. Those reach the whole group, as
   * everything did before circles existed — but every circle page asks whether a
   * share names *its* circle, so these appear on none of them.
   */
  uncircled: { itemType: ItemType; total: number }[];
}

export async function fetchMemberBlocks(memberId: string): Promise<MemberBlocks> {
  return parseOrThrow(await get(`/api/members/${memberId}/blocks`));
}

/** Lifts a block between two members, whichever of them wrote it. */
export async function liftMemberBlock(memberId: string, otherId: string): Promise<MemberBlocks> {
  return parseOrThrow(await send(`/api/members/${memberId}/blocks/${otherId}`, "DELETE"));
}

/** A circle as the app admin's roll lists it — what it is, not what it holds. */
export interface CircleRollEntry {
  id: number;
  name: string;
  icon: string;
  privacy: CirclePrivacy;
  isDefault: boolean;
  ownerId: string;
  ownerName: string;
  memberCount: number;
  shareCount: number;
  createdAt: string;
}

export interface CircleRoll {
  circles: CircleRollEntry[];
  /**
   * Extra circles marked as the default one. Discover is made on first use, so a
   * race could once leave two, which is invisible from inside either of them and
   * is why members in different copies could not read each other.
   */
  duplicateDefaults: number[];
  defaultCircleId: number | null;
}

export async function fetchCircleRoll(): Promise<CircleRoll> {
  return parseOrThrow(await get("/api/admin/circles"));
}

/** Folds every stray default circle into the canonical one, keeping the shares. */
export async function mergeDefaultCircles(): Promise<
  CircleRoll & { merged: number; members: number; shares: number }
> {
  return parseOrThrow(await send("/api/admin/circles", "POST", { action: "merge-defaults" }));
}

/**
 * One blob store as the orphan report reads it: how much is in it, how much of
 * that a row still names, and the keys nothing does.
 *
 * There are no sizes and no dates on any of it, because Netlify Blobs answers a
 * listing with keys and etags and nothing else — so this counts blobs rather than
 * bytes, and the only way to know a stray's age is that it is still here.
 */
export interface OrphanStore {
  id: string;
  label: string;
  note: string;
  total: number;
  live: number;
  orphans: string[];
  truncated: boolean;
}

export interface OrphanReport {
  stores: OrphanStore[];
  /** How many keys one store's list carries before it is cut short. */
  listLimit: number;
}

export async function fetchOrphans(): Promise<OrphanReport> {
  return parseOrThrow(await get("/api/admin/orphans"));
}

/**
 * Deletes some of one store's strays. The server takes the keys as a selection
 * and works out the orphan set again for itself, so `skipped` is how many of them
 * turned out to be in use or already gone by the time the button was pressed.
 */
export async function deleteOrphanBlobs(
  store: string,
  keys: string[],
): Promise<OrphanReport & { deleted: number; skipped: number }> {
  return parseOrThrow(await send("/api/admin/orphans", "POST", { action: "delete", store, keys }));
}

/**
 * One member's month on the usage report: what arrived, what went back out, and
 * how often they asked the AI Gateway for something.
 */
export interface MemberUsageRow {
  memberId: string;
  /** Null for a row whose account has gone — the bytes still cost what they cost. */
  name: string | null;
  uploadBytes: number;
  uploadCount: number;
  servedBytes: number;
  servedRequests: number;
  aiCalls: number;
}

export interface UsageReport {
  /** The month being shown, as `YYYY-MM`. */
  month: string;
  /** The months there is anything recorded for, newest first, plus the current one. */
  months: string[];
  members: MemberUsageRow[];
  /** How many members one report lists before it is cut short. */
  listLimit: number;
  /** What the figures do and do not say, written where they are read. */
  notes: string[];
}

/**
 * The usage report, for the app admin and the App Managers they have named. A
 * month is optional and defaults to the one in progress; anything that is not a
 * month is answered with that month rather than an error.
 */
export async function fetchUsageReport(month?: string): Promise<UsageReport> {
  const query = month ? `?month=${encodeURIComponent(month)}` : "";
  return parseOrThrow(await get(`/api/admin/usage${query}`));
}

async function parseOrThrow(res: Response) {
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return res.json();
}

/**
 * Every call to the API goes through here, for one reason: an access token lasts
 * about an hour, and a laptop that slept through the expiry wakes up with a stale
 * one. Rather than showing the member an error for a token they cannot see, a 401
 * is answered by renewing the session once and sending the same request again.
 *
 * Once, deliberately. A second 401 means the session is genuinely finished — the
 * refresh token was revoked, or the account was suspended — and retrying forever
 * would only turn a log-in prompt into a spinner.
 */
async function request(path: string, init?: RequestInit): Promise<Response> {
  const options: RequestInit = { credentials: "same-origin", ...init };
  const res = await fetch(path, options);
  if (res.status !== 401) return res;
  const renewed = await withFreshSession();
  if (!renewed) return res;
  return fetch(path, options);
}

function send(path: string, method: string, body?: unknown) {
  return request(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** The plain read every listing makes. */
function get(path: string) {
  return request(path);
}

// Songs ----------------------------------------------------------------------

export async function fetchSongs(): Promise<Song[]> {
  const data = await parseOrThrow(await get("/api/songs"));
  return data.songs;
}

/**
 * What the one song form sends, whichever way the member came in. The two paths
 * differ only in the bytes: a recording goes up in parts and is finished by
 * `/api/uploads/:id/complete`, and a song that is words alone is a plain POST with
 * nothing to stitch.
 *
 * An edit carries `audio` when the member sang it again or picked a different file —
 * the parts are already uploaded by then, so the PATCH claims them and the old
 * recording is swept up. Saying nothing about it keeps whatever is already there.
 */
export type SharedSong = Omit<Shared<Song>, "fieldValues"> & {
  fieldValues?: Record<number, string>;
  audio?: SongAudio | null;
};

/**
 * Shares a song that has no recording — the words and everything derived from them.
 * A member who knows a stotra and cannot sing it today still has the whole of it to
 * give, so the lyrics are the share rather than a note attached to one.
 */
export async function createSong(input: SharedSong): Promise<Song> {
  const data = await parseOrThrow(await send("/api/songs", "POST", input));
  return data.song;
}

export async function updateSong(id: number, changes: SharedSong): Promise<Song> {
  const data = await parseOrThrow(await send(`/api/songs/${id}`, "PATCH", changes));
  return data.song;
}

export async function deleteSong(id: number): Promise<void> {
  await parseOrThrow(await send(`/api/songs/${id}`, "DELETE"));
}

/**
 * Asks for the song's own words in another script. Every one of them is a character
 * mapping, so the answer is exact and comes back at once, and it is kept, so every tap
 * after the first is a cache read.
 *
 * Nothing here fetches the lyrics of a song, and nothing here translates them: the words
 * converted are the ones the member who shared the recording typed, and a recording with
 * none answers 400.
 */
export async function renderSongLyricScript(
  songId: number,
  script: LyricScript,
): Promise<SongLyricScript> {
  const data = await parseOrThrow(await send(`/api/songs/${songId}/lyrics/${script}`, "POST"));
  return data.lyricScript;
}

/** How somebody says they are typing: a convention for Latin letters. */
export type RomanScheme = "itrans" | "iast" | "iso" | "hk";

/**
 * Which scripts the Songs category offers, as the app admin has it set.
 *
 * `catalogue` is every script the converter knows, sent alongside so the admin panel
 * has something to tick from without keeping its own copy of a list the server owns —
 * a script added to the converter turns up on the panel with no change here.
 */
export interface SongScriptSettings {
  scripts: LyricScript[];
  catalogue: { id: LyricScript; label: string; native: string }[];
  defaults: LyricScript[];
  canEdit: boolean;
}

/**
 * Read by every member, because the share form pre-ticks the enabled scripts and the
 * links under a song are drawn from the same list. Writing it is the admin's alone,
 * which the server enforces and `canEdit` reports.
 */
export async function fetchSongScripts(): Promise<SongScriptSettings> {
  return parseOrThrow(await get("/api/settings/song-scripts"));
}

export async function updateSongScripts(scripts: LyricScript[]): Promise<SongScriptSettings> {
  return parseOrThrow(await send("/api/settings/song-scripts", "PUT", { scripts }));
}

/**
 * Whether a piece of text is in Latin letters rather than an Indic script — the one
 * question a form needs to answer in order to know whether to ask which convention it
 * follows. Text already in Kannada or Devanagari says what it is by being in it.
 *
 * A range check rather than the server's full block table, because the question here is
 * only "is any of this a letter of some script rather than the Latin alphabet", and
 * four of them is enough to rule out the odd pasted sign in an otherwise English line.
 * The range spans every block the server converts, from Arabic at the bottom to Wancho
 * at the top. Which script it actually is, is the server's finer judgement, and it is
 * the one that decides anything.
 *
 * The one hole cut out of that span is the reason this is worth a comment. Latin
 * Extended Additional sits in the middle of it, and that is where IAST and ISO 15919
 * keep ṇ, ṛ, ṣ, ṃ and ḥ — so a stotra typed in IAST counted four "script" letters in
 * its first line and was taken for a stotra typed in Devanagari. Nothing then asked its
 * author which convention they had used, so nothing could be converted from it, and the
 * group was offered no script at all with no word said about why. Those letters are
 * romanisation; they belong on this side of the question.
 */
export function looksRomanised(text: string) {
  let indic = 0;
  for (const character of text) {
    const code = character.codePointAt(0)!;
    if (code >= 0x1e00 && code <= 0x1eff) continue;
    if (code >= 0x0600 && code <= 0x1e2ff && ++indic >= 4) return false;
  }
  return text.trim().length > 0;
}

/**
 * Which roman convention a piece of Latin-letter text is most likely written in — the
 * answer the form proposes rather than the answer it stores, since only the author
 * really knows.
 *
 * It is worth proposing one at all because the alternative is what actually happened:
 * the question sat unanswered on "I would rather not say", which quietly voids every
 * script the same member ticked two fields below it. A proposal that is usually right
 * and always visible beats a blank that is never wrong and always silent.
 *
 * The split is what the letters can show. ITRANS and Harvard-Kyoto are plain ASCII, so
 * anything with a diacritic on it is one of the two academic conventions; ē, ō and ṁ
 * are ISO 15919's answers where IAST writes e, o and ṃ, so they separate those two.
 * ITRANS is what is left, and it is what most people type.
 */
export function guessRomanScheme(text: string): RomanScheme {
  if (/[ēōṁ]/i.test(text)) return "iso";
  if (/[āīūṛṝḷḹṅñṭḍṇśṣṃḥ]/i.test(text)) return "iast";
  return "itrans";
}

/** The scripts the authoring converter writes, and the ones it can read from. */
export type IndicScript =
  | "devanagari"
  | "bengali"
  | "gurmukhi"
  | "gujarati"
  | "oriya"
  | "tamil"
  | "telugu"
  | "kannada"
  | "malayalam"
  | "sinhala"
  | "ahom"
  | "avestan"
  | "balinese"
  | "bhaiksuki"
  | "brahmi"
  | "burmese"
  | "cham"
  | "dogra"
  | "grantha"
  | "gunjala-gondi"
  | "hanifi-rohingya"
  | "javanese"
  | "kharoshthi"
  | "khmer"
  | "khudawadi"
  | "lao"
  | "lepcha"
  | "limbu"
  | "mahajani"
  | "marchen"
  | "masaram-gondi"
  | "meetei-mayek"
  | "modi"
  | "mro"
  | "multani"
  | "newa"
  | "ol-chiki"
  | "old-persian"
  | "phags-pa"
  | "sharada"
  | "siddham"
  | "sora-sompeng"
  | "takri"
  | "thai"
  | "tibetan"
  | "tirhuta"
  | "arabic"
  | "wancho"
  | "warang-citi"
  | "zanabazar-square";

/**
 * The ways of typing an Indian language in Latin letters that the authoring converter
 * accepts, in the order the control offers them. `example` is the same half-line in
 * each, which is how somebody picks: they look for the one that resembles what they
 * were about to type.
 */
export const ROMAN_SCHEME_OPTIONS: {
  id: RomanScheme;
  label: string;
  /**
   * The convention's own name, for the places that label stored text rather than ask a
   * question — "ITRANS (Original)" over a member's lyrics. `label` is what to say to
   * somebody choosing one and is deliberately friendlier than accurate; `short` is what
   * to say about one already chosen, where the name is the useful thing.
   */
  short: string;
  hint: string;
  example: string;
}[] = [
  {
    id: "itrans",
    label: "Plain English letters",
    short: "ITRANS",
    hint: "aa ii uu, sh, N for ಂ, T for ಟ — the way most people type",
    example: "vakratuNDa mahaakaaya",
  },
  {
    id: "iast",
    label: "IAST",
    short: "IAST",
    hint: "with diacritics: ā ī ū, ś, ṭ, ṇ",
    example: "vakratuṇḍa mahākāya",
  },
  {
    id: "iso",
    label: "ISO 15919",
    short: "ISO 15919",
    hint: "with diacritics, ē and ō written long",
    example: "vakratuṇḍa mahākāya",
  },
  {
    id: "hk",
    label: "Harvard-Kyoto",
    short: "Harvard-Kyoto",
    hint: "A I U, z for ಶ, T for ಟ",
    example: "vakratuNDa mahAkAya",
  },
];

/**
 * The scripts the "type in English letters" control offers, in the order it draws them.
 * A far shorter list than everything the server can write, because these are the ones
 * this group actually composes in and the control is a dropdown a member picks from
 * while half way through a verse. Reading is the other question, and it is asked with
 * a search box over the whole list.
 */
export const SCRIPT_OPTIONS: { id: IndicScript; label: string; native: string }[] = [
  { id: "kannada", label: "Kannada", native: "ಕನ್ನಡ" },
  { id: "devanagari", label: "Devanagari", native: "देवनागरी" },
  { id: "telugu", label: "Telugu", native: "తెలుగు" },
  { id: "tamil", label: "Tamil", native: "தமிழ்" },
  { id: "malayalam", label: "Malayalam", native: "മലയാളം" },
];

/**
 * Converts what a member is in the middle of typing into a script, so somebody who can
 * say a stotra but not type one can still write it down. Nothing is stored: the answer
 * goes back into the textarea they are looking at, theirs to correct before it is
 * shared. Needs no AI Gateway, since changing letters is a lookup rather than a reading.
 */
export async function transliterate(input: {
  text: string;
  /**
   * How the text is written. Words already in an Indic script say what they are, so
   * this may be left out and the server works it out by looking; Latin letters say
   * nothing, which is why the member is asked which convention they used.
   */
  from?: RomanScheme | IndicScript;
  /**
   * What to write it in. A roman convention as well as a script, because the same
   * table run the other way is what a member handed a verse in letters they cannot
   * read is asking for.
   */
  to: IndicScript | RomanScheme;
}): Promise<string> {
  const data = await parseOrThrow(await send("/api/transliterate", "POST", input));
  return data.text as string;
}

/**
 * A Netlify Function only accepts a 6 MB request body, so a recording is sliced
 * into parts, each PUT on its own, and stitched back together server-side.
 */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/**
 * How big a slice is, and — because it sits under that 6 MB with room to spare —
 * the size above which anything at all goes up in slices rather than as one body.
 * A document answering an upload field reads it for exactly that reason.
 */
export const PART_BYTES = 4 * 1024 * 1024;

/**
 * The containers a recording may arrive in, and what to call each one's bytes.
 *
 * This table exists because of what a file picker on a phone actually does with
 * `accept`. On iOS the picker is a document browser, and a document browser filters
 * by UTType rather than by media type, so `audio/*` is not passed through as a
 * wildcard — WebKit expands it into the finite set of audio types it happens to have
 * a mapping for, and every file outside that set is drawn in the list and greyed
 * out. A member watching their own song sit there unselectable is the whole reason
 * this is written out longhand: an extension named literally in `accept` resolves to
 * its UTI and becomes pickable, where the wildcard alone leaves it disabled.
 *
 * So the list is deliberately wider than the four formats the hint names. `.opus` is
 * what a song forwarded through WhatsApp or Telegram arrives as, `.flac` is what the
 * form has always promised and the wildcard never reliably offered, and `.amr`,
 * `.aiff`, `.caf` and `.wma` are what other people's phones and desktops produce.
 * Whether a browser can then *play* one is a separate question from whether a member
 * can share it, and refusing the share is the worse of the two failures.
 *
 * The type beside each extension is the second job: a file the system could not
 * identify arrives with `file.type` empty, and something has to name the bytes for
 * the blob they are stored as. The extension is the only evidence there is.
 */
const AUDIO_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  m4b: "audio/mp4",
  mp4: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  wave: "audio/wav",
  flac: "audio/flac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  webm: "audio/webm",
  aif: "audio/aiff",
  aiff: "audio/aiff",
  amr: "audio/amr",
  caf: "audio/x-caf",
  wma: "audio/x-ms-wma",
  "3gp": "audio/3gpp",
  "3gpp": "audio/3gpp",
};

/**
 * What the audio picker offers, and both halves are needed for the same reason
 * `FIELD_FILE_ACCEPT` needs both. The media types come first because that is what a
 * desktop browser and an Android chooser filter on — `audio/*` there means every
 * audio file on the device, which is exactly right and must not be narrowed. The
 * extensions follow for iOS, which needs each one named before it will let a member
 * tap it.
 */
export const AUDIO_ACCEPT = ["audio/*", ...Object.keys(AUDIO_TYPES).map((ext) => `.${ext}`)].join(
  ",",
);

/** The extension of a file name, lowercased and without its dot. */
function extensionOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/**
 * What to call the bytes being uploaded.
 *
 * A recorder answers this itself — `audio/webm;codecs=opus` — and the parameters are
 * dropped, since what is stored is the container. A file picked on a phone often
 * answers nothing at all: iOS reports an empty type for anything it could not
 * identify, and sending that meant every such recording was stored as `audio/mpeg`
 * and served back under a type it was not, which is a decoder error on playback for
 * something that uploaded perfectly. So the extension is read where the file itself
 * is silent, and `audio/mpeg` remains the answer only when there is nothing else to
 * go on.
 */
export function audioContentType(file: Blob) {
  const declared = (file.type || "").split(";")[0].trim().toLowerCase();
  if (declared.startsWith("audio/")) return declared;
  const name = "name" in file ? String((file as File).name) : "";
  return AUDIO_TYPES[extensionOf(name)] ?? "audio/mpeg";
}

/** Types and extensions that are positively not a recording, whatever else is true. */
const NOT_AUDIO = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "pages",
  "numbers",
  "key",
  "txt",
  "rtf",
  "csv",
  "zip",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "heic",
  "heif",
  "webp",
  "svg",
  "mov",
  "avi",
  "mkv",
  "wmv",
]);

/**
 * Why this file is not a recording, or null when it might be one.
 *
 * Deliberately generous, because of where it is asked. The picker can be widened to
 * show every file — the one way past a system that has refused to identify a song at
 * all — and a check that then rejected everything it could not identify either would
 * have given the member nothing. So an unknown file passes: only a positive signal
 * the other way, a picture or a document by type or by extension, is a refusal, and
 * the honest "we cannot tell until we try" cases go up and are judged by whether
 * they play.
 */
export function notAudioReason(file: File): string | null {
  const type = (file.type || "").split(";")[0].trim().toLowerCase();
  const ext = extensionOf(file.name);
  if (type.startsWith("audio/") || AUDIO_TYPES[ext]) return null;
  const isDocument =
    type.startsWith("image/") ||
    type.startsWith("text/") ||
    (type.startsWith("application/") && type !== "application/octet-stream");
  if (isDocument || NOT_AUDIO.has(ext)) {
    return `${file.name} is not a recording — pick an audio file such as an MP3, M4A, WAV or FLAC.`;
  }
  return null;
}

export interface UploadDetails {
  file: Blob;
  fileName?: string;
  songName: string;
  composer?: string;
  raga?: string;
  /**
   * The words, typed by whoever is sharing the recording. Optional, and theirs —
   * the app renders them into other scripts on request and never supplies them.
   */
  lyrics?: string;
  /** What language those words are in, which the rendering is told. */
  lyricsLanguage?: string;
  /**
   * Which roman convention the words are typed in, when they are in Latin letters.
   * Empty means the member would rather not say, which the server reads as "no scheme"
   * and which costs them the exact conversion rather than the feature.
   */
  lyricsScheme?: RomanScheme | "" | null;
  /** The scripts the member asked the words to be readable in, empty for none. */
  readInto?: LyricScript[];
  visibility: Visibility;
  durationSeconds?: number | null;
  /** The circles the recording is being shared into; empty means the whole group. */
  circleIds?: number[];
  /** The taxonomy node it is filed on, in the circle whose tree it belongs to. */
  subcategoryId?: number | null;
  /** That node's path, which is how every other circle finds the same place. */
  subcategoryName?: string | null;
  /**
   * The category it is filed under, when its author put it somewhere other than
   * Songs — the Rathotsava recording under Events. Null is that ordinary case.
   */
  filedCategoryId?: number | null;
  /**
   * The folder in the circle it is being shared into, when the member walked into
   * one first. Left out entirely otherwise, which the server reads as leaving the
   * folder alone rather than as clearing it.
   */
  folderId?: number | null;
  /** Optional pictures to go with the recording, by uploaded key. */
  photos?: string[];
  /** Its answers to whatever its circles' Songs categories ask, keyed by field id. */
  fieldValues?: Record<number, string>;
}

/**
 * A recording whose parts are safely uploaded and waiting to be claimed by a song.
 *
 * The parts go up the same way whether the song is a new share or one already
 * shared being re-recorded, so what a route is handed is this — the id to read them
 * back under, how many there are, and what they are — rather than the bytes.
 */
export interface SongAudio {
  uploadId: string;
  parts: number;
  contentType: string;
  durationSeconds: number | null;
}

/**
 * Cuts a file into parts, PUTs each one, and answers the id and the count to hand
 * whichever route claims them.
 *
 * It says nothing about what the bytes are, because three things now travel this
 * way: a recording becoming a song, a recording answering an upload field, and a
 * document too big for one request body. Only the ceiling and the wording of a
 * refusal differ, and those belong to the caller, which is why the checks are up
 * there rather than in here.
 */
async function putParts(
  file: Blob,
  onProgress?: (percent: number) => void,
): Promise<{ uploadId: string; parts: number }> {
  const uploadId = crypto.randomUUID();
  const parts = Math.ceil(file.size / PART_BYTES);

  for (let index = 0; index < parts; index++) {
    const chunk = file.slice(index * PART_BYTES, (index + 1) * PART_BYTES);
    await parseOrThrow(
      await request(`/api/uploads/${uploadId}/parts/${index}`, {
        method: "PUT",
        body: chunk,
        headers: { "Content-Type": "application/octet-stream" },
      }),
    );
    // The final claim-and-save step is the last slice of the progress bar.
    onProgress?.(((index + 1) / (parts + 1)) * 100);
  }

  return { uploadId, parts };
}

/**
 * Slices a recording, PUTs each part, and answers what to hand the route that will
 * stitch them. Shared by sharing a song and by swapping the recording on one already
 * shared, which differ only in what claims the parts afterwards.
 */
export async function uploadSongParts(
  file: Blob,
  durationSeconds: number | null,
  onProgress?: (percent: number) => void,
): Promise<SongAudio> {
  if (file.size === 0) throw new Error("That recording is empty.");
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `That recording is ${formatBytes(file.size)}. Please keep it under ${formatBytes(MAX_UPLOAD_BYTES)}.`,
    );
  }

  const { uploadId, parts } = await putParts(file, onProgress);
  return { uploadId, parts, contentType: audioContentType(file), durationSeconds };
}

export async function uploadSongInParts(
  details: UploadDetails,
  onProgress?: (percent: number) => void,
): Promise<Song> {
  const { file } = details;
  const audio = await uploadSongParts(file, details.durationSeconds ?? null, onProgress);

  const data = await parseOrThrow(
    await send(`/api/uploads/${audio.uploadId}/complete`, "POST", {
      songName: details.songName,
      composer: details.composer,
      raga: details.raga,
      lyrics: details.lyrics,
      lyricsLanguage: details.lyricsLanguage,
      lyricsScheme: details.lyricsScheme || null,
      readInto: details.readInto ?? [],
      visibility: details.visibility,
      durationSeconds: audio.durationSeconds,
      circleIds: details.circleIds ?? [],
      subcategoryId: details.subcategoryId ?? null,
      subcategoryName: details.subcategoryName ?? null,
      filedCategoryId: details.filedCategoryId ?? null,
      ...(details.folderId === undefined ? {} : { folderId: details.folderId }),
      photos: details.photos ?? [],
      fieldValues: details.fieldValues ?? {},
      parts: audio.parts,
      contentType: audio.contentType,
    }),
  );
  onProgress?.(100);
  return data.song;
}

// Recipes --------------------------------------------------------------------

export async function fetchRecipes(): Promise<Recipe[]> {
  const data = await parseOrThrow(await get("/api/recipes"));
  return data.recipes;
}

/**
 * What the recipe form sends. Recipes are one of the built-in kinds a circle may
 * ask its own questions of, so the answers travel with the recipe exactly as a
 * book's do: keyed by the field's own id, which is unique across the app, so two
 * circles both asking "Menu type" are two questions and two answers.
 */
export type SharedRecipe = Omit<Shared<Recipe>, "fieldValues"> & {
  fieldValues?: Record<number, string>;
};

export async function createRecipe(input: SharedRecipe): Promise<Recipe> {
  const data = await parseOrThrow(await send("/api/recipes", "POST", input));
  return data.recipe;
}

export async function updateRecipe(id: number, changes: SharedRecipe): Promise<Recipe> {
  const data = await parseOrThrow(await send(`/api/recipes/${id}`, "PATCH", changes));
  return data.recipe;
}

export async function deleteRecipe(id: number): Promise<void> {
  await parseOrThrow(await send(`/api/recipes/${id}`, "DELETE"));
}

// Fun facts ------------------------------------------------------------------

export async function fetchFacts(): Promise<Fact[]> {
  const data = await parseOrThrow(await get("/api/facts"));
  return data.facts;
}

export async function createFact(input: Shared<Fact>): Promise<Fact> {
  const data = await parseOrThrow(await send("/api/facts", "POST", input));
  return data.fact;
}

export async function updateFact(id: number, changes: Shared<Fact>): Promise<Fact> {
  const data = await parseOrThrow(await send(`/api/facts/${id}`, "PATCH", changes));
  return data.fact;
}

export async function deleteFact(id: number): Promise<void> {
  await parseOrThrow(await send(`/api/facts/${id}`, "DELETE"));
}

// Word Explorer --------------------------------------------------------------

export async function fetchWords(): Promise<Word[]> {
  const data = await parseOrThrow(await get("/api/words"));
  return data.words;
}

export async function createWord(input: SharedWord): Promise<Word> {
  const data = await parseOrThrow(await send("/api/words", "POST", input));
  return data.word;
}

export async function updateWord(id: number, changes: SharedWord): Promise<Word> {
  const data = await parseOrThrow(await send(`/api/words/${id}`, "PATCH", changes));
  return data.word;
}

export async function deleteWord(id: number): Promise<void> {
  await parseOrThrow(await send(`/api/words/${id}`, "DELETE"));
}

export async function setWordLearned(id: number, learned: boolean): Promise<void> {
  await parseOrThrow(await send(`/api/words/${id}/learned`, learned ? "POST" : "DELETE"));
}

export async function createWordConnection(
  wordId: number,
  input: NewWordConnection,
): Promise<WordConnection> {
  const data = await parseOrThrow(await send(`/api/words/${wordId}/connections`, "POST", input));
  return data.connection;
}

export async function deleteWordConnection(wordId: number, connectionId: number): Promise<void> {
  await parseOrThrow(await send(`/api/words/${wordId}/connections/${connectionId}`, "DELETE"));
}

// Books ----------------------------------------------------------------------

export async function fetchBooks(): Promise<Book[]> {
  const data = await parseOrThrow(await get("/api/books"));
  return data.books;
}

/**
 * What the book form sends. A book is one of the two built-in kinds a circle may ask
 * its own questions of, so the answers travel with it exactly as a post's do: keyed
 * by the field's own id, which is unique across the app, so two circles both asking
 * "Lending copy?" are two questions and two answers.
 */
export type SharedBook = Omit<Shared<Book>, "fieldValues"> & {
  fieldValues?: Record<number, string>;
};

export async function createBook(input: SharedBook): Promise<Book> {
  const data = await parseOrThrow(await send("/api/books", "POST", input));
  return data.book;
}

export async function updateBook(id: number, changes: SharedBook): Promise<Book> {
  const data = await parseOrThrow(await send(`/api/books/${id}`, "PATCH", changes));
  return data.book;
}

export async function deleteBook(id: number): Promise<void> {
  await parseOrThrow(await send(`/api/books/${id}`, "DELETE"));
}

// Discussions and likes ------------------------------------------------------

/**
 * Starting a thread on somebody's share. A book and a recording take the same two
 * calls, because the thread is a contribution either way — the only difference is
 * what the question tends to be ("which chapter?" against "which raga?").
 */
export async function startDiscussion(
  itemType: DiscussionItemType,
  itemId: number,
  prompt: string,
): Promise<Discussion> {
  const data = await parseOrThrow(
    await send(`/api/items/${itemType}/${itemId}/discussions`, "POST", { prompt }),
  );
  return data.discussion;
}

export async function deleteDiscussion(
  itemType: DiscussionItemType,
  itemId: number,
  discussionId: number,
): Promise<void> {
  await parseOrThrow(
    await send(`/api/items/${itemType}/${itemId}/discussions/${discussionId}`, "DELETE"),
  );
}

/** Both reply calls answer with the whole thread, so counts never drift. */
export async function replyToDiscussion(
  discussionId: number,
  body: string,
): Promise<Discussion> {
  const data = await parseOrThrow(
    await send(`/api/discussions/${discussionId}/replies`, "POST", { body }),
  );
  return data.discussion;
}

export async function deleteDiscussionReply(
  discussionId: number,
  replyId: number,
): Promise<Discussion> {
  const data = await parseOrThrow(
    await send(`/api/discussions/${discussionId}/replies/${replyId}`, "DELETE"),
  );
  return data.discussion;
}

/** Asks for the AI reading of a long thread; the server caches what it returns. */
export async function summarizeDiscussion(discussionId: number): Promise<Discussion> {
  const data = await parseOrThrow(await send(`/api/discussions/${discussionId}/summary`, "POST"));
  return data.discussion;
}

/** The same call both ways: liking and taking the like back. */
export async function setBookLike(bookId: number, liked: boolean): Promise<LikeState> {
  const data = await parseOrThrow(
    await send(`/api/books/${bookId}/likes`, liked ? "POST" : "DELETE"),
  );
  return data.like;
}

// Experiences and tips -------------------------------------------------------

export async function createExperience(
  itemType: "recipe" | "remedy",
  itemId: number,
  input: NewExperience,
): Promise<ItemExperience> {
  const data = await parseOrThrow(
    await send("/api/experiences", "POST", { itemType, itemId, ...input }),
  );
  return data.experience;
}

export async function deleteExperience(id: number): Promise<void> {
  await parseOrThrow(await send(`/api/experiences/${id}`, "DELETE"));
}

// Traditional remedies ------------------------------------------------------

export async function fetchRemedies(): Promise<Remedy[]> {
  const data = await parseOrThrow(await get("/api/remedies"));
  return data.remedies;
}

export async function createRemedy(input: Shared<Remedy>): Promise<Remedy> {
  const data = await parseOrThrow(await send("/api/remedies", "POST", input));
  return data.remedy;
}

export async function updateRemedy(id: number, changes: Shared<Remedy>): Promise<Remedy> {
  const data = await parseOrThrow(await send(`/api/remedies/${id}`, "PATCH", changes));
  return data.remedy;
}

export async function deleteRemedy(id: number): Promise<void> {
  await parseOrThrow(await send(`/api/remedies/${id}`, "DELETE"));
}

// Bookmarks ------------------------------------------------------------------

export async function fetchBookmarks(): Promise<Bookmark[]> {
  const data = await parseOrThrow(await get("/api/bookmarks"));
  return data.bookmarks;
}

export async function createBookmark(input: Shared<Bookmark>): Promise<Bookmark> {
  const data = await parseOrThrow(await send("/api/bookmarks", "POST", input));
  return data.bookmark;
}

export async function updateBookmark(id: number, changes: Shared<Bookmark>): Promise<Bookmark> {
  const data = await parseOrThrow(await send(`/api/bookmarks/${id}`, "PATCH", changes));
  return data.bookmark;
}

export async function deleteBookmark(id: number): Promise<void> {
  await parseOrThrow(await send(`/api/bookmarks/${id}`, "DELETE"));
}

// My Library -----------------------------------------------------------------

export async function fetchLibrary(): Promise<LibraryState> {
  const data = await parseOrThrow(await get("/api/library"));
  return data;
}

export async function saveToLibrary(itemType: ItemType, itemId: number): Promise<void> {
  await parseOrThrow(await send("/api/library", "POST", { itemType, itemId }));
}

export async function removeFromLibrary(itemType: ItemType, itemId: number): Promise<void> {
  await parseOrThrow(await send(`/api/library/${itemType}/${itemId}`, "DELETE"));
}

// Activity -------------------------------------------------------------------

export async function fetchNotifications(): Promise<Notification[]> {
  const data = await parseOrThrow(await get("/api/notifications"));
  return data.notifications;
}

// Invites --------------------------------------------------------------------

export async function fetchInvites(): Promise<Invite[]> {
  const data = await parseOrThrow(await get("/api/invites"));
  return data.invites;
}

export async function createInvite(input: NewInvite = {}): Promise<Invite> {
  const data = await parseOrThrow(await send("/api/invites", "POST", input));
  return data.invite;
}

export async function revokeInvite(token: string): Promise<Invite> {
  const data = await parseOrThrow(await send(`/api/invites/${token}`, "DELETE"));
  return data.invite;
}

/** Readable without an account — this is the screen an invited friend lands on. */
export async function fetchInvitePreview(token: string): Promise<InvitePreview> {
  const data = await parseOrThrow(await get(`/api/invites/${token}`));
  return data.invite;
}

export async function acceptInvite(
  token: string,
): Promise<{ invite: InvitePreview; alreadyAccepted: boolean }> {
  const data = await parseOrThrow(await send(`/api/invites/${token}/accept`, "POST"));
  return { invite: data.invite, alreadyAccepted: Boolean(data.alreadyAccepted) };
}

// Sharing one item -----------------------------------------------------------
//
// The other half of an invite, and deliberately not the same thing: an invite
// says "come and join this circle", and a share says "I thought you would like
// this particular thing". So the link names one item, it is minted per item
// rather than per friend, and what it opens is that item — the content being the
// invitation, with the circle offered underneath it afterwards.

/**
 * Mint (or find) the link for one item. Asking twice answers the same token, so
 * the sheet can be opened and closed without leaving a trail of dead links, and
 * a link already passed on keeps working.
 *
 * `circleId` says which of the item's audiences the link speaks for, which is
 * what the recipient will be offered. Leaving it out lets the server pick one the
 * sharer is actually in.
 */
export async function createItemShare(
  itemType: ItemType,
  itemId: number,
  circleId?: number | null,
): Promise<string> {
  const body: Record<string, unknown> = { itemType, itemId };
  if (circleId !== undefined && circleId !== null) body.circleId = circleId;
  const data = await parseOrThrow(await send("/api/shares", "POST", body));
  return data.token;
}

/**
 * Readable without an account — this is the item a recipient lands on. It
 * answers the one item and the shell of its circle, so there is nothing here to
 * widen: no roll, no head count, no siblings, and no circle id any other public
 * route would take.
 */
export async function fetchSharedItem(token: string): Promise<SharedView> {
  const data = await parseOrThrow(await get(`/api/shared/${token}`));
  return data.shared;
}

/** Where a shared recording's audio is streamed from, the token being the key. */
export function sharedAudioUrl(token: string): string {
  return `/api/shared/${token}/audio`;
}

// Circles --------------------------------------------------------------------

export async function fetchCircles(): Promise<CirclesState> {
  const data = await parseOrThrow(await get("/api/circles"));
  return data;
}

export async function fetchCircle(id: number): Promise<CircleDetail> {
  const data = await parseOrThrow(await get(`/api/circles/${id}`));
  return data;
}

/**
 * Everybody in every circle the member is in, once each. One request rather than
 * one per circle, because the consolidated roll is a single question about the
 * caller's own membership.
 */
export async function fetchMyMembers(): Promise<GroupMember[]> {
  const data = await parseOrThrow(await get("/api/my-members"));
  return data.members ?? [];
}

export async function createCircle(
  input: NewCircle,
): Promise<{ circle: Circle; categories: CircleCategory[]; invited: number }> {
  const data = await parseOrThrow(await send("/api/circles", "POST", input));
  return {
    circle: data.circle,
    categories: data.categories ?? [],
    invited: Number(data.invited ?? 0),
  };
}

export async function updateCircle(id: number, changes: Partial<NewCircle>): Promise<Circle> {
  const data = await parseOrThrow(await send(`/api/circles/${id}`, "PATCH", changes));
  return data.circle;
}

export async function deleteCircle(id: number): Promise<void> {
  await parseOrThrow(await send(`/api/circles/${id}`, "DELETE"));
}

export async function inviteToCircle(id: number, memberIds: string[]): Promise<CirclePending[]> {
  const data = await parseOrThrow(await send(`/api/circles/${id}/invites`, "POST", { memberIds }));
  return data.invited;
}

/**
 * Accepting an invitation, walking into a public circle, or knocking on a
 * discoverable one — the answer says which of those happened.
 */
export async function joinCircle(id: number): Promise<{ joined: boolean; requested: boolean }> {
  const data = await parseOrThrow(await send(`/api/circles/${id}/members`, "POST", {}));
  return { joined: Boolean(data.joined), requested: Boolean(data.requested) };
}

/** A manager of the circle letting in somebody who asked to join. */
export async function approveCircleRequest(id: number, memberId: string): Promise<void> {
  await parseOrThrow(await send(`/api/circles/${id}/members`, "POST", { memberId }));
}

/** Leaving, or turning down an invitation — `me` covers both. */
export async function leaveCircle(id: number): Promise<void> {
  await parseOrThrow(await send(`/api/circles/${id}/members/me`, "DELETE"));
}

export async function removeCircleMember(id: number, memberId: string): Promise<void> {
  await parseOrThrow(await send(`/api/circles/${id}/members/${memberId}`, "DELETE"));
}

export async function fetchContacts(): Promise<Contact[]> {
  const data = await parseOrThrow(await get("/api/members"));
  return data.members;
}

/** Keeps the caller listed in the group's contacts, so others can invite them. */
export async function registerMember(): Promise<void> {
  await parseOrThrow(await send("/api/members", "POST", {}));
}

// Categories -----------------------------------------------------------------

/**
 * The shape of every circle the member is in, without counts: enough for a share
 * form to offer the right subcategories the moment a circle is ticked.
 */
export async function fetchMyCategories(): Promise<CircleCategory[]> {
  const data = await parseOrThrow(
    await get("/api/my-categories"),
  );
  return data.categories;
}

/** One circle's categories with the counts its own page shows. */
export async function fetchCircleCategories(circleId: number): Promise<CircleCategory[]> {
  const data = await parseOrThrow(
    await get(`/api/circles/${circleId}/categories`),
  );
  return data.categories;
}

/** Ticking a built-in back on, or inventing one. Returns the circle's whole list. */
export async function addCircleCategory(
  circleId: number,
  input: NewCategory,
): Promise<CircleCategory[]> {
  const data = await parseOrThrow(
    await send(`/api/circles/${circleId}/categories`, "POST", input),
  );
  return data.categories;
}

export async function updateCircleCategory(
  circleId: number,
  categoryId: number,
  changes: { name?: string; icon?: string; hidden?: boolean },
): Promise<CircleCategory[]> {
  const data = await parseOrThrow(
    await send(`/api/circles/${circleId}/categories/${categoryId}`, "PATCH", changes),
  );
  return data.categories;
}

export async function reorderCircleCategories(
  circleId: number,
  order: number[],
): Promise<CircleCategory[]> {
  const data = await parseOrThrow(
    await send(`/api/circles/${circleId}/categories`, "PATCH", { order }),
  );
  return data.categories;
}

/**
 * Removing a category the circle invented, once it is hidden. `posts` says what
 * happens to what is in it: "move" needs a target category, and "release" leaves
 * every post private to whoever wrote it. Neither one deletes anybody's post.
 */
export async function removeCircleCategory(
  circleId: number,
  categoryId: number,
  disposition?: { posts: "move"; to: number } | { posts: "release" },
): Promise<{ categories: CircleCategory[]; moved: number; released: number }> {
  const query = disposition
    ? `?${new URLSearchParams(
        disposition.posts === "move"
          ? { posts: "move", to: String(disposition.to) }
          : { posts: "release" },
      )}`
    : "";
  const data = await parseOrThrow(
    await send(`/api/circles/${circleId}/categories/${categoryId}${query}`, "DELETE"),
  );
  return {
    categories: data.categories ?? [],
    moved: Number(data.moved ?? 0),
    released: Number(data.released ?? 0),
  };
}

/**
 * Asking for a node. `parentId` is which node it goes beneath — null for one at
 * the top of the category. Without `confirm`, a name close to one already under
 * the same parent comes back as `similar` and nothing is created, so the member
 * can choose.
 */
export async function addSubcategory(
  circleId: number,
  categoryId: number,
  name: string,
  parentId: number | null = null,
  confirm = false,
): Promise<SubcategoryOutcome> {
  const data = await parseOrThrow(
    await send(`/api/circles/${circleId}/categories/${categoryId}/subcategories`, "POST", {
      name,
      parentId,
      confirm,
    }),
  );
  return {
    created: data.created ?? null,
    similar: data.similar ?? null,
    categories: data.categories ?? [],
  };
}

export async function updateSubcategory(
  circleId: number,
  categoryId: number,
  subcategoryId: number,
  changes: {
    name?: string;
    hidden?: boolean;
    mergeIntoId?: number;
    /** Moving it: which node it now sits under, null for the top of the category. */
    parentId?: number | null;
  },
): Promise<CircleCategory[]> {
  const data = await parseOrThrow(
    await send(
      `/api/circles/${circleId}/categories/${categoryId}/subcategories/${subcategoryId}`,
      "PATCH",
      changes,
    ),
  );
  return data.categories;
}

/**
 * The node goes; what was filed on it moves one level up, and its children are
 * promoted to the same place rather than being cut off from the category.
 */
export async function removeSubcategory(
  circleId: number,
  categoryId: number,
  subcategoryId: number,
): Promise<CircleCategory[]> {
  const data = await parseOrThrow(
    await send(
      `/api/circles/${circleId}/categories/${categoryId}/subcategories/${subcategoryId}`,
      "DELETE",
    ),
  );
  return data.categories;
}

export async function reorderSubcategories(
  circleId: number,
  categoryId: number,
  order: number[],
): Promise<CircleCategory[]> {
  const data = await parseOrThrow(
    await send(`/api/circles/${circleId}/categories/${categoryId}/subcategories`, "PATCH", {
      order,
    }),
  );
  return data.categories;
}

// Folders -------------------------------------------------------------------

/**
 * A circle's folders, with the counts its own page shows. Reading them is for
 * anybody who can see the circle; a keeper's answer also carries the folders they
 * have hidden, so they can be shown again.
 */
export async function fetchCircleFolders(circleId: number): Promise<Folder[]> {
  const data = await parseOrThrow(await get(`/api/circles/${circleId}/folders`));
  return data.folders ?? [];
}

/**
 * Asking for a folder. `parentId` is which folder it goes inside — null for one
 * at the top of the circle. Without `confirm`, a name close to one already inside
 * the same parent comes back as `similar` and nothing is made, so the keeper can
 * choose between the two.
 */
export async function addFolder(
  circleId: number,
  name: string,
  parentId: number | null = null,
  confirm = false,
): Promise<FolderOutcome> {
  const data = await parseOrThrow(
    await send(`/api/circles/${circleId}/folders`, "POST", { name, parentId, confirm }),
  );
  return {
    created: data.created ?? null,
    similar: data.similar ?? null,
    folders: data.folders ?? [],
  };
}

/**
 * Renaming a folder, hiding or showing it, moving it inside another, or merging
 * it into one. All four are one PATCH because all four are one row's worth of
 * change, and a rename onto a sibling's name comes back as a 409 offering the
 * merge instead.
 */
export async function updateFolder(
  circleId: number,
  folderId: number,
  changes: {
    name?: string;
    hidden?: boolean;
    mergeIntoId?: number;
    /** Moving it: which folder it now sits in, null for the top of the circle. */
    parentId?: number | null;
  },
): Promise<Folder[]> {
  const data = await parseOrThrow(
    await send(`/api/circles/${circleId}/folders/${folderId}`, "PATCH", changes),
  );
  return data.folders ?? [];
}

/**
 * The folder goes; what was in it moves one level up — to the circle itself at
 * the top — and its subfolders are promoted to the same place rather than being
 * cut off. Nothing anybody shared is deleted.
 */
export async function removeFolder(circleId: number, folderId: number): Promise<Folder[]> {
  const data = await parseOrThrow(
    await send(`/api/circles/${circleId}/folders/${folderId}`, "DELETE"),
  );
  return data.folders ?? [];
}

/**
 * Where each kind of share is edited. A move is one PATCH to the share's own
 * route, so this table is the whole of what a generic "put it in that folder"
 * needs — no ninth route, and no per-kind copy of the same call.
 */
const ITEM_PATHS: Record<ItemType, string> = {
  song: "songs",
  recipe: "recipes",
  fact: "facts",
  word: "words",
  book: "books",
  remedy: "remedies",
  bookmark: "bookmarks",
  post: "posts",
};

/**
 * Moving something already shared into one of its circle's folders — or out of
 * them, with `folderId` null, which puts it back at the top of the circle.
 *
 * It is deliberately the thinnest PATCH in the file: `folderId` and nothing
 * else. Every per-item route fills in what a body leaves out from the row it
 * already has, so a move cannot touch the words, the photos, the shelf or the
 * audience by accident — which is what makes it safe to offer on somebody
 * else's share to whoever keeps the circle.
 *
 * The answer is only the two things that changed, since the caller already has
 * the share: which circles it reaches, and where it now sits in each of them.
 */
export async function moveItemToFolder(
  itemType: ItemType,
  itemId: number,
  folderId: number | null,
): Promise<{ circleIds: number[]; filings: CircleFiling[] }> {
  const data = await parseOrThrow(
    await send(`/api/${ITEM_PATHS[itemType]}/${itemId}`, "PATCH", { folderId }),
  );
  const moved = (data?.[itemType] ?? {}) as {
    circleIds?: number[];
    filings?: CircleFiling[];
  };
  return { circleIds: moved.circleIds ?? [], filings: moved.filings ?? [] };
}

/** One level of the tree in a new order; folders from elsewhere are ignored. */
export async function reorderFolders(circleId: number, order: number[]): Promise<Folder[]> {
  const data = await parseOrThrow(
    await send(`/api/circles/${circleId}/folders`, "PATCH", { order }),
  );
  return data.folders ?? [];
}

// The extra questions a custom category asks --------------------------------

/**
 * Adding a question to a category's form. Any member of the circle may, the same
 * way any member may add a shelf mid-post. A label already on the form comes back
 * with `created` null and the existing field in `field`, so the form can use it.
 */
export async function addCategoryField(
  circleId: number,
  categoryId: number,
  input: NewCategoryField,
): Promise<FieldOutcome> {
  const data = await parseOrThrow(
    await send(`/api/circles/${circleId}/categories/${categoryId}/fields`, "POST", input),
  );
  return {
    created: data.created ?? null,
    field: data.field,
    categories: data.categories ?? [],
  };
}

/** Renaming a question, changing what it asks for, or switching it off. */
export async function updateCategoryField(
  circleId: number,
  categoryId: number,
  fieldId: number,
  changes: {
    label?: string;
    kind?: FieldKind;
    options?: string[];
    hint?: string | null;
    required?: boolean;
    uploadKind?: UploadKind;
    fileTypes?: FieldFileType[];
    maxBytes?: number | null;
    multiple?: boolean;
    audioWays?: AudioWay[];
    hidden?: boolean;
  },
): Promise<CircleCategory[]> {
  const data = await parseOrThrow(
    await send(
      `/api/circles/${circleId}/categories/${categoryId}/fields/${fieldId}`,
      "PATCH",
      changes,
    ),
  );
  return data.categories;
}

/** The question goes, and the answers to it with it. Nothing else on a post moves. */
export async function removeCategoryField(
  circleId: number,
  categoryId: number,
  fieldId: number,
): Promise<CircleCategory[]> {
  const data = await parseOrThrow(
    await send(`/api/circles/${circleId}/categories/${categoryId}/fields/${fieldId}`, "DELETE"),
  );
  return data.categories;
}

export async function reorderCategoryFields(
  circleId: number,
  categoryId: number,
  order: number[],
): Promise<CircleCategory[]> {
  const data = await parseOrThrow(
    await send(`/api/circles/${circleId}/categories/${categoryId}/fields`, "PATCH", { order }),
  );
  return data.categories;
}

// Posts in a circle's own categories -----------------------------------------

export async function fetchPosts(): Promise<Post[]> {
  const data = await parseOrThrow(await get("/api/posts"));
  return data.posts;
}

export async function createPost(input: SharedPost) {
  const data = await parseOrThrow(await send("/api/posts", "POST", input));
  return data.post as Post;
}

export async function updatePost(id: number, changes: SharedPost): Promise<Post> {
  const data = await parseOrThrow(await send(`/api/posts/${id}`, "PATCH", changes));
  return data.post;
}

export async function deletePost(id: number): Promise<void> {
  await parseOrThrow(await send(`/api/posts/${id}`, "DELETE"));
}

/**
 * Asks for a post's details in one of the scripts its author offered. Every one of them
 * keeps the words and changes only the letters, so the answer is exact; it is kept on
 * the post, so every tap after the first is a cache read.
 *
 * Nothing here invents content and nothing here translates: what is converted is the
 * text the author wrote, and a post with no details answers 400.
 */
export async function translatePost(
  postId: number,
  language: PostLanguage,
): Promise<PostTranslation> {
  const data = await parseOrThrow(
    await send(`/api/posts/${postId}/translations/${language}`, "POST"),
  );
  return data.translation;
}

export const MAX_COVER_BYTES = 5 * 1024 * 1024;
const COVER_WIDTH = 1200;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Pictures come off a phone camera at several megabytes, and a function only
 * accepts 6 MB, so the picked image is drawn into a canvas at the width it will
 * actually be shown at and sent as a JPEG. Whatever the camera produced — HEIC
 * included — arrives as something every browser can draw.
 */
async function shrinkImage(file: Blob, width: number): Promise<Blob | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, width / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.82),
    );
  } catch {
    return null;
  }
}

export async function uploadCircleCover(file: Blob): Promise<{ coverKey: string; coverUrl: string }> {
  const shrunk = await shrinkImage(file, COVER_WIDTH);
  const image = shrunk ?? file;
  if (!shrunk && !IMAGE_TYPES.includes(file.type)) {
    throw new Error("Please choose a JPEG, PNG, or WebP image.");
  }
  if (image.size > MAX_COVER_BYTES) {
    throw new Error(
      `That image is ${formatBytes(image.size)}. Please pick one under ${formatBytes(MAX_COVER_BYTES)}.`,
    );
  }

  const data = await parseOrThrow(
    await request("/api/circle-covers", {
      method: "POST",
      body: image,
      headers: { "Content-Type": image.type || "image/jpeg" },
    }),
  );
  return { coverKey: data.coverKey, coverUrl: data.coverUrl };
}

// Photos ---------------------------------------------------------------------

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
/** The same ceiling the server keeps, so the form can stop offering "+" in time. */
export const MAX_PHOTOS_PER_ITEM = 10;
const PHOTO_WIDTH = 1600;

/**
 * Uploads one picture and hands back the key that attaches it to a share. The
 * photo exists on its own until the form is saved, which is what lets a member
 * add several before deciding, and take one back out again.
 */
export async function uploadItemPhoto(file: Blob): Promise<ItemPhoto> {
  const shrunk = await shrinkImage(file, PHOTO_WIDTH);
  const image = shrunk ?? file;
  if (!shrunk && !IMAGE_TYPES.includes(file.type)) {
    throw new Error("Please choose a JPEG, PNG, or WebP image.");
  }
  if (image.size > MAX_PHOTO_BYTES) {
    throw new Error(
      `That photo is ${formatBytes(image.size)}. Please pick one under ${formatBytes(MAX_PHOTO_BYTES)}.`,
    );
  }

  const data = await parseOrThrow(
    await request("/api/photos", {
      method: "POST",
      body: image,
      headers: { "Content-Type": image.type || "image/jpeg" },
    }),
  );
  return data.photo;
}

/** The keys a form sends back, in the order the member arranged them. */
export function photoKeys(photos: ItemPhoto[]): string[] {
  return photos.map((photo) => photo.key);
}

// Files on a field ------------------------------------------------------------

/** The same ceiling the server keeps, so a file too big is refused before it goes. */
export const MAX_FIELD_FILE_BYTES = 10 * 1024 * 1024;

/** And the same cap on how many one field takes when it takes more than one. */
export const MAX_FILES_PER_FIELD = 6;

/** The three kinds of document a circle may ask an upload field for. */
export type FieldFileType = "pdf" | "word" | "excel";

/**
 * The three as the "Allowed file types" tick-list offers them, each with what a
 * browser might hand over for it. Both halves of `accept` are needed: the
 * extensions because some devices report a `.docx` as nothing more than a stream
 * of bytes, and the media types because a desktop browser filters on those.
 */
export const FIELD_FILE_TYPE_OPTIONS: {
  id: FieldFileType;
  label: string;
  extensions: string[];
  mediaTypes: string[];
}[] = [
  { id: "pdf", label: "PDF", extensions: [".pdf"], mediaTypes: ["application/pdf"] },
  {
    id: "word",
    label: "Word",
    extensions: [".doc", ".docx"],
    mediaTypes: [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  },
  {
    id: "excel",
    label: "Excel",
    extensions: [".xls", ".xlsx"],
    mediaTypes: [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  },
];

/** What the picker offers when the field said nothing about which of the three. */
export const FIELD_FILE_ACCEPT = fieldFileAccept([]);

/**
 * The `accept` attribute for a field that narrowed the list — a PDF-only field
 * opens the device's picker on PDFs rather than on everything and then refusing.
 * An empty list is all three, which is what a field with no answer stored means.
 */
export function fieldFileAccept(types: readonly FieldFileType[]): string {
  const wanted = FIELD_FILE_TYPE_OPTIONS.filter(
    (option) => types.length === 0 || types.includes(option.id),
  );
  return wanted.flatMap((option) => [...option.extensions, ...option.mediaTypes]).join(",");
}

/**
 * Which of the three a picked file is, judged the way the server judges it: what
 * the browser declared, then what the name ends with, since the two disagree
 * often enough that either alone is not enough. Null for anything that is
 * neither, which is the refusal.
 */
export function fieldFileTypeOf(file: File): FieldFileType | null {
  const declared = (file.type || "").split(";")[0].trim().toLowerCase();
  const byType = FIELD_FILE_TYPE_OPTIONS.find((option) => option.mediaTypes.includes(declared));
  if (byType) return byType.id;
  const name = file.name.trim().toLowerCase();
  return (
    FIELD_FILE_TYPE_OPTIONS.find((option) => option.extensions.some((ext) => name.endsWith(ext)))
      ?.id ?? null
  );
}

/** The words a field uses for what it accepts: "PDF", or "PDF or Word". */
export function fieldFileTypesLabel(types: readonly FieldFileType[]): string {
  const wanted = FIELD_FILE_TYPE_OPTIONS.filter(
    (option) => types.length === 0 || types.includes(option.id),
  ).map((option) => option.label);
  if (wanted.length === 0) return "PDF, Word or Excel";
  if (wanted.length === 1) return wanted[0];
  return `${wanted.slice(0, -1).join(", ")} or ${wanted.at(-1)}`;
}

/** A document answering a field of kind "file". */
export interface FieldFile {
  key: string;
  name: string;
  size: number;
  url: string;
}

/**
 * Uploads one document and hands back what attaches it to a share. Like a photo
 * it exists on its own until the form is saved, so the member sees the name on
 * the form straight away and can pick a different one before saving.
 *
 * How it travels depends only on its size, and the caller never has to care: a
 * file that fits in a request body is the body of `POST /api/files`, and anything
 * larger is sliced and PUT the way a recording is and then claimed by
 * `POST /api/field-files`. Both answer the same `{ key, name, size, url }`, which
 * is what lets a field ask for 10 MB when a function only ever receives 6.
 */
export async function uploadFieldFile(
  file: File,
  rules: { types?: readonly FieldFileType[]; maxBytes?: number | null } = {},
): Promise<FieldFile> {
  if (file.size === 0) throw new Error("That file is empty.");
  const ceiling = Math.min(rules.maxBytes || MAX_FIELD_FILE_BYTES, MAX_FIELD_FILE_BYTES);
  if (file.size > ceiling) {
    throw new Error(
      `That file is ${formatBytes(file.size)}. Please pick one under ${formatBytes(ceiling)}.`,
    );
  }
  // What the field actually asked for. The picker's own `accept` is a filter and
  // not a rule — a member may always choose "all files" past it — so the answer
  // is checked here as well, and again on the server, which is the one that counts.
  const kind = fieldFileTypeOf(file);
  const wanted = rules.types ?? [];
  if (!kind || (wanted.length > 0 && !wanted.includes(kind))) {
    throw new Error(`This field takes ${fieldFileTypesLabel(wanted)}.`);
  }

  // Past a request body's worth, the bytes go up in slices instead. The type is
  // sent as the browser reported it and the server checks it against the filename
  // the same way the one-request route does, since some devices report a `.docx`
  // as nothing in particular.
  if (file.size > PART_BYTES) {
    const { uploadId, parts } = await putParts(file);
    const claimed = await parseOrThrow(
      await send("/api/field-files", "POST", {
        uploadId,
        parts,
        contentType: file.type || "application/octet-stream",
        name: file.name,
      }),
    );
    return claimed.file;
  }

  const data = await parseOrThrow(
    await request("/api/files", {
      method: "POST",
      body: file,
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        // A name may hold anything a member typed, and a header may not.
        "X-File-Name": encodeURIComponent(file.name),
      },
    }),
  );
  return data.file;
}

/**
 * The answer a file field stores, read back. It is the one kind whose stored
 * value is not what a reader sees, so everything drawing an answer asks this
 * first and falls back to the plain text when it says no.
 */
export function parseFieldFile(value: string): FieldFile | null {
  const raw = value.trim();
  if (!raw.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(raw) as { key?: unknown; name?: unknown; size?: unknown };
    if (typeof parsed.key !== "string" || !parsed.key) return null;
    return {
      key: parsed.key,
      name: typeof parsed.name === "string" && parsed.name ? parsed.name : "Document",
      size: typeof parsed.size === "number" ? parsed.size : 0,
      url: `/api/files/${encodeURIComponent(parsed.key)}`,
    };
  } catch {
    return null;
  }
}

/**
 * The same answer read as the list it may be. A field set to take several stores
 * a JSON array and one taking a single document stores the bare object it always
 * did, so both shapes are read here and nothing written before a field could take
 * more than one had to be rewritten.
 */
export function parseFieldFiles(value: string): FieldFile[] {
  const raw = value.trim();
  if (!raw.startsWith("[")) {
    const one = parseFieldFile(raw);
    return one ? [one] : [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const files: FieldFile[] = [];
    for (const entry of parsed) {
      const file = parseFieldFile(JSON.stringify(entry));
      if (file && !files.some((kept) => kept.key === file.key)) files.push(file);
    }
    return files;
  } catch {
    return [];
  }
}

/** And the other direction: what the form sends once a document is picked. */
export function fieldFileValue(file: FieldFile): string {
  return JSON.stringify({ key: file.key, name: file.name, size: file.size });
}

/** The same, for a field holding more than one. One file keeps the older shape. */
export function fieldFilesValue(files: FieldFile[]): string {
  if (files.length === 0) return "";
  if (files.length === 1) return fieldFileValue(files[0]);
  return JSON.stringify(
    files.map((file) => ({ key: file.key, name: file.name, size: file.size })),
  );
}

/**
 * The answer to an audio field, uploaded.
 *
 * It is a recording, so it goes up the way every other recording in this app
 * does — `uploadSongParts()`, in ~4 MB slices, to `PUT /api/uploads/:id/parts/:i`,
 * up to the 20 MB a streamed response can carry — and only the route that claims
 * the parts differs: `POST /api/field-audio` writes them into the attachments
 * store and answers the same `{ key, name, size, url }` envelope a document does.
 * So an audio answer is stored, read, saved into My Library and swept up by
 * exactly the code a PDF answer is, and nothing above this line has to know which
 * of the two it is holding.
 *
 * `uploadFieldFile()` slices a large document the same way now, so the chunking is
 * no longer what separates the two: what does is the ceiling and the claim route,
 * a recording running to 20 MB where a document stops at 10.
 */
export async function uploadFieldAudio(
  file: Blob,
  options: { name?: string; durationSeconds?: number | null } = {},
  onProgress?: (percent: number) => void,
): Promise<FieldFile> {
  const audio = await uploadSongParts(file, options.durationSeconds ?? null, onProgress);
  const data = await parseOrThrow(
    await send("/api/field-audio", "POST", {
      uploadId: audio.uploadId,
      parts: audio.parts,
      contentType: audio.contentType,
      name: options.name ?? "",
    }),
  );
  onProgress?.(100);
  return data.file;
}

/**
 * Whether a stored answer is a recording rather than a document, read off the
 * name it was uploaded under.
 *
 * A saved answer carries its field's label and kind and not the field itself, so
 * a reader — and a copy of a share sitting in somebody's My Library long after
 * they left the circle that asked the question — has no `uploadKind` to consult.
 * The name is what there is, and it is enough: a recording arrives either from a
 * device, where it has one of these extensions, or from the recorder, which names
 * it after the container it captured.
 */
export function isAudioFileName(name: string): boolean {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return false;
  return Boolean(AUDIO_TYPES[name.slice(dot + 1).toLowerCase()]);
}

// Formatting -----------------------------------------------------------------

/**
 * Where a recording plays from.
 *
 * The `version` is the song's own blob key, and it is on the URL for one reason: a
 * member who re-records a song keeps the same song id, so without it the player
 * already on screen — and any copy the browser kept — would go on offering the take
 * they just replaced.
 */
export function audioUrl(id: number, version?: string | null): string {
  const stamp = version ? version.slice(-12).replace(/[^a-zA-Z0-9-]/g, "") : "";
  return stamp ? `/api/audio/${id}?v=${stamp}` : `/api/audio/${id}`;
}

/**
 * Bytes as a member reads them. The gigabyte step is for the usage report and
 * nothing else — every file this app accepts is capped in the megabytes, so a
 * share's own size never reaches it, while a month of somebody's egress does and
 * "40960.0 MB" is a number nobody can see the size of.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 1) return "";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  if (sameDay) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

/**
 * "2h", "3d", "12 Aug" — the short form a feed row wants, where the date is the
 * least interesting thing on the line and is competing with the title for the
 * reader's eye. Under a minute is "now", and anything older than a week gives up
 * on counting and says the date, since "37d" is arithmetic rather than
 * information. `formatDate()` is still the one to use anywhere a member is
 * actually reading a date — a recipe's page, a word's entry — because "Today" is
 * kinder there than "4h".
 */
export function formatSince(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(then).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
