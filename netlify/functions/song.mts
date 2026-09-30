// netlify/functions/song.mts
import type { Config, Context } from "@netlify/functions";
import { admittedAccess } from "../lib/access.js";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { savedItems, songs } from "../../db/schema.js";
import { audioStore, stitchParts, uploadFrom } from "../lib/audio-uploads.js";
import {
  fieldsForBuiltIn,
  filedCategoryIdFrom,
  shelfChoiceFrom,
} from "../lib/categories.js";
import {
  applyItemCircles,
  circleIdsFrom,
  clearItemCircles,
  filingsOf,
} from "../lib/circles.js";
import { clearDiscussions, discussionsOf } from "../lib/discussions.js";
import {
  answersFrom,
  answerTexts,
  applyItemFieldValues,
  clearItemFieldValues,
  missingRequired,
  tooMuchUploaded,
} from "../lib/fields.js";
import { folderIdFrom } from "../lib/folders.js";
import {
  badRequest,
  idFrom,
  jsonBody,
  notFound,
  notYours,
  optionalText,
  text,
  unauthorized,
  visibilityOf,
} from "../lib/items.js";
import {
  clearLyricScripts,
  lyricReadingOf,
  lyricsFrom,
  lyricsLanguageFrom,
  lyricsSchemeFrom,
  readIntoFrom,
  warmLyricScripts,
} from "../lib/lyrics.js";
import { applyItemPhotos, clearItemPhotos, photoKeysFrom } from "../lib/photos.js";
import { mayManageItem } from "../lib/moderation.js";
import { unsafeText } from "../lib/safety.js";
import { songScripts } from "../lib/settings.js";

export default async (req: Request, context: Context) => {
  const id = idFrom(context.params);
  if (id === null) return badRequest("Invalid song id.");

  const access = await admittedAccess();
  if (!access) return unauthorized();
  const user = access.user;

  const [existing] = await db.select().from(songs).where(eq(songs.id, id));
  if (!existing) return notFound("Song");
  // A recording is its author's, and it is also something said in somebody's circle.
  // So the author may always correct or withdraw it, and so may whoever keeps a
  // circle it was shared into — its owner, an admin they chose, or the app admin
  // stepping in. Everybody else is told it is not theirs.
  if (!(await mayManageItem("song", id, existing.memberId, access))) {
    return notYours("songs");
  }

  if (req.method === "PATCH") {
    const body = await jsonBody(req);
    if (!body) return badRequest("Expected a JSON body.");

    const songName = text(body.songName ?? existing.songName);
    if (!songName) return badRequest("A song needs a title.");

    // The words are the author's own to write and to correct. An edit that says
    // nothing about them leaves them alone; one that names them replaces them, and
    // the renderings made from the old words stop matching and are quietly dropped
    // by `lyricScriptsOf` rather than shown as the song's lyrics.
    const lyrics = "lyrics" in body ? lyricsFrom(body.lyrics) : existing.lyrics;
    const lyricsLanguage = !lyrics
      ? null
      : "lyricsLanguage" in body
        ? lyricsLanguageFrom(body.lyricsLanguage)
        : existing.lyricsLanguage;
    // Which roman convention the words follow, when they are in Latin letters. Editing
    // is where this most often arrives: a recording shared before the form asked can be
    // told afterwards, and saying so is what turns a model's guess at its Kannada into
    // an exact conversion.
    const lyricsScheme = !lyrics
      ? null
      : "lyricsScheme" in body
        ? lyricsSchemeFrom(body.lyricsScheme)
        : existing.lyricsScheme;
    // Which scripts the group may read the words in. Clearing the lyrics clears the
    // choice with them; an edit that says nothing about it leaves the author's list
    // exactly as it was.
    const readInto = !lyrics ? "" : (readIntoFrom(body) ?? existing.readInto);

    const composer = "composer" in body ? optionalText(body.composer) : existing.composer;
    const raga = "raga" in body ? optionalText(body.raga) : existing.raga;

    // What the circles this recording goes to ask about a song of their own. An
    // edit that says nothing about them leaves every answer as it was; one that
    // names them replaces the set, which is how an answer is taken back out.
    const wanted = circleIdsFrom(body);
    const fields = await fieldsForBuiltIn(
      "song",
      wanted ?? (await filingsOf("song", id, user)).map((filing) => filing.circleId),
    );
    const answers = answersFrom(body);
    if (answers) {
      const missing = missingRequired(fields, answers);
      if (missing) return badRequest(`${missing.label} is needed for this recording.`);
      // Every upload on the share added up, which no per-field ceiling can see.
      const tooMuch = tooMuchUploaded(fields, answers);
      if (tooMuch) return tooMuch;
    }

    const refused = unsafeText(
      songName,
      composer,
      raga,
      lyrics,
      ...(answers ? answerTexts(fields, answers) : []),
    );
    if (refused) return refused;

    // A new recording for a song already shared: sung again, or the right file this
    // time. The parts are already up — the browser PUT them exactly as it does for a
    // new share — so all that is left is to stitch them and swap the key.
    //
    // This one part of an edit is the author's alone. A moderator may correct or
    // withdraw what a circle is showing, which is what the check above allows, but
    // putting different audio under somebody else's name is not moderation; the
    // narrower refusal here says so rather than the blanket "not yours".
    const swapping = body.audio !== undefined && body.audio !== null;
    const replacement = swapping ? uploadFrom(body.audio) : null;
    if (swapping && !replacement) {
      return badRequest("That upload has an unexpected number of parts.");
    }
    if (replacement && existing.memberId !== user.id) {
      return Response.json(
        { error: "Only the member who shared a recording can replace it." },
        { status: 403 },
      );
    }

    let blobKey = existing.blobKey;
    let durationSeconds = existing.durationSeconds;
    if (replacement) {
      const stitched = await stitchParts(
        user.id,
        replacement.uploadId,
        replacement.parts,
        replacement.contentType,
      );
      if (stitched.error) return stitched.error;
      blobKey = stitched.blobKey;
      durationSeconds = replacement.durationSeconds;
    }

    const [song] = await db
      .update(songs)
      .set({
        songName,
        composer,
        raga,
        lyrics,
        lyricsLanguage,
        lyricsScheme,
        readInto,
        blobKey,
        durationSeconds,
        visibility: "visibility" in body ? visibilityOf(body.visibility) : existing.visibility,
      })
      .where(eq(songs.id, id))
      .returning();

    // The row now points at the new bytes, so the old ones are nobody's. Dropped
    // after the update rather than before it, so a failed write never leaves the
    // song pointing at a blob that has been swept up.
    if (replacement && existing.blobKey && existing.blobKey !== blobKey) {
      await audioStore().delete(existing.blobKey);
    }

    const circleIds = await applyItemCircles(
      "song",
      id,
      circleIdsFrom(body),
      song.visibility,
      user,
      shelfChoiceFrom(body),
      filedCategoryIdFrom(body),
      folderIdFrom(body),
    );

    // An edit that says nothing about photos leaves the ones already there.
    const photos = await applyItemPhotos("song", id, photoKeysFrom(body), user);
    const fieldValues = await applyItemFieldValues("song", id, fields, answers, user.id);

    // The words may have changed, or a convention may have just been declared for them.
    // Either way the exact conversions are remade now — three table lookups — so the
    // reader who opens the card next finds them already there.
    const enabled = await songScripts();
    await warmLyricScripts(song, enabled);

    return Response.json({
      song: {
        ...song,
        circleIds,
        filings: await filingsOf("song", id, user),
        photos,
        fieldValues,
        // The client replaces its copy of the row wholesale, so what an edit does not
        // touch travels back with it: the scripts still matching the words, and the
        // discussion about the raga, which is nobody's edit to make.
        ...(await lyricReadingOf(song, enabled)),
        discussions: await discussionsOf("song", id, user),
      },
    });
  }

  // Deleting removes the recording for everyone, so the audio blob, any library
  // entries pointing at it, and its circle links go too.
  await db.delete(songs).where(eq(songs.id, id));
  await db.delete(savedItems).where(and(eq(savedItems.itemType, "song"), eq(savedItems.itemId, id)));
  await clearItemCircles("song", id);
  await clearItemPhotos("song", id);
  // The words in other scripts were derived from this row, and the discussion about
  // its raga has nothing left to hang on, so both go with it.
  await clearLyricScripts(id);
  await clearDiscussions("song", id);
  await clearItemFieldValues("song", id);
  // A song may be words alone, in which case there is no blob to sweep up.
  if (existing.blobKey) await audioStore().delete(existing.blobKey);

  return Response.json({ ok: true });
};

export const config: Config = {
  path: "/api/songs/:id",
  method: ["PATCH", "DELETE"],
};
