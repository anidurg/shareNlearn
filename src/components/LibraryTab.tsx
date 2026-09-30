import { useState } from "react";
import { audioUrl, formatDate, formatDuration, type ItemType } from "../api";
import { canManageShare } from "../manage";
import type { ShareAndLearn } from "../store";
import {
  BookQuotes,
  BuyLink,
  EmptyState,
  ErrorLine,
  HealthNote,
  PhotoGallery,
  Stars,
  TabHeader,
} from "./shared";
import { BookConversation, SongConversation } from "./Discussions";
import { FieldAnswers } from "./CategoryFields";
import { IconButton } from "./Icons";
import { SongLyrics } from "./SongLyrics";
import { ExperienceCount } from "./Experiences";
import { PostActions } from "./PostMenu";
import { ShareLinkButton } from "./ShareLink";
import { PostTranslations } from "./PostTranslations";

const SECTIONS: { type: ItemType; label: string; glyph: string }[] = [
  { type: "song", label: "Saved Songs", glyph: "🎵" },
  { type: "recipe", label: "Saved Recipes", glyph: "🍲" },
  { type: "fact", label: "Saved Facts", glyph: "💡" },
  { type: "word", label: "Saved Words", glyph: "🔤" },
  { type: "book", label: "Reading List", glyph: "📚" },
  { type: "remedy", label: "Saved Remedies", glyph: "🌱" },
  { type: "bookmark", label: "Saved Bookmarks", glyph: "🔗" },
  { type: "post", label: "Saved Posts", glyph: "📌" },
];

/**
 * Removing something here only takes it out of this member's library. Deleting
 * the original is a separate action, available to whoever shared it.
 */
export function LibraryTab({
  store,
  userId,
  onOpenRecipe,
  onOpenRemedy,
  onOpenBook,
  onNeedsLogin,
}: {
  store: ShareAndLearn;
  userId: string | null;
  /**
   * Open one saved item on its own page. No folder travels with any of these,
   * and that is the honest answer rather than a gap: a library is nobody's
   * circle — what somebody saved outlives the circle it came from — so where the
   * thing sits is a question for the item's own filing, which is exactly what
   * its page falls back to.
   */
  onOpenRecipe: (id: number) => void;
  onOpenRemedy: (id: number) => void;
  onOpenBook: (id: number) => void;
  onNeedsLogin: () => void;
}) {
  const [active, setActive] = useState<ItemType>("song");
  const [error, setError] = useState<string | null>(null);

  function showError(err: unknown) {
    setError(err instanceof Error ? err.message : "Something went wrong.");
  }

  if (!userId) {
    return (
      <>
        <TabHeader title="My Library" />
        <EmptyState glyph="🔖" title="Your library is waiting">
          <button className="btn-text" onClick={onNeedsLogin}>
            Log in
          </button>{" "}
          to keep the songs, recipes, facts, words, books, remedies and links you want to come back
            to.
        </EmptyState>
      </>
    );
  }

  /**
   * A library keeps what a member saved even after they leave the circle it was
   * shared into, so the rows come from the server's own copy of the saved items.
   * Anything just saved from a visible listing is folded in as well, so the
   * library fills in straight away rather than waiting for the next reload.
   */
  function saved<T extends { id: number }>(type: ItemType, stored: T[] | undefined, visible: T[]) {
    const ids = new Set(
      store.saves.filter((save) => save.itemType === type).map((save) => save.itemId),
    );
    const rows = (stored ?? []).filter((row) => ids.has(row.id));
    const have = new Set(rows.map((row) => row.id));
    return [...rows, ...visible.filter((row) => ids.has(row.id) && !have.has(row.id))];
  }

  const songs = saved("song", store.libraryItems.song, store.songs);
  const recipes = saved("recipe", store.libraryItems.recipe, store.recipes);
  const facts = saved("fact", store.libraryItems.fact, store.facts);
  const words = saved("word", store.libraryItems.word, store.words);
  const books = saved("book", store.libraryItems.book, store.books);
  const remedies = saved("remedy", store.libraryItems.remedy, store.remedies);
  const bookmarks = saved("bookmark", store.libraryItems.bookmark, store.bookmarks);
  const posts = saved("post", store.libraryItems.post, store.posts);
  const counts: Record<ItemType, number> = {
    song: songs.length,
    recipe: recipes.length,
    fact: facts.length,
    word: words.length,
    book: books.length,
    remedy: remedies.length,
    bookmark: bookmarks.length,
    post: posts.length,
  };

  /**
   * A member who has saved nothing at all — everybody, on their first day — is
   * told that once, rather than being handed seven shelves reading (0) and asked
   * to pick one.
   */
  const savedAnything = SECTIONS.some((section) => counts[section.type] > 0);

  /**
   * Taking something off the shelf, which is the filled bookmark tapped a second
   * time — the same control that put it there, in the same state it was left in,
   * so the two halves of saving read as one toggle rather than as two unrelated
   * buttons. The wording each caller passes is the accessible name and the
   * tooltip, since there is no visible text to carry it.
   */
  function removeButton(type: ItemType, id: number, label = "Remove from My Library") {
    return (
      <IconButton
        icon="bookmark-filled"
        label={label}
        tone="on"
        pressed
        onClick={() => store.toggleSave(type, id).catch(showError)}
      />
    );
  }

  /**
   * Passing something on from one's own shelf, which is where a member most often
   * re-reads a thing worth sending. No circle travels with it: a saved copy
   * outlives the circle it came from, so the link speaks for whichever of the
   * item's own audiences the sharer is still in.
   */
  function shareButton(type: ItemType, id: number, name: string, blurb: string, kindWord?: string) {
    return (
      <ShareLinkButton
        itemType={type}
        itemId={id}
        name={name}
        blurb={blurb}
        kindWord={kindWord}
      />
    );
  }

  /**
   * The ⋮ on a saved copy. A member reads a share here as much as anywhere else,
   * so the same three choices belong on it — and hiding one takes it out of both
   * this shelf and the listings it came from.
   */
  function postMenu(type: ItemType, item: { id: number; memberId: string; memberName: string }) {
    return <PostActions store={store} userId={userId} itemType={type} item={item} />;
  }

  return (
    <>
      <TabHeader
        title="My Library"
        subtitle="Everything you saved stays here, even if you leave the circle it came from."
      />

      {savedAnything && (
        <div className="sub-tabs" role="tablist">
          {SECTIONS.map((section) => (
            <button
              key={section.type}
              role="tab"
              aria-selected={active === section.type}
              className={active === section.type ? "sub-tab sub-tab-active" : "sub-tab"}
              onClick={() => setActive(section.type)}
            >
              {section.label} ({counts[section.type]})
            </button>
          ))}
        </div>
      )}

      <ErrorLine message={error} />

      {/* The saved-remedies list is health-adjacent too, so it carries the same note. */}
      {active === "remedy" && remedies.length > 0 && <HealthNote compact />}

      {!savedAnything && (
        <EmptyState glyph="🔖" title="No items saved yet">
          Tap the bookmark on anything the group shares — a song, a recipe, a fact, a word, a book,
          a remedy or a link — and it lands here, yours to come back to.
        </EmptyState>
      )}

      {savedAnything && counts[active] === 0 && (
        <EmptyState
          glyph={SECTIONS.find((section) => section.type === active)!.glyph}
          title="Nothing saved here yet"
        >
          Tap the bookmark on anything the group shares and it lands here.
        </EmptyState>
      )}

      <div className="card-list">
        {active === "song" &&
          songs.map((song) => (
            <article className="card" key={song.id}>
              <h3 className="card-title">
                <span aria-hidden="true">🎵</span> {song.songName}
              </h3>
              <p className="byline">
                Shared by {song.memberName}
                {formatDuration(song.durationSeconds)
                  ? ` · ${formatDuration(song.durationSeconds)}`
                  : ""}
              </p>
              {/* A song may be words alone, in which case there is nothing to play. */}
              {song.blobKey && (
                <audio controls preload="none" src={audioUrl(song.id, song.blobKey)} className="card-audio" />
              )}
              <SongLyrics song={song} store={store} canEdit={canManageShare(store, userId, song)} />
              <PhotoGallery photos={song.photos} title={song.songName} compact />
              <SongConversation song={song} userId={userId} store={store} onError={showError} />
              <div className="card-actions">
                {shareButton(
                  "song",
                  song.id,
                  song.songName,
                  `${song.memberName} shared “${song.songName}” on Share & Learn.`,
                  "recording",
                )}
                {removeButton("song", song.id)}
                {postMenu("song", song)}
              </div>
            </article>
          ))}

        {active === "recipe" &&
          recipes.map((recipe) => (
            <article className="card" key={recipe.id}>
              <h3 className="card-title">
                <span aria-hidden="true">🍲</span> {recipe.title}
              </h3>
              <p className="byline">Shared by {recipe.memberName}</p>
              {/* The answers travel with a saved copy, so a recipe still says
                  who can eat it long after the member left the circle that
                  asked. */}
              <FieldAnswers values={recipe.fieldValues} />
              <PhotoGallery photos={recipe.photos} title={recipe.title} compact />
              <ExperienceCount experiences={recipe.experiences} />
              <div className="card-actions">
                <button className="chip-button chip-strong" onClick={() => onOpenRecipe(recipe.id)}>
                  View recipe
                </button>
                {shareButton(
                  "recipe",
                  recipe.id,
                  recipe.title,
                  `${recipe.memberName} shared a recipe for ${recipe.title} on Share & Learn.`,
                )}
                {removeButton("recipe", recipe.id)}
                {postMenu("recipe", recipe)}
              </div>
            </article>
          ))}

        {active === "fact" &&
          facts.map((fact) => (
            <article className="card fact-card" key={fact.id}>
              <p className="fact-eyebrow">
                Did you know? <span className="tag">{fact.category}</span>
              </p>
              <p className="fact-body">{fact.fact}</p>
              <PhotoGallery photos={fact.photos} title="This fun fact" compact />
              <p className="byline">
                Shared by {fact.memberName} · {formatDate(fact.createdAt)}
              </p>
              <div className="card-actions">
                {shareButton(
                  "fact",
                  fact.id,
                  fact.fact,
                  `${fact.fact} — shared by ${fact.memberName} on Share & Learn.`,
                )}
                {removeButton("fact", fact.id)}
                {postMenu("fact", fact)}
              </div>
            </article>
          ))}

        {active === "word" &&
          words.map((word) => (
            <article className="card word-card" key={word.id}>
              <h3 className="card-title">
                {word.word}
                {store.learnedWordIds.has(word.id) && <span className="tag tag-done">Learned</span>}
              </h3>
              <p className="word-body">{word.meaning}</p>
              <p className="byline">Added by {word.memberName}</p>
              <div className="card-actions">
                <button
                  className={
                    store.learnedWordIds.has(word.id) ? "chip-button chip-active" : "chip-button"
                  }
                  onClick={() => store.toggleLearned(word.id).catch(showError)}
                >
                  {store.learnedWordIds.has(word.id) ? "✓ Learned" : "Mark as learned"}
                </button>
                {shareButton(
                  "word",
                  word.id,
                  word.word,
                  `${word.word} — ${word.meaning} (shared by ${word.memberName} on Share & Learn.)`,
                )}
                {removeButton("word", word.id)}
                {postMenu("word", word)}
              </div>
            </article>
          ))}

        {active === "book" &&
          books.map((book) => (
            <article className="card book-card" key={book.id}>
              <h3 className="card-title">
                <span aria-hidden="true">📖</span> {book.title}
                {book.genre && <span className="tag">{book.genre}</span>}
                {book.language && <span className="tag">{book.language}</span>}
              </h3>
              {book.author && <p className="book-author">by {book.author}</p>}
              <Stars rating={book.rating} />
              {book.review && <p className="book-review">{book.review}</p>}
              <BookQuotes title={book.title} quotes={book.quotes} />
              {/* The answers travel with the saved copy, so a book still reads
                  properly long after the member has left the circle that asked. */}
              <FieldAnswers values={book.fieldValues} />
              <PhotoGallery photos={book.photos} title={book.title} compact />
              <p className="byline">
                Recommended by {book.memberName} · {formatDate(book.createdAt)}
              </p>
              <BookConversation book={book} userId={userId} store={store} onError={showError} />
              <div className="card-actions">
                <button className="chip-button chip-strong" onClick={() => onOpenBook(book.id)}>
                  View book
                </button>
                <BuyLink url={book.buyUrl} />
                {shareButton(
                  "book",
                  book.id,
                  book.title,
                  `${book.memberName} recommends “${book.title}”${
                    book.author ? ` by ${book.author}` : ""
                  } on Share & Learn.`,
                )}
                {removeButton("book", book.id, "Remove from reading list")}
                {postMenu("book", book)}
              </div>
            </article>
          ))}

        {active === "remedy" &&
          remedies.map((remedy) => (
            <article className="card remedy-card" key={remedy.id}>
              <p className="remedy-used-for">
                <span aria-hidden="true">🌱</span> Used for: {remedy.usedFor}
              </p>
              <h3 className="card-title">{remedy.title}</h3>
              {remedy.passedDownFrom && (
                <p className="remedy-lineage">Passed down from {remedy.passedDownFrom}</p>
              )}
              <p className="byline">
                Shared by {remedy.memberName} · {formatDate(remedy.createdAt)}
              </p>
              <PhotoGallery photos={remedy.photos} title={remedy.title} compact />
              <ExperienceCount experiences={remedy.experiences} />
              <div className="card-actions">
                <button className="chip-button chip-strong" onClick={() => onOpenRemedy(remedy.id)}>
                  View remedy
                </button>
                {shareButton(
                  "remedy",
                  remedy.id,
                  remedy.title,
                  `${remedy.memberName} shared a remedy for ${remedy.usedFor}: ${remedy.title} on Share & Learn.`,
                )}
                {removeButton("remedy", remedy.id)}
                {postMenu("remedy", remedy)}
              </div>
            </article>
          ))}

        {/* A saved link is its destination, so the row is the address itself —
            opened in a new tab, because leaving the app is what a bookmark is for. */}
        {active === "bookmark" &&
          bookmarks.map((bookmark) => (
            <article className="card" key={bookmark.id}>
              <h3 className="card-title">
                <span aria-hidden="true">🔗</span> {bookmark.title}
              </h3>
              <p className="card-link">
                <a
                  className="field-link"
                  href={bookmark.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {bookmark.url}
                </a>
              </p>
              <p className="byline">
                Shared by {bookmark.memberName} · {formatDate(bookmark.createdAt)}
              </p>
              <div className="card-actions">
                {shareButton(
                  "bookmark",
                  bookmark.id,
                  bookmark.title,
                  `${bookmark.memberName} shared “${bookmark.title}” on Share & Learn.`,
                )}
                {removeButton("bookmark", bookmark.id)}
                {postMenu("bookmark", bookmark)}
              </div>
            </article>
          ))}

        {/* A post keeps its category's name, which is the only label it has. */}
        {active === "post" &&
          posts.map((post) => {
            const category = store.categoryById.get(post.categoryId);
            return (
              <article className="card" key={post.id}>
                <h3 className="card-title">
                  <span aria-hidden="true">{category?.icon ?? "📌"}</span> {post.title}
                  {category && <span className="tag">{category.name}</span>}
                </h3>
                {post.body && <p className="post-body">{post.body}</p>}
                <FieldAnswers values={post.fieldValues} />
                <PostTranslations post={post} store={store} />
                <PhotoGallery photos={post.photos} title={post.title} compact />
                <p className="byline">
                  Shared by {post.memberName} · {formatDate(post.createdAt)}
                </p>
                <div className="card-actions">
                  {shareButton(
                    "post",
                    post.id,
                    post.title,
                    `${post.memberName} shared “${post.title}” on Share & Learn.`,
                  )}
                  {removeButton("post", post.id)}
                  {postMenu("post", post)}
                </div>
              </article>
            );
          })}
      </div>
    </>
  );
}
