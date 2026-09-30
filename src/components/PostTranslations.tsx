import { useState } from "react";
import { POST_LANGUAGE_OPTIONS, type Post, type PostLanguage } from "../api";
import type { ShareAndLearn } from "../store";
import { ScriptPicker } from "./ScriptPicker";
import { ErrorLine } from "./shared";

/**
 * A post's details, read in whichever script the reader asks for.
 *
 * The author says which scripts the post should be readable in when they write it, and
 * those are the only links drawn — a stotra written in Sanskrit is offered in Kannada
 * letters and Devanagari because somebody decided it should be, not because the app
 * guessed. Tapping one opens the same details below, written once and kept, so the
 * second reader pays nothing and the tenth reader pays nothing.
 *
 * Every one of them does the same job: it keeps the words and changes only the letters,
 * which is a character mapping and is therefore exact and immediate. Nothing here says
 * what the words *mean* in another language — that is a reading rather than a mapping,
 * and a paraphrase of somebody's post under their own name is not what a reader tapping
 * "ಕನ್ನಡ" is asking for. Editing the post retires every conversion of the old text, so
 * nobody is left reading a paragraph that is no longer there.
 *
 * A script the details cannot be converted into — because they are already in it, or
 * because they are in Latin letters, which say nothing about what they are — is left out
 * of the row rather than drawn as a button whose one outcome is a shrug. Older responses
 * carry no `translationsAvailable`, and there the author's own list stands, exactly as
 * it did before the server started answering the question.
 */
export function PostTranslations({ post, store }: { post: Post; store: ShareAndLearn }) {
  const [language, setLanguage] = useState<PostLanguage | null>(null);
  const [busy, setBusy] = useState<PostLanguage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const possible = post.translationsAvailable;
  const offered = POST_LANGUAGE_OPTIONS.filter(
    (option) =>
      (post.translateInto ?? []).includes(option.id) &&
      (possible === undefined || possible.includes(option.id)),
  );
  // Nothing to offer, or nothing to convert: the post simply reads as written.
  if (!post.body || offered.length === 0) return null;

  const rendered = post.translations ?? [];
  const shown = language ? rendered.find((row) => row.language === language) : undefined;
  const chosen = offered.find((option) => option.id === language);

  async function choose(option: PostLanguage) {
    setError(null);
    // Tapping the open language again closes it, so the row is a toggle rather
    // than a one-way door.
    if (language === option) {
      setLanguage(null);
      return;
    }
    setLanguage(option);
    if (rendered.some((row) => row.language === option)) return;
    setBusy(option);
    try {
      await store.translatePost(post.id, option);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "That could not be written in that script.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="translations">
      <p className="translations-links">
        <span className="translations-label">Read this in</span>
        {offered.map((option) => (
          <button
            key={option.id}
            type="button"
            className={
              language === option.id ? "translation-link translation-link-on" : "translation-link"
            }
            onClick={() => choose(option.id)}
            aria-pressed={language === option.id}
            title={option.note}
            disabled={busy !== null}
          >
            {option.native} {option.label}
            {busy === option.id ? " …" : ""}
          </button>
        ))}
      </p>

      <ErrorLine message={error} />

      {language && (
        <div className="translation-body">
          <p className="translations-label">
            {chosen?.label}
            <span className="tag">{chosen?.note}</span>
          </p>
          {busy === language ? (
            <p className="muted">Writing it in {chosen?.label}…</p>
          ) : shown ? (
            shown.body.split(/\n{2,}/).map((paragraph, index) => (
              <p className="post-body" key={index}>
                {paragraph}
              </p>
            ))
          ) : (
            !error && <p className="muted">Nothing came back for {chosen?.label}.</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The choice behind all of that, on the form that writes or edits a post: whether
 * the details should be readable in other scripts, and which ones.
 *
 * Answering no is the ordinary case and costs nothing — nothing is converted until a
 * reader actually taps a script. Saying yes opens the same searchable tick-list the
 * recording form uses, because the question is the same question and a member who has
 * answered it once should not have to learn a second control to answer it again.
 *
 * Every option on the list does one thing: it keeps the words and changes the letters,
 * which is what a stotra wants — the Kannada side of the family should be singing the
 * same syllables, not reading a paraphrase.
 */
export function TranslationField({
  languages,
  onChange,
}: {
  languages: PostLanguage[];
  onChange: (next: PostLanguage[]) => void;
}) {
  const [wanted, setWanted] = useState(languages.length > 0);

  return (
    <fieldset className="field visibility-picker">
      <legend>Should the details be readable in other scripts?</legend>
      <label>
        <input
          type="radio"
          checked={!wanted}
          onChange={() => {
            setWanted(false);
            onChange([]);
          }}
        />
        <span>No — just as I wrote it</span>
      </label>
      <label>
        <input type="radio" checked={wanted} onChange={() => setWanted(true)} />
        <span>Yes — offer it in other scripts</span>
      </label>

      {wanted && (
        <div className="translation-picker">
          <ScriptPicker
            options={POST_LANGUAGE_OPTIONS}
            chosen={languages}
            onChange={(next) => onChange(next as PostLanguage[])}
            emptyNote="None chosen yet — tick the scripts your circle reads."
          />

          <span className="field-hint">
            Readers see a link for each one under the post. Each keeps your words exactly
            as you wrote them and changes only the letters, so nothing is translated,
            nothing is explained, and nothing you did not write is added. Each one is
            written once and then kept.
          </span>
        </div>
      )}
    </fieldset>
  );
}
