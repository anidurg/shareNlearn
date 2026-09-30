// netlify/functions/transliterate.mts
// Type it in English letters, get it in Kannada — the authoring side of script
// conversion, and the reason the whole thing was asked for.
//
// A member who knows a stotra by heart can say it in a second and needs twenty minutes
// and a phone keyboard they cannot read to write it down. So the forms let them type
// `vakratunDa mahaakaaya` and this route hands back ವಕ್ರತುಂಡ ಮಹಾಕಾಯ, which they then
// edit, correct and share as their own words. Nothing is stored here: what comes back
// goes into the textarea the member is already looking at, and the post or the
// recording is saved by the route that always saved it.
//
// Which is why this is the one AI-adjacent-looking route with no model in it and
// nothing to cache. It is a lookup table with an HTTP hop in front, so it is fast
// enough to sit under a button, it costs nothing per call, and it works on a deployment
// with no AI Gateway configured at all.
//
// Being logged in is the whole of the gate. There is no item, no circle and no author
// involved — a member is converting text they are in the middle of typing — so there is
// nothing to own and nothing to be visible in. `admittedUser()` rather than `getUser()`
// all the same, because every route in this app answers the front door the same way.
import type { Config } from "@netlify/functions";
import { admittedUser } from "../lib/access.js";
import {
  MAX_TRANSLITERATION_SOURCE,
  type TransliterationSource,
  type TransliterationTarget,
  isIndicScript,
  isRomanScheme,
  transliterate,
  transliterateDetected,
} from "../lib/aksharamukha.js";
import { badRequest, jsonBody, text, unauthorized } from "../lib/items.js";

export default async (req: Request) => {
  const user = await admittedUser();
  if (!user) return unauthorized();

  const body = await jsonBody(req);
  if (!body) return badRequest("Invalid request body.");

  const { from, to } = body;
  // A source may be either a way of typing Latin letters or a script already, since the
  // same button is how somebody moves a verse they pasted in from Devanagari to Kannada.
  // It may also be left out, which is not laziness but the honest answer where nobody
  // was asked: text already in an Indic script says what it is, so the letters are
  // counted and the answer read off them. Latin letters say nothing, which is why the
  // forms ask — and why an unsaid source over Latin text is refused here rather than
  // guessed at.
  const said = isRomanScheme(from) || isIndicScript(from);
  if (from !== undefined && from !== null && from !== "" && from !== "auto" && !said) {
    return badRequest("That is not a way of writing this app can read.");
  }
  // A target may be a roman convention as well as a script, because the same table run
  // the other way is what somebody handed a verse in letters they cannot read wants:
  // the sounds of it in the alphabet they can.
  if (!isIndicScript(to) && !isRomanScheme(to)) {
    return badRequest("That is not a script this app writes.");
  }

  const source = text(body.text).slice(0, MAX_TRANSLITERATION_SOURCE);
  if (source.length === 0) return badRequest("There is nothing to convert yet.");

  const converted = said
    ? await transliterate({ source, from: from as TransliterationSource, to })
    : await transliterateDetected(source, to as TransliterationTarget);
  // Null is "not this way, then" rather than a fault: the service may be unreachable, or
  // what came back was the text that went out. The member keeps what they typed, and the
  // message says so rather than blaming them for it.
  if (!converted) {
    return Response.json(
      {
        error:
          "That could not be converted just now. What you typed is still here — try again in a moment.",
      },
      { status: 502 },
    );
  }

  return Response.json({ text: converted });
};

export const config: Config = {
  path: "/api/transliterate",
  method: ["POST"],
};
