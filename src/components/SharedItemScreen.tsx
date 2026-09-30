// src/components/SharedItemScreen.tsx
// One item, read by somebody who was handed a link to it.
//
// This is the other half of sharing, and the whole point of the feature: the
// content is the invitation. So a recipient reads the thing itself — the recipe,
// the recording, the book somebody finished — before anybody asks them for
// anything, and the circle it came out of is offered underneath it afterwards.
// Nothing here redirects to a login screen, and nothing waits on an account.
//
// What it may show is decided entirely by the server: `GET /api/shared/:token`
// answers with one item and the shell of one circle, and there is no way to ask
// it for a second item, the roll, the folder's contents or anything else in
// there. So this screen has nothing to guard — it draws what it was given, and a
// token that no longer answers is simply a link that has stopped working.
//
// That includes the one case where it is given no item at all. A **private,
// invite-only** circle answers with the link's identity and nothing from inside
// it — the kind of thing, its name, who sent it — because its members were let in
// one at a time and a link is not an invitation. `locked` is that answer, and the
// page is then the frame around a note saying so — the footer under it is what
// names somebody to ask, since that differs by reader. Every other circle
// answers in full: Open to All and Ask to Join are both listed in the app for
// anybody to look at, so a link into one tells a recipient nothing they could not
// have found by looking.
//
// Three things here exist because this page is the one screen in the app a
// stranger meets first, so it may never be blank. The item's body is drawn inside
// its own `ErrorBoundary`, so a render fault costs the body and leaves the
// heading, the byline and the circle's offer on screen. The arrays it reads are
// read through `toArray()` rather than trusted, because they arrive over the wire
// and the bug that produced all of this was a `text` column reaching a `.join()`.
// And tapping "Create an account" writes the token down first, so the round trip
// through Identity's email comes back to this item rather than to the home page.
//
// It is deliberately store-less. Every reader of this page may have no account
// at all, so nothing on it can read `useShareAndLearn` — which is why the pieces
// it shares with the members' side are the store-free ones (`PhotoGallery`,
// `FieldAnswers`, `Stars`, `BookQuotes`, `toLines`) and the two things that
// cannot be borrowed — a recording's script panel and a post's translations —
// are drawn read-only from what the group has already had written.

import { useEffect, useState } from "react";
import type { User } from "@netlify/identity";
import {
  fetchSharedItem,
  formatDate,
  formatDuration,
  recipeMenuBits,
  sharedAudioUrl,
  LYRIC_SCRIPT_OPTIONS,
  POST_LANGUAGE_OPTIONS,
  type Book,
  type Bookmark,
  type Fact,
  type Post,
  type Recipe,
  type Remedy,
  type SharedCircle,
  type SharedThing,
  type SharedView,
  type Song,
  type Word,
} from "../api";
import { TOPICS } from "../feed";
import { BookQuotes, BuyLink, EmptyState, ErrorLine, PhotoGallery, Stars, toLines } from "./shared";
import { FieldAnswers } from "./CategoryFields";
import { ErrorBoundary } from "./ErrorBoundary";
import { InstallButton } from "./InstallPrompt";

/**
 * Where the token waits while somebody goes and makes an account.
 *
 * Signing in leaves the page: an OAuth provider navigates away, and the email
 * door comes back on Identity's own link, which lands on the site root carrying
 * `#recovery_token=…` — so the `#/shared/<token>` the reader arrived on is gone
 * by the time there is a session to use it. Written down, the shell can put them
 * back on the item they were reading, which is the whole of "continue the flow
 * afterwards".
 *
 * It is deliberately the same three functions `JoinScreen` keeps for a pending
 * invite, under its own key: the two intents are different — an invite says join
 * this circle, a share says read this one thing — and somebody could plausibly be
 * carrying both.
 */
const PENDING_SHARE_KEY = "share-and-learn:pending-share";

export function rememberPendingShare(token: string) {
  try {
    localStorage.setItem(PENDING_SHARE_KEY, token);
  } catch {
    /* Private browsing with storage blocked — the link still works in this tab. */
  }
}

export function pendingShare(): string | null {
  try {
    return localStorage.getItem(PENDING_SHARE_KEY);
  } catch {
    return null;
  }
}

export function forgetPendingShare() {
  try {
    localStorage.removeItem(PENDING_SHARE_KEY);
  } catch {
    /* Nothing to clean up. */
  }
}

/**
 * A list that arrived over the wire, read as a list whatever turned up.
 *
 * A word's synonyms and a book's quotes are one newline-joined `text` column in
 * Postgres and an array in the browser's types, and the normalisation between the
 * two is the server's job. It was missed on this route once, and `null.length`
 * during render took the entire page down — so this is the belt to that braces:
 * the payload is fixed, and a wrong shape now costs a missing line instead of the
 * screen.
 */
function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((one): one is string => typeof one === "string");
  if (typeof value === "string") {
    return value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return [];
}

/** What kind of thing this is, in words a recipient would use. */
const KIND_WORDS: Record<SharedThing["itemType"], string> = {
  song: "recording",
  recipe: "recipe",
  fact: "fun fact",
  word: "word",
  book: "book",
  remedy: "remedy",
  bookmark: "bookmark",
  post: "post",
};

function glyphFor(itemType: SharedThing["itemType"], item: SharedThing | null): string {
  if (item && item.itemType === "post" && item.categoryIcon) return item.categoryIcon;
  return TOPICS.find((topic) => topic.type === itemType)?.glyph ?? "✨";
}

/**
 * The heading, which is the item itself rather than its kind. A fun fact is its
 * own title — the whole of it is one sentence — so it is printed as the heading
 * and its source is all that is left underneath.
 */
function titleOf(item: SharedThing): string {
  switch (item.itemType) {
    case "song":
      return item.songName;
    case "fact":
      return item.fact;
    case "word":
      return item.word;
    default:
      return item.title;
  }
}

type JoinState = "idle" | "working" | "joined" | "requested";

export function SharedItemScreen({
  token,
  user,
  ready,
  myCircleIds,
  onLogIn,
  onJoin,
  onOpenCircle,
  onEnterApp,
}: {
  token: string | null;
  user: User | null;
  /** Whether the session has been settled, so the CTA is not drawn from a guess. */
  ready: boolean;
  /** The circles this reader is already in, so a member is offered the door instead. */
  myCircleIds: number[];
  onLogIn: () => void;
  /**
   * Joining goes through the app's own workflow and nothing else — a public
   * circle admits them, an "Ask to Join" one files a request for its admins, and
   * a private one refuses. There is no second membership path here.
   */
  onJoin: (circleId: number) => Promise<{ joined: boolean; requested: boolean }>;
  onOpenCircle: (circleId: number) => void;
  onEnterApp: () => void;
}) {
  const [view, setView] = useState<SharedView | null>(null);
  const [missing, setMissing] = useState(false);
  const [joining, setJoining] = useState<JoinState>("idle");
  const [problem, setProblem] = useState<string | null>(null);

  /* Keyed on who is asking as well as on what was asked for, because the answer
     is not the same for everybody: an invite-only circle's item arrives without
     its content for a stranger and with it for one of its members, so a reader
     who signs in on this very page has to ask again rather than keep the answer
     they were given as a visitor. */
  useEffect(() => {
    if (!token) {
      setMissing(true);
      return;
    }
    let live = true;
    setMissing(false);
    fetchSharedItem(token)
      .then((found) => {
        if (live) setView(found);
      })
      .catch(() => {
        if (live) setMissing(true);
      });
    return () => {
      live = false;
    };
  }, [token, user?.id]);

  /* They got where they were going, so the note that was holding the way back is
     no longer needed — left behind, it would pull them here again the next time
     they opened the app. */
  useEffect(() => {
    if (user && token) forgetPendingShare();
  }, [user, token]);

  if (missing) {
    return (
      <section className="shared-screen">
        <EmptyState glyph="🔗" title="This link is not available">
          Whoever shared it may have made it private again, or taken it out of the circle. Ask them
          for a fresh link.
        </EmptyState>
        <button className="btn btn-ghost" onClick={onEnterApp}>
          Go to Share &amp; Learn
        </button>
      </section>
    );
  }

  if (!view) {
    return (
      <section className="shared-screen">
        <p className="muted">Opening what was shared with you…</p>
      </section>
    );
  }

  const { item, circle, sharedByName } = view;
  const word = KIND_WORDS[view.itemType];

  async function join(circleId: number) {
    setProblem(null);
    setJoining("working");
    try {
      const answer = await onJoin(circleId);
      setJoining(answer.joined ? "joined" : answer.requested ? "requested" : "idle");
    } catch (err) {
      setJoining("idle");
      setProblem(err instanceof Error ? err.message : "That circle could not be joined.");
    }
  }

  const alreadyIn = circle !== null && (view.member || myCircleIds.includes(circle.id));

  /* Going off to make an account loses the hash — an OAuth provider navigates
     away and the email link comes back on Identity's own address — so the token
     is written down before the reader leaves, and the shell brings them back to
     this item once there is a session. */
  const logIn = () => {
    rememberPendingShare(view.token);
    onLogIn();
  };

  /* A locked link's heading is the item's own name where it has one, and its kind
     where it does not: a fun fact is one sentence and that sentence is the whole
     of it, so printing its "title" would be printing the content this page is
     withholding. */
  const heading =
    item === null
      ? (view.title ?? `A ${word} from ${circle ? circle.name : "Share & Learn"}`)
      : titleOf(item);

  return (
    <section className="shared-screen">
      <p className="join-eyebrow">
        {sharedByName} shared {item === null ? "a" : "this"} {word} with you
      </p>
      <h1 className="shared-title">
        <span aria-hidden="true">{glyphFor(view.itemType, item)}</span> {heading}
      </h1>
      {circle && <SharedFrom circle={circle} />}

      {item === null ? (
        <LockedNote circle={circle} word={word} />
      ) : (
        <>
          {/* The body is the one part of this page that reads an item's own shape,
              so it is the one part that can fault on an unexpected one. Boxed off
              here, a fault costs the body and leaves the heading, the byline and
              the way into the circle exactly where they were — which is what a
              recipient actually needs. */}
          <article className="shared-item">
            <ErrorBoundary
              where="shared-item"
              fallback={() => (
                <p className="muted">
                  This {word} could not be shown here. Opening it in the app should work.
                </p>
              )}
            >
              <SharedBody item={item} token={view.token} />
            </ErrorBoundary>
          </article>

          <p className="shared-byline">
            Shared by {item.memberName} · {formatDate(item.createdAt)}
          </p>
        </>
      )}

      <ErrorLine message={problem} />

      <footer className="shared-cta">
        {circle === null ? (
          <>
            <h2 className="shared-cta-title">Enjoyed this? There is a lot more of it.</h2>
            <p className="join-copy">
              Share &amp; Learn is where a group keeps the things it enjoys — songs they recorded,
              recipes worth cooking, books they finished, words worth knowing.
            </p>
            {ready && !user && (
              <button className="btn btn-primary" onClick={logIn}>
                Create an account
              </button>
            )}
            {ready && user && (
              <button className="btn btn-primary" onClick={onEnterApp}>
                Go to Share &amp; Learn
              </button>
            )}
          </>
        ) : (
          <>
            <h2 className="shared-cta-title">
              Enjoyed this? Discover more from {circle.icon} {circle.name}
            </h2>
            {circle.description && <p className="join-copy">{circle.description}</p>}
            <CircleCall
              circle={circle}
              ready={ready}
              user={user}
              alreadyIn={alreadyIn}
              state={joining}
              sharedByName={sharedByName}
              onLogIn={logIn}
              onJoin={() => join(circle.id)}
              onOpenCircle={() => onOpenCircle(circle.id)}
            />
          </>
        )}
        <InstallButton label="Keep Share & Learn on your phone" className="btn-text" />
      </footer>
    </section>
  );
}

/**
 * Where it came from, and where it sits in there. The folder trail is plain text
 * rather than a walk anybody can take: a recipient has not been let into the
 * circle, so naming the shelf is context and linking it would be a door.
 */
function SharedFrom({ circle }: { circle: SharedCircle }) {
  return (
    <p className="shared-from">
      Shared from <span aria-hidden="true">{circle.icon}</span>{" "}
      <strong>{circle.name}</strong>
      {circle.folderPath.length > 0 && (
        <span className="shared-from-path"> · {circle.folderPath.join(" › ")}</span>
      )}
    </p>
  );
}

/**
 * What stands in for the item when the link came out of an invite-only circle
 * and the reader is not in it.
 *
 * The share is still honoured as far as it can be: the kind of thing, its name
 * where it has one, the circle it came from and who sent it are all named, so a
 * recipient knows what they were handed and by whom rather than meeting a dead
 * link. What is withheld is the item's own words, which is the whole difference
 * between a circle whose door is open and one whose is not — the server never
 * sends them, so this is a rendering of an absence rather than a hidden element.
 *
 * It says why the item is not here and stops there. What to do next is the
 * footer's answer and differs by reader — an invitation to ask for, an account to
 * make first — so saying it twice would only be saying it differently.
 */
function LockedNote({ circle, word }: { circle: SharedCircle | null; word: string }) {
  return (
    <article className="shared-item shared-locked">
      <p className="shared-locked-glyph" aria-hidden="true">
        🔒
      </p>
      <p>
        {circle ? <strong>{circle.name}</strong> : <strong>This circle</strong>} is invite only, so
        this {word} stays inside it until you are one of its members.
      </p>
    </article>
  );
}

/**
 * The one button under the content, which is whatever this reader's own answer
 * to "can I join?" actually is. The rules are the circle's existing ones and are
 * enforced by the server either way: Open to All admits on the spot, Ask to Join
 * files a request for its admins, and a private circle has nothing to offer but
 * the name of somebody who could invite them.
 */
function CircleCall({
  circle,
  ready,
  user,
  alreadyIn,
  state,
  sharedByName,
  onLogIn,
  onJoin,
  onOpenCircle,
}: {
  circle: SharedCircle;
  ready: boolean;
  user: User | null;
  alreadyIn: boolean;
  state: JoinState;
  sharedByName: string;
  onLogIn: () => void;
  onJoin: () => void;
  onOpenCircle: () => void;
}) {
  if (!ready) return <p className="muted">One moment…</p>;

  if (state === "joined" || alreadyIn) {
    return (
      <div className="join-actions">
        <button className="btn btn-primary" onClick={onOpenCircle}>
          Open {circle.name}
        </button>
      </div>
    );
  }

  if (state === "requested") {
    return (
      <p className="join-copy">
        Your request is with {circle.name}’s admins. You will hear about it in the app once one of
        them answers.
      </p>
    );
  }

  if (!user) {
    return (
      <div className="join-actions">
        <button className="btn btn-primary" onClick={onLogIn}>
          {circle.privacy === "public" ? `Join ${circle.name}` : "Create an account"}
        </button>
        <p className="field-hint">
          {circle.privacy === "public"
            ? "One tap and you are in — everything shared there is yours to read."
            : circle.privacy === "discoverable"
              ? `${circle.name} approves its own members, so joining asks its admins first.`
              : `${circle.name} is invite only. Ask ${sharedByName} for an invitation once you have an account.`}
        </p>
      </div>
    );
  }

  if (circle.privacy === "private") {
    return (
      <p className="join-copy">
        {circle.name} is invite only, so there is nothing to join here — ask {sharedByName} to send
        you an invitation.
      </p>
    );
  }

  return (
    <div className="join-actions">
      <button className="btn btn-primary" onClick={onJoin} disabled={state === "working"}>
        {state === "working"
          ? "Just a moment…"
          : circle.privacy === "public"
            ? `Join ${circle.name}`
            : `Ask to join ${circle.name}`}
      </button>
      {circle.privacy === "discoverable" && (
        <p className="field-hint">{circle.name} approves its own members, so this asks first.</p>
      )}
    </div>
  );
}

/** The item itself, drawn the way its own detail page draws it, minus the title. */
function SharedBody({ item, token }: { item: SharedThing; token: string }) {
  switch (item.itemType) {
    case "song":
      return <SharedSong song={item} token={token} />;
    case "recipe":
      return <SharedRecipe recipe={item} />;
    case "book":
      return <SharedBook book={item} />;
    case "remedy":
      return <SharedRemedy remedy={item} />;
    case "fact":
      return <SharedFact fact={item} />;
    case "word":
      return <SharedWordEntry word={item} />;
    case "bookmark":
      return <SharedBookmark bookmark={item} />;
    case "post":
      return <SharedPost post={item} />;
  }
}

type Public<T> = Omit<T, "memberId" | "blobKey" | "circleIds" | "filings">;

function SharedSong({ song, token }: { song: Public<Song> & { hasAudio: boolean }; token: string }) {
  const bits = [song.composer, song.raga ? `Raga ${song.raga}` : null].filter(Boolean) as string[];
  const length = formatDuration(song.durationSeconds);
  if (length) bits.push(length);

  return (
    <>
      {bits.length > 0 && <p className="card-meta">{bits.join(" · ")}</p>}
      {song.hasAudio && (
        <audio controls preload="none" src={sharedAudioUrl(token)} className="song-detail-audio" />
      )}
      <SharedLyrics song={song} />
      <FieldAnswers values={song.fieldValues} />
      <PhotoGallery photos={song.photos} title={song.songName} />
    </>
  );
}

/**
 * The words of a recording, as written and in whatever scripts have already been
 * written for it. There is no button to ask for another one: a rendering may cost
 * a gateway call, which belongs to the group rather than to whoever was handed a
 * link, so a recipient reads what the group has read.
 */
function SharedLyrics({ song }: { song: Public<Song> }) {
  if (!song.lyrics) return null;
  const written = Array.isArray(song.lyricScripts) ? song.lyricScripts : [];
  return (
    <div className="lyrics-block">
      <h2 className="section-title">
        Lyrics{song.lyricsLanguage ? ` · ${song.lyricsLanguage}` : ""}
      </h2>
      <p className="lyrics-body">{song.lyrics}</p>
      {written.map((reading) => {
        const option = LYRIC_SCRIPT_OPTIONS.find((one) => one.id === reading.script);
        return (
          <div className="lyrics-rendered" key={reading.script}>
            <h3 className="section-title">
              {option ? `${option.native} ${option.label}` : reading.script}
            </h3>
            <p className="lyrics-body">{reading.body}</p>
          </div>
        );
      })}
    </div>
  );
}

function SharedRecipe({ recipe }: { recipe: Public<Recipe> }) {
  const bits = recipeMenuBits(recipe);
  if (recipe.prepMinutes) bits.push(`${recipe.prepMinutes} min`);

  return (
    <>
      {bits.length > 0 && <p className="card-meta">{bits.join(" · ")}</p>}
      <h2 className="section-title">Ingredients</h2>
      <ul className="bullet-list">
        {toLines(recipe.ingredients).map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ul>
      <h2 className="section-title">Method</h2>
      <ol className="step-list">
        {toLines(recipe.method).map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ol>
      {recipe.notes && (
        <>
          <h2 className="section-title">Notes</h2>
          <p className="recipe-notes">{recipe.notes}</p>
        </>
      )}
      <FieldAnswers values={recipe.fieldValues} />
      <PhotoGallery photos={recipe.photos} title={recipe.title} />
    </>
  );
}

function SharedBook({ book }: { book: Public<Book> }) {
  return (
    <>
      <p className="card-meta">
        {[book.genre, book.language].filter(Boolean).join(" · ")}
      </p>
      {book.author && <p className="book-author">by {book.author}</p>}
      <Stars rating={book.rating} />
      {book.review && <p className="book-review">{book.review}</p>}
      <BookQuotes title={book.title} quotes={toArray(book.quotes)} />
      <FieldAnswers values={book.fieldValues} />
      <PhotoGallery photos={book.photos} title={book.title} />
      <div className="card-actions">
        <BuyLink url={book.buyUrl} />
      </div>
    </>
  );
}

function SharedRemedy({ remedy }: { remedy: Public<Remedy> }) {
  return (
    <>
      <p className="card-meta">For {remedy.usedFor}</p>
      {remedy.passedDownFrom && (
        <p className="remedy-lineage">Passed down from {remedy.passedDownFrom}</p>
      )}
      <h2 className="section-title">Ingredients</h2>
      <ul className="bullet-list">
        {toLines(remedy.ingredients).map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ul>
      <h2 className="section-title">Preparation</h2>
      <ol className="step-list">
        {toLines(remedy.preparation).map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ol>
      {remedy.howToUse && (
        <>
          <h2 className="section-title">How to use</h2>
          <p className="recipe-notes">{remedy.howToUse}</p>
        </>
      )}
      {remedy.notes && (
        <>
          <h2 className="section-title">Notes</h2>
          <p className="recipe-notes">{remedy.notes}</p>
        </>
      )}
      <p className="health-note">
        Shared by a member of the group, not medical advice. Ask somebody qualified before trying
        it.
      </p>
      <PhotoGallery photos={remedy.photos} title={remedy.title} />
    </>
  );
}

function SharedFact({ fact }: { fact: Public<Fact> }) {
  return (
    <>
      <p className="card-meta">{fact.category}</p>
      {fact.source && <p className="card-meta">Source: {fact.source}</p>}
      <PhotoGallery photos={fact.photos} title="this fun fact" />
    </>
  );
}

function SharedWordEntry({ word }: { word: Public<Word> }) {
  const synonyms = toArray(word.synonyms);
  const antonyms = toArray(word.antonyms);
  const connections = Array.isArray(word.connections) ? word.connections : [];
  return (
    <>
      {word.language && <p className="card-meta">{word.language}</p>}
      <p className="word-body">{word.meaning}</p>
      {word.pronunciation && <p className="card-meta">Said: {word.pronunciation}</p>}
      {word.example && <p className="word-example">“{word.example}”</p>}
      {synonyms.length > 0 && <p className="card-meta">Synonyms: {synonyms.join(", ")}</p>}
      {antonyms.length > 0 && <p className="card-meta">Antonyms: {antonyms.join(", ")}</p>}
      {word.notes && <p className="recipe-notes">{word.notes}</p>}
      {connections.length > 0 && (
        <>
          <h2 className="section-title">In other languages</h2>
          <ul className="bullet-list">
            {connections.map((link) => (
              <li key={link.id}>
                {link.language}: {link.term}
                {link.note ? ` — ${link.note}` : ""}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function SharedBookmark({ bookmark }: { bookmark: Public<Bookmark> }) {
  return (
    <p className="card-link">
      <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
        {bookmark.url} ↗
      </a>
    </p>
  );
}

function SharedPost({
  post,
}: {
  post: Public<Post> & { categoryName: string | null; categoryIcon: string | null };
}) {
  const written = Array.isArray(post.translations) ? post.translations : [];
  return (
    <>
      {post.categoryName && <p className="card-meta">{post.categoryName}</p>}
      {post.body &&
        toLines(post.body).map((line, index) => (
          <p className="post-body" key={index}>
            {line}
          </p>
        ))}
      {written.map((reading) => {
        const option = POST_LANGUAGE_OPTIONS.find((one) => one.id === reading.language);
        return (
          <div className="translation-body" key={reading.language}>
            <h3 className="section-title">{option ? option.label : reading.language}</h3>
            {toLines(reading.body).map((line, index) => (
              <p className="post-body" key={index}>
                {line}
              </p>
            ))}
          </div>
        );
      })}
      <FieldAnswers values={post.fieldValues} />
      <PhotoGallery photos={post.photos} title={post.title} />
    </>
  );
}
