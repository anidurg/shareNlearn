import { useMemo, useState } from "react";
import { formatDate, type Book, type Circle } from "../api";
import { inCircle } from "../feed";
import { canManageShare, deleteNote } from "../manage";
import type { ShareAndLearn } from "../store";
import {
  BookQuotes,
  BuyLink,
  Byline,
  EmptyState,
  ErrorLine,
  OwnerActions,
  PhotoGallery,
  PrivateTag,
  SaveButton,
  SearchField,
  Stars,
  TabHeader,
} from "./shared";
import { BookModal } from "./BookModal";
import { ShareLinkButton } from "./ShareLink";
import { FieldAnswers } from "./CategoryFields";
import { BuiltInFieldsButton } from "./ManageFields";
import { useGuidelinesGate } from "./Guidelines";
import { PostActions } from "./PostMenu";
import { BookConversation } from "./Discussions";
import { backFromOrigin, ItemTrail, MissingItemBack } from "./ItemLocation";
import type { ItemOrigin } from "../item-location";

export function BooksTab({
  store,
  userId,
  currentCircle,
  openBookId,
  origin,
  onOpenBook,
  onOpenPlace,
  onBackToList,
  onNeedsLogin,
}: {
  store: ShareAndLearn;
  userId: string | null;
  /** The circle in view; the listing is what that circle holds, not everything. */
  currentCircle: Circle | null;
  /**
   * One book opened on its own page. A book is the one kind that had no such
   * page: everything about it sat on its card, which read well enough on the
   * Books tab and left a feed row with nowhere to go — tapping one dropped the
   * reader on the whole books listing, out of the circle and the folder they
   * were reading in. So it has a page now, for the same reason a recipe does.
   */
  openBookId: number | null;
  /** The circle and folder the reader opened this book from, off the route. */
  origin: ItemOrigin;
  onOpenBook: (id: number) => void;
  /** Open a place in the app: a folder of a circle, or the circle itself. */
  onOpenPlace: (circleId: number, folderId: number | null) => void;
  onBackToList: () => void;
  onNeedsLogin: () => void;
}) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  // Asked once, before a member's first share of anything.
  const guidelines = useGuidelinesGate(store);
  const [editing, setEditing] = useState<Book | null>(null);
  const [error, setError] = useState<string | null>(null);

  // One book opened by id is looked up across everything the member may see: a
  // link is a link, and it should not break because another circle is in view.
  const open = openBookId ? store.books.find((item) => item.id === openBookId) : undefined;

  const circleId = currentCircle?.id ?? null;
  /** The books this circle holds. Everything below counts and searches this. */
  const here = useMemo(() => inCircle(store.books, circleId), [store.books, circleId]);

  const books = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return here;
    return here.filter((book) =>
      [book.title, book.author, book.genre, book.language, book.memberName, book.review]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(needle)),
    );
  }, [here, query]);

  /* Where Delete lands: the folder the reader came through, since the book's own
     filing goes with it. */
  const leaveItem = backFromOrigin(origin, onOpenPlace, onBackToList);

  function showError(err: unknown) {
    setError(err instanceof Error ? err.message : "Something went wrong.");
  }

  const modals = (
    <>
      {guidelines.gate}

      {adding && (
        <BookModal
          store={store}
          circles={store.circles}
          categories={store.categories}
          onClose={() => setAdding(false)}
          onSave={async (values) => {
            await store.addBook(values);
            setAdding(false);
          }}
        />
      )}
      {editing && (
        <BookModal
          book={editing}
          store={store}
          circles={store.circles}
          categories={store.categories}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            await store.editBook(editing.id, values);
            setEditing(null);
          }}
        />
      )}
    </>
  );

  if (openBookId && !open) {
    return (
      <>
        <EmptyState glyph="◦" title="That book is not available">
          It may have been removed, or kept private by whoever shared it.
        </EmptyState>
        <MissingItemBack
          store={store}
          origin={origin}
          onOpenPlace={onOpenPlace}
          onBackToList={onBackToList}
          listLabel="All books"
        />
      </>
    );
  }

  if (open) {
    return (
      <>
        {/* Where this book sits — the circle and the folders down to it — rather
            than the listing its kind belongs to. */}
        <ItemTrail
          store={store}
          item={open}
          origin={origin}
          circleInView={circleId}
          onOpenPlace={onOpenPlace}
          onBackToList={onBackToList}
          listLabel="All books"
        />
        <ErrorLine message={error} />
        <article className="card book-card">
          <h1 className="tab-title">
            <span aria-hidden="true">📖</span> {open.title}
            {open.genre && <span className="tag">{open.genre}</span>}
            {open.language && <span className="tag">{open.language}</span>}
            <PrivateTag visibility={open.visibility} />
          </h1>
          {open.author && <p className="book-author">by {open.author}</p>}
          <Stars rating={open.rating} />
          {open.review && <p className="book-review">{open.review}</p>}
          <BookQuotes title={open.title} quotes={open.quotes} />
          {/* Whatever the circle's own Books category asked about this one. */}
          <FieldAnswers values={open.fieldValues} />
          <PhotoGallery photos={open.photos} title={open.title} />
          <Byline
            memberName={open.memberName}
            createdAt={formatDate(open.createdAt)}
            circleIds={open.circleIds}
            circleById={store.circleById}
          />
          <BookConversation book={open} userId={userId} store={store} onError={showError} />
          <div className="card-actions">
            <BuyLink url={open.buyUrl} />
            <ShareLinkButton
              itemType="book"
              itemId={open.id}
              name={open.title}
              blurb={`${open.memberName} recommends “${open.title}”${
                open.author ? ` by ${open.author}` : ""
              } on Share & Learn.`}
              circleId={circleId}
            />
            <SaveButton
              saved={store.savedKeys.has(`book:${open.id}`)}
              canSave={Boolean(userId)}
              onToggle={() => store.toggleSave("book", open.id).catch(showError)}
              label="Add to my reading list"
              savedLabel="On my reading list"
            />
            <PostActions store={store} userId={userId} itemType="book" item={open} />
            {canManageShare(store, userId, open) && (
              <OwnerActions
                onEdit={() => setEditing(open)}
                onDelete={() => store.removeBook(open.id).then(leaveItem).catch(showError)}
                confirmNote={deleteNote(open.memberId === userId, "book", open.memberName)}
              />
            )}
          </div>
        </article>
        {modals}
      </>
    );
  }

  return (
    <>
      <TabHeader
        title="Books"
        subtitle={
          currentCircle
            ? `What ${currentCircle.name} has been reading — find your next one here.`
            : "What the group has been reading — find your next one here."
        }
        actions={
          userId ? (
            <>
              {/*
                What this circle's Books form asks, changed without being in the
                middle of adding a book. It draws for the circle's owner, its
                admins and the app admin and for nobody else, and answers null
                when no circle is in view, a form's shape belonging to one
                circle's copy of the category. Worded twice and shown once, the
                same pair every other heading in the app uses.
              */}
              <BuiltInFieldsButton
                store={store}
                itemType="book"
                circleId={circleId}
                className="btn btn-ghost tab-header-wide-action"
                label="Manage fields"
              />
              <BuiltInFieldsButton
                store={store}
                itemType="book"
                circleId={circleId}
                className="btn btn-ghost section-head-narrow-action"
                label="Fields"
              />
              <button
                className="btn btn-primary"
                onClick={() => guidelines.guard(() => setAdding(true))}
              >
                Add a book
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={onNeedsLogin}>
              Log in to share
            </button>
          )
        }
      />

      {here.length > 0 && (
        <div className="collection-bar">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search by title, author, genre, or language…"
          />
          <p className="collection-count">
            {books.length} {books.length === 1 ? "book" : "books"}
          </p>
        </div>
      )}

      <ErrorLine message={error} />

      {here.length === 0 && (
        <EmptyState glyph="📚" title={currentCircle ? `No books in ${currentCircle.name} yet` : "No books yet"}>
          {userId
            ? "Add the last book you finished — a line about why you liked it is enough to get someone else reading."
            : "Log in to see the books members have shared, and to add your own."}
        </EmptyState>
      )}

      {here.length > 0 && books.length === 0 && (
        <EmptyState glyph="◦" title={`Nothing matches “${query.trim()}”`}>
          Try another title, author, genre, or language.
        </EmptyState>
      )}

      <div className="card-list">
        {books.map((book) => (
          <article className="card book-card" key={book.id}>
            <h3 className="card-title">
              <span aria-hidden="true">📖</span> {book.title}
              {book.genre && <span className="tag">{book.genre}</span>}
              {book.language && <span className="tag">{book.language}</span>}
              <PrivateTag visibility={book.visibility} />
            </h3>
            {book.author && <p className="book-author">by {book.author}</p>}
            <Stars rating={book.rating} />
            {book.review && <p className="book-review">{book.review}</p>}
            <BookQuotes title={book.title} quotes={book.quotes} />
            {/*
              Whatever the circle's own Books category asked about this one — the
              shelf it came off, whether there is a copy to lend. A question nobody
              answered has no line, so a quiet card stays quiet.
            */}
            <FieldAnswers values={book.fieldValues} />
            <PhotoGallery photos={book.photos} title={book.title} compact />
            <Byline
              memberName={book.memberName}
              createdAt={formatDate(book.createdAt)}
              circleIds={book.circleIds}
              circleById={store.circleById}
            />
            <BookConversation book={book} userId={userId} store={store} onError={showError} />
            <div className="card-actions">
              <button className="chip-button chip-strong" onClick={() => onOpenBook(book.id)}>
                View book
              </button>
              <BuyLink url={book.buyUrl} />
              <ShareLinkButton
                itemType="book"
                itemId={book.id}
                name={book.title}
                blurb={`${book.memberName} recommends “${book.title}”${
                  book.author ? ` by ${book.author}` : ""
                } on Share & Learn.`}
                circleId={circleId}
              />
              <SaveButton
                saved={store.savedKeys.has(`book:${book.id}`)}
                canSave={Boolean(userId)}
                onToggle={() => store.toggleSave("book", book.id).catch(showError)}
                label="Add to my reading list"
                savedLabel="On my reading list"
              />
              {/*
                The author, and whoever keeps a circle this book went into: a
                circle's owner and its admins answer for what is in it.
              */}
              {canManageShare(store, userId, book) && (
                <OwnerActions
                  onEdit={() => setEditing(book)}
                  onDelete={() => store.removeBook(book.id).catch(showError)}
                  confirmNote={deleteNote(book.memberId === userId, "book", book.memberName)}
                />
              )}
              <PostActions store={store} userId={userId} itemType="book" item={book} />
            </div>
          </article>
        ))}
      </div>

      {modals}
    </>
  );
}
