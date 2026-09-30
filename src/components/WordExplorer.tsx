import { useMemo, useState } from "react";
import { formatDate, type NewWordConnection, type Word, type WordConnection } from "../api";
import { canManageShare, deleteNote } from "../manage";
import type { ShareAndLearn } from "../store";
import { PostActions } from "./PostMenu";
import { ShareLinkButton } from "./ShareLink";
import { WordModal } from "./WordModal";
import {
  ChoiceField,
  CircleChips,
  EmptyState,
  ErrorLine,
  LANGUAGE_OPTIONS,
  OwnerActions,
  PrivateTag,
  SaveButton,
  SearchField,
} from "./shared";

/**
 * A word matches what somebody typed when its own spelling, its meaning or its
 * language does — the three things a member is likely to be holding in their head
 * when they come looking ("that Sanskrit word for bone", "the one that means
 * wasteful").
 */
export function matchesWord(word: Word, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [word.word, word.meaning, word.language]
    .filter(Boolean)
    .some((field) => (field as string).toLowerCase().includes(needle));
}

/**
 * Word Explorer: a search box, a way in, and the words themselves — a list of
 * names first, because a list of names is scannable in a way a wall of cards is
 * not, and everything a word knows on the word's own page.
 *
 * The list it shows is whatever the caller hands it, so the same surface serves
 * the Learn tab (every word the member can see) and a circle's Word Explorer
 * category (that circle's words, on the shelf being looked at).
 */
export function WordExplorer({
  store,
  userId,
  words,
  onAddWord,
  emptyTitle = "No words yet",
  emptyHint,
}: {
  store: ShareAndLearn;
  userId: string | null;
  words: Word[];
  /** Opens the add-word form; null when nobody is logged in to add one. */
  onAddWord: (() => void) | null;
  emptyTitle?: string;
  emptyHint?: string;
}) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Word | null>(null);
  const [error, setError] = useState<string | null>(null);

  function showError(err: unknown) {
    setError(err instanceof Error ? err.message : "Something went wrong.");
  }

  const found = useMemo(() => words.filter((word) => matchesWord(word, query)), [words, query]);
  const open = openId === null ? null : (words.find((word) => word.id === openId) ?? null);

  // A word that has just been opened is read on its own, so the list steps aside.
  if (open) {
    return (
      <>
        <button className="btn-text back-link" onClick={() => setOpenId(null)}>
          ← Word Explorer
        </button>
        <ErrorLine message={error} />
        <WordPage
          word={open}
          store={store}
          userId={userId}
          onEdit={() => setEditing(open)}
          onDelete={() => {
            setOpenId(null);
            store.removeWord(open.id).catch(showError);
          }}
          onError={showError}
        />
        {editing && (
          <WordModal
            word={editing}
            circles={store.circles}
            categories={store.categories}
            onClose={() => setEditing(null)}
            onSave={async (values) => {
              await store.editWord(editing.id, values);
              setEditing(null);
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="word-explorer-bar">
        <SearchField value={query} onChange={setQuery} placeholder="Search words…" />
        {onAddWord && (
          <button className="btn btn-primary" onClick={onAddWord}>
            + Add Word
          </button>
        )}
      </div>

      <ErrorLine message={error} />

      {words.length === 0 ? (
        <EmptyState glyph="🔤" title={emptyTitle}>
          {emptyHint ??
            (userId
              ? "Add a word you came across, with its meaning and an example."
              : "Log in to read the words members have collected, and to add your own.")}
        </EmptyState>
      ) : found.length === 0 ? (
        <EmptyState glyph="◦" title={`Nothing matches “${query.trim()}”`}>
          Words can be found by their spelling, their meaning or their language.
        </EmptyState>
      ) : (
        <section className="circle-section">
          <h2 className="section-title">
            {query.trim()
              ? `${found.length} ${found.length === 1 ? "match" : "matches"}`
              : "Recently Added"}
          </h2>
          <ul className="word-list">
            {found.map((word) => {
              // The first connection somebody offered, on the row itself: a member
              // scanning the list is usually after "which language, and what is it
              // there?", and that is the whole of the answer for most words.
              const connection = (word.connections ?? [])[0];
              return (
                <li key={word.id}>
                  <button className="word-row" onClick={() => setOpenId(word.id)}>
                    <span className="word-row-name">{word.word}</span>
                    {word.language && <span className="tag">{word.language}</span>}
                    {connection && (
                      <span className="word-row-connection">
                        {connection.language ? `${connection.language}: ` : ""}
                        {connection.term}
                      </span>
                    )}
                    {store.learnedWordIds.has(word.id) && (
                      <span className="tag tag-done">Learned</span>
                    )}
                    <PrivateTag visibility={word.visibility} />
                    <span className="word-row-chevron" aria-hidden="true">
                      ›
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

/** One labelled section of a word. Nothing renders when there is nothing to say. */
function WordSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="word-section">
      <p className="word-label">{label}</p>
      {children}
    </div>
  );
}

/** A row of words, for the synonyms and antonyms somebody bothered to add. */
function WordChips({ label, entries }: { label: string; entries: string[] }) {
  if (entries.length === 0) return null;
  return (
    <WordSection label={label}>
      <ul className="word-chips">
        {entries.map((entry) => (
          <li className="word-chip" key={entry}>
            {entry}
          </li>
        ))}
      </ul>
    </WordSection>
  );
}

/**
 * Everything one word knows, without the frame around it: the sections that exist
 * are shown and the ones nobody filled in are absent altogether — an empty
 * "Synonyms" heading says nothing except that the form had a field.
 *
 * It is separate from `WordPage` because a word turns up in more than one place
 * now. Word Explorer opens it as a page of its own, and a feed row in a circle
 * opens it underneath the row it was tapped on — a word has no route of its own,
 * so the alternative was sending the reader to the Learn tab and hoping they
 * found it again. Same word, same sections, one implementation.
 */
export function WordDetail({
  word,
  store,
  userId,
  onError,
}: {
  word: Word;
  store: ShareAndLearn;
  userId: string | null;
  onError: (err: unknown) => void;
}) {
  return (
    <>
      {word.language && (
        <WordSection label="Language">
          <p className="word-body">{word.language}</p>
        </WordSection>
      )}

      <WordSection label="Meaning">
        <p className="word-body">{word.meaning}</p>
      </WordSection>

      {word.example && (
        <WordSection label="Example">
          <p className="word-example">“{word.example}”</p>
        </WordSection>
      )}

      {word.pronunciation && (
        <WordSection label="Pronunciation">
          <p className="word-body">{word.pronunciation}</p>
        </WordSection>
      )}

      {word.notes && (
        <WordSection label="Notes">
          <p className="word-body">{word.notes}</p>
        </WordSection>
      )}

      <WordSection label="Added by">
        <p className="word-body">
          {word.memberName}
          <CircleChips circleIds={word.circleIds} circleById={store.circleById} />
        </p>
      </WordSection>

      <WordSection label="Date Added">
        <p className="word-body">{formatDate(word.createdAt)}</p>
      </WordSection>

      {word.source && (
        <WordSection label="Found in">
          <p className="word-body">{word.source}</p>
        </WordSection>
      )}

      <WordChips label="Synonyms" entries={word.synonyms ?? []} />
      <WordChips label="Antonyms" entries={word.antonyms ?? []} />

      <LanguageConnections
        word={word}
        userId={userId}
        canManage={canManageShare(store, userId, word)}
        onAdd={(values) => store.addWordConnection(word.id, values)}
        onRemove={(connectionId) => store.removeWordConnection(word.id, connectionId)}
        onError={onError}
      />
    </>
  );
}

/**
 * Everything one word knows. The sections that exist are shown and the ones
 * nobody filled in are absent altogether — an empty "Synonyms" heading says
 * nothing except that the form had a field.
 */
function WordPage({
  word,
  store,
  userId,
  onEdit,
  onDelete,
  onError,
}: {
  word: Word;
  store: ShareAndLearn;
  userId: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onError: (err: unknown) => void;
}) {
  const learned = store.learnedWordIds.has(word.id);

  return (
    <article className={learned ? "card word-page word-learned" : "card word-page"}>
      <header className="word-page-head">
        <h1 className="word-page-title">{word.word}</h1>
        <PrivateTag visibility={word.visibility} />
        {learned && <span className="tag tag-done">Learned</span>}
      </header>

      <WordDetail word={word} store={store} userId={userId} onError={onError} />

      <div className="card-actions">
        <ShareLinkButton
          itemType="word"
          itemId={word.id}
          name={word.word}
          blurb={`${word.word} — ${word.meaning} (shared by ${word.memberName} on Share & Learn.)`}
        />
        <SaveButton
          saved={store.savedKeys.has(`word:${word.id}`)}
          canSave={Boolean(userId)}
          onToggle={() => store.toggleSave("word", word.id).catch(onError)}
        />
        {userId && (
          <button
            className={learned ? "chip-button chip-active" : "chip-button"}
            onClick={() => store.toggleLearned(word.id).catch(onError)}
            aria-pressed={learned}
          >
            {learned ? "✓ Learned" : "Mark as learned"}
          </button>
        )}
        {/* The author, and whoever keeps a circle this word went into. */}
        {canManageShare(store, userId, word) && (
          <OwnerActions
            onEdit={onEdit}
            onDelete={onDelete}
            confirmNote={deleteNote(word.memberId === userId, "word", word.memberName)}
          />
        )}
        <PostActions store={store} userId={userId} itemType="word" item={word} />
      </div>
    </article>
  );
}

/**
 * The same word elsewhere: the Greek root, the German for it, the Hindi spelling.
 * Anybody who can see the word may add one, because a connection is something
 * another member knows rather than a change to what the author wrote. Whoever
 * added one can take it back, and so can the author of the word and whoever keeps
 * a circle the word went into.
 */
function LanguageConnections({
  word,
  userId,
  canManage,
  onAdd,
  onRemove,
  onError,
}: {
  word: Word;
  userId: string | null;
  /** Whether the reader answers for the word — its author, or a circle's keeper. */
  canManage: boolean;
  onAdd: (values: NewWordConnection) => Promise<WordConnection>;
  onRemove: (connectionId: number) => Promise<void>;
  onError: (err: unknown) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [language, setLanguage] = useState("");
  const [term, setTerm] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connections = word.connections ?? [];
  const canAdd = Boolean(userId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onAdd({ language: language.trim(), term: term.trim(), note: note.trim() });
      setLanguage("");
      setTerm("");
      setNote("");
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That connection could not be added.");
    } finally {
      setBusy(false);
    }
  }

  const form = adding && (
    <form className="connection-form" onSubmit={submit}>
      <div className="field-row">
        <ChoiceField
          label="Language"
          options={LANGUAGE_OPTIONS}
          value={language}
          onChange={setLanguage}
          emptyLabel="Pick a language"
          placeholder="Which language?"
          required
        />
        <label className="field">
          <span>The word in that language</span>
          <input
            required
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </label>
      </div>
      <label className="field">
        <span>How it connects (optional)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <ErrorLine message={error} />
      <div className="connection-form-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Adding…" : "Add connection"}
        </button>
        <button type="button" className="btn-text" onClick={() => setAdding(false)}>
          Cancel
        </button>
      </div>
    </form>
  );

  if (connections.length === 0) {
    return (
      <div className="word-section">
        <p className="word-label">Language connections</p>
        <p className="muted">No language connections yet.</p>
        {canAdd && !adding && (
          <button className="btn btn-ghost" onClick={() => setAdding(true)}>
            Add the first connection
          </button>
        )}
        {form}
      </div>
    );
  }

  return (
    <div className="word-section">
      <p className="word-label">Language connections</p>
      <ul className="connection-list">
        {connections.map((connection) => (
          <li className="connection" key={connection.id}>
            <p className="connection-language">{connection.language}</p>
            <p className="connection-term">{connection.term}</p>
            {connection.note && <p className="connection-note">{connection.note}</p>}
            <p className="connection-byline">Added by {connection.memberName}</p>
            {(connection.memberId === userId || canManage) && (
              <button
                className="connection-remove"
                aria-label={`Remove the ${connection.language} connection`}
                onClick={() => onRemove(connection.id).catch(onError)}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      {canAdd && !adding && (
        <button className="btn btn-ghost" onClick={() => setAdding(true)}>
          + Add Connection
        </button>
      )}
      {form}
    </div>
  );
}
