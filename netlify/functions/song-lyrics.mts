// netlify/functions/song-lyrics.mts
// The lyrics of one song written out in one script — whichever of them the member who
// shared it asked for — so everybody the recording reached can follow it in whatever
// they read.
//
// Every one is the same words in other letters, which is a character mapping and goes
// to the transliteration tables. Nothing here translates, so nothing here needs a
// model and no deployment is without it.
//
// Any member the song reaches may ask for a script, because asking is reading: it
// changes nothing about the recording, the words, or anybody else's view of them. The
// words themselves stay the author's alone, and there have to be some — this route
// converts what somebody wrote down and never supplies what they did not.
//
// The answer is cached against the words it was made from, so a script somebody
// already asked for costs nothing the second time, and one made from lyrics that have
// since been edited is remade rather than served.
import type { Config, Context } from "@netlify/functions";
import { admittedUser } from "../lib/access.js";
import { detectScript } from "../lib/aksharamukha.js";
import {
  cachedLyricScript,
  isLyricScript,
  lyricScriptAvailableFor,
  lyricScriptResponse,
  lyricsSchemeFrom,
  readIntoOf,
  renderLyricScript,
  sameScriptAs,
  visibleSong,
} from "../lib/lyrics.js";
import { badRequest, idFrom, notFound, unauthorized } from "../lib/items.js";
import { songScripts } from "../lib/settings.js";

export default async (_req: Request, context: Context) => {
  const songId = idFrom({ id: context.params.id });
  if (songId === null) return badRequest("Invalid song id.");

  const { script } = context.params;
  if (!isLyricScript(script)) return badRequest("That is not a script this app writes.");

  const user = await admittedUser();
  if (!user) return unauthorized();

  const song = await visibleSong(songId, user);
  if (!song) return notFound("Song");

  if (!song.lyrics) {
    return badRequest(
      "This song has no words written down yet. Whoever shared it can add them, and then it can be read in any script.",
    );
  }

  const words = { ...song, lyrics: song.lyrics };

  // The words are already in these letters, so there is nothing to convert and the
  // answer is on screen above the buttons.
  if (sameScriptAs(script, words.lyrics)) {
    return badRequest("These words are already written in that script.");
  }

  // Which scripts this song is offered in is the author's decision, so a request for
  // one they did not ask for is refused in their words rather than dressed up as a
  // conversion that failed. Null is a recording shared before the form asked, where
  // every script the words allow still stands.
  const readInto = readIntoOf(words.readInto);
  if (readInto !== null && !readInto.includes(script)) {
    return badRequest("This recording is not offered in that script.");
  }

  // And which scripts the Songs category offers at all is the app admin's, so a script
  // switched off since the author ticked it is refused here as well as being absent
  // from the links a reader is drawn.
  const enabled = await songScripts();
  if (!enabled.includes(script)) {
    return badRequest("That script is not switched on for songs.");
  }

  // Already made from exactly these words: the cache is the answer, and nothing is
  // converted a second time.
  const cached = await cachedLyricScript(words, script);
  if (cached) return Response.json({ lyricScript: lyricScriptResponse(cached) });

  // A mapping has to know what it is mapping from. Words in a script say so by being
  // in one; words in English letters do not, and the author is the only person who
  // can, so the refusal says so plainly rather than hiding behind "not available".
  if (
    !lyricScriptAvailableFor(
      script,
      words.lyrics,
      lyricsSchemeFrom(words.lyricsScheme),
      readInto,
      enabled,
    )
  ) {
    return badRequest(
      needsScheme(words.lyrics, words.lyricsScheme)
        ? "These words are typed in English letters, and nothing has said which convention they follow — so they cannot be converted exactly. Whoever shared the recording can pick a convention under Edit."
        : "These words cannot be written in that script.",
    );
  }

  const rendered = await renderLyricScript(words, script);
  if (!rendered) {
    return Response.json(
      { error: "Those lyrics could not be written in that script just now. Try again in a moment." },
      { status: 502 },
    );
  }

  return Response.json({ lyricScript: lyricScriptResponse(rendered) }, { status: 201 });
};

/**
 * Whether the only thing standing between these words and an exact conversion is
 * somebody saying which roman convention they are in. That is worth saying out loud,
 * because it is the one refusal here a member can actually do something about.
 */
function needsScheme(lyrics: string, scheme: string | null) {
  return detectScript(lyrics) === null && lyricsSchemeFrom(scheme) === null;
}

export const config: Config = {
  path: "/api/songs/:id/lyrics/:script",
  method: ["POST"],
};
