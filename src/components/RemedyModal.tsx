import { useState } from "react";
import {
  photoKeys,
  type Circle,
  type CircleCategory,
  type ItemPhoto,
  type Remedy,
  type Shared,
  type ShelfChoice,
  type Visibility,
} from "../api";
import { currentFiledCategoryId, currentShelfChoice } from "../categories";
import { currentFolderPath, type ShareTarget } from "../folders";
import { prefillText, type SharePrefill } from "../incoming-share";
import { ErrorLine, HealthNote, Modal, PhotoField, SharedInNote, SharingIntoNote, ShelfField, VisibilityPicker } from "./shared";

/** The complaints members reach for most often, offered as a starting point. */
const COMMON_USES = [
  "Sore throat",
  "Cough",
  "Cold",
  "Indigestion",
  "Headache",
  "Fever",
  "Acidity",
  "Skin",
  "Sleep",
];

export function RemedyModal({
  remedy,
  circles = [],
  categories = [],
  presetCircleIds = [],
  folder = null,
  prefill,
  onClose,
  onSave,
}: {
  remedy?: Remedy;
  /** The circles the member belongs to, so a remedy can be shared into them. */
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
  onSave: (values: Shared<Remedy>) => Promise<unknown>;
}) {
  const [title, setTitle] = useState(remedy?.title ?? prefill?.title ?? "");
  const [usedFor, setUsedFor] = useState(remedy?.usedFor ?? "");
  const [ingredients, setIngredients] = useState(remedy?.ingredients ?? "");
  const [preparation, setPreparation] = useState(remedy?.preparation ?? "");
  const [howToUse, setHowToUse] = useState(remedy?.howToUse ?? "");
  const [passedDownFrom, setPassedDownFrom] = useState(remedy?.passedDownFrom ?? "");
  const [notes, setNotes] = useState(remedy?.notes ?? prefillText(prefill));
  const [visibility, setVisibility] = useState<Visibility>(remedy?.visibility ?? "shared");
  const [circleIds, setCircleIds] = useState<number[]>(remedy?.circleIds ?? presetCircleIds);
  const [shelf, setShelf] = useState<ShelfChoice>(currentShelfChoice(categories, remedy));
  const [filedCategoryId, setFiledCategoryId] = useState<number | null>(
    currentFiledCategoryId(remedy),
  );

  // Where the share already sits, when it is being edited rather than shared: a
  // folder is the filing, so the form states it instead of offering the old shelf
  // picker and inviting a second answer to a question already answered.
  const filedIn = currentFolderPath(remedy);
  // Whether the form asks about filing at all. Where it does not, the shelf keys
  // are left out of the payload rather than sent as nulls this form never asked
  // for, which the server reads as "leave whatever is stored alone" — so a legacy
  // subcategory survives an edit that never mentioned it.
  const asksShelf = !folder && filedIn === null;
  // A photo shared in from the device's share sheet is already uploaded by the
  // time this form opens, so it seeds the field exactly as a picked one does.
  const [photos, setPhotos] = useState<ItemPhoto[]>(remedy?.photos ?? prefill?.photos ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSave({
        title: title.trim(),
        usedFor: usedFor.trim(),
        ingredients: ingredients.trim(),
        preparation: preparation.trim(),
        howToUse: howToUse.trim(),
        passedDownFrom: passedDownFrom.trim(),
        notes: notes.trim(),
        visibility,
        circleIds,
        ...(asksShelf
          ? { subcategoryId: shelf.id, subcategoryName: shelf.name, filedCategoryId }
          : {}),
        ...(folder && folder.id !== null ? { folderId: folder.id } : {}),
        photos: photoKeys(photos),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that remedy.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      eyebrow={remedy ? "Your remedy" : "Passed down to you"}
      title={remedy ? "Edit remedy" : "Share a traditional remedy"}
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
            itemType="remedy"
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
          <span>Remedy title</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Used for</span>
          <input
            required
            list="remedy-uses"
            value={usedFor}
            onChange={(e) => setUsedFor(e.target.value)}
          />
          {/* A list, not a fixed set of options — families name their complaints differently. */}
          <datalist id="remedy-uses">
            {COMMON_USES.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          <span className="field-hint">
            What it helps with, in a word or two — that is how the group will find it.
          </span>
        </label>
        <label className="field">
          <span>Ingredients — one per line</span>
          <textarea
            required
            rows={4}
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Preparation — one step per line</span>
          <textarea
            required
            rows={4}
            value={preparation}
            onChange={(e) => setPreparation(e.target.value)}
          />
        </label>
        <label className="field">
          <span>How to use (optional)</span>
          <textarea
            rows={2}
            value={howToUse}
            onChange={(e) => setHowToUse(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Passed down from (optional)</span>
          <input
            value={passedDownFrom}
            onChange={(e) => setPassedDownFrom(e.target.value)}
          />
          <span className="field-hint">Credit whoever taught it to you.</span>
        </label>
        <label className="field">
          <span>Notes (optional)</span>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <HealthNote compact />

        <VisibilityPicker
          value={visibility}
          onChange={setVisibility}
          circles={circles}
          circleIds={circleIds}
          onCircleIdsChange={setCircleIds}
          itemType="remedy"
          categories={categories}
          onShelfChange={setShelf}
        />
        <PhotoField
          photos={photos}
          onChange={setPhotos}
          hint="Optional. The ingredients, or the plant they come from."
        />
        <ErrorLine message={error} />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : remedy ? "Save changes" : "Share remedy"}
        </button>
      </form>
    </Modal>
  );
}
