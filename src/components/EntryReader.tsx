import { useMemo } from "react";
import type { FeedEntry } from "../feed";
import type { ShareAndLearn } from "../store";
import { FieldAnswers } from "./CategoryFields";
import { IconButton } from "./Icons";
import { PostTranslations } from "./PostTranslations";
import { WordDetail } from "./WordExplorer";

/**
 * What the button on a feed row should actually do, which depends entirely on
 * whether the thing has somewhere to go.
 *
 * Three kinds have a page of their own — a recipe, a remedy and a book are opened
 * by navigating to them. A song plays where it sits. A post in a category a circle
 * invented has no route at all, and neither does a word: which word is open in
 * Word Explorer is component state rather than a hash, so there is no address to
 * send a reader to. Both therefore open underneath the row they were tapped on. A
 * fun fact is its own row — the title is the fact and the detail line names its
 * source — so there is nothing behind a button and it gets none. And a bookmark is
 * the one kind whose content is not in the app at all: opening it means leaving,
 * so its row is a link out rather than a panel that would hold the same address
 * again.
 *
 * This used to be a chain of `else if`s ending in a silent fallback, which sent
 * a word, a fact and a post to the Learn tab: three kinds leaving the circle
 * the reader was looking at, one of them by accident. Naming the four answers
 * means a new kind of share has to say which one it is rather than inheriting
 * whatever the last branch happened to be.
 */
export type EntryAction = "play" | "read" | "open" | "visit" | "none";

export function entryAction(entry: FeedEntry): EntryAction {
  switch (entry.itemType) {
    case "song":
      // A song shared as words alone has nothing to play, and a Play button whose
      // one outcome is a 404 is worse than no button — so its row is the whole of
      // it, the way a fun fact's row is.
      return entry.playable === false ? "none" : "play";
    case "post":
    case "word":
      return "read";
    case "recipe":
    case "remedy":
    case "book":
      return "open";
    case "bookmark":
      return "visit";
    case "fact":
      return "none";
  }
}

/**
 * What the button says, which is also what it is called when it says nothing.
 *
 * A play button is a triangle and no words — `entryActionButton()` below draws
 * that one — so this label is its `aria-label` and its tooltip rather than its
 * text. "Read" and "View" stay in words, because there is no shape that means
 * either, and a row of unlabelled squares would be a puzzle.
 */
export function entryActionLabel(action: EntryAction, open: boolean) {
  if (action === "play") return open ? "Stop the recording" : "Play the recording";
  if (action === "read") return open ? "Close" : "Read";
  if (action === "visit") return "Open link";
  return "View";
}

/**
 * The button itself, so both mixed feeds draw the same thing rather than each
 * deciding what a play control looks like. A recording gets the filled triangle
 * (a square while it is playing, which is the one shape that reads as "stop");
 * everything else keeps its word.
 */
export function EntryActionButton({
  action,
  open,
  onClick,
  href,
}: {
  action: EntryAction;
  open: boolean;
  onClick?: () => void;
  /** Only a "visit" needs one: the row is a link out rather than a control. */
  href?: string;
}) {
  const label = entryActionLabel(action, open);
  // A bookmark leaves the app, so it is an anchor and not a button dressed as
  // one — a link a reader can open in a new tab, copy or share the way they
  // expect to be able to. `noopener` because the destination is somebody else's.
  if (action === "visit") {
    return (
      <a
        className="chip-button chip-strong"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {label}
      </a>
    );
  }
  if (action === "play") {
    return (
      <IconButton
        icon={open ? "stop" : "play"}
        label={label}
        tone="strong"
        pressed={open}
        onClick={() => onClick?.()}
      />
    );
  }
  return (
    <button className="chip-button chip-strong" onClick={onClick}>
      {label}
    </button>
  );
}

/**
 * A post or a word opened in place, under the row it was tapped on. It is the
 * same content the surface of its own would show: a post's paragraphs, its
 * answers to its category's questions and the languages it can be read in, or
 * everything a word knows including its language connections, which anybody who
 * can see the word may add to from here.
 *
 * Anything else renders nothing, because anything else is either played, opened
 * on a page of its own, followed out of the app, or already entirely on the row.
 */
export function EntryDetail({
  entry,
  store,
  userId,
  onError,
}: {
  entry: FeedEntry;
  store: ShareAndLearn;
  userId: string | null;
  onError: (message: string) => void;
}) {
  const post = useMemo(
    () => (entry.itemType === "post" ? store.posts.find((row) => row.id === entry.id) : undefined),
    [entry.itemType, entry.id, store.posts],
  );
  const word = useMemo(
    () => (entry.itemType === "word" ? store.words.find((row) => row.id === entry.id) : undefined),
    [entry.itemType, entry.id, store.words],
  );

  if (post) {
    return (
      <>
        {post.body?.split(/\n{2,}/).map((paragraph, index) => (
          <p className="post-body" key={index}>
            {paragraph}
          </p>
        ))}
        <FieldAnswers values={post.fieldValues} />
        <PostTranslations post={post} store={store} />
      </>
    );
  }

  if (word) {
    return (
      <div className="feed-reading">
        <WordDetail
          word={word}
          store={store}
          userId={userId}
          onError={(err) => onError(err instanceof Error ? err.message : "That did not work.")}
        />
      </div>
    );
  }

  return null;
}
