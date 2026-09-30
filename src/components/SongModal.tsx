import { useEffect, useRef, useState } from "react";
import {
  AUDIO_ACCEPT,
  audioUrl,
  createSong,
  formatBytes,
  formatDuration,
  MAX_UPLOAD_BYTES,
  notAudioReason,
  photoKeys,
  uploadSongInParts,
  uploadSongParts,
  type Circle,
  type CircleCategory,
  type ItemPhoto,
  type LyricScript,
  type RomanScheme,
  type ShelfChoice,
  type Song,
  type SongAudio,
  type Visibility,
} from "../api";
import { currentFiledCategoryId, currentShelfChoice } from "../categories";
import { currentFolderPath, type ShareTarget } from "../folders";
import type { SharePrefill } from "../incoming-share";
import type { ShareAndLearn } from "../store";
import {
  AudioRecorder,
  canRecordAudio,
  readAudioDuration,
  useAudioRecorder,
} from "./AudioRecorder";
import { initialAnswers, SongFields } from "./CategoryFields";
import { SongConversation } from "./Discussions";
import { ErrorLine, Modal, PhotoField, SharedInNote, SharingIntoNote, ShelfField, VisibilityPicker } from "./shared";
import { LyricsField } from "./SongLyrics";

/**
 * The one way a song is shared.
 *
 * There used to be two buttons on every song surface — "Record one" and "Upload a
 * file" — which asked the member to decide how before they had decided what. So
 * there is one button now, and the choice of how is a field near the top of the form
 * it opens: sing it here, or send a recording you already have.
 *
 * It is only those two, because the third answer — the words on their own — was
 * never really a third way of sharing. Every field on this form is on it whichever
 * radio is ticked, so a member who types the words and records nothing has already
 * shared a song, and asking them to declare that first was a question with no
 * purpose. It is why `songs.blob_key` is nullable: a stotra somebody knows by heart
 * is a whole share — the words, and every script the group can read them in — and
 * holding it back for want of a microphone was losing the thing rather than the
 * recording of it.
 *
 * Editing has a third answer, and it is the one it opens on: **keep** what is
 * already there. The same two ways in are on the edit form too — a take that came
 * out badly is sung again, and a file that turned out to be the wrong one is picked
 * again — so the recording stops being the one part of a song that could only be
 * fixed by deleting it and sharing it afresh.
 */
type Way = "keep" | "record" | "upload";

/**
 * What the one button behind it actually offers, said out loud wherever songs are
 * listed. Two buttons used to say it by existing; one button has to say it in words,
 * and the quietest way in — the words on their own — was never on either of them.
 */
export const ADD_A_SONG_NOTE =
  "Tap “+ Add a Song” to record one now, upload a recording you already have, or simply add the words.";

export function SongModal({
  song,
  store,
  userId = null,
  circles = [],
  categories = [],
  presetCircleIds = [],
  folder = null,
  prefill,
  onClose,
  onSaved,
}: {
  /** Editing a song already shared; absent when sharing a new one. */
  song?: Song;
  store: ShareAndLearn;
  /** Who is looking, so the discussion on a song being edited knows what is theirs. */
  userId?: string | null;
  /** The circles the member belongs to, so a song can be shared into them. */
  circles?: Circle[];
  /** Their circles' categories, so the form can offer the right shelves and fields. */
  categories?: CircleCategory[];
  /** Ticked to begin with, when the form was opened from inside a circle. */
  presetCircleIds?: number[];
  /**
   * The folder this form was opened from, when the member walked into one and
   * tapped "+ Share an item". They have already said where the share goes, so
   * the folder is stated rather than asked for a second time.
   */
  folder?: ShareTarget | null;
  /**
   * Text another app handed over through the device's share sheet, when this form
   * was opened from the incoming-share screen. It seeds the fields it has
   * something to say about and nothing else, and only on a new item — an edit
   * opens on what the member already wrote, which no share sheet may overwrite.
   */
  prefill?: SharePrefill;
  onClose: () => void;
  onSaved: (song: Song) => void;
}) {
  const editing = Boolean(song);
  const canRecord = canRecordAudio;
  // Editing opens on "keep": the recording that is there is almost always the one
  // the member meant, and the two ways of replacing it are beside it for the take
  // that came out badly. On a new share the default is to sing it, unless this
  // browser cannot — in which case starting on a disabled choice would only look
  // broken.
  const [way, setWay] = useState<Way>(editing ? "keep" : canRecord ? "record" : "upload");
  const [songName, setSongName] = useState(song?.songName ?? prefill?.title ?? "");
  const [composer, setComposer] = useState(song?.composer ?? "");
  const [raga, setRaga] = useState(song?.raga ?? "");
  const [lyrics, setLyrics] = useState(song?.lyrics ?? "");
  const [lyricsLanguage, setLyricsLanguage] = useState(song?.lyricsLanguage ?? "");
  /**
   * Which roman convention the words follow, when they are typed in Latin letters.
   *
   * Empty here on purpose, new song or old: the field itself proposes one the moment
   * there are Latin letters to look at, read off whether they carry diacritics, which is
   * a better answer than any this can give before a word has been typed. Editing a song
   * whose author already said keeps what they said, including their having declined.
   */
  const [lyricsScheme, setLyricsScheme] = useState<RomanScheme | "">(song?.lyricsScheme ?? "");
  /**
   * The scripts the member wants their words readable in. A new song starts on the ones
   * the app admin switched on for songs, so the described flow — type the words, save,
   * read them in Kannada — needs no ticking at all; editing a song shared before the
   * form asked falls back to whatever it is currently offered in, so saving an old song
   * does not quietly take its buttons away.
   */
  const [readInto, setReadInto] = useState<LyricScript[]>(
    song?.readInto ?? song?.lyricScriptsAvailable ?? store.songScripts?.scripts ?? [],
  );
  /** Whether the member has answered the script question themselves. */
  const seeded = useRef(Boolean(song) || (store.songScripts?.scripts.length ?? 0) > 0);
  const [visibility, setVisibility] = useState<Visibility>(song?.visibility ?? "shared");
  const [circleIds, setCircleIds] = useState<number[]>(song?.circleIds ?? presetCircleIds);
  const [shelf, setShelf] = useState<ShelfChoice>(currentShelfChoice(categories, song));
  const [filedCategoryId, setFiledCategoryId] = useState<number | null>(
    currentFiledCategoryId(song),
  );

  // Where the share already sits, when it is being edited rather than shared: a
  // folder is the filing, so the form states it instead of offering the old shelf
  // picker and inviting a second answer to a question already answered.
  const filedIn = currentFolderPath(song);
  // Whether the form asks about filing at all. Where it does not, the shelf keys
  // are left out of the payload rather than sent as nulls this form never asked
  // for, which the server reads as "leave whatever is stored alone" — so a legacy
  // subcategory survives an edit that never mentioned it.
  const asksShelf = !folder && filedIn === null;
  const [answers, setAnswers] = useState<Record<number, string>>(() => initialAnswers(song));
  // A photo shared in from the device's share sheet is already uploaded by the
  // time this form opens, so it seeds the field exactly as a picked one does.
  const [photos, setPhotos] = useState<ItemPhoto[]>(song?.photos ?? prefill?.photos ?? []);
  /**
   * The question the member wants asked about the song. A discussion is somebody
   * else's contribution and can only hang on a song that exists, so on a new share
   * this is held here and started the moment the song is saved; on one already
   * shared, the real conversation is rendered instead.
   */
  const [prompt, setPrompt] = useState("");
  /**
   * The song went up and the question did not. It is the one half-outcome this form
   * has: the share is real and already on screen behind the modal, so there is
   * nothing to retry and nothing to undo, and the only thing worth doing with the
   * words the member typed is leaving them where they can be read and copied. The
   * failure used to be swallowed whole — an empty `catch` with a comment saying the
   * question could be asked again from the card — which meant a member who typed one
   * watched the modal close and never learned it had gone nowhere.
   */
  const [threadFailed, setThreadFailed] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  /**
   * Whether the picker has been widened to show every file on the device.
   *
   * The default is the audio filter, which is right for almost everybody. But the
   * filter is a UTType list on iOS, and a file the system could not identify — one
   * with no extension, or forwarded through an app that stripped it — conforms to
   * nothing and is greyed out however many extensions are named. That member is
   * looking straight at their song and cannot tap it, and the only thing that helps
   * is to stop filtering. So it is offered as a way out rather than as the default:
   * the picker fills up with documents and photos, and `notAudioReason()` catches
   * the obvious mistakes that follow.
   */
  const [showEveryFile, setShowEveryFile] = useState(false);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // The microphone, the clock and the take, from the one place in the app that knows
  // how to work them — a category's audio field asks the same hook for the same
  // thing rather than keeping a second `MediaRecorder` of its own.
  const recorder = useAudioRecorder({
    onError: setError,
    alternative: "choose “Upload a recording” instead",
  });
  const recording = recorder.recording;

  // The configured scripts landing after the form opened, which is the one case the
  // initial value above cannot cover. It happens once and only while the member has
  // not answered the question themselves, so it can never overwrite a choice.
  const configured = store.songScripts?.scripts;
  useEffect(() => {
    if (seeded.current || !configured || configured.length === 0) return;
    seeded.current = true;
    setReadInto(configured);
  }, [configured]);

  function handleFile(next: File | null) {
    setFile(next);
    if (!next) {
      setError(null);
      return;
    }
    if (next.size > MAX_UPLOAD_BYTES) {
      setError(
        `${next.name} is ${formatBytes(next.size)} — recordings need to be under ${formatBytes(MAX_UPLOAD_BYTES)}.`,
      );
      return;
    }
    if (next.size === 0) {
      setError(`${next.name} is empty. It may still be downloading from iCloud or Drive.`);
      return;
    }
    // Only ever a refusal for something that is plainly not a recording, which in
    // practice means a mis-tap once the picker has been widened. Anything the device
    // could not identify is allowed through: it is far likelier to be the song the
    // member came here for than a mistake.
    setError(notAudioReason(next));
  }

  /** Everything the two save paths have in common, which is everything but the audio. */
  function shared() {
    return {
      songName: songName.trim(),
      composer: composer.trim(),
      raga: raga.trim(),
      lyrics: lyrics.trim(),
      lyricsLanguage: lyricsLanguage.trim(),
      // The form's "I would rather not say" is an empty string; the row holds null.
      lyricsScheme: lyricsScheme || null,
      readInto,
      visibility,
      circleIds,
      ...(asksShelf
        ? { subcategoryId: shelf.id, subcategoryName: shelf.name, filedCategoryId }
        : {}),
      // A song shared from inside a folder goes into it; the key is left out
      // entirely otherwise, which the server reads as leaving the folder alone.
      ...(folder && folder.id !== null ? { folderId: folder.id } : {}),
      photos: photoKeys(photos),
      fieldValues: answers,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!songName.trim()) {
      setError("Give the song a title.");
      return;
    }
    // The recording is optional, so what decides the path is whether there is any
    // audio rather than which radio is ticked. A member who typed the words and sang
    // nothing has still shared the song, which is why there is no third radio saying
    // so: every field on this form is on it either way. On an edit, "keep" is the
    // radio that means "no new bytes", and the song keeps whatever it already had.
    const audio = way === "record" ? recording : way === "upload" ? file : null;
    if (!editing && !audio && !lyrics.trim()) {
      setError("Record something, choose a file, or type the words.");
      return;
    }
    if (editing && way !== "keep" && !audio) {
      setError(
        way === "record"
          ? "Record the new take, or choose “Keep this recording”."
          : "Choose the file to use, or choose “Keep this recording”.",
      );
      return;
    }
    // Asked again here rather than trusted from the field, since the picker can be
    // widened after a file was chosen and the answer only matters at the point the
    // bytes would actually go up.
    if (way === "upload" && file) {
      const wrong = notAudioReason(file);
      if (wrong) {
        setError(wrong);
        return;
      }
    }

    setError(null);
    setBusy(true);
    setProgress(0);
    try {
      if (editing) {
        // Everything but the bytes is a plain PATCH. A member who sang it again, or
        // picked a different file, sends the parts up first and the PATCH claims
        // them — so one save changes the words and the recording together, and the
        // old take is swept up server-side rather than left behind.
        let replacing: SongAudio | undefined;
        if (audio) {
          const duration = way === "record" ? recorder.seconds : await readAudioDuration(file!);
          replacing = await uploadSongParts(audio, duration, setProgress);
        }
        onSaved(await store.editSong(song!.id, { ...shared(), audio: replacing }));
        onClose();
        return;
      }

      let saved: Song;
      if (!audio) {
        saved = await createSong(shared());
      } else {
        const duration = way === "record" ? recorder.seconds : await readAudioDuration(file!);
        saved = await uploadSongInParts(
          { ...shared(), file: audio, durationSeconds: duration },
          setProgress,
        );
      }

      // Asked for on the form, started once there is something to hang it on. A
      // thread that will not start is not worth losing the song over, so the share
      // stands either way — and the member is told, rather than left to wonder why
      // the question they typed is nowhere on the song.
      if (prompt.trim()) {
        try {
          saved = {
            ...saved,
            discussions: [await store.startDiscussion("song", saved.id, prompt.trim())],
          };
        } catch (err) {
          onSaved(saved);
          setThreadFailed(true);
          setError(
            err instanceof Error
              ? `The song is shared, but that question could not be asked: ${err.message} Ask it again from the song’s own page.`
              : "The song is shared, but that question could not be asked. Ask it again from the song’s own page.",
          );
          return;
        }
      }

      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not share that song.");
    } finally {
      setBusy(false);
    }
  }

  // Only a save with bytes in it has a progress bar to show — which an edit now has
  // too, whenever the recording is being swapped for another.
  const uploading = busy && Boolean(way === "record" ? recording : way === "upload" ? file : null);

  return (
    <Modal
      eyebrow={editing ? "Your song" : "Sing it, share it, or write it down"}
      title={editing ? "Edit song" : "Add a Song"}
      onClose={onClose}
      busy={busy}
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {/* Where it goes, first, the same way it is asked first on every other
            share form — except that a form opened from inside a folder has
            already been told, and an edit of something already in one is being
            shown where it is rather than asked all over again. */}
        {folder ? (
          <SharingIntoNote path={folder.path} />
        ) : filedIn ? (
          <SharedInNote path={filedIn} />
        ) : (
          <ShelfField
            itemType="song"
            categories={categories}
            circles={circles}
            circleIds={circleIds}
            value={shelf}
            onChange={setShelf}
            filedCategoryId={filedCategoryId}
            onFiledCategoryIdChange={setFiledCategoryId}
          />
        )}

        <fieldset className="field song-way">
          <legend>{editing ? "How did you share it?" : "How are you sharing it?"}</legend>

          {/* What is on the song now, so the member can hear it before deciding to
              replace it — and reach the file itself, which is the only link there is
              to a recording. A song shared as words alone says so instead. */}
          {editing && (
            <div className="song-current">
              {song?.blobKey ? (
                <>
                  <p className="field-hint">
                    {[
                      way === "keep" ? "This is the recording on it now." : "The recording on it now.",
                      formatDuration(song.durationSeconds),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <audio
                    controls
                    preload="none"
                    src={audioUrl(song.id, song.blobKey)}
                    className="recorder-preview"
                  />
                  <p className="field-hint">
                    <a href={audioUrl(song.id, song.blobKey)} target="_blank" rel="noreferrer">
                      Open the recording in a new tab
                    </a>{" "}
                    — the link to the audio itself, to download or to play elsewhere.
                  </p>
                </>
              ) : (
                <p className="field-hint">
                  This song is the words alone — there is no recording on it yet.
                </p>
              )}
            </div>
          )}

          {editing && (
            <label>
              <input
                type="radio"
                checked={way === "keep"}
                onChange={() => setWay("keep")}
                disabled={busy}
              />
              <span>{song?.blobKey ? "Keep this recording" : "Leave it as words alone"}</span>
            </label>
          )}
          <label>
            <input
              type="radio"
              checked={way === "record"}
              onChange={() => setWay("record")}
              disabled={busy || !canRecord}
            />
            <span>
              {editing ? (song?.blobKey ? "Record it again" : "Record it now") : "Record it now"}
              {!canRecord && <span className="field-hint"> — this browser cannot record</span>}
            </span>
          </label>
          <label>
            <input
              type="radio"
              checked={way === "upload"}
              onChange={() => setWay("upload")}
              disabled={busy}
            />
            <span>
              {editing && song?.blobKey ? "Upload a different recording" : "Upload a recording"}
            </span>
          </label>
          <span className="field-hint">
            {editing
              ? "A new take replaces the one above; everything else about the song stays as it is."
              : "Both are optional — type the words below and share the song without a recording at all."}
          </span>
        </fieldset>

        <label className="field">
          <span>Song title</span>
          <input
            required
            value={songName}
            onChange={(e) => setSongName(e.target.value)}
            disabled={busy}
            autoFocus
          />
        </label>

        {way === "record" && canRecord && <AudioRecorder recorder={recorder} disabled={busy} />}

        {way === "upload" && (
          <>
            <label className="field field-file">
              <span>{editing && song?.blobKey ? "New audio file" : "Audio file"}</span>
              <input
                type="file"
                // Widened only on request. `AUDIO_ACCEPT` names every audio
                // extension outright rather than relying on `audio/*`, because a
                // phone's picker filters by file type and greys out whatever the
                // wildcard did not expand to cover — which is most of them.
                accept={showEveryFile ? undefined : AUDIO_ACCEPT}
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                disabled={busy}
              />
              <span className="field-hint">
                MP3, M4A, WAV, FLAC, OGG or Opus — up to {formatBytes(MAX_UPLOAD_BYTES)}
                {file && !busy ? ` · ${file.name} is ${formatBytes(file.size)}` : ""}
              </span>
            </label>
            {/* Outside the label on purpose: a button inside one is a second way to
                open the picker, and this one's whole job is to change how it opens
                before it does. */}
            {showEveryFile ? (
              <p className="field-hint">
                Every file on your device is showing. Pick the recording — anything that is not
                one is turned away here rather than shared.
              </p>
            ) : (
              <button
                type="button"
                className="widen-picker"
                onClick={() => setShowEveryFile(true)}
                disabled={busy}
              >
                Song greyed out in Files? Show every file
              </button>
            )}
          </>
        )}

        <label className="field">
          <span>Composer (optional)</span>
          <input value={composer} onChange={(e) => setComposer(e.target.value)} disabled={busy} />
        </label>

        <label className="field">
          <span>Raga or style (optional)</span>
          <input value={raga} onChange={(e) => setRaga(e.target.value)} disabled={busy} />
        </label>

        <LyricsField
          lyrics={lyrics}
          language={lyricsLanguage}
          scheme={lyricsScheme}
          readInto={readInto}
          onLyrics={setLyrics}
          onLanguage={setLyricsLanguage}
          onScheme={setLyricsScheme}
          onReadInto={(next) => {
            // Answered by hand, so the configured default can no longer land on top.
            seeded.current = true;
            setReadInto(next);
          }}
        />

        {/* Whatever the chosen circles decided a song here should also say, and the
            "+" that adds a question — which belongs to the people who answer for the
            circle, so a plain member sees the questions and no button. */}
        <SongFields
          store={store}
          categories={categories}
          circleIds={circleIds}
          values={answers}
          onChange={setAnswers}
          attachment={prefill?.attachment}
        />

        <VisibilityPicker
          value={visibility}
          onChange={setVisibility}
          circles={circles}
          circleIds={circleIds}
          onCircleIdsChange={setCircleIds}
          itemType="song"
          categories={categories}
          onShelfChange={setShelf}
        />

        <PhotoField
          photos={photos}
          onChange={setPhotos}
          hint="Optional. The words, the notation, or whoever sang it."
        />

        {/* A discussion is somebody else's contribution, so it can only hang on a song
            that exists. Before it does, the form takes the question and asks it the
            moment the song is saved. */}
        {editing && song ? (
          <div className="field song-discussion">
            <span className="field-label">Discussion</span>
            <SongConversation
              song={song}
              userId={userId}
              store={store}
              onError={(err) =>
                setError(err instanceof Error ? err.message : "That could not be saved.")
              }
            />
          </div>
        ) : (
          <label className="field">
            <span>Start a discussion (optional)</span>
            <textarea
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Which raga is this based on?"
              disabled={busy}
            />
            <span className="field-hint">
              Asked of everybody the song reaches, as soon as it is shared.
            </span>
          </label>
        )}

        <ErrorLine message={error} />

        {uploading && (
          <div
            className="upload-progress"
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="upload-progress-bar" style={{ width: `${progress}%` }} />
            <span className="upload-progress-label">
              {progress < 100 ? `Uploading… ${Math.round(progress)}%` : "Almost done…"}
            </span>
          </div>
        )}

        {threadFailed ? (
          // The song exists, so submitting again would share a second one. The way
          // out is the door, with the question still on screen to be copied.
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        ) : (
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Sharing…" : editing ? "Save changes" : "Share the song"}
          </button>
        )}
      </form>
    </Modal>
  );
}
