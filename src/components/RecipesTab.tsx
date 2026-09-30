import { useMemo, useState } from "react";
import { formatDate, recipeMenuBits, type Circle, type Recipe } from "../api";
import { inCircle } from "../feed";
import { canManageShare, deleteNote } from "../manage";
import type { ShareAndLearn } from "../store";
import {
  Byline,
  EmptyState,
  ErrorLine,
  OwnerActions,
  PhotoGallery,
  PrivateTag,
  SaveButton,
  SearchField,
  TabHeader,
  toLines,
} from "./shared";
import { PostActions } from "./PostMenu";
import { ShareLinkButton } from "./ShareLink";
import { backFromOrigin, ItemTrail, MissingItemBack } from "./ItemLocation";
import type { ItemOrigin } from "../item-location";
import { FieldAnswers } from "./CategoryFields";
import { BuiltInFieldsButton } from "./ManageFields";
import { RecipeModal } from "./RecipeModal";
import { useGuidelinesGate } from "./Guidelines";
import { ExperienceCount, ExperienceSection } from "./Experiences";

export function RecipesTab({
  store,
  userId,
  currentCircle,
  openRecipeId,
  origin,
  onOpenRecipe,
  onOpenPlace,
  onBackToList,
  onNeedsLogin,
}: {
  store: ShareAndLearn;
  userId: string | null;
  /** The circle in view; the listing is what that circle holds, not everything. */
  currentCircle: Circle | null;
  openRecipeId: number | null;
  /** The circle and folder the reader opened this recipe from, off the route. */
  origin: ItemOrigin;
  onOpenRecipe: (id: number) => void;
  /** Open a place in the app: a folder of a circle, or the circle itself. */
  onOpenPlace: (circleId: number, folderId: number | null) => void;
  onBackToList: () => void;
  onNeedsLogin: () => void;
}) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  // Asked once, before a member's first share of anything.
  const guidelines = useGuidelinesGate(store);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [error, setError] = useState<string | null>(null);

  // One recipe opened by id is looked up across everything the member may see: a
  // link is a link, and it should not break because another circle is in view.
  const open = openRecipeId ? store.recipes.find((item) => item.id === openRecipeId) : undefined;

  const circleId = currentCircle?.id ?? null;
  const here = useMemo(() => inCircle(store.recipes, circleId), [store.recipes, circleId]);

  const recipes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return here;
    return here.filter((recipe) =>
      [
        recipe.title,
        recipe.memberName,
        recipe.ingredients,
        ...recipeMenuBits(recipe),
        // Menu type and Dish type are answers now, so a member searching for
        // "Sweet" has to find the recipes that answered rather than only the
        // ones shared before the question became the circle's own.
        ...(recipe.fieldValues ?? []).map((value) => value.value),
      ]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(needle)),
    );
  }, [here, query]);

  /* Where Delete lands: the folder the reader came through, since the recipe's
     own filing goes with it. */
  const leaveItem = backFromOrigin(origin, onOpenPlace, onBackToList);

  function showError(err: unknown) {
    setError(err instanceof Error ? err.message : "Something went wrong.");
  }

  const modals = (
    <>
      {guidelines.gate}

      {adding && (
        <RecipeModal
          store={store}
          circles={store.circles}
          categories={store.categories}
          onClose={() => setAdding(false)}
          onSave={async (values) => {
            await store.addRecipe(values);
            setAdding(false);
          }}
        />
      )}
      {editing && (
        <RecipeModal
          recipe={editing}
          store={store}
          circles={store.circles}
          categories={store.categories}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            await store.editRecipe(editing.id, values);
            setEditing(null);
          }}
        />
      )}
    </>
  );

  if (openRecipeId && !open) {
    return (
      <>
        <EmptyState glyph="◦" title="That recipe is not available">
          It may have been removed, or kept private by whoever shared it.
        </EmptyState>
        <MissingItemBack
          store={store}
          origin={origin}
          onOpenPlace={onOpenPlace}
          onBackToList={onBackToList}
          listLabel="All recipes"
        />
      </>
    );
  }

  if (open) {
    return (
      <>
        {/* Where this recipe sits — the circle and the folders down to it —
            rather than the listing its kind belongs to. */}
        <ItemTrail
          store={store}
          item={open}
          origin={origin}
          circleInView={circleId}
          onOpenPlace={onOpenPlace}
          onBackToList={onBackToList}
          listLabel="All recipes"
        />
        <ErrorLine message={error} />
        <article className="recipe-detail">
          <h1 className="tab-title">
            {open.title}
            <PrivateTag visibility={open.visibility} />
          </h1>
          <Byline
            memberName={open.memberName}
            createdAt={formatDate(open.createdAt)}
            circleIds={open.circleIds}
            circleById={store.circleById}
          />
          <p className="card-meta">
            {[
              ...recipeMenuBits(open),
              open.prepMinutes ? `Preparation time: ${open.prepMinutes} minutes` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          <h2 className="section-title">Ingredients</h2>
          <ul className="bullet-list">
            {toLines(open.ingredients).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>

          <h2 className="section-title">Method</h2>
          <ol className="step-list">
            {toLines(open.method).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>

          {open.notes && (
            <>
              <h2 className="section-title">Notes</h2>
              <p className="recipe-notes">{open.notes}</p>
            </>
          )}

          {/* Menu type, Dish type and whatever else the recipe's circles asked
              about it. An unanswered question has no line, so a circle asking a
              dozen things does not turn a quiet recipe into a table of blanks. */}
          <FieldAnswers values={open.fieldValues} />

          <PhotoGallery photos={open.photos} title={open.title} />

          <ExperienceSection
            title="Experiences & Tips"
            ownerId={open.memberId}
            canManage={canManageShare(store, userId, open)}
            experiences={open.experiences}
            userId={userId}
            onAdd={(values) => store.addExperience("recipe", open.id, values)}
            onRemove={(experienceId) => store.removeExperience("recipe", open.id, experienceId)}
            onError={showError}
          />

          <div className="card-actions">
            <ShareLinkButton
              itemType="recipe"
              itemId={open.id}
              name={open.title}
              blurb={`${open.memberName} shared a recipe for ${open.title} on Share & Learn.`}
              circleId={circleId}
            />
            <SaveButton
              saved={store.savedKeys.has(`recipe:${open.id}`)}
              canSave={Boolean(userId)}
              onToggle={() => store.toggleSave("recipe", open.id).catch(showError)}
              label="Save to My Library"
              savedLabel="In My Library"
            />
            <PostActions store={store} userId={userId} itemType="recipe" item={open} />
            {/*
              The author, and whoever keeps a circle this recipe went into — a
              circle's owner and the admins they chose answer for what is in it, so
              they can correct a wrong ingredient or take a bad recipe down without
              waiting on somebody who may never open the app again.
            */}
            {canManageShare(store, userId, open) && (
              <OwnerActions
                onEdit={() => setEditing(open)}
                onDelete={() =>
                  store
                    .removeRecipe(open.id)
                    .then(leaveItem)
                    .catch(showError)
                }
                confirmNote={deleteNote(open.memberId === userId, "recipe", open.memberName)}
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
        title="Recipes"
        subtitle={
          currentCircle
            ? `What did you cook for ${currentCircle.name}? Write it down while it is fresh.`
            : "What did you cook? Write it down while it is fresh."
        }
        actions={
          userId ? (
            <>
              {/*
                What this circle's Recipes form asks — Menu type and Dish type
                among it, those two being the circle's own configurable fields
                rather than one list handed to every circle. It is a keeper's
                door and nobody else's, and it deliberately does not live on the
                Add/Edit Recipe form: deciding what a form asks and filling one
                in are two different jobs. Worded twice and shown once, the same
                pair Books and Songs carry.
              */}
              <BuiltInFieldsButton
                store={store}
                itemType="recipe"
                circleId={circleId}
                className="btn btn-ghost tab-header-wide-action"
                label="Manage fields"
              />
              <BuiltInFieldsButton
                store={store}
                itemType="recipe"
                circleId={circleId}
                className="btn btn-ghost section-head-narrow-action"
                label="Fields"
              />
              <button
                className="btn btn-primary"
                onClick={() => guidelines.guard(() => setAdding(true))}
              >
                Add recipe
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
          <SearchField value={query} onChange={setQuery} placeholder="Search recipes…" />
          <p className="collection-count">
            {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}
          </p>
        </div>
      )}

      <ErrorLine message={error} />

      {here.length === 0 && (
        <EmptyState
          glyph="🍲"
          title={currentCircle ? `No recipes in ${currentCircle.name} yet` : "No recipes yet"}
        >
          {userId
            ? "Add the dish you made today — ingredients and method are enough."
            : "Log in to see the recipes members have shared, and to add your own."}
        </EmptyState>
      )}

      {here.length > 0 && recipes.length === 0 && (
        <EmptyState glyph="◦" title={`Nothing matches “${query.trim()}”`}>
          Try another dish, ingredient, or member.
        </EmptyState>
      )}

      <div className="card-list">
        {recipes.map((recipe) => (
          <article className="card" key={recipe.id}>
            <h3 className="card-title">
              <span aria-hidden="true">🍲</span> {recipe.title}
              <PrivateTag visibility={recipe.visibility} />
            </h3>
            <Byline
              memberName={recipe.memberName}
              createdAt={formatDate(recipe.createdAt)}
              circleIds={recipe.circleIds}
              circleById={store.circleById}
            />
            <p className="card-meta">
              {[
                ...recipeMenuBits(recipe),
                recipe.prepMinutes ? `Preparation time: ${recipe.prepMinutes} minutes` : null,
                `${toLines(recipe.ingredients).length} ingredients`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {/* What this recipe's circles asked about it — who can eat it, what
                kind of dish it is, and anything else they added. */}
            <FieldAnswers values={recipe.fieldValues} />
            <PhotoGallery photos={recipe.photos} title={recipe.title} compact />
            <ExperienceCount experiences={recipe.experiences} />
            <div className="card-actions">
              <button className="chip-button chip-strong" onClick={() => onOpenRecipe(recipe.id)}>
                View recipe
              </button>
              <ShareLinkButton
                itemType="recipe"
                itemId={recipe.id}
                name={recipe.title}
                blurb={`${recipe.memberName} shared a recipe for ${recipe.title} on Share & Learn.`}
                circleId={circleId}
              />
              <SaveButton
                saved={store.savedKeys.has(`recipe:${recipe.id}`)}
                canSave={Boolean(userId)}
                onToggle={() => store.toggleSave("recipe", recipe.id).catch(showError)}
                label="Save to My Library"
                savedLabel="In My Library"
              />
              {canManageShare(store, userId, recipe) && (
                <OwnerActions
                  onEdit={() => setEditing(recipe)}
                  onDelete={() => store.removeRecipe(recipe.id).catch(showError)}
                  confirmNote={deleteNote(
                    recipe.memberId === userId,
                    "recipe",
                    recipe.memberName,
                  )}
                />
              )}
              <PostActions store={store} userId={userId} itemType="recipe" item={recipe} />
            </div>
          </article>
        ))}
      </div>
      {modals}
    </>
  );
}
