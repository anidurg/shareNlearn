// netlify/lib/aksharamukha.ts
// The one place letters are changed, so every feature that wants the same words in
// different script asks the same way and fails the same way.
//
// Changing letters and changing words are two different jobs, and this app once did
// both with a language model. That was wrong in two ways. It was slow — a model writes
// a stotra out one token at a time, and a member watching a spinner for ten seconds is
// a member who stops tapping the button — and it was unreliable in the way that
// matters least visibly: a model asked to put Devanagari into Kannada letters will
// occasionally decide a word is a name, or a title, or worth improving.
//
// Transliteration is not a judgement call. /ka/ is ಕ is క is क, and a lookup table
// settles it in microseconds. So the table now lives **in this process**: Sanscript
// (`@indic-transliteration/sanscript`, MIT, no native code, no network) holds the
// mappings for the ten scripts and four roman conventions this app offers, and a
// conversion is a function call rather than a request. That is the whole of this
// change: the answer used to cost a round trip to a hosted service — a second and a
// half of somebody's afternoon, every time, on top of the app's own hop — and now it
// costs a millisecond.
//
// Aksharamukha, which used to do this job, is kept as the fallback for the rare pair
// the local table cannot make sense of. It knows some orthographic niceties Sanscript
// does not, so it is worth asking when the local answer comes back unbelievable — but
// it is never on the path a member actually waits on.
//
// The AI Gateway has no part in any of this any more. It once wrote the readings —
// what a verse *means* in another language — and the app no longer offers those: a
// script conversion keeps every word, and a paraphrase printed under somebody's own
// name was never what a reader tapping "ಕನ್ನಡ" was asking for.
//
// Three properties this module holds to, all of them the same shape as `ai.ts`:
//
//   Nothing here throws. Every failure path — an unrecognised pair, an unreachable
//   fallback, a slow one, an answer that came back in the wrong letters — is null, and
//   the caller offers nothing rather than approximating. A script conversion is a
//   convenience.
//
//   Nothing here invents. A mapping table maps characters; it cannot add a sentence,
//   and it has no opinion about what the text says. That is the whole reason it is a
//   better fit than a model for this job, and it is why the member's own words come
//   back as the member's own words.
//
//   Every answer is checked before it is believed. See `converted()` below — both
//   converters can hand back the text that went in, so "it did not error" is not the
//   same as "it converted".
import Sanscript from "@indic-transliteration/sanscript";

/**
 * Aksharamukha's public REST endpoint, which the project offers "for reasonable
 * public consumption". Reasonable is now barely anything at all: it is asked only when
 * the local table declines a pair, and every answer is cached against a digest of the
 * text it came from.
 */
const ENDPOINT = "https://aksharamukha-plugin.appspot.com/api/public";

/**
 * Long enough for a stotra or a travelogue in one call. The same ceiling the gateway
 * side uses, so a member cannot discover that one converter takes more than the other.
 */
export const MAX_TRANSLITERATION_SOURCE = 6_000;

/**
 * Short, because this only ever guards the fallback, and because a character mapping
 * that has not answered in five seconds is not going to. Nothing a member is watching
 * waits on it: the local table has already declined by the time this matters, so the
 * choice is between a null soon and a null later.
 */
const TIMEOUT_MS = 5_000;

/**
 * The scripts this app converts into: the name Sanscript knows each by, the name
 * Aksharamukha knows each by, the name a member reads, a few of its own letters to
 * recognise it by, and the Unicode block those letters live in.
 *
 * It is a long table on purpose. Sanscript ships the mappings for every one of these
 * in the same file it ships Kannada in, so offering fifty costs exactly what offering
 * ten cost — no key, no request, no extra dependency — and the ten this app started
 * with were ten guesses about whose family reads what. A member ticks the scripts
 * their own people read, and the ones nobody ticks are simply never drawn.
 *
 * Every row was checked rather than written from memory: each one was converted in
 * this process and its answer confirmed to be in the block claimed for it. Two rules
 * kept scripts out. A script that shares a block with one already here would make
 * `detectScript()` ambiguous — Assamese cannot be told from Bengali, nor Shan from
 * Burmese, by looking at the letters — so the block each row claims is its own. And a
 * script the local table maps to itself is no conversion at all.
 *
 * Neither set of converter names is a guess and they are not interchangeable with the
 * obvious synonym — Aksharamukha calls Gurmukhi "Gurmukhi" and not "Punjabi", and Odia
 * "Oriya" and not "Odia" — and neither converter refuses a name it does not know.
 * Aksharamukha answers `200` with your text handed straight back; Sanscript hands it
 * back without complaint too. Which is why `converted()` exists and why nothing here is
 * spelled from memory. They are written out separately because one of them changing its
 * mind is not the other's problem: a remote name that has drifted costs the fallback
 * for that one script and nothing else.
 *
 * `native` is what somebody scanning the list looks for first. For the scripts a member
 * is likely to read it is the script's own name for itself; for the historical ones,
 * where an endonym would be an invention, it is one word — *akshara* — written in that
 * script, which is a truer sample than a name nobody agrees on.
 *
 * The block is what proves an answer arrived. It is a range rather than a regex
 * because a converted line is mostly its own letters plus whatever punctuation,
 * digits and stray Latin the member typed, and the question being asked is only
 * "is any of this actually in the script I asked for".
 */
const SCRIPTS = {
  devanagari: {
    local: "devanagari",
    name: "Devanagari",
    label: "Devanagari",
    native: "देवनागरी",
    from: 0x0900,
    to: 0x097f,
  },
  bengali: {
    local: "bengali",
    name: "Bengali",
    label: "Bengali",
    native: "বাংলা",
    from: 0x0980,
    to: 0x09ff,
  },
  gurmukhi: {
    local: "gurmukhi",
    name: "Gurmukhi",
    label: "Gurmukhi",
    native: "ਗੁਰਮੁਖੀ",
    from: 0x0a00,
    to: 0x0a7f,
  },
  gujarati: {
    local: "gujarati",
    name: "Gujarati",
    label: "Gujarati",
    native: "ગુજરાતી",
    from: 0x0a80,
    to: 0x0aff,
  },
  oriya: {
    local: "oriya",
    name: "Oriya",
    label: "Odia",
    native: "ଓଡ଼ିଆ",
    from: 0x0b00,
    to: 0x0b7f,
  },
  tamil: {
    local: "tamil",
    name: "Tamil",
    label: "Tamil",
    native: "தமிழ்",
    from: 0x0b80,
    to: 0x0bff,
  },
  telugu: {
    local: "telugu",
    name: "Telugu",
    label: "Telugu",
    native: "తెలుగు",
    from: 0x0c00,
    to: 0x0c7f,
  },
  kannada: {
    local: "kannada",
    name: "Kannada",
    label: "Kannada",
    native: "ಕನ್ನಡ",
    from: 0x0c80,
    to: 0x0cff,
  },
  malayalam: {
    local: "malayalam",
    name: "Malayalam",
    label: "Malayalam",
    native: "മലയാളം",
    from: 0x0d00,
    to: 0x0d7f,
  },
  sinhala: {
    local: "sinhala",
    name: "Sinhala",
    label: "Sinhala",
    native: "සිංහල",
    from: 0x0d80,
    to: 0x0dff,
  },
  ahom: {
    local: "ahom",
    name: "Ahom",
    label: "Ahom",
    native: "𑜒𑜀𑜫𑜏𑜍",
    from: 0x11700,
    to: 0x1174f,
  },
  avestan: {
    local: "avestan",
    name: "Avestan",
    label: "Avestan",
    native: "𐬀𐬐𐬴𐬀𐬀𐬭𐬀𐬀",
    from: 0x10b00,
    to: 0x10b3f,
  },
  balinese: {
    local: "balinese",
    name: "Balinese",
    label: "Balinese",
    native: "ᬅᬓ᭄ᬱᬭ",
    from: 0x1b00,
    to: 0x1b7f,
  },
  bhaiksuki: {
    local: "bhaiksuki",
    name: "Bhaiksuki",
    label: "Bhaiksuki",
    native: "𑰀𑰎𑰿𑰬𑰨",
    from: 0x11c00,
    to: 0x11c6f,
  },
  brahmi: {
    local: "brahmi",
    name: "Brahmi",
    label: "Brahmi",
    native: "𑀅𑀓𑁆𑀱𑀭",
    from: 0x11000,
    to: 0x1107f,
  },
  burmese: {
    local: "burmese",
    name: "Burmese",
    label: "Burmese",
    native: "မြန်မာ",
    from: 0x1000,
    to: 0x109f,
  },
  cham: {
    local: "cham",
    name: "Cham",
    label: "Cham",
    native: "ꨀꩀꨦꨣ",
    from: 0xaa00,
    to: 0xaa5f,
  },
  dogra: {
    local: "dogra",
    name: "Dogra",
    label: "Dogra",
    native: "𑠀𑠊𑠹𑠨𑠤",
    from: 0x11800,
    to: 0x1184f,
  },
  grantha: {
    local: "grantha",
    name: "Grantha",
    label: "Grantha",
    native: "𑌅𑌕𑍍𑌷𑌰",
    from: 0x11300,
    to: 0x1137f,
  },
  "gunjala-gondi": {
    local: "gondi_gunjala",
    name: "GunjalaGondi",
    label: "Gunjala Gondi",
    native: "𑵠𑵱𑶗𑶉𑶈",
    from: 0x11d60,
    to: 0x11daf,
  },
  "hanifi-rohingya": {
    local: "rohingya",
    name: "HanifiRohingya",
    label: "Hanifi Rohingya",
    native: "𐴀𐴝𐴑𐴐𐴝𐴌𐴝",
    from: 0x10d00,
    to: 0x10d3f,
  },
  javanese: {
    local: "javanese",
    name: "Javanese",
    label: "Javanese",
    native: "ꦄꦏ꧀ꦰꦫ",
    from: 0xa980,
    to: 0xa9df,
  },
  kharoshthi: {
    local: "kharoshthi",
    name: "Kharoshthi",
    label: "Kharoshthi",
    native: "𐨀𐨐𐨿𐨮𐨪",
    from: 0x10a00,
    to: 0x10a5f,
  },
  khmer: {
    local: "khmer",
    name: "Khmer",
    label: "Khmer",
    native: "ខ្មែរ",
    from: 0x1780,
    to: 0x17ff,
  },
  khudawadi: {
    local: "khudawadi",
    name: "Khudawadi",
    label: "Khudawadi",
    native: "𑊰𑊺𑋪𑋜𑋩𑋙",
    from: 0x112b0,
    to: 0x112ff,
  },
  lao: {
    local: "lao",
    name: "Lao",
    label: "Lao",
    native: "ລາວ",
    from: 0x0e80,
    to: 0x0eff,
  },
  lepcha: {
    local: "lepcha",
    name: "Lepcha",
    label: "Lepcha",
    native: "ᰣᰀᰡ᰷ᰛ",
    from: 0x1c00,
    to: 0x1c4f,
  },
  limbu: {
    local: "limbu",
    name: "Limbu",
    label: "Limbu",
    native: "ᤀᤁ᤻ᤙᤖ",
    from: 0x1900,
    to: 0x194f,
  },
  mahajani: {
    local: "mahajani",
    name: "Mahajani",
    label: "Mahajani",
    native: "𑅐𑅕𑅖𑅳𑅐𑅭𑅐",
    from: 0x11150,
    to: 0x1117f,
  },
  marchen: {
    local: "marchen",
    name: "Marchen",
    label: "Marchen",
    native: "𑲏𑱲𑲬𑲊",
    from: 0x11c70,
    to: 0x11cbf,
  },
  "masaram-gondi": {
    local: "gondi_masaram",
    name: "MasaramGondi",
    label: "Masaram Gondi",
    native: "𑴀𑴮𑴦",
    from: 0x11d00,
    to: 0x11d5f,
  },
  "meetei-mayek": {
    local: "manipuri",
    name: "MeeteiMayek",
    label: "Meetei Mayek",
    native: "ꯑꯛꯁꯔ",
    from: 0xabc0,
    to: 0xabff,
  },
  modi: {
    local: "modi",
    name: "Modi",
    label: "Modi",
    native: "𑘀𑘎𑘿𑘬𑘨",
    from: 0x11600,
    to: 0x1165f,
  },
  mro: {
    local: "mro",
    name: "Mro",
    label: "Mro",
    native: "𖩒𖩌𖩔𖩒𖩓𖩒",
    from: 0x16a40,
    to: 0x16a6f,
  },
  multani: {
    local: "multani",
    name: "Multani",
    label: "Multani",
    native: "𑊀𑊄𑊥𑊀𑊢𑊀",
    from: 0x11280,
    to: 0x112af,
  },
  newa: {
    local: "newa",
    name: "Newa",
    label: "Newa",
    native: "𑐀𑐎𑑂𑐲𑐬",
    from: 0x11400,
    to: 0x1147f,
  },
  "ol-chiki": {
    local: "ol_chiki",
    name: "OlChiki",
    label: "Ol Chiki",
    native: "ᱚᱠᱥᱚᱨᱚ",
    from: 0x1c50,
    to: 0x1c7f,
  },
  "old-persian": {
    local: "persian_old",
    name: "OldPersian",
    label: "Old Persian",
    native: "𐎠𐎣𐏂𐎠𐎼𐎠",
    from: 0x103a0,
    to: 0x103df,
  },
  "phags-pa": {
    local: "phags_pa",
    name: "PhagsPa",
    label: "Phags-pa",
    native: "ꡝꡀꡚꡘ",
    from: 0xa840,
    to: 0xa87f,
  },
  sharada: {
    local: "sharada",
    name: "Sharada",
    label: "Sharada",
    native: "𑆃𑆑𑇀𑆰𑆫",
    from: 0x11180,
    to: 0x111df,
  },
  siddham: {
    local: "siddham",
    name: "Siddham",
    label: "Siddham",
    native: "𑖀𑖎𑖿𑖬𑖨",
    from: 0x11580,
    to: 0x115ff,
  },
  "sora-sompeng": {
    local: "sora_sompeng",
    name: "SoraSompeng",
    label: "Sora Sompeng",
    native: "𑃦𑃨𑃟𑃐𑃨𑃝",
    from: 0x110d0,
    to: 0x110ff,
  },
  takri: {
    local: "takri",
    name: "Takri",
    label: "Takri",
    native: "𑚀𑚊𑚶𑚋𑚤",
    from: 0x11680,
    to: 0x116cf,
  },
  thai: {
    local: "thai",
    name: "Thai",
    label: "Thai",
    native: "ไทย",
    from: 0x0e00,
    to: 0x0e7f,
  },
  tibetan: {
    local: "tibetan",
    name: "Tibetan",
    label: "Tibetan",
    native: "བོད་ཡིག",
    from: 0x0f00,
    to: 0x0fff,
  },
  tirhuta: {
    local: "tirhuta_maithili",
    name: "Tirhuta",
    label: "Tirhuta",
    native: "𑒁𑒏𑓂𑒭𑒩",
    from: 0x11480,
    to: 0x114df,
  },
  arabic: {
    local: "urdu",
    name: "Urdu",
    label: "Urdu",
    native: "اردو",
    from: 0x0600,
    to: 0x06ff,
  },
  wancho: {
    local: "wancho",
    name: "Wancho",
    label: "Wancho",
    native: "𞋁𞋔𞋏𞋁𞋗𞋁",
    from: 0x1e2c0,
    to: 0x1e2ff,
  },
  "warang-citi": {
    local: "warang_citi",
    name: "WarangCiti",
    label: "Warang Citi",
    native: "𑣁𑣌𑣞𑣜",
    from: 0x118a0,
    to: 0x118ff,
  },
  "zanabazar-square": {
    local: "zanbazar_square",
    name: "ZanabazarSquare",
    label: "Zanabazar Square",
    native: "𑨀𑨲𑨫",
    from: 0x11a00,
    to: 0x11a4f,
  },
} as const;

export type IndicScript = keyof typeof SCRIPTS;

/** The same table as a list, built once, because `detectScript` walks it per letter. */
const BLOCKS = Object.entries(SCRIPTS) as [IndicScript, (typeof SCRIPTS)[IndicScript]][];

export function isIndicScript(value: unknown): value is IndicScript {
  return typeof value === "string" && value in SCRIPTS;
}

/**
 * Every script on offer, as the list a picker draws: the id it is asked for by, the
 * name a member reads, and a few of its own letters.
 *
 * The order is the table's own — the scripts this group actually writes in first, then
 * the rest by name — because a member scanning for Kannada should not have to scroll
 * past Ahom to find it, and a member looking for Ahom is searching rather than
 * scanning. Both features that offer scripts build their own list from this one, so
 * adding a script to `SCRIPTS` adds it to both and to neither's list of things to
 * remember.
 */
export const SCRIPT_LIST = BLOCKS.map(([id, script]) => ({
  id,
  label: script.label,
  native: script.native,
}));

/**
 * The ways of writing an Indian language in Latin letters that a member might
 * actually type, in the order the form offers them.
 *
 * This list is the reason the authoring converter can exist at all. "Type in English
 * letters and get Kannada" is only a well-defined request once somebody has said
 * which convention the English letters follow — `sh` for ಶ or `ś`, `aa` for ಆ or `ā` —
 * and the four here cover every member this app is likely to have: the one who types
 * the way people type in chat, the two academic standards, and the one linguists use.
 */
export const ROMAN_SCHEMES = [
  {
    id: "itrans",
    local: "itrans",
    name: "Itrans",
    label: "Plain English letters",
    hint: "aa ii uu, sh, N for ಂ, T for ಟ — the way most people type",
    example: "vakratuNDa mahaakaaya",
  },
  {
    id: "iast",
    local: "iast",
    name: "IAST",
    label: "IAST",
    hint: "with diacritics: ā ī ū, ś, ṭ, ṇ",
    example: "vakratuṇḍa mahākāya",
  },
  {
    id: "iso",
    local: "iso",
    name: "ISO",
    label: "ISO 15919",
    hint: "with diacritics, ē and ō written long",
    example: "vakratuṇḍa mahākāya",
  },
  {
    id: "hk",
    local: "hk",
    name: "HK",
    label: "Harvard-Kyoto",
    hint: "A I U, z for ಶ, T for ಟ",
    example: "vakratuNDa mahAkAya",
  },
] as const;

export type RomanScheme = (typeof ROMAN_SCHEMES)[number]["id"];

export function isRomanScheme(value: unknown): value is RomanScheme {
  return typeof value === "string" && ROMAN_SCHEMES.some((scheme) => scheme.id === value);
}

/** A source is either a script somebody wrote in or a convention they typed in. */
export type TransliterationSource = IndicScript | RomanScheme;

/**
 * And so is a target. Writing Kannada letters out in Latin ones is the same lookup
 * run the other way — the direction a member wants when they have pasted a stotra in
 * a script they cannot read and would like the sounds of it in the alphabet they can.
 * Which is why the two ends of a conversion are the same type: nothing about the
 * table cares which side a script is on.
 */
export type TransliterationTarget = TransliterationSource;

function schemeOf(source: TransliterationSource) {
  return ROMAN_SCHEMES.find((scheme) => scheme.id === source)!;
}

/** What Aksharamukha calls the same script or convention. */
function serviceName(source: TransliterationSource) {
  if (isIndicScript(source)) return SCRIPTS[source].name;
  return schemeOf(source).name;
}

/** What Sanscript's own tables call the same script or convention. */
function localName(source: TransliterationSource) {
  return isIndicScript(source) ? SCRIPTS[source].local : schemeOf(source).local;
}

/**
 * Which script a piece of text is written in, by counting whose letters they are.
 *
 * This is deliberately a count rather than a first-match: a Kannada post quoting a
 * Devanagari line is still a Kannada post, and the script with the most letters in it
 * is the one the text is in. Punctuation, digits and spaces belong to no script and
 * are not counted.
 *
 * Null means Latin letters or nothing recognisable — and null is the important
 * answer, not a failure. Latin text may be romanised Sanskrit, in which case
 * converting it is exactly right, or it may be an English paragraph about a holiday,
 * in which case converting it produces confident gibberish. The app cannot tell those
 * apart by looking, so it does not try: a Latin source is either declared by the
 * member who typed it or handed to the gateway, which can read the difference.
 */
export function detectScript(source: string): IndicScript | null {
  const counts = new Map<IndicScript, number>();
  for (const character of source) {
    const code = character.codePointAt(0)!;
    // Cheap reject for the Latin, punctuation and whitespace that most characters
    // are, so a 6,000 character post is not fifty range checks per letter. Arabic is
    // the lowest block in the table and Wancho the highest, and everything below the
    // first is the alphabet this sentence is written in.
    if (code < 0x0600 || code > 0x1e2ff) continue;
    for (const [id, script] of BLOCKS) {
      if (code >= script.from && code <= script.to) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
        break;
      }
    }
  }

  let best: IndicScript | null = null;
  let most = 0;
  for (const [id, count] of counts) {
    if (count > most) {
      best = id;
      most = count;
    }
  }
  // A stray sign or two is somebody's punctuation, not the script they wrote in.
  return most >= 4 ? best : null;
}

/**
 * An answer, tidied and believed — or null.
 *
 * This is the guard the whole module leans on, because neither converter rejects a
 * script name it does not recognise. Aksharamukha answers `200 OK` with the text handed
 * straight back; the local table is just as quiet about it. A caller that trusts
 * "it did not error" will cheerfully cache the original Devanagari as though it were
 * Kannada and serve it to readers forever.
 *
 * So two questions are asked of every answer. Did anything change at all — an answer
 * identical to what went out is a converter declining without saying so. And is any of
 * it in the letters that were asked for, which catches an error page, an empty body,
 * and a mapping that dropped the text on the floor. One letter is enough: a member
 * converting a single word is asking a fair question, and the answer to "did this
 * happen" does not get truer with four.
 *
 * "The letters that were asked for" is a Unicode block for a script and the Latin
 * alphabet for a roman convention — the same question either way, since a Kannada
 * verse written out in English letters is proved by there being English letters in it.
 *
 * Trailing spaces go and line breaks stay, which is the reason this can be used for
 * lyrics at all: a verse that comes back as one paragraph is no use to somebody trying
 * to sing along with it.
 */
function converted(written: string, source: string, target: TransliterationTarget) {
  const answer = written
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();

  if (answer.length === 0) return null;
  if (answer === source.trim()) return null;

  if (!isIndicScript(target)) {
    // A roman scheme's letters are a-z with diacritics on some of them, and the
    // plain ASCII range is what every one of the four has in common.
    return /[A-Za-z]/.test(answer) ? answer : null;
  }

  const { from, to } = SCRIPTS[target];
  for (const character of answer) {
    const code = character.codePointAt(0)!;
    if (code >= from && code <= to) return answer;
  }
  return null;
}

/** Whether script conversion can be reached at all. It needs no key, so: always. */
export function transliterationAvailable() {
  return true;
}

/**
 * Which of the two converters wrote a cached row. Stored rather than inferred, because
 * the answer decides whether a row is still the best one available: a model's attempt
 * at a script conversion is worth remaking exactly, and an exact one never needs
 * remaking at all. It lives here rather than in either feature because both of them
 * mean the same two things by it, and the browser is told which one it is reading.
 *
 * There are two exact converters now — the local table and the hosted service it fell
 * back from — and they are one value here on purpose. What a reader is being told is
 * "this is a mapping rather than a reading", and which table did the mapping is not
 * something anybody needs to know or would trust differently.
 */
export type ConversionEngine = "aksharamukha" | "ai";

/**
 * The same words in different letters, in this process, or null.
 *
 * Null covers every way this can go wrong — a pair neither table can make sense of, an
 * answer that came back in the letters it went out in — and callers treat it as "not
 * this way, then" rather than as an error to hand a member. On the reader side that
 * means the script is not offered at all; on the authoring side it means the member
 * keeps typing what they were typing.
 *
 * The local table answers first and almost always, which is the point: a member tapping
 * Convert waits on a function call rather than on somebody else's server.
 */
export async function transliterate(input: {
  source: string;
  from: TransliterationSource;
  to: TransliterationTarget;
}): Promise<string | null> {
  const source = input.source.slice(0, MAX_TRANSLITERATION_SOURCE);
  if (source.trim().length === 0) return null;

  // Nothing to do, and nothing worth doing it with: the words are already in these
  // letters. Said here rather than at each caller so no caller has to remember.
  if (input.from === input.to) return null;

  let local: string | null = null;
  try {
    local = Sanscript.t(source, localName(input.from), localName(input.to));
  } catch {
    // A mapping table that threw is a mapping table that has no answer.
    local = null;
  }
  const mapped = local === null ? null : converted(local, source, input.to);
  if (mapped) return mapped;

  return remote(source, input.from, input.to);
}

/**
 * The hosted service, asked only once the local table has declined.
 *
 * It is kept because it knows a handful of orthographic conventions the local tables do
 * not, and because a second opinion costs nothing when the first one had none. Nothing
 * reaches this on the ordinary path, so its slowness is no longer anybody's afternoon.
 */
async function remote(source: string, from: TransliterationSource, to: TransliterationTarget) {
  const body = new URLSearchParams({
    source: serviceName(from),
    target: serviceName(to),
    text: source,
  });

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // A timeout and a refused connection are the same thing to the caller.
    return null;
  }

  if (!response.ok) return null;

  const written = await response.text().catch(() => "");
  return converted(written, source, to);
}

/**
 * Script conversion for text whose script nobody declared — the reader-side case,
 * where all there is to go on is the post or the lyrics themselves.
 *
 * Answers null for Latin source text on purpose, and that null is a feature. An
 * English sentence put through a transliterator comes back as Kannada letters
 * spelling English sounds, which is not a translation, not a transliteration, and not
 * something any reader wants. Rather than guess, this hands the job back, and the
 * caller asks the gateway — which can tell a romanised stotra from a paragraph about
 * Mysore, because that is a reading comprehension question rather than a lookup.
 */
export async function transliterateDetected(source: string, to: TransliterationTarget) {
  const from = detectScript(source);
  if (!from) return null;
  return transliterate({ source, from, to });
}
