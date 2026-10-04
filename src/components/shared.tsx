import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  MAX_PHOTOS_PER_ITEM,
  NO_SHELF,
  uploadItemPhoto,
  type Circle,
  type CircleCategory,
  type ItemPhoto,
  type ShelfChoice,
  type Visibility,
} from "../api";
import {
  filingChoices,
  mergeShelfOptions,
  NO_SUBCATEGORY,
  normalizeName,
  pathText,
  shelfOptions,
  similarName,
  splitPathText,
  type BuiltInType,
  type ShelfOption,
} from "../categories";
import { Icon, IconButton } from "./Icons";

export function Modal({
  eyebrow,
  title,
  onClose,
  busy,
  children,
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  // A click outside closes the form — but only when the press *started* outside
  // too. Selecting the lyrics to copy them, or dragging to the end of a line,
  // very often ends with the pointer released past the edge of the dialog, and
  // that used to count as "clicked away": the form closed and everything typed
  // into it went with it. Whether the gesture began on the backdrop is the one
  // thing that tells a dismissal from a text selection.
  const pressedBackdrop = useRef(false);

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (busy) return;
        if (e.target !== e.currentTarget || !pressedBackdrop.current) return;
        pressedBackdrop.current = false;
        onClose();
      }}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="Close" disabled={busy}>
          ×
        </button>
        <p className="modal-eyebrow">{eyebrow}</p>
        <h2 className="modal-title">{title}</h2>
        {/* The body scrolls on its own so a long form stays reachable on a phone. */}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/**
 * Which circles a post came from. One post can sit in several circles without
 * being copied, so this is a list; a post with no circles went to the whole group
 * and shows nothing. Only circles the reader belongs to are ever named.
 */
export function CircleChips({
  circleIds,
  circleById,
  onOpen,
}: {
  circleIds?: number[];
  circleById: Map<number, Circle>;
  onOpen?: (id: number) => void;
}) {
  const known = (circleIds ?? [])
    .map((id) => circleById.get(id))
    .filter((circle): circle is Circle => Boolean(circle));
  if (known.length === 0) return null;

  return (
    <span className="circle-chips">
      {known.map((circle) =>
        onOpen ? (
          <button
            key={circle.id}
            type="button"
            className="circle-chip circle-chip-link"
            onClick={() => onOpen(circle.id)}
          >
            <span aria-hidden="true">{circle.icon}</span>
            {circle.name}
          </button>
        ) : (
          <span key={circle.id} className="circle-chip">
            <span aria-hidden="true">{circle.icon}</span>
            {circle.name}
          </span>
        ),
      )}
    </span>
  );
}

export function Byline({
  memberName,
  createdAt,
  circleIds,
  circleById,
}: {
  memberName: string;
  createdAt: string;
  circleIds?: number[];
  /** Passing this shows which circles the item was shared into. */
  circleById?: Map<number, Circle>;
}) {
  return (
    <p className="byline">
      Shared by {memberName} · {createdAt}
      {circleById && <CircleChips circleIds={circleIds} circleById={circleById} />}
    </p>
  );
}

/** A path as the value of an `<option>`, and the key two circles agree on. */
function optionKey(path: string[]) {
  return path.map((name) => normalizeName(name)).join("/");
}

/** The name of one node, indented by how deep it sits, for a flat `<select>`. */
function optionLabel(option: ShelfOption) {
  const name = option.path[option.path.length - 1] ?? "";
  return `${"\u00a0\u00a0".repeat(Math.max(0, option.depth - 1))}${name}`;
}

/**
 * One node of the circle's tree, chosen from a flat list of the whole of it. A
 * node arrives as an id and a path, and both travel when the share is saved: the
 * id answers its own circle exactly, and the path is what the same choice means in
 * the other circles a share is going to, where those words are a different row.
 *
 * A share may sit at any level, so the list offers every node rather than only the
 * leaves — filing a recipe under Vegetarian is a real answer, and being made to
 * pick Karnataka to say so would be a worse one. Picking nothing is a real answer
 * too: a member can post now and classify later.
 *
 * "+ Add new subcategory…" makes a node under whatever is selected, which is how
 * the tree actually grows — somebody halfway through a post is exactly who knows
 * that South Indian needs a Karnataka under it. The parent is named on screen and
 * can be changed there, because a new node in the wrong branch is worse than no
 * new node. Nothing is created here; the path is sent with the share and the
 * server makes what is missing, so abandoning the form leaves no stray shelf.
 */
export function SubcategoryPicker({
  options,
  value,
  onChange,
  label = "Subcategory",
  allowNew = true,
}: {
  /** Every node on offer, from every circle this share is going to. */
  options: ShelfOption[];
  value: ShelfChoice;
  onChange: (next: ShelfChoice) => void;
  label?: string;
  /** False where the circle keeps its taxonomy to the people who run it. */
  allowNew?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [near, setNear] = useState<string | null>(null);
  const [parentKey, setParentKey] = useState("");
  const [invented, setInvented] = useState<ShelfOption[]>([]);

  // Everything on offer, plus anything invented on this form, plus wherever the
  // share already sits — which may be a node this member's circles no longer show.
  const list = useMemo(() => {
    const held: ShelfOption[] =
      value.name && value.name.length > 0
        ? [
            {
              id: value.id ?? null,
              path: splitPathText(value.name),
              depth: splitPathText(value.name).length,
            },
          ]
        : [];
    return mergeShelfOptions([options, invented, held]);
  }, [options, invented, value]);

  const chosen =
    list.find((option) => option.id !== null && option.id === value.id) ??
    list.find(
      (option) =>
        value.name !== null &&
        value.name !== undefined &&
        optionKey(option.path) === optionKey(splitPathText(value.name)),
    ) ??
    null;

  const parentPath = parentKey
    ? (list.find((option) => optionKey(option.path) === parentKey)?.path ?? [])
    : [];

  function keep(option: ShelfOption) {
    onChange({ id: option.id, name: pathText(option.path) });
    setAdding(false);
    setDraft("");
    setNear(null);
  }

  function add(anyway = false) {
    const trimmed = draft.trim();
    if (!trimmed) return;
    // Only its own siblings: Karnataka under Vegetarian and Karnataka under
    // Non-Vegetarian are two real places, and offering one for the other is wrong.
    const siblings = list
      .filter(
        (option) =>
          option.path.length === parentPath.length + 1 &&
          optionKey(option.path.slice(0, -1)) === optionKey(parentPath),
      )
      .map((option) => option.path[option.path.length - 1]);
    const match = anyway ? null : similarName(trimmed, siblings);
    if (match) {
      setNear(match);
      return;
    }
    const made: ShelfOption = {
      id: null,
      path: [...parentPath, trimmed],
      depth: parentPath.length + 1,
    };
    setInvented((prev) => [...prev, made]);
    keep(made);
  }

  return (
    <div className="field subcategory-field">
      <span className="field-label">{label}</span>
      <select
        value={chosen ? optionKey(chosen.path) : ""}
        onChange={(e) => {
          if (e.target.value === "__new") {
            // A new node starts under whatever was selected, which is nearly
            // always what somebody adding one from here meant.
            setParentKey(chosen ? optionKey(chosen.path) : "");
            setAdding(true);
            setNear(null);
            return;
          }
          const picked = list.find((option) => optionKey(option.path) === e.target.value);
          if (!picked) {
            onChange(NO_SHELF);
            return;
          }
          keep(picked);
        }}
      >
        <option value="">{NO_SUBCATEGORY}</option>
        {list.map((option) => (
          <option key={optionKey(option.path)} value={optionKey(option.path)}>
            {optionLabel(option)}
          </option>
        ))}
        {allowNew && <option value="__new">+ Add new subcategory…</option>}
      </select>

      {chosen && chosen.path.length > 1 && (
        <p className="field-hint">{pathText(chosen.path)}</p>
      )}

      {adding && (
        <div className="subcategory-add">
          <label className="field">
            <span>Under</span>
            <select value={parentKey} onChange={(e) => setParentKey(e.target.value)}>
              <option value="">Top level</option>
              {list.map((option) => (
                <option key={optionKey(option.path)} value={optionKey(option.path)}>
                  {optionLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <p className="field-hint">
            {parentPath.length > 0
              ? `The new subcategory goes under ${pathText(parentPath)}.`
              : "The new subcategory goes at the top of this category."}
          </p>
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setNear(null);
            }}
            maxLength={40}
            aria-label="New subcategory"
            autoFocus
          />
          {near ? (
            // Close enough to something already there to be worth asking about.
            // Both answers are fine; only the member knows which they meant.
            <div className="subcategory-similar">
              <p>
                “{near}” is already here. Did you mean that one?
              </p>
              <div className="subcategory-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    const existing = list.find(
                      (option) =>
                        option.path.length === parentPath.length + 1 &&
                        optionKey(option.path.slice(0, -1)) === optionKey(parentPath) &&
                        option.path[option.path.length - 1] === near,
                    );
                    if (existing) keep(existing);
                  }}
                >
                  Use {near}
                </button>
                <button type="button" className="btn btn-primary" onClick={() => add(true)}>
                  Create “{draft.trim()}” anyway
                </button>
              </div>
            </div>
          ) : (
            <div className="subcategory-actions">
              <button
                type="button"
                className="btn-text"
                onClick={() => {
                  setAdding(false);
                  setDraft("");
                }}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={() => add()}>
                Add and select
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Where the share is going, on a form opened from inside a folder.
 *
 * A folder is *where* something belongs and a content type is *what* it is, and
 * this is the first half of that answered already: the member walked into Madhwa
 * Festivals › Krishna Janmashtami and tapped "+ Share an item", so asking them a
 * second time which folder they meant would be asking a question they have just
 * answered with their feet. So the folder is stated rather than offered, and
 * `ShelfField` — the old "File under" pair — is not drawn at all beside it: two
 * ways of saying where one thing goes is how a circle ends up with two competing
 * structures, which is exactly what folders replaced.
 *
 * It is a note rather than a disabled control because there is nothing to change
 * here: leaving the folder means going back and sharing from somewhere else.
 */
export function SharingIntoNote({ path }: { path: string[] }) {
  if (path.length === 0) return null;
  return (
    <p className="sharing-into">
      <span aria-hidden="true">📁</span> Sharing into <strong>{pathText(path)}</strong>
    </p>
  );
}

/**
 * Where a share already is, at the top of an edit form: the same note in the past
 * tense.
 *
 * An edit of something filed in a folder asks nothing about where it goes, for the
 * reason above — the folder is the filing, and re-asking it with the old shelf
 * picker offered a member a second, unrelated tree to answer a question they had
 * already answered. So the form states the folder and moves on. Changing it is
 * "Move to folder" on the share itself rather than a field buried in an edit form,
 * which is also why this is a line of text rather than a disabled control.
 */
export function SharedInNote({ path }: { path: string[] }) {
  if (path.length === 0) return null;
  return (
    <p className="sharing-into">
      <span aria-hidden="true">📁</span> Shared in <strong>{pathText(path)}</strong>
    </p>
  );
}

/**
 * Where a share is filed, at the top of every share form: which of the circle's
 * categories it belongs in, and which shelf within it.
 *
 * The category question is asked at all because a kind of thing is not always the
 * category it belongs to. A circle that invented Events wants the song from the
 * Rathotsava under Events, not scattered between Songs and Recipes with everything
 * else it recorded that year — so a form offers the circle's own categories beside
 * the obvious one, and the shelves follow whichever is chosen, because a shelf
 * belongs to a category. With no such category anywhere in the chosen circles there
 * is nothing to ask, and the question is not drawn.
 *
 * The shelf question used to sit inside `VisibilityPicker`, at the very bottom of
 * the form and below the circles it depends on, which put the same field in a
 * different place on every one of the seven forms depending on how tall the fields
 * above it were. Both are asked first now, and identically everywhere: filing is
 * how a member thinks about what they are about to write, not an afterthought once
 * they have written it.
 *
 * Shelves and categories both belong to circles, so before any circle is chosen
 * there is nothing real to offer. That is a line of explanation rather than a hidden
 * field — a question that appears halfway down the form once you tick something
 * reads as a glitch.
 */
export function ShelfField({
  itemType,
  categories = [],
  circles = [],
  circleIds = [],
  category,
  value,
  onChange,
  filedCategoryId = null,
  onFiledCategoryIdChange,
  label,
}: {
  /** What this form shares, for the six built-in kinds. */
  itemType?: BuiltInType;
  /** Every category of every circle the member is in, as they see them. */
  categories?: CircleCategory[];
  /** The member's circles, so an option can say which one a category belongs to. */
  circles?: Circle[];
  circleIds?: number[];
  /** A custom category, which exists in one circle and brings its own shelves. */
  category?: CircleCategory;
  value: ShelfChoice;
  onChange: (next: ShelfChoice) => void;
  /** The circle's own category this share is filed under, or null for the obvious one. */
  filedCategoryId?: number | null;
  /** Left out on a form whose category is fixed, which is what hides the question. */
  onFiledCategoryIdChange?: (next: number | null) => void;
  label?: string;
}) {
  // The circles' own categories, and the one of them this share is going into.
  const choices = useMemo(
    () =>
      onFiledCategoryIdChange ? filingChoices(categories, circleIds, filedCategoryId) : [],
    [categories, circleIds, filedCategoryId, onFiledCategoryIdChange],
  );
  const filed = choices.find((entry) => entry.id === filedCategoryId) ?? null;

  // A category whose circle has just been unticked is no longer somewhere this
  // share can go, so the choice goes with it. Nothing is corrected before the
  // categories have loaded, because "not there yet" and "not there any more" look
  // identical and only one of them should cost a member their filing.
  useEffect(() => {
    if (!onFiledCategoryIdChange || !filedCategoryId || categories.length === 0) return;
    if (!filed) onFiledCategoryIdChange(null);
  }, [categories.length, filed, filedCategoryId, onFiledCategoryIdChange]);

  // Everything the chosen circles already file this kind of thing under. Two
  // circles calling a shelf "Sweets" is one choice; `SubcategoryPicker` dedupes.
  //
  // A chosen category names one circle, so its shelves are the answer there and
  // every other circle still offers its own — which is also what the server does
  // with the name that comes back.
  const options = useMemo(() => {
    if (category) return shelfOptions(category.subcategories);
    if (!itemType || circleIds.length === 0) return [];
    return mergeShelfOptions(
      categories
        .filter(
          (entry) =>
            entry.itemType === itemType &&
            circleIds.includes(entry.circleId) &&
            entry.circleId !== filed?.circleId,
        )
        .concat(filed ? [filed] : [])
        .map((entry) => shelfOptions(entry.subcategories)),
    );
  }, [category, categories, circleIds, filed, itemType]);

  // Inventing a node mid-post is the circle's own decision, and the server refuses
  // it either way — this only keeps the offer off a form where it would fail. One
  // circle allowing it is enough, since a share reaching several is filed circle by
  // circle and lands unfiled in the ones that said no.
  const reach = category ? [category.circleId] : circleIds;
  const allowNew =
    reach.length === 0 ||
    reach.some((id) => circles.find((circle) => circle.id === id)?.memberTaxonomy !== false);

  if (!category && circleIds.length === 0) {
    return (
      <div className="field subcategory-field">
        <span className="field-label">{label ?? "Subcategory"}</span>
        <p className="field-hint">
          Subcategories belong to a circle. Pick the circles to share with, below, and their
          shelves appear here.
        </p>
      </div>
    );
  }

  return (
    <>
      {onFiledCategoryIdChange && choices.length > 0 && (
        <div className="field">
          <span className="field-label">File under</span>
          <select
            value={filedCategoryId ?? ""}
            onChange={(e) => onFiledCategoryIdChange(Number(e.target.value) || null)}
          >
            <option value="">{defaultCategoryLabel(categories, circleIds, itemType)}</option>
            {choices.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.icon} {entry.name}
                {circleIds.length > 1 ? ` · ${circleNameOf(circles, entry.circleId)}` : ""}
              </option>
            ))}
          </select>
          <p className="field-hint">
            {filed
              ? `It goes into ${filed.icon} ${filed.name}, and its shelves are the ones below.`
              : "Or file it in one of this circle's own categories instead."}
          </p>
        </div>
      )}
      <SubcategoryPicker
        options={options}
        value={value}
        onChange={onChange}
        label={label}
        allowNew={allowNew}
      />
    </>
  );
}

/** What "leave it where this kind of thing goes" is actually called here. */
function defaultCategoryLabel(
  categories: CircleCategory[],
  circleIds: number[],
  itemType?: BuiltInType,
) {
  const named = categories.filter(
    (entry) => entry.itemType === itemType && circleIds.includes(entry.circleId),
  );
  const names = [...new Set(named.map((entry) => `${entry.icon} ${entry.name}`))];
  return names.length === 1 ? names[0] : "Where this kind of thing goes";
}

function circleNameOf(circles: Circle[], circleId: number) {
  return circles.find((circle) => circle.id === circleId)?.name ?? "another circle";
}

/**
 * Where a share goes: one or more of the member's circles, or a private note to
 * self. Ticking circles is what the group asked for — "Share with: ☑ Music Lovers
 * ☑ Family" — and a single post covers all of them rather than being duplicated
 * into each.
 *
 * A member with circles is not offered the whole group as well, because a circle
 * is the audience and the two would read as the same choice. The group-wide option
 * survives only where it is the plain truth: somebody in no circle yet, and a share
 * made before circles existed.
 */
export function VisibilityPicker({
  value,
  onChange,
  circles = [],
  circleIds = [],
  onCircleIdsChange,
  itemType,
  categories = [],
  onShelfChange,
}: {
  value: Visibility;
  onChange: (next: Visibility) => void;
  /** The circles the member belongs to; with none, this is the old two-way choice. */
  circles?: Circle[];
  circleIds?: number[];
  onCircleIdsChange?: (next: number[]) => void;
  /** What this form shares, so a circle that switched the category off is not offered. */
  itemType?: BuiltInType;
  /** Every category of every circle the member is in, as they see them. */
  categories?: CircleCategory[];
  /** Kept so unticking the last circle clears a shelf that no longer exists. */
  onShelfChange?: (next: ShelfChoice) => void;
}) {
  // A circle only takes what it has switched on. One already ticked stays on the
  // list either way, so an existing share can always be seen and undone.
  const offered = useMemo(() => {
    if (!itemType || categories.length === 0) return circles;
    const listed = new Set(categories.map((category) => category.circleId));
    return circles.filter(
      (circle) =>
        circleIds.includes(circle.id) ||
        !listed.has(circle.id) ||
        categories.some(
          (category) => category.circleId === circle.id && category.itemType === itemType,
        ),
    );
  }, [circles, circleIds, categories, itemType]);

  const picking = Boolean(onCircleIdsChange) && offered.length > 0;
  /**
   * "Everyone in the group" is not a choice a member with circles is offered any
   * more: a circle already holds everyone it is meant to reach, so the two read as
   * the same thing and picking the wrong one is silently wider than intended.
   * Circles are the audiences, so choosing one is how something is shared.
   *
   * It stays on screen for the two cases where it is the truth rather than an
   * option: a member in no circle at all, who would otherwise have nowhere to
   * share, and a share made before circles existed, whose author can see what it
   * still does and change it. Once a circle is ticked it goes, and unticking the
   * last one lands on private rather than quietly widening the share.
   */
  const groupWide = value === "shared" && circleIds.length === 0;

  function toggle(id: number) {
    if (!onCircleIdsChange) return;
    const next = circleIds.includes(id)
      ? circleIds.filter((current) => current !== id)
      : [...circleIds, id];
    onCircleIdsChange(next);
    // Choosing a circle is a decision to share, so it settles the radio too — and
    // with the group-wide option gone, taking the last circle back off leaves
    // nothing for "shared" to mean, so it lands on private.
    if (next.length > 0 && value !== "shared") onChange("shared");
    if (next.length === 0 && value === "shared") {
      onChange("private");
      onShelfChange?.(NO_SHELF);
    }
  }

  function choose(next: Visibility) {
    onChange(next);
    onCircleIdsChange?.([]);
    // Nothing left to file it under once no circle is chosen.
    onShelfChange?.(NO_SHELF);
  }

  return (
    <fieldset className="field visibility-picker">
      <legend>Share with</legend>
      {picking && (
        <div className="circle-choices">
          {offered.map((circle) => {
            const on = circleIds.includes(circle.id);
            return (
              <label key={circle.id} className={on ? "circle-choice circle-choice-on" : "circle-choice"}>
                <input type="checkbox" checked={on} onChange={() => toggle(circle.id)} />
                <span className="circle-choice-icon" aria-hidden="true">
                  {circle.icon}
                </span>
                <span className="circle-choice-name">{circle.name}</span>
              </label>
            );
          })}
        </div>
      )}
      {(!picking || groupWide) && (
        <label>
          <input type="radio" checked={groupWide} onChange={() => choose("shared")} />
          <span>Everyone in the group</span>
        </label>
      )}
      <label>
        <input type="radio" checked={value === "private"} onChange={() => choose("private")} />
        <span>Private — only me</span>
      </label>
      {picking && value === "private" && (
        <p className="field-hint">Tick a circle above to share this with it.</p>
      )}
      {picking && value === "shared" && circleIds.length > 0 && (
        <p className="field-hint">
          Only these circles will see it, and only the members who are in them.
        </p>
      )}
    </fieldset>
  );
}

/**
 * Photos, always optional. A member may add none at all, and the "+" keeps
 * offering another one — a recipe wants the finished dish and the page it came
 * from, a remedy wants the plant. Each picture is uploaded as it is chosen, so
 * the form holds keys rather than megabytes, and removing one before saving
 * simply drops the key.
 */
export function PhotoField({
  photos,
  onChange,
  label = "Photos",
  hint = "Optional. Add as many as you like.",
}: {
  photos: ItemPhoto[];
  onChange: (next: ItemPhoto[]) => void;
  label?: string;
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const room = MAX_PHOTOS_PER_ITEM - photos.length;

  async function take(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    const added: ItemPhoto[] = [];
    try {
      // One at a time: a phone on a slow connection is happier, and a failure
      // half way through still keeps the pictures that did arrive.
      for (const file of Array.from(files).slice(0, room)) {
        added.push(await uploadItemPhoto(file));
      }
      if (files.length > room) {
        setError(`Only ${MAX_PHOTOS_PER_ITEM} photos can go on one share.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "That photo could not be added.");
    } finally {
      if (added.length) onChange([...photos, ...added]);
      setBusy(false);
      // Let the same file be picked again after a removal.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="field photo-field">
      <span className="field-label">{label}</span>

      {photos.length > 0 && (
        <ul className="photo-drafts">
          {photos.map((photo, index) => (
            <li key={photo.key}>
              <img src={photo.url} alt={`Photo ${index + 1}`} />
              <button
                type="button"
                className="photo-drop"
                title="Remove this photo"
                aria-label={`Remove photo ${index + 1}`}
                onClick={() => onChange(photos.filter((other) => other.key !== photo.key))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="photo-input"
        onChange={(e) => void take(e.target.files)}
      />
      <button
        type="button"
        className="btn btn-ghost photo-add"
        disabled={busy || room <= 0}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Adding…" : photos.length === 0 ? "+ Add a photo" : "+ Add another photo"}
      </button>
      <span className="field-hint">
        {room <= 0 ? `That is all ${MAX_PHOTOS_PER_ITEM} photos.` : hint}
      </span>
      <ErrorLine message={error} />
    </div>
  );
}

/**
 * The photos on a share, wherever it appears. Tapping one opens it full size,
 * because a recipe card is too small to read a handwritten page in.
 */
export function PhotoGallery({
  photos,
  title,
  compact,
}: {
  photos: ItemPhoto[] | undefined;
  /** What the photos are of, for the alt text and the viewer's heading. */
  title: string;
  /** A tighter row, for a feed listing rather than a detail page. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (!photos || photos.length === 0) return null;
  const showing = open === null ? null : photos[open];

  return (
    <>
      <ul className={compact ? "photo-strip compact" : "photo-strip"}>
        {photos.map((photo, index) => (
          <li key={photo.key}>
            <button
              type="button"
              className="photo-open"
              onClick={() => setOpen(index)}
              aria-label={`Open photo ${index + 1} of ${title}`}
            >
              <img src={photo.url} alt={`${title} — photo ${index + 1}`} loading="lazy" />
            </button>
          </li>
        ))}
      </ul>

      {showing && (
        <Modal
          eyebrow={photos.length > 1 ? `Photo ${open! + 1} of ${photos.length}` : "Photo"}
          title={title}
          onClose={() => setOpen(null)}
        >
          <img className="photo-full" src={showing.url} alt={title} />
          {photos.length > 1 && (
            <div className="photo-paging">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setOpen((prev) => (prev! - 1 + photos.length) % photos.length)}
              >
                <Icon name="chevron-left" /> Previous
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setOpen((prev) => (prev! + 1) % photos.length)}
              >
                Next <Icon name="chevron-right" />
              </button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

/**
 * Saving something into My Library, as a bookmark rather than the word "Save".
 *
 * It is a toggle, so the shape stays put and only fills in — an outline bookmark
 * for "save this", the same bookmark solid for "it is saved, tap to take it
 * out". A button that changed size or wording under the finger is what made this
 * one worth replacing. The `label` and `savedLabel` a caller passes are still
 * used, and are now the accessible name and the tooltip: "Add to my reading
 * list" says more than a bookmark can on its own, and a screen reader gets the
 * sentence rather than the glyph.
 */
export function SaveButton({
  saved,
  canSave,
  onToggle,
  savedLabel = "Saved — tap to remove from My Library",
  label = "Save to My Library",
}: {
  saved: boolean;
  canSave: boolean;
  onToggle: () => void;
  savedLabel?: string;
  label?: string;
}) {
  if (!canSave) return null;
  return (
    <IconButton
      icon={saved ? "bookmark-filled" : "bookmark"}
      label={saved ? savedLabel : label}
      tone={saved ? "on" : "quiet"}
      pressed={saved}
      onClick={onToggle}
    />
  );
}

/**
 * The author's own two actions on their share: a pencil and a bin.
 *
 * The icons replace what used to be the words "Edit" and "Delete", which on a
 * card already crowded with counts and circle chips read as two more links to
 * scan past. What has *not* changed is the confirm step: the bin arms the
 * question rather than doing the deed, and the question itself is still in words,
 * because "are you sure" is the one thing an icon must not be trusted with.
 */
export function OwnerActions({
  onEdit,
  onDelete,
  deleteLabel = "Delete for everyone",
  confirmNote,
  busy,
}: {
  onEdit?: () => void;
  onDelete: () => void;
  deleteLabel?: string;
  /**
   * The question asked before the delete goes through, where the thing being deleted
   * deserves one in words rather than only a red button. Absent, the confirm step is
   * still there — this only decides whether it says what it is about.
   */
  confirmNote?: string;
  busy?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span className="owner-actions">
        {confirmNote && <span className="owner-confirm">{confirmNote}</span>}
        <button className="chip-button chip-danger" onClick={onDelete} disabled={busy}>
          {busy ? "Removing…" : deleteLabel}
        </button>
        <button className="btn-text" onClick={() => setConfirming(false)} disabled={busy}>
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span className="owner-actions">
      {onEdit && <IconButton icon="edit" label="Edit" onClick={onEdit} />}
      <IconButton
        icon="trash"
        label={deleteLabel}
        tone="danger"
        onClick={() => setConfirming(true)}
      />
    </span>
  );
}

/**
 * The languages this group actually shares in — Indian ones first, because that is
 * most of it, then the handful of others that come up. It is a starting list rather
 * than a closed one: every form that offers it also offers "Other", so a language
 * nobody thought of is one box away.
 */
export const LANGUAGE_OPTIONS = [
  "English",
  "Kannada",
  "Hindi",
  "Tamil",
  "Telugu",
  "Malayalam",
  "Marathi",
  "Bengali",
  "Gujarati",
  "Punjabi",
  "Konkani",
  "Tulu",
  "Sanskrit",
  "Urdu",
  "French",
  "German",
  "Spanish",
];

/** The option that swaps the dropdown for a text box. Never stored as-is. */
const OTHER = "Other";

/**
 * A dropdown of known answers that gives way to a text box when none of them fit.
 * Whatever the member types is the value that gets saved, so "Other" itself is
 * never stored — a value that isn't in the list opens with the box already
 * showing, which is what lets an older book, or a connection typed before the
 * dropdown existed, be edited without losing what it said.
 */
export function ChoiceField({
  label,
  options,
  value,
  onChange,
  emptyLabel,
  placeholder,
  required,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  emptyLabel: string;
  placeholder: string;
  /** When set, the empty option cannot be the answer the form is submitted with. */
  required?: boolean;
}) {
  // Kept apart from `value`: while the box is still empty there is nothing in the
  // value to tell us the member chose "Other" rather than nothing at all.
  const [other, setOther] = useState(() => value.length > 0 && !options.includes(value));

  return (
    <div className="field">
      <span>{label}</span>
      <select
        aria-label={label}
        required={required && !other}
        value={other ? OTHER : value}
        onChange={(e) => {
          const picked = e.target.value;
          setOther(picked === OTHER);
          onChange(picked === OTHER ? "" : picked);
        }}
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        <option value={OTHER}>{OTHER}</option>
      </select>
      {other && (
        <input
          autoFocus
          required={required}
          aria-label={`${label} — type your own`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

export function PrivateTag({ visibility }: { visibility: Visibility }) {
  if (visibility !== "private") return null;
  return <span className="tag tag-private">Private</span>;
}

/** A book's rating out of five, or nothing at all when the member did not score it. */
export function Stars({ rating }: { rating: number | null }) {
  if (!rating) return null;
  return (
    <span className="stars" title={`${rating} out of 5`} aria-label={`Rated ${rating} out of 5`}>
      {"★".repeat(rating)}
      <span className="stars-off">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

/**
 * A book's lines worth remembering. The first one is always on the card; the rest
 * sit behind a count, because a card full of quotes buries everything else.
 */
export function BookQuotes({ title, quotes }: { title: string; quotes: string[] }) {
  const [open, setOpen] = useState(false);
  if (quotes.length === 0) return null;

  return (
    <div className="book-quotes">
      <blockquote className="book-quote">“{quotes[0]}”</blockquote>
      {quotes.length > 1 && (
        <button type="button" className="quote-count-btn" onClick={() => setOpen(true)}>
          <span className="quote-count">{quotes.length}</span>
          lines worth remembering
        </button>
      )}
      {open && (
        <Modal eyebrow="Worth remembering" title={title} onClose={() => setOpen(false)}>
          <ol className="quote-list">
            {quotes.map((line, index) => (
              <li key={index}>“{line}”</li>
            ))}
          </ol>
        </Modal>
      )}
    </div>
  );
}

/** Opens in a new tab; the URL was checked server-side before it was stored. */
export function BuyLink({ url }: { url: string | null }) {
  if (!url) return null;

  // Keep the book action retailer-neutral, but make an Amazon destination clear
  // before somebody taps it. This is intentionally not labelled an affiliate
  // link yet: that disclosure belongs here only after the URL carries our real
  // Amazon Associates tag.
  let isAmazon = false;
  try {
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
    const host = new URL(candidate).hostname.toLowerCase();
    isAmazon = host === "amazon.com" || host.endsWith(".amazon.com");
  } catch {
    // The form/server already validate URLs; keep the generic fallback harmless.
  }

  return (
    <a className="btn btn-ghost buy-link" href={url} target="_blank" rel="noopener noreferrer">
      {isAmazon ? "Available on Amazon ↗" : "Buy a copy ↗"}
    </a>
  );
}

/**
 * Remedies are health-adjacent, so anywhere they are shown or written down says
 * plainly what they are: family tradition, not medical advice.
 */
export function HealthNote({ compact }: { compact?: boolean }) {
  return (
    <aside className={compact ? "health-note health-note-compact" : "health-note"} role="note">
      <span className="health-note-glyph" aria-hidden="true">
        ⚕
      </span>
      <p>
        These remedies are shared by community members based on personal or family traditions. They
        are not medical advice. For serious or persistent health concerns, consult a qualified
        healthcare professional.
      </p>
    </aside>
  );
}

/**
 * A small fixed list of answers, any number of which may be true at once.
 *
 * The counterpart to `ChoiceField`, and the distinction between the two is the
 * whole point: a dropdown asks "which one of these is it?", and a dropdown asked
 * where several apply forces a member to pick the more important of two facts and
 * throw the other away. A recipe that is both Vegetarian and No onion & garlic is
 * the case that produced this control.
 *
 * The list is the state. There is no Add button and nothing to remove afterwards —
 * a tick is on and a second tick is off — and the order the answers come back in is
 * the order they were offered, so two shares with the same answer read the same way
 * wherever they are printed.
 *
 * It looks like the circle tick-list a share form already carries, and shares its
 * rules in `styles.css` for that reason: two lists of tick boxes on one form that
 * did not match would read as two different kinds of question.
 */
export function TickList({
  legend,
  options,
  chosen,
  onChange,
  hint,
}: {
  legend: string;
  options: string[];
  chosen: string[];
  onChange: (next: string[]) => void;
  hint?: string;
}) {
  function toggle(option: string) {
    const next = chosen.includes(option)
      ? chosen.filter((entry) => entry !== option)
      : [...chosen, option];
    // Offered order rather than ticked order, so the answer is stable.
    onChange(options.filter((entry) => next.includes(entry)));
  }

  return (
    <fieldset className="field">
      <legend>{legend}</legend>
      <div className="tick-choices">
        {options.map((option) => {
          const on = chosen.includes(option);
          return (
            <label key={option} className={on ? "tick-choice tick-choice-on" : "tick-choice"}>
              <input type="checkbox" checked={on} onChange={() => toggle(option)} />
              <span className="tick-choice-name">{option}</span>
            </label>
          );
        })}
      </div>
      {hint && <p className="field-hint">{hint}</p>}
    </fieldset>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  return (
    <div className="search-field">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value && (
        <button className="btn-text" onClick={() => onChange("")}>
          Clear
        </button>
      )}
    </div>
  );
}

/**
 * The opening message, and the first thing a member reads once they are in. It
 * is shared rather than kept by one screen because the same words greet a visitor
 * at the door and somebody still choosing a circle, and a greeting that only
 * appears in one of those places is a greeting almost nobody sees.
 *
 * Discover is the exception: everybody lands there, so it is the one circle where
 * the greeting is about the place rather than the person. Naming somebody on the
 * page they see every single time they open the app says less than telling them
 * what the space is for.
 */
export function WelcomeNote({
  memberName,
  compact = false,
  discover = false,
}: {
  memberName?: string | null;
  compact?: boolean;
  /** The circle in view is Discover, so lead with what it is instead of who they are. */
  discover?: boolean;
}) {
  return (
    // No eyebrow: the header says "Share & Learn" an inch above this, and saying it
    // again was the app introducing itself to somebody already inside it. The copy is
    // two lines rather than a paragraph for the same reason it is read every single
    // visit — a wall of text in the place a member's eye lands first is read once and
    // scrolled past forever after.
    <section className={compact ? "hero hero-compact" : "hero"}>
      {discover ? (
        <>
          <h1 className="hero-title">Explore. Learn. Share. Inspire.</h1>
          <p className="hero-copy">
            Books, words, facts and journeys, kept by the people who found them.
            <br />
            Discover something worth sharing, or see what others have discovered.
          </p>
        </>
      ) : (
        <>
          <h1 className="hero-title">{memberName ? `Welcome, ${memberName}` : "Welcome"}</h1>
          <p className="hero-copy">
            A song, a recipe, a book, a word, a fact, a remedy worth keeping.
            <br />
            Share one today and inspire someone tomorrow.
          </p>
        </>
      )}
    </section>
  );
}

export function EmptyState({
  glyph,
  title,
  children,
}: {
  glyph: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <p className="empty-glyph">{glyph}</p>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}

export function TabHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="tab-header">
      <div>
        <h1 className="tab-title">{title}</h1>
        {subtitle && <p className="tab-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="tab-actions">{actions}</div>}
    </header>
  );
}

export function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="form-error">{message}</p>;
}

// A bullet or a numbered marker at the start of a line is punctuation the member
// typed to make a list, so it goes; a quantity is part of what they wrote, so it
// stays. Telling the two apart is the whole of this pattern: a dash, a bullet or a
// middle dot is always a marker, and a number is one only when a "." or ")" follows
// it and nothing else does — "1." and "2)" are numbering, while "1 tsp" is an
// ingredient and "1.5 cups" is a measurement. It used to be one character class
// holding \d and ., which ate the quantity off every ingredient line in the app.
const LINE_MARKER = /^\s*(?:[-–—•*·]+|\d+[.)](?!\d))\s*/;

/** Turns a textarea's lines into a list, ignoring blank lines and stray bullets. */
export function toLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.replace(LINE_MARKER, "").trim())
    .filter(Boolean);
}
