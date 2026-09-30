import { useState } from "react";
import {
  formatDate,
  type Book,
  type Discussion,
  type DiscussionItemType,
  type Song,
} from "../api";
import { canManageShare } from "../manage";
import type { ShareAndLearn } from "../store";
import { ErrorLine } from "./shared";

/**
 * What the group says back about somebody's share. Two kinds of thing carry a
 * conversation — a book, where the question is usually about a chapter, and a
 * recording, where it is almost always "which raga is this?" — and both work the
 * same way, because a discussion is a contribution rather than an edit: any member
 * who can see the share may start a thread, join one, or close their own.
 *
 * **One mechanism, two surfaces**, the same trade `SongLyrics` makes with the words.
 * `ItemConversation` is the full panel, drawn where the share is the whole of the
 * page — a book card, a song's own page, a saved copy in My Library — with the counts
 * as chips over it. `ItemDiscussions` is the collapsed line for a listing row, where
 * the row's own detail line has already printed "💬 3" and what the reader wants is
 * the questions rather than a second count. Both open the same `ConversationBody`, so
 * a thread reads and answers identically wherever it was found.
 *
 * **Which kind can be discussed is a table rather than a component.** `DISCUSSABLE`
 * holds the wording each kind is asked in and nothing else is keyed on the kind, so
 * a third one is one entry here beside the one in `DISCUSSION_ITEM_TYPES` on the
 * server. `BookConversation` and `SongConversation` are that one component with the
 * kind filled in — the book's also carrying the like, which is a book's alone.
 *
 * **Nothing is drawn for a share with nothing to say.** A "💬 0 Discussions" chip is
 * an empty block wearing a count: where there are no threads the chip invites the
 * reader to start one, and where they could not write anyway it renders nothing at
 * all. A listing row goes quiet the same way, since a row is a list of what is there.
 */
interface Discussable {
  id: number;
  memberId: string;
  discussions?: Discussion[];
}

/** The one like button in the app, which is a book's alone. */
interface LikeControl {
  count: number;
  on: boolean;
  onToggle: () => void;
}

/**
 * The words each kind is asked its first question in. A recording and a book are the
 * same mechanism and a different sentence, which is the whole of the difference
 * between them here.
 */
const DISCUSSABLE: Record<DiscussionItemType, { placeholder: string; emptyInvite: string }> = {
  book: {
    placeholder: "Which chapter impacted you the most?",
    emptyInvite: "Ask the group something about this book.",
  },
  song: {
    placeholder: "Which raga is this based on?",
    emptyInvite: "Ask the group which raga this is based on.",
  },
};

/**
 * The threads themselves, the invitation when there are none, and the form that asks
 * the first question — everything behind whichever control opened it. It is deliberately
 * unaware of how it was reached: the counts on a detail page and the collapsed line on
 * a listing row are two ways of asking for the same panel, and a reply written in one
 * of them is the same reply.
 */
function ConversationBody({
  itemType,
  item,
  userId,
  store,
  onError,
}: {
  itemType: DiscussionItemType;
  item: Discussable;
  userId: string | null;
  store: ShareAndLearn;
  onError: (err: unknown) => void;
}) {
  const [starting, setStarting] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { placeholder, emptyInvite } = DISCUSSABLE[itemType];
  const discussions = item.discussions ?? [];
  const canWrite = Boolean(userId);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await store.startDiscussion(itemType, item.id, prompt.trim());
      setPrompt("");
      setStarting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That discussion could not be started.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="discussion-panel">
      {discussions.length === 0 && (
        <p className="muted">
          No discussions yet.{canWrite ? ` ${emptyInvite}` : ""}
        </p>
      )}

      {discussions.map((discussion) => (
        <DiscussionThread
          key={discussion.id}
          item={item}
          discussion={discussion}
          userId={userId}
          store={store}
          onError={onError}
        />
      ))}

      {canWrite && !starting && (
        <button className="btn btn-ghost" onClick={() => setStarting(true)}>
          {discussions.length === 0 ? "Start the first discussion" : "+ Start a discussion"}
        </button>
      )}

      {starting && (
        <form className="discussion-form" onSubmit={start}>
          <label className="field">
            <span>What do you want to ask the group?</span>
            <input
              required
              autoFocus
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={placeholder}
            />
          </label>
          <ErrorLine message={error} />
          <div className="discussion-form-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Starting…" : "Start discussion"}
            </button>
            <button type="button" className="btn-text" onClick={() => setStarting(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/**
 * The conversation where the share itself is what the page is about: the counts as
 * chips, and the threads under them.
 *
 * The chip is a statement of what is there rather than a permanent control. Where the
 * group has asked something it counts the questions; where it has not, it says
 * "Start a discussion", which is the only thing a reader could want from it; and where
 * there is nothing to read and this reader could not write anyway — somebody with no
 * account, looking at a quiet recording — the whole block goes, since a zero in a
 * chip is an empty block that has learned to count.
 */
export function ItemConversation({
  itemType,
  item,
  userId,
  store,
  onError,
  like,
}: {
  itemType: DiscussionItemType;
  item: Discussable;
  userId: string | null;
  store: ShareAndLearn;
  onError: (err: unknown) => void;
  like?: LikeControl;
}) {
  const [open, setOpen] = useState(false);

  const discussions = item.discussions ?? [];
  const canWrite = Boolean(userId);
  const asks = discussions.length > 0 || canWrite;

  if (!asks && !like) return null;

  return (
    <div className="conversation">
      <div className="conversation-counts">
        {asks && (
          <button
            className={open ? "count-chip count-chip-on" : "count-chip"}
            onClick={() => setOpen((was) => !was)}
            aria-expanded={open}
          >
            {discussions.length > 0
              ? `💬 ${discussions.length} ${discussions.length === 1 ? "Discussion" : "Discussions"}`
              : "💬 Start a discussion"}
          </button>
        )}
        {like && (
          <button
            className={like.on ? "count-chip count-chip-on" : "count-chip"}
            onClick={() => {
              if (!canWrite) return;
              like.onToggle();
            }}
            aria-pressed={like.on}
            disabled={!canWrite}
            title={canWrite ? undefined : "Log in to like this"}
          >
            👍 {like.count} {like.count === 1 ? "Like" : "Likes"}
          </button>
        )}
      </div>

      {open && asks && (
        <ConversationBody
          itemType={itemType}
          item={item}
          userId={userId}
          store={store}
          onError={onError}
        />
      )}
    </div>
  );
}

/**
 * The same conversation on a listing row, collapsed to one line — the shape a
 * recording's words already take there, and for the same reason: a row is a list of
 * what the circle holds, and a thread with four replies in it is not a line of a list.
 *
 * It renders **only when there is something to read**. The row's own detail line
 * already prints "💬 3", so this is the way to the questions rather than a second
 * count of them, and a row with no questions says nothing here at all — starting one
 * belongs on the share's own page, where the reader has said the share is what they
 * came for.
 */
export function ItemDiscussions({
  itemType,
  item,
  userId,
  store,
  onError,
}: {
  itemType: DiscussionItemType;
  item: Discussable;
  userId: string | null;
  store: ShareAndLearn;
  onError: (err: unknown) => void;
}) {
  const [open, setOpen] = useState(false);

  const discussions = item.discussions ?? [];
  if (discussions.length === 0) return null;

  return (
    <div className="discussion-block">
      <button
        type="button"
        className="details-toggle"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
      >
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
        <span className="details-toggle-label">Discussion</span>
        <span className="details-toggle-note">
          {discussions.length === 1
            ? "1 question the group asked"
            : `${discussions.length} questions the group asked`}
        </span>
      </button>

      {open && (
        <div className="discussion-details">
          <ConversationBody
            itemType={itemType}
            item={item}
            userId={userId}
            store={store}
            onError={onError}
          />
        </div>
      )}
    </div>
  );
}

/**
 * The discussions on a book and the likes it has collected — the two counts that
 * read on every book card.
 */
export function BookConversation({
  book,
  userId,
  store,
  onError,
}: {
  book: Book;
  userId: string | null;
  store: ShareAndLearn;
  onError: (err: unknown) => void;
}) {
  return (
    <ItemConversation
      itemType="book"
      item={book}
      userId={userId}
      store={store}
      onError={onError}
      like={{
        count: book.likeCount ?? 0,
        on: Boolean(book.likedByMe),
        onToggle: () => store.toggleBookLike(book.id).catch(onError),
      }}
    />
  );
}

/**
 * The same panel under a recording, which is where the group works out what it is:
 * the raga, the composer somebody half-remembers, where the version came from. A
 * recording has no like button, so the row carries the one count.
 */
export function SongConversation({
  song,
  userId,
  store,
  onError,
}: {
  song: Song;
  userId: string | null;
  store: ShareAndLearn;
  onError: (err: unknown) => void;
}) {
  return (
    <ItemConversation
      itemType="song"
      item={song}
      userId={userId}
      store={store}
      onError={onError}
    />
  );
}

/**
 * One question and everything said back to it. The replies read oldest first, the
 * way a conversation happened, and the head count is of people rather than replies:
 * one member answering three times is still one person who joined.
 */
function DiscussionThread({
  item,
  discussion,
  userId,
  store,
  onError,
}: {
  item: Discussable;
  discussion: Discussion;
  userId: string | null;
  store: ShareAndLearn;
  onError: (err: unknown) => void;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canWrite = Boolean(userId);
  // Whoever answers for the share the thread hangs on: its author, and the people
  // who keep a circle it went into. They may close a thread and take a reply back,
  // which is the same rule the server applies and the reason a question asked in
  // somebody's circle can be tidied up there.
  const keeper = canManageShare(store, userId, item);
  const mayClose = discussion.memberId === userId || keeper;

  async function reply(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await store.replyToDiscussion(discussion.id, body.trim());
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That reply could not be added.");
    } finally {
      setBusy(false);
    }
  }

  // A summary is worth asking for when there is none yet, or when the thread has
  // grown past the one that is cached.
  const wantsSummary = discussion.summarizable && (!discussion.summary || discussion.summaryStale);

  async function summarize() {
    setSummarizing(true);
    setError(null);
    try {
      await store.summarizeDiscussion(discussion.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That discussion could not be summarised.");
    } finally {
      setSummarizing(false);
    }
  }

  return (
    <section className="discussion">
      <div className="discussion-head">
        <p className="discussion-prompt">“{discussion.prompt}”</p>
        {mayClose && (
          <button
            className="connection-remove"
            aria-label="Close this discussion"
            onClick={() =>
              store
                .removeDiscussion(discussion.itemType, discussion.itemId, discussion.id)
                .catch(onError)
            }
          >
            ×
          </button>
        )}
      </div>
      <p className="discussion-byline">
        Started by {discussion.memberName} · {formatDate(discussion.createdAt)}
      </p>
      {discussion.participantCount > 0 && (
        <p className="discussion-joined">
          {discussion.participantCount}{" "}
          {discussion.participantCount === 1 ? "person has" : "people have"} joined the discussion.
        </p>
      )}

      {discussion.summary && (
        <div className="discussion-summary">
          <p className="discussion-summary-label">
            Discussion Summary
            {discussion.summaryStale && <span className="tag">Behind the thread</span>}
          </p>
          <ul>
            {discussion.summary
              .split("\n")
              .filter((line) => line.trim().length > 0)
              .map((line) => (
                <li key={line}>{line}</li>
              ))}
          </ul>
        </div>
      )}

      {discussion.replies.length > 0 && (
        <ul className="reply-list">
          {discussion.replies.map((entry) => (
            <li className="reply" key={entry.id}>
              <p className="reply-body">{entry.body}</p>
              <p className="reply-byline">
                {entry.memberName} · {formatDate(entry.createdAt)}
              </p>
              {(entry.memberId === userId || discussion.memberId === userId || keeper) && (
                <button
                  className="connection-remove"
                  aria-label={`Remove ${entry.memberName}'s reply`}
                  onClick={() =>
                    store.removeDiscussionReply(discussion.id, entry.id).catch(onError)
                  }
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ErrorLine message={error} />

      {canWrite && (
        <form className="discussion-form" onSubmit={reply}>
          <label className="field">
            <span>Your answer</span>
            <textarea
              required
              rows={2}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Join the discussion…"
            />
          </label>
          <div className="discussion-form-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Adding…" : "Reply"}
            </button>
            {wantsSummary && (
              <button
                type="button"
                className="btn-text"
                onClick={summarize}
                disabled={summarizing}
              >
                {summarizing
                  ? "Summarising…"
                  : discussion.summary
                    ? "Update the summary"
                    : "Summarise this discussion"}
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
