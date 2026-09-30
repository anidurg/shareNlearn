import { useState } from "react";
import {
  photoKeys,
  type Circle,
  type CircleCategory,
  type Fact,
  type ItemPhoto,
  type Shared,
  type ShelfChoice,
  type Visibility,
} from "../api";
import { currentFiledCategoryId, currentShelfChoice } from "../categories";
import { currentFolderPath, type ShareTarget } from "../folders";
import type { SharePrefill } from "../incoming-share";
import { ErrorLine, Modal, PhotoField, SharedInNote, SharingIntoNote, ShelfField, VisibilityPicker } from "./shared";

const CATEGORIES = ["Food", "Science", "History", "Nature", "Other"];

export function FactModal({
  fact,
  circles = [],
  categories = [],
  presetCircleIds = [],
  folder = null,
  prefill,
  onClose,
  onSave,
}: {
  fact?: Fact;
  /** The circles the member belongs to, so a fact can be shared into them. */
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
  onSave: (values: Shared<Fact>) => Promise<unknown>;
}) {
  const [text, setText] = useState(fact?.fact ?? prefill?.note ?? "");
  const [category, setCategory] = useState(fact?.category ?? "Other");
  const [source, setSource] = useState(fact?.source ?? prefill?.url ?? "");
  const [visibility, setVisibility] = useState<Visibility>(fact?.visibility ?? "shared");
  const [circleIds, setCircleIds] = useState<number[]>(fact?.circleIds ?? presetCircleIds);
  const [shelf, setShelf] = useState<ShelfChoice>(currentShelfChoice(categories, fact));
  const [filedCategoryId, setFiledCategoryId] = useState<number | null>(
    currentFiledCategoryId(fact),
  );

  // Where the share already sits, when it is being edited rather than shared: a
  // folder is the filing, so the form states it instead of offering the old shelf
  // picker and inviting a second answer to a question already answered.
  const filedIn = currentFolderPath(fact);
  // Whether the form asks about filing at all. Where it does not, the shelf keys
  // are left out of the payload rather than sent as nulls this form never asked
  // for, which the server reads as "leave whatever is stored alone" — so a legacy
  // subcategory survives an edit that never mentioned it.
  const asksShelf = !folder && filedIn === null;
  // A photo shared in from the device's share sheet is already uploaded by the
  // time this form opens, so it seeds the field exactly as a picked one does.
  const [photos, setPhotos] = useState<ItemPhoto[]>(fact?.photos ?? prefill?.photos ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSave({
        fact: text.trim(),
        category,
        source: source.trim(),
        visibility,
        circleIds,
        ...(asksShelf
          ? { subcategoryId: shelf.id, subcategoryName: shelf.name, filedCategoryId }
          : {}),
        ...(folder && folder.id !== null ? { folderId: folder.id } : {}),
        photos: photoKeys(photos),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that fact.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      eyebrow="Did you know?"
      title={fact ? "Edit fun fact" : "Add a fun fact"}
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
            itemType="fact"
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
          <span>Fact</span>
          <textarea
            required
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Where did you learn it? (optional)</span>
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="A documentary, a book, a friend…"
          />
          <span className="field-hint">
            Adding a source helps everyone check a fact before repeating it.
          </span>
        </label>
        <VisibilityPicker
          value={visibility}
          onChange={setVisibility}
          circles={circles}
          circleIds={circleIds}
          onCircleIdsChange={setCircleIds}
          itemType="fact"
          categories={categories}
          onShelfChange={setShelf}
        />
        <PhotoField
          photos={photos}
          onChange={setPhotos}
          hint="Optional. A picture that shows what you mean."
        />
        <ErrorLine message={error} />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : fact ? "Save changes" : "Share fact"}
        </button>
      </form>
    </Modal>
  );
}
