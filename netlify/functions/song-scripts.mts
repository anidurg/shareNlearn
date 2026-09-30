// netlify/functions/song-scripts.mts
// Which scripts the Songs category offers, read by everybody and written by the app
// admin.
//
// Two audiences and two rules, which is why the methods are gated differently. Every
// member reads it, because the form that shares a recording ticks the enabled scripts
// for the author and the panel under a song draws its links from the same list — a
// setting nobody can read is a setting nothing can honour. Only the app admin writes
// it, because it is a decision for the whole group rather than for one circle or one
// song.
//
// The answer carries the whole catalogue beside the enabled list, so the admin panel
// has something to tick from without a second request and without the browser keeping
// its own copy of a list the converter owns. Add a script to `LYRIC_SCRIPTS` and it is
// on the panel the same day, which is the entire reason the enabled list is a row.
import type { Config } from "@netlify/functions";
import { admittedAccess, forbidden } from "../lib/access.js";
import { badRequest, jsonBody, unauthorized } from "../lib/items.js";
import { LYRIC_SCRIPTS } from "../lib/lyrics.js";
import { DEFAULT_SONG_SCRIPTS, setSongScripts, songScripts } from "../lib/settings.js";

/** The catalogue, in the shape the picker already reads. */
const catalogue = LYRIC_SCRIPTS.map((entry) => ({
  id: entry.id,
  label: entry.label,
  native: entry.native,
}));

export default async (req: Request) => {
  const access = await admittedAccess();
  if (!access) return unauthorized();

  if (req.method === "GET") {
    return Response.json({
      scripts: await songScripts(),
      catalogue,
      defaults: DEFAULT_SONG_SCRIPTS,
      canEdit: access.isAppAdmin,
    });
  }

  if (!access.isAppAdmin) {
    return forbidden("Which scripts songs are offered in is the app admin's to set.");
  }

  const body = await jsonBody(req);
  if (!body) return badRequest("Expected a JSON body.");
  if (!("scripts" in body)) return badRequest("Say which scripts.");

  // What comes back is what was kept rather than what was sent: an id the converter
  // does not know is dropped on the way in, and the admin should see that rather than
  // be shown their own submission and left to discover it later.
  const scripts = await setSongScripts(body.scripts, access.user.id);

  return Response.json({ scripts, catalogue, defaults: DEFAULT_SONG_SCRIPTS, canEdit: true });
};

export const config: Config = {
  path: "/api/settings/song-scripts",
  method: ["GET", "PUT"],
};
