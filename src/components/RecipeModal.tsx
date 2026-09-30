import { useState } from "react";
import {
  photoKeys,
  type Circle,
  type CircleCategory,
  type ItemPhoto,
  type Recipe,
  type SharedRecipe,
  type ShelfChoice,
  type Visibility,
} from "../api";
import { currentFiledCategoryId, currentShelfChoice } from "../categories";
import { currentFolderPath, type ShareTarget } from "../folders";
import { prefillText, type SharePrefill } from "../incoming-share";
import type { ShareAndLearn } from "../store";
import {
  ErrorLine,
  Modal,
  PhotoField,
  SharedInNote,
  SharingIntoNote,
  ShelfField,
  VisibilityPicker,
} from "./shared";
import { initialAnswers, RecipeFields } from "./CategoryFields";

export function RecipeModal({
  recipe,
  store,
  circles = [],
  categories = [],
  presetCircleIds = [],
  folder = null,
  prefill,
  onClose,
  onSave,
}: {
  recipe?: Recipe;
  /**
   * Read for the circles' own questions about a recipe — which is where Menu type
   * and Dish type now come from, so the form asks what this circle actually asks
   * rather than one list every circle was given.
   */
  store: ShareAndLearn;
  /** The circles the member belongs to, so a recipe can be shared into them. */
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
  onSave: (values: SharedRecipe) => Promise<unknown>;
}) {
  const [title, setTitle] = useState(recipe?.title ?? prefill?.title ?? "");
  const [ingredients, setIngredients] = useState(recipe?.ingredients ?? "");
  const [method, setMethod] = useState(recipe?.method ?? "");
  const [notes, setNotes] = useState(recipe?.notes ?? prefillText(prefill));
  const [prepMinutes, setPrepMinutes] = useState(
    recipe?.prepMinutes ? String(recipe.prepMinutes) : "",
  );
  // What the chosen circles ask about a recipe of their own. Menu type and Dish
  // type are two of those answers now rather than two lists written into this
  // form, which is what lets a circle that shares only vegetarian food stop
  // offering "Non-vegetarian" at all.
  const [answers, setAnswers] = useState<Record<number, string>>(() => initialAnswers(recipe));
  const [visibility, setVisibility] = useState<Visibility>(recipe?.visibility ?? "shared");
  const [circleIds, setCircleIds] = useState<number[]>(recipe?.circleIds ?? presetCircleIds);
  const [shelf, setShelf] = useState<ShelfChoice>(currentShelfChoice(categories, recipe));
  const [filedCategoryId, setFiledCategoryId] = useState<number | null>(
    currentFiledCategoryId(recipe),
  );

  // Where the share already sits, when it is being edited rather than shared: a
  // folder is the filing, so the form states it instead of offering the old shelf
  // picker and inviting a second answer to a question already answered.
  const filedIn = currentFolderPath(recipe);
  // Whether the form asks about filing at all. Where it does not, the shelf keys
  // are left out of the payload rather than sent as nulls this form never asked
  // for, which the server reads as "leave whatever is stored alone" — so a legacy
  // subcategory survives an edit that never mentioned it.
  const asksShelf = !folder && filedIn === null;
  // A photo shared in from the device's share sheet is already uploaded by the
  // time this form opens, so it seeds the field exactly as a picked one does.
  const [photos, setPhotos] = useState<ItemPhoto[]>(recipe?.photos ?? prefill?.photos ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSave({
        title: title.trim(),
        ingredients: ingredients.trim(),
        method: method.trim(),
        notes: notes.trim(),
        prepMinutes: prepMinutes ? Number(prepMinutes) : null,
        // Deliberately no `menuTypes` and no `dishType`: the form stopped asking
        // for either, and a body naming neither leaves all three of the old
        // columns exactly as they were — so a recipe that answered the question
        // before it became a field keeps its answer rather than being blanked by
        // the next edit.
        fieldValues: answers,
        visibility,
        circleIds,
        ...(asksShelf
          ? { subcategoryId: shelf.id, subcategoryName: shelf.name, filedCategoryId }
          : {}),
        ...(folder && folder.id !== null ? { folderId: folder.id } : {}),
        photos: photoKeys(photos),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that recipe.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      eyebrow={recipe ? "Your recipe" : "Add to the kitchen"}
      title={recipe ? "Edit recipe" : "Add a recipe"}
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
            itemType="recipe"
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
          <span>Item name</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Ingredients — one per line</span>
          <textarea
            required
            rows={5}
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Method — one step per line</span>
          <textarea
            required
            rows={5}
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Preparation time (minutes)</span>
          <input
            type="number"
            min={0}
            value={prepMinutes}
            onChange={(e) => setPrepMinutes(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Notes (optional)</span>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        {/* Menu type, Dish type, and whatever else the chosen circles decided a
            recipe here should say. Which questions those are is decided in
            "Manage fields" on the Recipes category rather than here: a form is
            for filling in. */}
        <RecipeFields
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
          itemType="recipe"
          categories={categories}
          onShelfChange={setShelf}
        />
        <PhotoField
          photos={photos}
          onChange={setPhotos}
          hint="Optional. The finished dish, or the page it was written on."
        />
        <ErrorLine message={error} />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : recipe ? "Save changes" : "Share recipe"}
        </button>
      </form>
    </Modal>
  );
}
