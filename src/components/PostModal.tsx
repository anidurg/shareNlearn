import { useState } from "react";
import {
  photoKeys,
  type CircleCategory,
  type ItemPhoto,
  type Post,
  type PostLanguage,
  type SharedPost,
  type ShelfChoice,
  type Visibility,
} from "../api";
import { currentShelfChoice } from "../categories";
import { currentFolderPath, type ShareTarget } from "../folders";
import { prefillText, type SharePrefill } from "../incoming-share";
import { FieldInputs, initialAnswers } from "./CategoryFields";
import { TranslationField } from "./PostTranslations";
import { ScriptConverter, appendText } from "./ScriptConverter";
import { ErrorLine, Modal, PhotoField, SharedInNote, SharingIntoNote, ShelfField } from "./shared";

/**
 * A post in a category a circle invented — a festival, a trip, a stotra, whatever
 * the circle decided it wanted a place for. Unlike the six built-in kinds, there is
 * no "share with" choice: the category belongs to one circle, so the post does
 * too.
 *
 * Everything below the details is the category's own: the questions it decided to
 * ask, in the order its keepers put them in. Which questions those are is decided
 * in **Manage fields** and not here — this form is for filling in.
 */
export function PostModal({
  category,
  post,
  folder = null,
  prefill,
  onClose,
  onSave,
}: {
  category: CircleCategory;
  post?: Post;
  /**
   * The folder this form was opened from, when it was opened by walking into one
   * and tapping "+ Share an item". The member has already said where the post
   * goes, so the folder is stated rather than asked for a second time.
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
  onSave: (values: SharedPost) => Promise<unknown>;
}) {
  const [title, setTitle] = useState(post?.title ?? prefill?.title ?? "");
  const [body, setBody] = useState(post?.body ?? prefillText(prefill));
  const [translateInto, setTranslateInto] = useState<PostLanguage[]>(post?.translateInto ?? []);
  const [visibility, setVisibility] = useState<Visibility>(post?.visibility ?? "shared");
  const [shelf, setShelf] = useState<ShelfChoice>(currentShelfChoice([category], post));

  // Where the share already sits, when it is being edited rather than shared: a
  // folder is the filing, so the form states it instead of offering the old shelf
  // picker and inviting a second answer to a question already answered.
  const filedIn = currentFolderPath(post);
  // Whether the form asks about filing at all. Where it does not, the shelf keys
  // are left out of the payload rather than sent as nulls this form never asked
  // for, which the server reads as "leave whatever is stored alone" — so a legacy
  // subcategory survives an edit that never mentioned it.
  const asksShelf = !folder && filedIn === null;
  // A photo shared in from the device's share sheet is already uploaded by the
  // time this form opens, so it seeds the field exactly as a picked one does.
  const [photos, setPhotos] = useState<ItemPhoto[]>(post?.photos ?? prefill?.photos ?? []);
  const [answers, setAnswers] = useState<Record<number, string>>(() => initialAnswers(post));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSave({
        categoryId: category.id,
        title: title.trim(),
        body: body.trim() || null,
        translateInto,
        visibility,
        ...(asksShelf ? { subcategoryId: shelf.id, subcategoryName: shelf.name } : {}),
        ...(folder && folder.id !== null ? { folderId: folder.id } : {}),
        photos: photoKeys(photos),
        fieldValues: answers,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      eyebrow={`${category.icon} ${category.name}`}
      title={post ? "Edit post" : `Add to ${category.name}`}
      onClose={onClose}
      busy={busy}
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {/* Where it goes, first, the same way it is asked first on every other share
            form — except that a form opened from inside a folder has already been
            told, and an edit of something already in one is being shown where it
            is rather than asked all over again. */}
        {folder ? (
          <SharingIntoNote path={folder.path} />
        ) : filedIn ? (
          <SharedInNote path={filedIn} />
        ) : (
          <ShelfField
            category={category}
            value={shelf}
            onChange={setShelf}
          />
        )}

        <label className="field">
          <span>Title</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            autoFocus
          />
        </label>

        <label className="field">
          <span>Details</span>
          <textarea
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What happened, what to bring, what to remember for next time."
          />
        </label>

        {/* Because a category like Stotras is written in a script most keyboards cannot
            type, and somebody who knows the verse should not be stopped by that. */}
        <ScriptConverter
          target="the details"
          onAdd={(added) => setBody(appendText(body, added))}
        />

        {/* The questions this category decided to ask. Which questions those are is
            decided in Manage fields, not here: a form is for filling in. */}
        <FieldInputs
          category={category}
          values={answers}
          onChange={setAnswers}
          attachment={prefill?.attachment}
        />

        <TranslationField languages={translateInto} onChange={setTranslateInto} />

        <PhotoField
          photos={photos}
          onChange={setPhotos}
          hint="Optional. Add a picture, or several."
        />

        {/* One category, one circle — the only choice left is whether to share it. */}
        <fieldset className="field visibility-picker">
          <legend>Share with</legend>
          <label>
            <input
              type="radio"
              checked={visibility === "shared"}
              onChange={() => setVisibility("shared")}
            />
            <span>Everyone in this circle</span>
          </label>
          <label>
            <input
              type="radio"
              checked={visibility === "private"}
              onChange={() => setVisibility("private")}
            />
            <span>Private — only me</span>
          </label>
        </fieldset>

        <ErrorLine message={error} />

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : post ? "Save changes" : "Share it"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
