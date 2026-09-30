import { useEffect, useRef, useState } from "react";
import {
  LYRIC_SCRIPT_OPTIONS,
  ROMAN_SCHEME_OPTIONS,
  guessRomanScheme,
  looksRomanised,
  transliterate,
  type LyricScript,
  type RomanScheme,
  type Song,
} from "../api";
import type { ShareAndLearn } from "../store";
import { ScriptPicker } from "./ScriptPicker";
import { ErrorLine } from "./shared";

/**
 * The words of a song, and the same words in whichever script the reader asks for.
 *
 * The words are the member's own: whoever shares a recording types them in, in
 * whatever script they think in, and everything below is derived from that text.
 * The app never goes looking for the lyrics of a song — it cannot know what somebody
 * hummed, and a machine's guess at a song it half-recognises is worse than an honest
 * blank — so a recording with no words typed has no lyrics, and says so to the one
 * person who can fix that.
 *
 * All of it sits behind a **Details** link rather than on the face of the card. A
 * card is a list of what the group has shared and a verse is thirty lines long, so
 * printing every one of them turns eight songs into a scroll: the player is what
 * somebody came for, and the words are what they came for next. Opening it is one
 * tap and closing it is the same tap.
 *
 * Which scripts are on offer is settled in two places and neither of them is here. The
 * app admin switches on the scripts the Songs category offers at all, and the author
 * ticks the ones their own family reads out of those — the tabs everybody else sees
 * are what survives both. The server narrows the list a third time by what these
 * particular words can actually be converted into, so a tab here always leads
 * somewhere.
 *
 * Those tabs sit over **one** lyrics area, with the contributor's own words on the
 * first of them and selected to begin with. Tapping a script rewrites that area rather
 * than opening a second one under it, which is the whole point: the aunt who wrote it in
 * Kannada and the nephew who reads only Devanagari are looking at the same song in the
 * same place. Every script keeps the sounds, so anybody can sing along — each is a
 * character mapping, so it comes back at once and it is exact. Nothing here says what
 * the words *mean* in another language: a model's paraphrase of a verse, printed under
 * the words of the person who sang it, is not what somebody tapping "ಕನ್ನಡ" is after.
 * The answer is kept on the song, so every later tap is instant.
 *
 * English letters is the one that goes the other way, and it is there for the member
 * who has been handed a stotra in a script they do not read at all: it says the same
 * sounds in the alphabet they do, and it translates nothing.
 */
export function SongLyrics({
  song,
  store,
  canEdit,
}: {
  song: Song;
  store: ShareAndLearn;
  /**
   * Whether this reader can put the words right — the member who shared it, or
   * whoever keeps a circle it went into. Only they are nudged, since nobody else
   * can act on what the nudge says.
   */
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!song.lyrics) {
    if (!canEdit) return null;
    return (
      <p className="lyrics-nudge">
        No words typed for this one. Add them under Edit and the group can read them in
        Kannada, Devanagari, Tamil or any other script you pick.
      </p>
    );
  }

  const offered = offeredScripts(song);

  return (
    <div className="lyrics-block">
      {/* The one line the card always shows, and what is behind it: the words, and
          the scripts they can be read in. It says which, so the tap is worth making. */}
      <button
        type="button"
        className="details-toggle"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
      >
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
        <span className="details-toggle-label">Details</span>
        <span className="details-toggle-note">
          {offered.length > 0
            ? `the words, and ${offered.length === 1 ? "1 script" : `${offered.length} scripts`} to read them in`
            : "the words"}
        </span>
      </button>

      {open && (
        <div className="lyrics-details">
          <LyricsReading song={song} store={store} canEdit={canEdit} />
        </div>
      )}
    </div>
  );
}

/**
 * The same words on the song's own page, where there is nothing to unfold: a reader who
 * asked for **Details** has already said the words are what they came for, so hiding
 * them behind a second tap would be asking the same question twice.
 *
 * It is otherwise the identical reading — the configured scripts as tabs, Original
 * among them and selected first, and one area under them showing whichever was tapped
 * without leaving the page.
 */
export function SongLyricsPanel({
  song,
  store,
  canEdit,
}: {
  song: Song;
  store: ShareAndLearn;
  canEdit: boolean;
}) {
  if (!song.lyrics) {
    if (!canEdit) return null;
    return (
      <section className="lyrics-panel">
        <h2 className="section-title">Lyrics</h2>
        <p className="lyrics-nudge">
          No words typed for this one. Add them under Edit and the group can read them in
          Kannada, Devanagari, Tamil or any other script you pick.
        </p>
      </section>
    );
  }

  return (
    <section className="lyrics-panel">
      <h2 className="section-title">Lyrics</h2>
      <LyricsReading song={song} store={store} canEdit={canEdit} detail />
    </section>
  );
}

/**
 * The words themselves and the scripts they can be read in — the whole of the reading,
 * written once and used by both the card and the song's own page, because two copies of
 * this would be two answers to "which script am I looking at?".
 *
 * It is **one lyrics area with a row of scripts over it**, and the row always leads with
 * **Original** — the words exactly as the contributor typed them, which is what it opens
 * on. Tapping a script replaces what is in that area; tapping Original puts the
 * contributor's own text back. It used to print the original and then open a *second*
 * block underneath it, which said the same song twice: the reader who tapped ಕನ್ನಡ
 * scrolled past thirty lines of ITRANS to reach the thirty lines they had asked for.
 * One area and one selection is the same information without the scroll, and it is why
 * the row needs no label — "Original | देवनागरी | ಕನ್ನಡ" is a set of choices that says
 * what it is by being one.
 *
 * Nothing here writes anything. The original is the one stored text and every script is
 * derived from it on demand, so switching scripts can no more change the song than
 * reading it can — which is also why Original is always on the row: it is the way back
 * to what was actually shared, and it is what the area falls back to when a conversion
 * cannot be made, so a failed tap costs a reader a line of explanation rather than the
 * words.
 */
function LyricsReading({
  song,
  store,
  canEdit,
  detail = false,
}: {
  song: Song;
  store: ShareAndLearn;
  canEdit: boolean;
  /** The song's own page, which words things a little more fully than a card can. */
  detail?: boolean;
}) {
  /** Which script the area is showing. Null is the original, and is where it opens. */
  const [script, setScript] = useState<LyricScript | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * The last script asked for, so a conversion that arrives after the reader has moved
   * on cannot speak for the area any more. The row stays tappable while one is being
   * written — Original in particular has to stay reachable — so two taps in a row is an
   * ordinary thing to do rather than an edge case.
   */
  const wanted = useRef<LyricScript | null>(null);

  const rendered = song.lyricScripts ?? [];
  const offered = offeredScripts(song);
  const chosen = LYRIC_SCRIPT_OPTIONS.find((option) => option.id === script);
  const shown = script ? rendered.find((row) => row.script === script) : undefined;
  // Both callers render this only when there are words; the fallback is for the type
  // rather than for a case that happens. The original is also the fallback for a script
  // that somehow has no body: the one thing this area must never be is empty.
  const words = song.lyrics ?? "";
  const body = script ? shown?.body ?? words : words;
  const scheme = ROMAN_SCHEME_OPTIONS.find((option) => option.id === song.lyricsScheme);
  const needsScheme = !song.lyricsScheme && looksRomanised(words);
  // Asked and answered "no", as against never asked at all — the second is a recording
  // from before the form had the question, and it is offered whatever its words allow.
  const askedForNone = Array.isArray(song.readInto) && song.readInto.length === 0;

  async function choose(option: LyricScript | null) {
    setError(null);
    setScript(option);
    wanted.current = option;
    // Original is the stored text, and a script already written is on the song: both are
    // on screen the moment they are tapped, cost no request, and end any wait — a reader
    // who taps Original while a conversion is in flight wants the words now, not a
    // "writing…" line about a script they have just navigated away from.
    if (option === null || rendered.some((row) => row.script === option)) {
      setBusy(false);
      return;
    }
    setBusy(true);
    try {
      await store.songLyricScript(song.id, option);
    } catch (err) {
      // A conversion the reader has already moved on from says nothing at all: it is
      // neither the words on screen nor the tab they are looking at.
      if (wanted.current !== option) return;
      // Otherwise fall back to the words the member actually typed rather than to a
      // blank. The original is what every script here is made from, so it is never the
      // wrong thing to be reading, and the error line says why it is what is on screen.
      setScript(null);
      setError(
        err instanceof Error ? err.message : "Those lyrics could not be written in that script.",
      );
    } finally {
      if (wanted.current === option) setBusy(false);
    }
  }

  return (
    <>
      {/* The card has no heading over this; the song's own page has an <h2>. */}
      {!detail && <p className="lyrics-label">Lyrics</p>}

      {/* One row, Original first, and nothing above it saying what a row of script
          names obviously is. Absent altogether when there is nothing to switch to —
          a tab bar of one is a decoration. */}
      {offered.length > 0 && (
        <div className="script-tabs" role="group" aria-label="Script">
          <button
            type="button"
            className={script === null ? "script-tab script-tab-on" : "script-tab"}
            onClick={() => choose(null)}
            aria-pressed={script === null}
            title="The words as they were typed"
          >
            Original
          </button>
          {offered.map((option) => (
            <button
              key={option.id}
              type="button"
              className={script === option.id ? "script-tab script-tab-on" : "script-tab"}
              onClick={() => choose(option.id)}
              aria-pressed={script === option.id}
              aria-label={option.label}
              title={option.note}
            >
              {tabText(option)}
            </button>
          ))}
        </div>
      )}

      {/* Which of them is on screen, in words: the native name on a tab is what a
          reader of that script looks for, and this is where everybody else finds out
          what they are looking at. */}
      <p className="lyrics-meta">
        {chosen ? (
          <span>
            {chosen.label} — {chosen.note}
          </span>
        ) : (
          <>
            <span>
              As {song.memberName} wrote them
              {detail && scheme ? `, in ${scheme.short}` : ""}
            </span>
            {song.lyricsLanguage && <span className="tag">{song.lyricsLanguage}</span>}
          </>
        )}
      </p>

      {/* The one area, whatever is selected. A conversion in flight says so here rather
          than swapping the words out for a spinner somewhere else. */}
      <div className="lyrics-view" aria-busy={busy}>
        {busy ? (
          <p className="muted">Writing the words in {chosen?.label}…</p>
        ) : (
          <pre className="lyrics-body">{body}</pre>
        )}
      </div>

      <ErrorLine message={error} />

      {/* The two reasons nothing is on offer that somebody reading this can
          actually do something about. Said to them alone. */}
      {offered.length === 0 && canEdit && (askedForNone || needsScheme) && (
        <p className="lyrics-nudge">
          {askedForNone
            ? "These words are not offered in any other script. Pick the ones your circle reads under Edit."
            : "These words are in English letters. Say which convention you typed them in under Edit, and the group can read them in the scripts you picked."}
        </p>
      )}
    </>
  );
}

/**
 * What a script's own tab says. The native spelling, because somebody who reads Kannada
 * looks for ಕನ್ನಡ rather than for the word "Kannada" — the English name is the tab's
 * accessible name and its tooltip, and the line under the row names whichever one is
 * open. The single exception is English letters, whose "native" is the sample `Aa`: a
 * sample is not a name, and "Aa" on a tab says nothing to anybody.
 */
function tabText(option: (typeof LYRIC_SCRIPT_OPTIONS)[number]) {
  return option.id === "english" ? option.label : option.native;
}

/**
 * What the server says can be offered: the scripts the app admin switched on for songs,
 * narrowed to the ones the author asked for, narrowed again to the ones these particular
 * words can actually be converted into. It leaves out the one the words are already in —
 * it is on screen above — and any that could only fail. An older response that said
 * nothing about it means "offer them all", which is what the app did before it asked.
 */
function offeredScripts(song: Song) {
  return song.lyricScriptsAvailable
    ? LYRIC_SCRIPT_OPTIONS.filter((option) => song.lyricScriptsAvailable!.includes(option.id))
    : LYRIC_SCRIPT_OPTIONS;
}

/**
 * The fields behind all of that, on every form that shares or edits a recording.
 * All of them are optional — plenty of recordings are humming, and a member can add the
 * words later — and the hint says plainly what the app will and will not do with
 * them, because a lyrics field that mentioned scripts at all could otherwise read as an
 * offer to go and find the song.
 *
 * The third field only appears when it has something to ask. Words typed in an Indic
 * script say what they are by being in it, but `vakratuNDa mahaakaaya` could be any of
 * four conventions, and `aa` is a different vowel in each — so a member who typed in
 * English letters is asked which one they meant. It is the difference between the group
 * reading their words in Kannada and not being offered Kannada at all, which is why it
 * is asked here rather than worked out later.
 *
 * And because it is that load-bearing, the field proposes an answer rather than opening
 * on "I would rather not say". An unanswered convention silently voids every script
 * ticked below it, which is a trap: the member picks Kannada, Devanagari and Telugu,
 * shares the song, and the group is offered nothing at all. The proposal is read off the
 * letters — diacritics mean IAST or ISO, plain ASCII means ITRANS — and it is only ever
 * a first suggestion: it is set once, the moment the question first has something to
 * ask, and never again over an answer the member has given.
 *
 * Under them sits the question a post is already asked — should these words be readable
 * in other scripts? — because the answer belongs to the member who wrote them rather
 * than to the app. Saying yes takes as many scripts as they want, one at a time, and
 * every one of them can be previewed on the spot from the very tables the group will
 * read it through, so a wrong roman convention is caught while it can still be changed.
 */
export function LyricsField({
  lyrics,
  language,
  scheme,
  readInto,
  onLyrics,
  onLanguage,
  onScheme,
  onReadInto,
}: {
  lyrics: string;
  language: string;
  /** Which roman convention the words follow, when they are in Latin letters. */
  scheme: RomanScheme | "";
  /** The scripts the author wants the words readable in. */
  readInto: LyricScript[];
  onLyrics: (value: string) => void;
  onLanguage: (value: string) => void;
  onScheme: (value: RomanScheme | "") => void;
  onReadInto: (next: LyricScript[]) => void;
}) {
  const romanised = looksRomanised(lyrics);
  // Whether the member has answered this themselves, in which case the proposal below
  // has had its say. "I would rather not say" is an answer like any other and must not
  // be talked out of by a suggestion arriving a keystroke later.
  const answered = useRef(scheme !== "");

  useEffect(() => {
    if (answered.current || !romanised || scheme !== "") return;
    answered.current = true;
    onScheme(guessRomanScheme(lyrics));
    // Read off whatever has been typed by the time the question first applies; it is a
    // suggestion rather than a running judgement, so it does not follow later edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [romanised]);

  return (
    <>
      <label className="field">
        <span>Lyrics (optional)</span>
        <textarea
          rows={5}
          value={lyrics}
          onChange={(e) => onLyrics(e.target.value)}
          placeholder="Type the words as you know them, one line per line…"
        />
        <span className="field-hint">
          Your words, in whatever script you write in. The group can then read them in
          whichever scripts you pick below — the app changes the letters and nothing
          else, never translates, and never fills in a song it thinks it recognises.
        </span>
      </label>

      {lyrics.trim().length > 0 && (
        <label className="field">
          <span>Language of the words (optional)</span>
          <input
            value={language}
            onChange={(e) => onLanguage(e.target.value)}
            placeholder="Kannada, Sanskrit, Hindi…"
          />
        </label>
      )}

      {romanised && (
        <label className="field">
          <span>You have typed in English letters — which way?</span>
          <select
            value={scheme}
            onChange={(e) => {
              answered.current = true;
              onScheme(e.target.value as RomanScheme | "");
            }}
          >
            <option value="">I would rather not say</option>
            {ROMAN_SCHEME_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} — {option.example}
              </option>
            ))}
          </select>
          <span className="field-hint">
            Saying so is what lets the group read these words in another script, letter
            for letter. Leave it and there is nothing to convert from — `aa`, `ā` and `A`
            are three conventions' answer to the same vowel — so no script is offered on
            this recording.
          </span>
        </label>
      )}

      <LyricScriptField
        lyrics={lyrics}
        scheme={scheme}
        needsScheme={romanised && scheme === ""}
        chosen={readInto}
        onChange={onReadInto}
      />
    </>
  );
}

/**
 * "Should the words be readable in other scripts?" — asked of the author, answered by
 * them rather than by the app, and shown to them before anybody else sees it.
 *
 * It is the same control a post's details carry, for the same reason: the member who
 * shares a stotra knows which scripts their own circle reads, and the app does not.
 * Saying yes opens the searchable tick-list — a search box and fifty scripts, the ones
 * this group writes in at the top — because ticking is how somebody chooses three
 * things out of fifty and a dropdown is how they choose one out of five.
 *
 * Every chosen script can then be previewed. Every one of them is a mapping table
 * rather than a reading, so the answer arrives in a millisecond and is exactly what a
 * reader will get — which is the point of showing it at all. A verse typed in the wrong
 * roman convention comes out as visible nonsense here, on the form, rather than on
 * somebody else's screen a week later.
 *
 * Nothing is stored by looking. The renderings a reader taps are written on the song
 * itself when it is saved, from the same tables.
 */
function LyricScriptField({
  lyrics,
  scheme,
  needsScheme,
  chosen,
  onChange,
}: {
  lyrics: string;
  scheme: RomanScheme | "";
  /**
   * Whether the ticks below cannot currently do anything: English letters with the
   * convention question left unanswered. Said here as well as up there, because this is
   * the field whose ticks would otherwise go quietly nowhere.
   */
  needsScheme: boolean;
  chosen: LyricScript[];
  onChange: (next: LyricScript[]) => void;
}) {
  const [wanted, setWanted] = useState(chosen.length > 0);
  const [preview, setPreview] = useState<LyricScript | null>(null);

  // Scripts arriving after the form opened — the configured default landing on a fresh
  // share — open the tick list, so what is on screen matches the answer already
  // recorded. Only ever in that direction: unticking the last one leaves the list open
  // rather than folding it away mid-thought, and "No" closes it by saying so.
  useEffect(() => {
    if (chosen.length > 0) setWanted(true);
  }, [chosen.length]);

  const words = lyrics.trim();

  // Nothing to convert yet: the question only makes sense once there are words.
  if (!words) return null;

  return (
    <fieldset className="field visibility-picker">
      <legend>Should the words be readable in other scripts?</legend>
      <label>
        <input
          type="radio"
          checked={!wanted}
          onChange={() => {
            setWanted(false);
            setPreview(null);
            onChange([]);
          }}
        />
        <span>No — just as I typed them</span>
      </label>
      <label>
        <input type="radio" checked={wanted} onChange={() => setWanted(true)} />
        <span>Yes — offer them in other scripts</span>
      </label>

      {wanted && (
        <div className="translation-picker">
          <ScriptPicker
            options={LYRIC_SCRIPT_OPTIONS}
            chosen={chosen}
            onChange={(next) => {
              onChange(next as LyricScript[]);
              // A script that has just been unticked cannot go on being previewed.
              if (preview && !next.includes(preview)) setPreview(null);
            }}
            emptyNote="None chosen yet — tick the scripts your family reads."
          />

          <span className="field-hint">
            Readers see a button for each one under the recording. Every one of them
            changes the letters and nothing else — the same words, the same sounds, an
            exact conversion by the Aksharamukha tables rather than anything written by
            AI.
          </span>

          {/* The one way ticking a script can come to nothing, said where the ticking
              happens rather than only beside the question that causes it. */}
          {needsScheme && chosen.length > 0 && (
            <p className="lyrics-nudge">
              These words are in English letters, and you have not said which convention
              they follow — so none of the scripts ticked here can be offered. Answer
              “which way?” above and they all can.
            </p>
          )}

          {chosen.length > 0 && (
            <div className="lyrics-scripts">
              <span className="lyrics-scripts-label">Check one</span>
              {chosen.map((id) => {
                const option = LYRIC_SCRIPT_OPTIONS.find((entry) => entry.id === id);
                return (
                  <button
                    key={id}
                    type="button"
                    className={preview === id ? "count-chip count-chip-on" : "count-chip"}
                    onClick={() => setPreview(preview === id ? null : id)}
                    aria-pressed={preview === id}
                    title={`Preview the words in ${option?.label ?? id}`}
                  >
                    {option?.native} {option?.label}
                  </button>
                );
              })}
            </div>
          )}

          {preview && <ScriptPreview words={words} scheme={scheme} script={preview} />}
        </div>
      )}
    </fieldset>
  );
}


/** One chosen script, converted as the member types, so it can be checked before it is shared. */
function ScriptPreview({
  words,
  scheme,
  script,
}: {
  words: string;
  scheme: RomanScheme | "";
  script: LyricScript;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const option = LYRIC_SCRIPT_OPTIONS.find((entry) => entry.id === script);
  const target = option?.target;

  useEffect(() => {
    if (!target || !words) {
      setText("");
      setError(null);
      return;
    }
    // The words are still being typed, so the conversion waits for a pause rather
    // than firing on every keystroke — half a word converts to nonsense.
    let live = true;
    setBusy(true);
    const timer = window.setTimeout(() => {
      transliterate({ text: words, from: scheme || undefined, to: target })
        .then((converted) => {
          if (!live) return;
          setText(converted);
          setError(null);
        })
        .catch((err) => {
          if (!live) return;
          setText("");
          setError(
            err instanceof Error ? err.message : "Those words could not be written that way.",
          );
        })
        .finally(() => {
          if (live) setBusy(false);
        });
    }, 400);

    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [words, scheme, target]);

  return (
    <div className="lyrics-rendered">
      <p className="lyrics-label">{option?.label}</p>
      {busy ? (
        <p className="muted">Writing the words in {option?.label}…</p>
      ) : text ? (
        <pre className="lyrics-body">{text}</pre>
      ) : (
        !error && <p className="muted">Nothing came back for {option?.label}.</p>
      )}
      <ErrorLine message={error} />
    </div>
  );
}
