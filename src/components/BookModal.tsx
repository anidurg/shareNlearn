import { useState } from "react";
import {
  photoKeys,
  type Book,
  type Circle,
  type CircleCategory,
  type ItemPhoto,
  type SharedBook,
  type ShelfChoice,
  type Visibility,
} from "../api";
import { currentFiledCategoryId, currentShelfChoice } from "../categories";
import { currentFolderPath, type ShareTarget } from "../folders";
import type { SharePrefill } from "../incoming-share";
import type { ShareAndLearn } from "../store";
import { BookFields, initialAnswers } from "./CategoryFields";
import {
  ChoiceField,
  ErrorLine,
  LANGUAGE_OPTIONS,
  Modal,
  PhotoField,
  SharedInNote,
  SharingIntoNote,
  ShelfField,
  VisibilityPicker,
} from "./shared";

const GENRES = [
  "Fiction",
  "Non-fiction",
  "Mystery",
  "Biography",
  "History",
  "Science",
  "Poetry",
  "Music",
  "Spiritual",
  "Children's",
];

/** Matches the server's cap so the form can't offer more boxes than it will keep. */
const MAX_QUOTES = 20;

/** Members paste "amazon.com/…" as often as a full URL, so a missing scheme is fine. */
function looksLikeUrl(value: string) {
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".");
  } catch {
    return false;
  }
}

export function BookModal({
  book,
  store,
  circles = [],
  categories = [],
  presetCircleIds = [],
  folder = null,
  prefill,
  onClose,
  onSave,
}: {
  book?: Book;
  /**
   * Read for the extra questions the chosen circles ask about a book, and for who
   * may add one — a circle's own people, never a plain member.
   */
  store: ShareAndLearn;
  /** The circles the member belongs to, so a book can be shared into them. */
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
  onSave: (values: SharedBook) => Promise<unknown>;
}) {
  const [title, setTitle] = useState(book?.title ?? prefill?.title ?? "");
  const [author, setAuthor] = useState(book?.author ?? "");
  const [genre, setGenre] = useState(book?.genre ?? "");
  const [language, setLanguage] = useState(book?.language ?? "");
  const [rating, setRating] = useState<number | null>(book?.rating ?? null);
  const [review, setReview] = useState(book?.review ?? prefill?.note ?? "");
  const [quotes, setQuotes] = useState<string[]>(
    book?.quotes && book.quotes.length > 0 ? book.quotes : [""],
  );
  const [buyUrl, setBuyUrl] = useState(book?.buyUrl ?? prefill?.url ?? "");
  const [visibility, setVisibility] = useState<Visibility>(book?.visibility ?? "shared");
  const [circleIds, setCircleIds] = useState<number[]>(book?.circleIds ?? presetCircleIds);
  const [shelf, setShelf] = useState<ShelfChoice>(currentShelfChoice(categories, book));
  const [filedCategoryId, setFiledCategoryId] = useState<number | null>(
    currentFiledCategoryId(book),
  );

  // Where the share already sits, when it is being edited rather than shared: a
  // folder is the filing, so the form states it instead of offering the old shelf
  // picker and inviting a second answer to a question already answered.
  const filedIn = currentFolderPath(book);
  // Whether the form asks about filing at all. Where it does not, the shelf keys
  // are left out of the payload rather than sent as nulls this form never asked
  // for, which the server reads as "leave whatever is stored alone" — so a legacy
  // subcategory survives an edit that never mentioned it.
  const asksShelf = !folder && filedIn === null;
  // A photo shared in from the device's share sheet is already uploaded by the
  // time this form opens, so it seeds the field exactly as a picked one does.
  const [photos, setPhotos] = useState<ItemPhoto[]>(book?.photos ?? prefill?.photos ?? []);
  // What this book already said to its circles' own questions, keyed by question.
  const [answers, setAnswers] = useState<Record<number, string>>(() => initialAnswers(book));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filledQuotes = quotes.map((line) => line.trim()).filter(Boolean);

  function updateQuote(index: number, value: string) {
    setQuotes((prev) => prev.map((line, i) => (i === index ? value : line)));
  }

  function addQuote() {
    setQuotes((prev) => (prev.length < MAX_QUOTES ? [...prev, ""] : prev));
  }

  function removeQuote(index: number) {
    setQuotes((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : [""]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedBuyUrl = buyUrl.trim();
    if (trimmedBuyUrl && !looksLikeUrl(trimmedBuyUrl)) {
      setError("That buy link doesn’t look like a web address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({
        title: title.trim(),
        author: author.trim(),
        genre: genre.trim(),
        language: language.trim(),
        rating,
        review: review.trim(),
        quotes: filledQuotes,
        buyUrl: trimmedBuyUrl,
        visibility,
        circleIds,
        ...(asksShelf
          ? { subcategoryId: shelf.id, subcategoryName: shelf.name, filedCategoryId }
          : {}),
        ...(folder && folder.id !== null ? { folderId: folder.id } : {}),
        photos: photoKeys(photos),
        fieldValues: answers,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that book.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      eyebrow="On your shelf"
      title={book ? "Edit book" : "Add a book you read"}
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
            itemType="book"
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
          <span>Book title</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Author (optional)</span>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
          </label>
          <ChoiceField
            label="Language (optional)"
            options={LANGUAGE_OPTIONS}
            value={language}
            onChange={setLanguage}
            emptyLabel="Not sure"
            placeholder="Which language?"
          />
        </div>
        <ChoiceField
          label="Genre (optional)"
          options={GENRES}
          value={genre}
          onChange={setGenre}
          emptyLabel="Not sure"
          placeholder="Type the genre"
        />

        <fieldset className="field rating-field">
          <legend>Your rating (optional)</legend>
          <div className="rating-picker">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={rating !== null && star <= rating ? "star star-on" : "star"}
                onClick={() => setRating(rating === star ? null : star)}
                aria-pressed={rating !== null && star <= rating}
                aria-label={`${star} out of 5`}
              >
                ★
              </button>
            ))}
            {rating !== null && (
              <button type="button" className="btn-text" onClick={() => setRating(null)}>
                Clear
              </button>
            )}
          </div>
        </fieldset>

        <label className="field">
          <span>Why should someone else read it? (optional)</span>
          <textarea
            rows={3}
            value={review}
            onChange={(e) => setReview(e.target.value)}
          />
          <span className="field-hint">
            A line about why you liked it is what makes someone else pick it up.
          </span>
        </label>
        <div className="field quotes-field" role="group" aria-label="Lines worth remembering">
          <div className="quotes-head">
            <span className="quotes-title">
              A line worth remembering (optional)
              {filledQuotes.length > 1 && (
                <span className="quote-count">{filledQuotes.length}</span>
              )}
            </span>
            <button
              type="button"
              className="quote-add"
              onClick={addQuote}
              disabled={quotes.length >= MAX_QUOTES}
              title="Add another line"
              aria-label="Add another line worth remembering"
            >
              +
            </button>
          </div>
          {quotes.map((line, index) => (
            <div className="quote-row" key={index}>
              <textarea
                rows={2}
                value={line}
                onChange={(e) => updateQuote(index, e.target.value)}
                placeholder={
                  index === 0
                    ? "Quote a sentence that stayed with you."
                    : "Another line from the book."
                }
              />
              {quotes.length > 1 && (
                <button
                  type="button"
                  className="quote-remove"
                  onClick={() => removeQuote(index)}
                  aria-label={`Remove line ${index + 1}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <span className="field-hint">
            Press + for every extra line you want to keep. The group sees them all together.
          </span>
        </div>

        <label className="field">
          <span>Where to buy it (optional)</span>
          <input
            type="text"
            inputMode="url"
            value={buyUrl}
            onChange={(e) => setBuyUrl(e.target.value)}
          />
          <span className="field-hint">
            A shop link so anyone who likes your recommendation can get their own copy.
          </span>
        </label>

        {/* Whatever the chosen circles decided a book here should also say, and the
            "+" that adds a question — which belongs to the people who answer for the
            circle, so a plain member sees the questions and no button. */}
        <BookFields
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
          itemType="book"
          categories={categories}
          onShelfChange={setShelf}
        />
        <PhotoField
          photos={photos}
          onChange={setPhotos}
          hint="Optional. The cover, or a page worth keeping."
        />
        <ErrorLine message={error} />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : book ? "Save changes" : "Share book"}
        </button>
      </form>
    </Modal>
  );
}
