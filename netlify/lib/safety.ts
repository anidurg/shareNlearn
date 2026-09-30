// netlify/lib/safety.ts
// The line between what the Community Guidelines ask for and what they refuse,
// applied to every piece of text a member writes before it is stored.
//
// This is deliberately a plain, deterministic check rather than a model call.
// Everywhere else in the app an AI answer is a convenience that may be absent —
// a summary, a lyric rendering — and the feature simply degrades. A safety
// filter cannot degrade that way: a deployment with no AI Gateway would quietly
// stop filtering, which is the one failure that matters. So the rules here are
// text, they always run, and they cost nothing.
//
// Two kinds of thing are refused, and they are refused for different reasons:
//
//   - Profanity and slurs, because the guidelines ask members to respect each
//     other and this is a group that reads together.
//   - Offers and requests for illegal material, which are matched as *intent*
//     rather than as subject matter. "Buy cocaine" is refused; a fun fact about
//     the history of cocaine is not, because a family app that cannot mention a
//     drug, a weapon or a crime is not safer, only useless.
//
// The word list below contains slurs and strong profanity in plain text. It has
// to: this is the file that recognises them so that members never have to read
// them. Anyone maintaining it should expect that, and keep it to terms with no
// innocent reading.

/**
 * Strong profanity and slurs. Mild words a family would shrug at — "damn",
 * "hell", "crap" — are deliberately absent: refusing a recipe review for saying
 * "a hell of a curry" teaches members that the app is broken, not that it is
 * safe. Every entry here is matched on a whole-word boundary, so "class",
 * "grass" and "Scunthorpe" are never caught by the short ones.
 *
 * A few obvious candidates are missing on purpose, because this app is mostly
 * recipes and books and they have innocent readings that would come up: "dick"
 * (Moby-Dick), "cock" and "cracker" (food), "ass" (the animal, in a fun fact),
 * and "queer". The ⋮ Report menu is the right tool for those — a human reading
 * the context, rather than a word list guessing at it.
 */
const PROFANITY = [
  "anal",
  "arsehole",
  "asshole",
  "bastard",
  "bitch",
  "bitches",
  "blowjob",
  "bollocks",
  "boner",
  "chink",
  "clit",
  "coon",
  "cum",
  "cunt",
  "dago",
  "dildo",
  "dyke",
  "fag",
  "faggot",
  "fuck",
  "fucked",
  "fucker",
  "fucking",
  "gook",
  "handjob",
  "jerkoff",
  "jizz",
  "kike",
  "kunt",
  "milf",
  "motherfucker",
  "nigga",
  "nigger",
  "paki",
  "pussy",
  "raghead",
  "randi",
  "retard",
  "retarded",
  "rape",
  "raping",
  "shit",
  "shite",
  "shitty",
  "slut",
  "spastic",
  "spic",
  "tits",
  "titties",
  "tranny",
  "twat",
  "wank",
  "wanker",
  "whore",
  "wog",
];

/**
 * Offering, asking for or arranging something illegal. Phrases rather than
 * single words on purpose — the subject is allowed, the transaction is not — so
 * a remedy may name a plant and a fun fact may name a crime while an advert for
 * either is refused.
 *
 * The child-safety entries are the exception and are matched as bare terms,
 * because there is no reading of them that belongs in this app.
 */
const ILLEGAL_PATTERNS: RegExp[] = [
  // Child sexual abuse material — no context makes these acceptable.
  /\bchild (?:porn|pornography|sex|nudes?)\b/,
  /\bchildporn\b/,
  /\bcsam\b/,
  /\b(?:underage|minor|preteen|jailbait) (?:nudes?|porn|sex|pics?|photos?)\b/,
  /\bloli(?:con)?\s*(?:porn|hentai|nudes?)\b/,

  // Buying or selling controlled drugs.
  /\b(?:buy|sell|selling|order|score|deliver|supply|ship)\b[^.!?\n]{0,30}\b(?:cocaine|heroin|meth|methamphetamine|mdma|lsd|ketamine|fentanyl|crystal meth|weed|hashish|charas|ganja|opium)\b/,
  /\b(?:cocaine|heroin|meth|mdma|lsd|fentanyl|opium|ganja|charas)\b[^.!?\n]{0,30}\b(?:for sale|available|dm me|whatsapp me|contact me|home delivery|discreet)\b/,
  /\bdrug (?:dealer|plug)\b[^.!?\n]{0,30}\b(?:contact|number|dm|whatsapp)\b/,

  // Weapons and explosives, again as a transaction or a how-to.
  /\b(?:buy|sell|selling|order|get)\b[^.!?\n]{0,30}\b(?:unlicensed|illegal|unregistered|untraceable)\b[^.!?\n]{0,20}\b(?:gun|guns|pistol|rifle|firearm|ammo|ammunition)\b/,
  /\bhow to (?:make|build) (?:a )?(?:bomb|pipe bomb|explosive|ied|molotov)\b/,

  // Fraud, stolen credentials and money laundering.
  /\b(?:stolen|cloned|hacked|dumped)\b[^.!?\n]{0,20}\b(?:credit cards?|debit cards?|cvv|bank accounts?|logins?|passwords?)\b/,
  /\b(?:sell|selling|buy|buying)\b[^.!?\n]{0,20}\b(?:cvv|fullz|card dumps?|otp bypass)\b/,
  /\b(?:launder|laundering) (?:money|cash|funds)\b/,
  /\bfake (?:passports?|ids?|aadhaar|pan cards?|driving licen[cs]es?|certificates?)\b[^.!?\n]{0,30}\b(?:for sale|available|order|buy|make|made)\b/,

  // Trafficking and violence for hire.
  /\b(?:hire|hiring|need) (?:a )?(?:hitman|hit man|contract killer)\b/,
  /\b(?:human|organ|child) trafficking\b[^.!?\n]{0,30}\b(?:contact|buy|sell|available)\b/,

  // Piracy, which is the "content you own or have permission to share" line.
  /\b(?:free )?(?:download|watch|stream)\b[^.!?\n]{0,25}\b(?:pirated|cam ?rip|torrent link|full movie free)\b/,
  /\b(?:cracked|nulled|pirated)\b[^.!?\n]{0,20}\b(?:software|licen[cs]e keys?|serial keys?)\b/,
];

/** Leetspeak, so "f4ck" and "sh1t" are read as what they are. */
const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
  "!": "i",
};

/**
 * What the checks actually read: lower case, accents dropped, leetspeak undone,
 * and everything that is not a letter or a digit turned into a space so that
 * whole-word matching works.
 */
function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[013457@$!]/g, (char) => LEET[char] ?? char)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * The other half of the evasion problem: "f u c k" and "s.h.i.t". Only runs of
 * *single* characters are joined up, which is the signature of somebody spacing
 * a word out — so "the rapist" stays two words and is never read as one.
 */
function deseparate(normalized: string) {
  return normalized.replace(/\b(?:[a-z0-9] ){2,}[a-z0-9]\b/g, (run) => run.replace(/ /g, ""));
}

/**
 * A letter held down for emphasis — "fuuuuck", "shiiit" — squeezed back to one.
 * The word list is squeezed the same way before being matched against this, so
 * the two always agree: "bollocks" becomes "bolocks" on both sides rather than
 * dropping out of the list.
 */
function unstretch(value: string) {
  return value.replace(/([a-z])\1+/g, "$1");
}

const PROFANITY_PATTERN = new RegExp(`\\b(?:${PROFANITY.join("|")})\\b`);
const UNSTRETCHED_PATTERN = new RegExp(
  `\\b(?:${[...new Set(PROFANITY.map(unstretch))].join("|")})\\b`,
);

export type SafetyVerdict =
  | { ok: true }
  | { ok: false; kind: "profanity" | "illegal"; message: string };

const PROFANITY_MESSAGE =
  "That reads as offensive language. The Community Guidelines ask everyone to keep this a group " +
  "the whole family can read — please reword it and try again.";

const ILLEGAL_MESSAGE =
  "That looks like it offers or asks for something illegal, which the Community Guidelines do not " +
  "allow here. If you think this is a mistake, reword it and try again.";

/**
 * Whether a member's text may be stored. Answers *why* rather than pointing at
 * the word it matched: naming it would only teach the next person which spelling
 * to try, and the member already knows what they wrote.
 */
export function checkText(...parts: (string | null | undefined)[]): SafetyVerdict {
  const written = parts.filter(Boolean).join("\n").trim();
  if (!written) return { ok: true };

  const normalized = normalize(written);
  if (!normalized) return { ok: true };
  // Three readings of the same sentence: as written, with spaced-out letters put
  // back together, and with held-down letters squeezed. A term has to survive
  // all three to get through.
  const joined = deseparate(normalized);
  const squeezed = unstretch(normalized);

  for (const pattern of ILLEGAL_PATTERNS) {
    if (pattern.test(normalized) || pattern.test(joined)) {
      return { ok: false, kind: "illegal", message: ILLEGAL_MESSAGE };
    }
  }

  if (
    PROFANITY_PATTERN.test(normalized) ||
    PROFANITY_PATTERN.test(joined) ||
    UNSTRETCHED_PATTERN.test(squeezed) ||
    UNSTRETCHED_PATTERN.test(unstretch(joined))
  ) {
    return { ok: false, kind: "profanity", message: PROFANITY_MESSAGE };
  }

  return { ok: true };
}

/**
 * The same check as a route guard: a `Response` when the text may not be stored
 * and null when it may, so a handler reads as one line before it writes
 * anything. 422 rather than 400 — the request was well formed, the content is
 * what was refused.
 */
export function unsafeText(...parts: (string | null | undefined)[]): Response | null {
  const verdict = checkText(...parts);
  if (verdict.ok) return null;
  return Response.json({ error: verdict.message, refused: verdict.kind }, { status: 422 });
}
