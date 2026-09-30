import { useState } from "react";
import type { Bookmark, Circle, CircleCategory, Shared, ShelfChoice, Visibility } from "../api";
import { currentFiledCategoryId, currentShelfChoice } from "../categories";
import { currentFolderPath, type ShareTarget } from "../folders";
import type { SharePrefill } from "../incoming-share";
import { ErrorLine, Modal, SharedInNote, SharingIntoNote, ShelfField, VisibilityPicker } from "./shared";

/**
 * The smallest share form in the app: a name and a web address, and then the same
 * two questions every other form asks — which circles it goes to, and which shelf
 * it sits on.
 *
 * There is no photo field and no notes box, and both absences are deliberate. A
 * bookmark's content is at the other end of the link, so a picture beside it would
 * be decoration rather than the share; and anything long enough to need a notes
 * box is a post, which is what a circle's own categories are for. Two fields is
 * the whole point of the kind.
 *
 * The address is not validated here beyond the browser's own `type="url"` nudge —
 * the server parses it with the same `webAddressOf()` a category's Link field
 * uses, and refuses anything that is not http or https, so a second and slightly
 * different rule on this side would only be able to disagree with it.
 */
export function BookmarkModal({
  bookmark,
  circles = [],
  categories = [],
  presetCircleIds = [],
  folder = null,
  prefill,
  onClose,
  onSave,
}: {
  bookmark?: Bookmark;
  /** The circles the member belongs to, so a bookmark can be shared into them. */
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
  onSave: (values: Shared<Bookmark>) => Promise<unknown>;
}) {
  const [title, setTitle] = useState(bookmark?.title ?? prefill?.title ?? "");
  const [url, setUrl] = useState(bookmark?.url ?? prefill?.url ?? "");
  const [visibility, setVisibility] = useState<Visibility>(bookmark?.visibility ?? "shared");
  const [circleIds, setCircleIds] = useState<number[]>(bookmark?.circleIds ?? presetCircleIds);
  const [shelf, setShelf] = useState<ShelfChoice>(currentShelfChoice(categories, bookmark));
  const [filedCategoryId, setFiledCategoryId] = useState<number | null>(
    currentFiledCategoryId(bookmark),
  );

  // Where the share already sits, when it is being edited rather than shared: a
  // folder is the filing, so the form states it instead of offering the old shelf
  // picker and inviting a second answer to a question already answered.
  const filedIn = currentFolderPath(bookmark);
  // Whether the form asks about filing at all. Where it does not, the shelf keys
  // are left out of the payload rather than sent as nulls this form never asked
  // for, which the server reads as "leave whatever is stored alone" — so a legacy
  // subcategory survives an edit that never mentioned it.
  const asksShelf = !folder && filedIn === null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSave({
        title: title.trim(),
        url: url.trim(),
        visibility,
        circleIds,
        ...(asksShelf
          ? { subcategoryId: shelf.id, subcategoryName: shelf.name, filedCategoryId }
          : {}),
        ...(folder && folder.id !== null ? { folderId: folder.id } : {}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that bookmark.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      eyebrow="Worth passing on"
      title={bookmark ? "Edit bookmark" : "Add a bookmark"}
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
            itemType="bookmark"
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
          <span>Bookmark name</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What to call it"
          />
        </label>
        <label className="field">
          <span>Link</span>
          <input
            required
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/page"
          />
          <span className="field-hint">
            Paste the whole address. Anything that is not a web page is turned away.
          </span>
        </label>
        <VisibilityPicker
          value={visibility}
          onChange={setVisibility}
          circles={circles}
          circleIds={circleIds}
          onCircleIdsChange={setCircleIds}
          itemType="bookmark"
          categories={categories}
          onShelfChange={setShelf}
        />
        <ErrorLine message={error} />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : bookmark ? "Save changes" : "Share bookmark"}
        </button>
      </form>
    </Modal>
  );
}
