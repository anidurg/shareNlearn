// netlify/functions/songs.mts
import type { Config } from "@netlify/functions";
import { admittedUser, sharingGate } from "../lib/access.js";
import { desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { songs } from "../../db/schema.js";
import {
  fieldsForBuiltIn,
  filedCategoryIdFrom,
  shelfChoiceFrom,
} from "../lib/categories.js";
import {
  announceShare,
  circleIdsFrom,
  filingsOf,
  setItemCircles,
  withCircleIds,
} from "../lib/circles.js";
import {
  answersFrom,
  answerTexts,
  missingRequired,
  tooMuchUploaded,
  setItemFieldValues,
  withFieldValues,
} from "../lib/fields.js";
import { folderIdFrom } from "../lib/folders.js";
import {
  badRequest,
  jsonBody,
  memberNameOf,
  optionalText,
  text,
  unauthorized,
  visibilityOf,
  visibleTo,
} from "../lib/items.js";
import {
  lyricReadingOf,
  lyricsFrom,
  lyricsLanguageFrom,
  lyricsSchemeFrom,
  readIntoFrom,
  warmLyricScripts,
  withLyricScripts,
} from "../lib/lyrics.js";
import { photoKeysFrom, setItemPhotos, withPhotos } from "../lib/photos.js";
import { unsafeText } from "../lib/safety.js";
import { withDiscussions } from "../lib/discussions.js";
import { songScripts } from "../lib/settings.js";

/**
 * The recordings, and the one way of sharing one that has no audio in it.
 *
 * A song arrives here two ways. A recording — sung into the browser or picked off
 * the phone — goes up in parts and is finished by `upload-complete.mts`, because
 * the bytes have to be stitched before the row can name them. A song that is words
 * alone is a plain `POST` with nothing to stitch, and it is a whole share rather
 * than half of one: somebody who knows a stotra and cannot sing it today still has
 * the words, and every script derived from them, to give the group.
 */
export default async (req: Request) => {
  const user = await admittedUser();

  if (req.method === "GET") {
    const allSongs = await db
      .select()
      .from(songs)
      .where(visibleTo(songs, user, "song"))
      .orderBy(desc(songs.createdAt));

    return Response.json({
      songs: await withDiscussions(
        "song",
        await withFieldValues(
          "song",
          await withLyricScripts(
            await withPhotos("song", await withCircleIds("song", allSongs, user)),
            await songScripts(),
          ),
        ),
        user,
      ),
    });
  }

  if (!user) return unauthorized();
  const gate = await sharingGate(user);
  if (gate) return gate;

  const body = await jsonBody(req);
  if (!body) return badRequest("Expected a JSON body.");

  const songName = text(body.songName);
  if (!songName) return badRequest("A song needs a title.");

  // The whole of this share. A recording may be humming with no words; a song with
  // no recording is only a song at all because of them, so here they are required.
  const lyrics = lyricsFrom(body.lyrics);
  if (!lyrics) {
    return badRequest("Add the words, or record or upload the song itself.");
  }
  const lyricsLanguage = lyricsLanguageFrom(body.lyricsLanguage);
  const lyricsScheme = lyricsSchemeFrom(body.lyricsScheme);
  // Which scripts the group should be able to read the words in. "" is a member who
  // was asked and said no, which is a different answer from the null on every song
  // shared before the form asked.
  const readInto = readIntoFrom(body) ?? "";

  const composer = optionalText(body.composer);
  const raga = optionalText(body.raga);
  const visibility = visibilityOf(body.visibility);

  // Whatever the circles it is going to ask about a song of their own.
  const wanted = circleIdsFrom(body) ?? [];
  const fields = visibility === "shared" ? await fieldsForBuiltIn("song", wanted) : [];
  const answers = answersFrom(body) ?? new Map<number, string>();
  const missing = missingRequired(fields, answers);
  if (missing) return badRequest(`${missing.label} is needed.`);
  // Every upload on the share added up, which no per-field ceiling can see.
  const tooMuch = tooMuchUploaded(fields, answers);
  if (tooMuch) return tooMuch;

  const refused = unsafeText(songName, composer, raga, lyrics, ...answerTexts(fields, answers));
  if (refused) return refused;

  const memberName = memberNameOf(user);

  const [song] = await db
    .insert(songs)
    .values({
      memberId: user.id,
      memberName,
      songName,
      composer,
      raga,
      lyrics,
      lyricsLanguage,
      lyricsScheme,
      readInto,
      // No recording, which is what `songs.blob_key` being nullable is for.
      blobKey: null,
      durationSeconds: null,
      visibility,
    })
    .returning();

  const chosen =
    visibility === "shared"
      ? await setItemCircles(
          "song",
          song.id,
          wanted,
          user,
          shelfChoiceFrom(body),
          filedCategoryIdFrom(body),
          folderIdFrom(body),
        )
      : [];

  const photos = await setItemPhotos("song", song.id, photoKeysFrom(body) ?? [], user);
  const fieldValues = await setItemFieldValues("song", song.id, fields, answers, user.id);

  // Every script is a table lookup, so the ones the author asked for are written
  // now: the words arrive readable in them at once rather than on second reading.
  const enabled = await songScripts();
  await warmLyricScripts(song, enabled);

  if (chosen.length > 0) {
    await announceShare({
      itemType: "song",
      message: `${memberName} shared the words of "${songName}"`,
      circles: chosen,
    });
  }

  return Response.json(
    {
      song: {
        ...song,
        circleIds: chosen.map((circle) => circle.id),
        filings: await filingsOf("song", song.id, user),
        photos,
        fieldValues,
        ...(await lyricReadingOf(song, enabled)),
        discussions: [],
      },
    },
    { status: 201 },
  );
};

export const config: Config = {
  path: "/api/songs",
  method: ["GET", "POST"],
};
