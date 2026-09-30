// netlify/lib/recipes.ts
// The two questions a recipe form asks about the recipe itself, and the one
// question it used to ask instead of them.
//
// The form had a single "Category" dropdown holding Vegetarian, Non-vegetarian,
// Vegan, Dessert, Drink and Other, which is two different facts in one control: the
// first three say who may eat a dish and the next two say what kind of dish it is.
// A vegetarian dessert therefore had to choose which half of the truth to record,
// and a Jain recipe or one made without onion and garlic had nowhere to say so at
// all. So the question is now asked twice — **Menu type**, which takes as many
// answers as apply, and **Dish type**, which takes exactly one.
//
// Neither is a folder, a subfolder or a category: they are facts about one recipe,
// stored on the recipe, exactly as its preparation time is. Where a recipe *sits*
// is still Circle → Folder → Subfolder, answered by `ShelfField` and the folder
// picker, and nothing here touches it.
//
// The old column is kept and read as a fallback rather than back-filled by a
// migration, which is the same trick `itemRefOf()` plays on a discussion's original
// `book_id`: nothing anybody typed is rewritten, and a recipe nobody has edited
// since still reads correctly.
import { optionalText, text } from "./items.js";

/**
 * Who can eat it. Checkboxes rather than a dropdown, because more than one applies
 * to the same dish and often does — "Vegetarian" and "No onion & garlic" together
 * is the ordinary case for festival food, not an edge one.
 */
export const RECIPE_MENU_TYPES = [
  "Vegetarian",
  "Non-vegetarian",
  "Vegan",
  "Jain",
  "No onion & garlic",
] as const;

/**
 * What kind of dish it is. One answer, so a dropdown is the right control here —
 * the opposite conclusion from the list above, for the opposite reason.
 */
export const RECIPE_DISH_TYPES = [
  "Appetizer",
  "Breakfast",
  "Rice item",
  "Main dish",
  "Side dish",
  "Snack",
  "Chaat",
  "Sweet / Dessert",
  "Drink / Beverage",
  "Chutney / Pickle",
  "Other",
] as const;

/**
 * The two questions a circle's Recipes form starts out asking, as configurable
 * fields rather than as the hard-coded controls the two lists above used to draw.
 *
 * The lists themselves survive as the *starting* answer rather than the only one:
 * a circle is given these two fields once, and from then on its keepers rename,
 * reorder, add to and take away from the choices — which is the whole point, since
 * a circle that shares only vegetarian food should not have to offer
 * "Non-vegetarian" and a circle that cooks meat should. So nothing below is a rule
 * any more: `menuTypesFrom()` still reads the old column against `RECIPE_MENU_TYPES`
 * for a recipe stored before this, and what a member is *asked* comes from the
 * circle's own field.
 */
export const RECIPE_STARTER_FIELDS = [
  {
    label: "Menu type",
    kind: "multiselect",
    options: [...RECIPE_MENU_TYPES],
    hint: "Tick as many as apply — a sweet can be both Vegetarian and No onion & garlic.",
  },
  {
    label: "Dish type",
    kind: "select",
    options: [...RECIPE_DISH_TYPES],
  },
] as const;

/** Long enough for anything on the list above, and for a legacy value carried over. */
const MAX_DISH_TYPE = 60;

/**
 * How the old single answer reads as one of the two new ones.
 *
 * Three of the six were menu types and three were dish types, which is what made
 * the old control the wrong shape. Nothing is guessed: this is the whole of the
 * list that dropdown ever offered, and each entry has exactly one honest reading.
 */
const LEGACY_MENU_TYPES = new Set(["vegetarian", "non-vegetarian", "vegan"]);
const LEGACY_DISH_TYPES = new Map([
  ["dessert", "Sweet / Dessert"],
  ["drink", "Drink / Beverage"],
  ["other", "Other"],
]);

/** The canonical spelling of a menu type, or null for anything not on the list. */
function menuTypeOf(value: unknown) {
  const needle = text(value).replace(/\s+/g, " ").toLowerCase();
  return RECIPE_MENU_TYPES.find((option) => option.toLowerCase() === needle) ?? null;
}

/**
 * What a form said about menu types, as a clean list.
 *
 * Accepts either an array (what the form sends) or the newline-separated text the
 * column stores, so the same function reads a body and a row. Anything not on the
 * list is dropped rather than stored: the control is five tick boxes, so a sixth
 * answer is a bug somewhere rather than something a member meant.
 */
export function menuTypesFrom(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split("\n") : [];
  const chosen: string[] = [];
  for (const candidate of raw) {
    const option = menuTypeOf(candidate);
    if (option && !chosen.includes(option)) chosen.push(option);
  }
  // Kept in the order the list offers them rather than the order they were ticked,
  // so two recipes with the same answer read the same way on a card.
  return RECIPE_MENU_TYPES.filter((option) => chosen.includes(option));
}

/** One per line, the shape a word's synonyms are stored in; null for none at all. */
export function joinMenuTypes(entries: string[]) {
  return entries.length > 0 ? entries.join("\n") : null;
}

/**
 * What a form said about the dish type.
 *
 * Deliberately *not* checked against `RECIPE_DISH_TYPES`: a value that came over
 * from the old column and is not on the new list is still what its author wrote,
 * and refusing it here would mean an edit that changed only the notes quietly threw
 * it away. The form offers it back as an extra option for the same reason.
 */
export function dishTypeFrom(value: unknown) {
  const trimmed = optionalText(value);
  return trimmed ? trimmed.replace(/\s+/g, " ").slice(0, MAX_DISH_TYPE) : null;
}

interface RecipeMeta {
  menuTypes: string | null;
  dishType: string | null;
  category: string | null;
}

/**
 * The two answers as the browser reads them, falling back to the old column.
 *
 * The fallback applies only when neither new column has anything in it, so a
 * recipe that has been saved through the new form is read from the new form's
 * answers and an untouched one is read from what it has always had.
 */
export function recipeReadingOf(row: RecipeMeta) {
  const stored = menuTypesFrom(row.menuTypes);
  const dishType = dishTypeFrom(row.dishType);
  if (stored.length > 0 || dishType) return { menuTypes: stored, dishType };

  const legacy = text(row.category).toLowerCase();
  if (LEGACY_MENU_TYPES.has(legacy)) {
    return { menuTypes: menuTypesFrom([row.category]), dishType: null };
  }
  const asDish = LEGACY_DISH_TYPES.get(legacy);
  if (asDish) return { menuTypes: [], dishType: asDish };
  // Anything else the column happens to hold is a dish type as far as the form is
  // concerned: it is offered back, kept if saved, and never silently dropped.
  return { menuTypes: [], dishType: dishTypeFrom(row.category) };
}

/** A stored recipe as the API hands it over: the row plus the two derived answers. */
export function recipeResponse<T extends RecipeMeta>(row: T) {
  return { ...row, ...recipeReadingOf(row) };
}

/**
 * What a create should write.
 *
 * `category` is left null: the current form does not ask the old question, so a
 * recipe shared today has no legacy answer to keep.
 */
export function recipeMetaFrom(body: Record<string, unknown>) {
  return {
    menuTypes: joinMenuTypes(menuTypesFrom(body.menuTypes)),
    dishType: dishTypeFrom(body.dishType),
    category: null,
  };
}

/**
 * What a PATCH should write, and the one place the old column is retired.
 *
 * A body that names neither key leaves all three columns exactly as they are, the
 * way `photoKeysFrom()` leaves photos alone — so a caller that never asked the
 * question cannot answer it by accident.
 *
 * A body that names either key *has* asked it, and the form it came from opened
 * with `recipeReadingOf()`'s reading of the old column already filled in. So the
 * answer coming back is that reading, confirmed or corrected by the author, and the
 * old column has nothing left to say: it is cleared rather than kept as a second
 * answer that would come back the moment somebody unticked everything.
 */
export function recipeMetaPatch(body: Record<string, unknown>, existing: RecipeMeta) {
  const asked = "menuTypes" in body || "dishType" in body;
  if (!asked) {
    return { menuTypes: existing.menuTypes, dishType: existing.dishType, category: existing.category };
  }

  const reading = recipeReadingOf(existing);
  return {
    menuTypes: joinMenuTypes(
      "menuTypes" in body ? menuTypesFrom(body.menuTypes) : reading.menuTypes,
    ),
    dishType: "dishType" in body ? dishTypeFrom(body.dishType) : reading.dishType,
    category: null,
  };
}
