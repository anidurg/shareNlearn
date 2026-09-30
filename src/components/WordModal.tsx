import { useRef, useState } from "react";
import {
  MAX_WORD_CONNECTIONS,
  type Circle,
  type CircleCategory,
  type NewWordConnection,
  type SharedWord,
  type ShelfChoice,
  type Visibility,
  type Word,
} from "../api";
import { currentFiledCategoryId, currentShelfChoice } from "../categories";
import { currentFolderPath, type ShareTarget } from "../folders";
import type { SharePrefill } from "../incoming-share";
import {
  ChoiceField,
  ErrorLine,
  LANGUAGE_OPTIONS,
  Modal,
  SharedInNote,
  SharingIntoNote,
  ShelfField,
  VisibilityPicker,
} from "./shared";

/**
 * Synonyms and antonyms are short, so they are typed on one line and separated
 * however feels natural — a comma or a new line. Blank entries fall away, which
 * is what makes "Extravagant, Lavish," behave the way it looks.
 */
function splitList(value: string) {
  return value
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * One language connection being typed. `key` is only for React: a draft has no
 * id until the server has it, and removing the middle of three must not shuffle
 * what the other two rows are holding.
 */
type ConnectionDraft = { key: number; language: string; term: string; note: string };

export function WordModal({
  word,
  circles = [],
  categories = [],
  presetCircleIds = [],
  folder = null,
  prefill,
  onClose,
  onSave,
}: {
  word?: Word;
  /** The circles the member belongs to, so a word can be shared into them. */
  circles?: Circle[];
  /** Their circles' categories, so the form can offer the right shelves. */
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
  onSave: (values: SharedWord) => Promise<unknown>;
}) {
  const [term, setTerm] = useState(word?.word ?? prefill?.title ?? "");
  const [meaning, setMeaning] = useState(word?.meaning ?? "");
  const [example, setExample] = useState(word?.example ?? "");
  const [language, setLanguage] = useState(word?.language ?? "");
  const [pronunciation, setPronunciation] = useState(word?.pronunciation ?? "");
  const [synonyms, setSynonyms] = useState((word?.synonyms ?? []).join(", "));
  const [antonyms, setAntonyms] = useState((word?.antonyms ?? []).join(", "));
  const [notes, setNotes] = useState(word?.notes ?? prefill?.note ?? "");
  const [source, setSource] = useState(word?.source ?? prefill?.url ?? "");
  const [connections, setConnections] = useState<ConnectionDraft[]>([]);
  const [visibility, setVisibility] = useState<Visibility>(word?.visibility ?? "shared");
  const [circleIds, setCircleIds] = useState<number[]>(word?.circleIds ?? presetCircleIds);
  const [shelf, setShelf] = useState<ShelfChoice>(currentShelfChoice(categories, word));
  const [filedCategoryId, setFiledCategoryId] = useState<number | null>(
    currentFiledCategoryId(word),
  );

  // Where the share already sits, when it is being edited rather than shared: a
  // folder is the filing, so the form states it instead of offering the old shelf
  // picker and inviting a second answer to a question already answered.
  const filedIn = currentFolderPath(word);
  // Whether the form asks about filing at all. Where it does not, the shelf keys
  // are left out of the payload rather than sent as nulls this form never asked
  // for, which the server reads as "leave whatever is stored alone" — so a legacy
  // subcategory survives an edit that never mentioned it.
  const asksShelf = !folder && filedIn === null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextKey = useRef(0);

  function addDraft() {
    setConnections((prev) => [
      ...prev,
      { key: (nextKey.current += 1), language: "", term: "", note: "" },
    ]);
  }

  function editDraft(key: number, changes: Partial<ConnectionDraft>) {
    setConnections((prev) =>
      prev.map((draft) => (draft.key === key ? { ...draft, ...changes } : draft)),
    );
  }

  function removeDraft(key: number) {
    setConnections((prev) => prev.filter((draft) => draft.key !== key));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // A row with only half of it filled in is a half-finished thought rather than
    // a connection, so it is said out loud instead of quietly dropped.
    const typed = connections.filter((draft) => draft.language.trim() || draft.term.trim());
    if (typed.some((draft) => !draft.language.trim() || !draft.term.trim())) {
      setError("A language connection needs both a language and the word in it.");
      return;
    }
    const offered: NewWordConnection[] = typed.map((draft) => ({
      language: draft.language.trim(),
      term: draft.term.trim(),
      note: draft.note.trim(),
    }));

    setBusy(true);
    setError(null);
    try {
      await onSave({
        word: term.trim(),
        meaning: meaning.trim(),
        example: example.trim(),
        language: language.trim(),
        pronunciation: pronunciation.trim(),
        synonyms: splitList(synonyms),
        antonyms: splitList(antonyms),
        notes: notes.trim(),
        source: source.trim(),
        visibility,
        circleIds,
        ...(asksShelf
          ? { subcategoryId: shelf.id, subcategoryName: shelf.name, filedCategoryId }
          : {}),
        ...(folder && folder.id !== null ? { folderId: folder.id } : {}),
        // Only a new word carries them: on a word that exists, a connection is a
        // contribution anybody it reaches can make, and it is added on the word.
        ...(word ? {} : { connections: offered }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that word.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      eyebrow="Word Explorer"
      title={word ? "Edit word" : "Add Word"}
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
            itemType="word"
            categories={categories}
            circles={circles}
            circleIds={circleIds}
            value={shelf}
            onChange={setShelf}
            filedCategoryId={filedCategoryId}
            onFiledCategoryIdChange={setFiledCategoryId}
          />
        )}
        <label className="field">
          <span>Word</span>
          <input
            required
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Meaning</span>
          <textarea
            required
            rows={2}
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Example sentence (optional)</span>
          <textarea
            rows={2}
            value={example}
            onChange={(e) => setExample(e.target.value)}
          />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Language (optional)</span>
            <input
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Pronunciation notes (optional)</span>
            <input
              value={pronunciation}
              onChange={(e) => setPronunciation(e.target.value)}
            />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Synonyms (optional)</span>
            <input
              value={synonyms}
              onChange={(e) => setSynonyms(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Antonyms (optional)</span>
            <input
              value={antonyms}
              onChange={(e) => setAntonyms(e.target.value)}
            />
          </label>
        </div>
        <label className="field">
          <span>Notes (optional)</span>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Where it comes from, when to use it, who says it."
          />
        </label>
        <label className="field">
          <span>Where did you find it? (optional)</span>
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="A novel, a podcast, a conversation…"
          />
        </label>
        {word ? (
          <p className="field-hint">
            Language connections live on the word itself, so anybody it reaches can offer one.
          </p>
        ) : (
          <div className="field connection-field">
            <span className="field-label">Language connections (optional)</span>
            <span className="field-hint">
              The same idea in other tongues — Greek osteon, German Knochen, Hindi अस्थि. Members
              can add more later.
            </span>

            {connections.map((draft) => (
              <div className="connection-draft" key={draft.key}>
                <button
                  type="button"
                  className="connection-remove"
                  aria-label={
                    draft.language.trim()
                      ? `Remove the ${draft.language.trim()} connection`
                      : "Remove this connection"
                  }
                  onClick={() => removeDraft(draft.key)}
                >
                  ×
                </button>
                <div className="field-row">
                  <ChoiceField
                    label="Language"
                    options={LANGUAGE_OPTIONS}
                    value={draft.language}
                    onChange={(value) => editDraft(draft.key, { language: value })}
                    emptyLabel="Pick a language"
                    placeholder="Which language?"
                  />
                  <label className="field">
                    <span>The word in that language</span>
                    <input
                      value={draft.term}
                      onChange={(e) => editDraft(draft.key, { term: e.target.value })}
                    />
                  </label>
                </div>
                <label className="field">
                  <span>How it connects (optional)</span>
                  <input
                    value={draft.note}
                    onChange={(e) => editDraft(draft.key, { note: e.target.value })}
                  />
                </label>
              </div>
            ))}

            {connections.length < MAX_WORD_CONNECTIONS ? (
              <button type="button" className="btn btn-ghost" onClick={addDraft}>
                {connections.length === 0 ? "+ Add a connection" : "+ Add another connection"}
              </button>
            ) : (
              <span className="field-hint">That is all {MAX_WORD_CONNECTIONS} connections.</span>
            )}
          </div>
        )}
        <VisibilityPicker
          value={visibility}
          onChange={setVisibility}
          circles={circles}
          circleIds={circleIds}
          onCircleIdsChange={setCircleIds}
          itemType="word"
          categories={categories}
          onShelfChange={setShelf}
        />
        <ErrorLine message={error} />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : word ? "Save changes" : "Share word"}
        </button>
      </form>
    </Modal>
  );
}
