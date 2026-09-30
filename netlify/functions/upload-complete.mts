// netlify/functions/upload-complete.mts
import type { Config, Context } from "@netlify/functions";
import { admittedUser, sharingGate } from "../lib/access.js";
import { db } from "../../db/index.js";
import { songs } from "../../db/schema.js";
import {
  fieldsForBuiltIn,
  filedCategoryIdFrom,
  shelfChoiceFrom,
} from "../lib/categories.js";
import { announceShare, circleIdsFrom, filingsOf, setItemCircles } from "../lib/circles.js";
import {
  MAX_PARTS,
  durationFrom,
  isValidUploadId,
  normalizeContentType,
  stitchParts,
} from "../lib/audio-uploads.js";
import { folderIdFrom } from "../lib/folders.js";
import { photoKeysFrom, setItemPhotos } from "../lib/photos.js";
import {
  answersFrom,
  answerTexts,
  missingRequired,
  tooMuchUploaded,
  setItemFieldValues,
} from "../lib/fields.js";
import {
  lyricReadingOf,
  lyricsFrom,
  lyricsLanguageFrom,
  lyricsSchemeFrom,
  readIntoFrom,
  warmLyricScripts,
} from "../lib/lyrics.js";
import { unsafeText } from "../lib/safety.js";
import { songScripts } from "../lib/settings.js";

export default async (req: Request, context: Context) => {
  const user = await admittedUser();
  if (!user) {
    return Response.json({ error: "You must be logged in to upload a song." }, { status: 401 });
  }
  // The parts are already uploaded, but the song only becomes a share here, and a
  // share needs a circle to go to.
  const gate = await sharingGate(user);
  if (gate) return gate;

  const { uploadId } = context.params;
  if (!isValidUploadId(uploadId)) {
    return Response.json({ error: "Invalid upload id." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const songName = String(body.songName ?? "").trim();
  const composer = String(body.composer ?? "").trim() || null;
  const raga = String(body.raga ?? "").trim() || null;
  // The words, if the member typed any. Plenty of recordings are humming, so this is
  // optional — and it is their own text, never anything the app went looking for.
  const lyrics = lyricsFrom(body.lyrics);
  const lyricsLanguage = lyrics ? lyricsLanguageFrom(body.lyricsLanguage) : null;
  // Which convention the words follow, when they are typed in Latin letters. Without it
  // romanised lyrics cannot be converted exactly at all, so the form asks and this
  // remembers the answer.
  const lyricsScheme = lyrics ? lyricsSchemeFrom(body.lyricsScheme) : null;
  // Which scripts the group should be able to read the words in. "" is a member who
  // was asked and said no — a different answer from the null on every recording shared
  // before the form asked, which keeps being offered whatever its words allow.
  const readInto = lyrics ? (readIntoFrom(body) ?? "") : "";
  const partCount = Number(body.parts);
  const contentType = normalizeContentType(body.contentType);
  const visibility = body.visibility === "private" ? "private" : "shared";
  const durationSeconds = durationFrom(body.durationSeconds);

  if (!songName) {
    return Response.json({ error: "A recording needs a title." }, { status: 400 });
  }
  if (!Number.isInteger(partCount) || partCount < 1 || partCount > MAX_PARTS) {
    return Response.json({ error: "That upload has an unexpected number of parts." }, { status: 400 });
  }

  // Whatever the circles it is going to ask about a recording of their own — the
  // deity, the tala, who taught it. Checked before the parts are stitched, for the
  // same reason the words are: a refused recording should never become a blob.
  const wanted = circleIdsFrom(body) ?? [];
  const fields = visibility === "shared" ? await fieldsForBuiltIn("song", wanted) : [];
  const answers = answersFrom(body) ?? new Map<number, string>();
  const missing = missingRequired(fields, answers);
  if (missing) return Response.json({ error: `${missing.label} is needed.` }, { status: 400 });
  // Every upload on the share added up, which no per-field ceiling can see.
  const tooMuch = tooMuchUploaded(fields, answers);
  if (tooMuch) return tooMuch;

  // Before the parts are stitched, so a refused recording never becomes a blob.
  const refused = unsafeText(songName, composer, raga, lyrics, ...answerTexts(fields, answers));
  if (refused) return refused;

  const memberName = user.name || user.email || "Unknown member";
  const stitched = await stitchParts(user.id, uploadId, partCount, contentType);
  if (stitched.error) return stitched.error;
  const blobKey = stitched.blobKey;

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
      blobKey,
      durationSeconds,
      visibility,
    })
    .returning();

  // A private recording reaches nobody, so it keeps no circle links.
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

  // A recording may carry photos too — sheet music, the group that sang it.
  const photos = await setItemPhotos("song", song.id, photoKeysFrom(body) ?? [], user);

  // The circles' own questions. An empty answer writes no row, so a recording that
  // skipped an optional one simply has nothing to show for it.
  const fieldValues = await setItemFieldValues("song", song.id, fields, answers, user.id);

  // Every script on offer is a table lookup, so the ones the author asked for are all
  // written now rather than on first tap: the words arrive readable in them at once.
  const enabled = await songScripts();
  await warmLyricScripts(song, enabled);

  if (visibility === "shared") {
    await announceShare({
      itemType: "song",
      message: `${memberName} shared "${songName}"`,
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
        // The exact scripts were just written, so they travel with the row rather than
        // waiting for a reload. Nobody has asked about its raga yet.
        ...(await lyricReadingOf(song, enabled)),
        discussions: [],
      },
    },
    { status: 201 },
  );
};

export const config: Config = {
  path: "/api/uploads/:uploadId/complete",
  method: ["POST"],
};
