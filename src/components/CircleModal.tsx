import { useState } from "react";
import {
  uploadCircleCover,
  type Circle,
  type CirclePrivacy,
  type Contact,
  type NewCategory,
  type NewCircle,
} from "../api";
import {
  BUILT_IN_CATEGORIES,
  CATEGORY_ICONS,
  DEFAULT_CATEGORY_ICON,
  normalizeName,
  type BuiltInType,
} from "../categories";
import { ErrorLine, Modal } from "./shared";

/** A starting set of marks, so most circles need no typing to look like themselves. */
const ICONS = [
  "👥",
  // Places of worship and the marks a chapter of one picks itself by: a temple
  // organisation naming its branches after cities wants both.
  "\u{1F6D5}",
  "\u{1FA94}",
  "\u{1F549}\uFE0F",
  "\u{2B50}",
  "\u{1F920}",
  "\u{1F335}",
  "\u{1F3D9}\uFE0F",
  "\u{1F309}",
  "📚",
  "📖",
  "✍️",
  "🎵",
  "🎸",
  "🍲",
  "🥘",
  "🌱",
  "⚕️",
  "💡",
  "🧠",
  "✈️",
  "🌍",
  "🏡",
  "🧘",
  "⚽",
  "🎬",
  "🎨",
  "🐦",
];

/**
 * The three doors a circle can have, in the words a member reads rather than the
 * words the column holds. "Ask to Join" is `discoverable` and "Open to All" is
 * `public` — the latter is the only one nobody has to answer, which is what makes
 * a circle findable by somebody who has just arrived and knows no one yet.
 */
const PRIVACY: { value: CirclePrivacy; label: string; hint: string }[] = [
  {
    value: "private",
    label: "Private",
    hint: "Invite only. The circle does not show up for anybody you have not invited.",
  },
  {
    value: "discoverable",
    label: "Ask to Join",
    hint: "Anyone in the group can find it and ask to join. You decide who comes in.",
  },
  {
    value: "public",
    label: "Open to All",
    hint: "Listed for everybody, and anyone in the group can join it on the spot — no approval needed.",
  },
];

/**
 * Creating a circle, and editing one later. The contact list only appears when
 * making a new circle — once it exists, inviting people happens on the circle
 * itself, where you can see who is already in.
 */
export function CircleModal({
  circle,
  circles,
  parent,
  contacts,
  onClose,
  onSubmit,
}: {
  circle?: Circle | null;
  /**
   * The member's own circles, which is where "Branch of" gets its choices. Only
   * the ones they keep are offered: attaching a circle under an organisation is
   * a decision about that organisation, and the server refuses it for anybody
   * who does not look after it.
   */
  circles: Circle[];
  /**
   * The organisation to start this circle under, when the form was opened by
   * "Add branch" on that circle rather than by "+ Start a circle". It seeds the
   * "Branch of" field below and nothing else, so the member can still change it
   * or take it back to None — starting a branch is starting a circle.
   */
  parent?: Circle | null;
  contacts: Contact[];
  onClose: () => void;
  onSubmit: (input: NewCircle) => Promise<unknown>;
}) {
  const editing = Boolean(circle);
  /**
   * The preset only applies to a circle being started. Editing one already has
   * an answer to "branch of what?" — its own — and letting a leftover preset
   * speak for it would quietly move an independent circle under an organisation
   * on a form the member opened to change its description.
   */
  const preset = editing ? null : (parent ?? null);
  const [name, setName] = useState(circle?.name ?? "");
  const [description, setDescription] = useState(circle?.description ?? "");
  const [icon, setIcon] = useState(circle?.icon ?? "👥");
  // Every stored privacy is choosable again, so an existing circle's own setting
  // is simply the one that starts ticked.
  const [privacy, setPrivacy] = useState<CirclePrivacy>(circle?.privacy ?? "private");
  /**
   * Whether a plain member may add to this circle's taxonomy while posting. On by
   * default, because filing something as you share it is the ordinary way a tree
   * grows — a circle that wants its shelves kept by its keepers says so here, and
   * the server refuses the member either way once it is off.
   */
  const [memberTaxonomy, setMemberTaxonomy] = useState(circle?.memberTaxonomy ?? true);
  /**
   * "Branch of": the organisation this circle sits under, or null for a circle
   * that stands on its own — which is the default, and what almost every circle
   * is. It used to be said by the name: calling a circle "SVKV - Austin" was the
   * only way to put it under SVKV, and there was no way to take it back out.
   * Saying it here means a chapter can simply be called Austin.
   */
  const [parentId, setParentId] = useState<number | null>(circle?.parentCircleId ?? preset?.id ?? null);
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(circle?.coverUrl ?? null);
  const [coverTouched, setCoverTouched] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [invitees, setInvitees] = useState<string[]>([]);
  // The six the app was built around are on to begin with: a new circle that
  // shares nothing is nobody's idea of a circle, and unticking is quicker than
  // ticking six boxes. Bookmarks is the exception and is offered unticked, being
  // a thing a circle takes up on purpose rather than a default it lives with —
  // `defaultOn: false` on the entry is what says so, and the server's own
  // `BUILT_INS` says the same thing to the same effect.
  const [picked, setPicked] = useState<BuiltInType[]>(
    BUILT_IN_CATEGORIES.filter((entry) => entry.defaultOn !== false).map((entry) => entry.itemType),
  );
  const [custom, setCustom] = useState<{ name: string; icon: string }[]>([]);
  const [adding, setAdding] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newIcon, setNewIcon] = useState(DEFAULT_CATEGORY_ICON);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickCover(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const cover = await uploadCircleCover(file);
      setCoverKey(cover.coverKey);
      setCoverUrl(cover.coverUrl);
      setCoverTouched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That cover image did not upload.");
    } finally {
      setUploading(false);
    }
  }

  function clearCover() {
    setCoverKey(null);
    setCoverUrl(null);
    setCoverTouched(true);
  }

  function toggleCategory(itemType: BuiltInType) {
    setPicked((prev) =>
      prev.includes(itemType)
        ? prev.filter((current) => current !== itemType)
        : [...prev, itemType],
    );
  }

  /**
   * A category invented here belongs to this circle and no other, so the only
   * thing to check is that it does not collide with what this form already has.
   */
  function addCategory() {
    const trimmed = newCategory.trim();
    if (!trimmed) {
      setError("Give the category a name.");
      return;
    }
    const key = normalizeName(trimmed);
    const clash =
      custom.some((entry) => normalizeName(entry.name) === key) ||
      BUILT_IN_CATEGORIES.some((entry) => normalizeName(entry.name) === key);
    if (clash) {
      setError(`This circle already has a category like “${trimmed}”.`);
      return;
    }
    setCustom((prev) => [...prev, { name: trimmed, icon: newIcon }]);
    setNewCategory("");
    setNewIcon(DEFAULT_CATEGORY_ICON);
    setAdding(false);
    setError(null);
  }

  function toggleInvitee(id: string) {
    setInvitees((prev) => (prev.includes(id) ? prev.filter((current) => current !== id) : [...prev, id]));
  }

  /**
   * Which circles this one could be a branch of.
   *
   * Three rules, and each of them is one the server keeps too. It has to be a
   * circle the member **keeps**, since adding a branch to an organisation is
   * that organisation's business. It cannot be **Discover**, which is the circle
   * everybody lands in rather than an organisation with chapters. And it cannot
   * itself be a **branch**: the hierarchy is one level deep — an organisation
   * and the places it has — because two levels of indent on a phone is a list
   * nobody can read and a tree nobody asked for.
   */
  const parentChoices = circles
    .filter((option) => option.id !== circle?.id)
    .filter((option) => option.role === "owner" || option.role === "admin")
    .filter((option) => !option.isDefault && !option.parentCircleId)
    .sort((a, b) => a.name.localeCompare(b.name));

  /** A circle that has chapters of its own cannot also become somebody's chapter. */
  const hasOwnBranches = Boolean(circle) && circles.some((row) => row.parentCircleId === circle?.id);
  /**
   * The organisation it is already under, even where the member does not keep
   * that organisation: the field has to be able to say what is true, and
   * detaching your own circle is allowed whatever the parent says.
   */
  const currentParent = circle?.parentCircleId
    ? (circles.find((row) => row.id === circle.parentCircleId) ?? null)
    : null;
  /**
   * A circle the form was preset with, where the member keeps it as the app
   * admin rather than as its owner or admin: `parentChoices` asks the narrower
   * question, so the option has to be named explicitly or "Add branch" would
   * open a form with the parent quietly missing.
   */
  const presetParent =
    preset && !parentChoices.some((option) => option.id === preset.id) ? preset : null;
  const showBranchField =
    !circle?.isDefault &&
    (parentChoices.length > 0 || Boolean(circle?.parentCircleId) || Boolean(preset));

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the circle a name.");
      return;
    }

    // Nothing ticked would leave a circle with nowhere to share anything.
    if (!editing && picked.length === 0 && custom.length === 0) {
      setError("Pick at least one thing this circle is for.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const input: NewCircle = {
        name: trimmed,
        description: description.trim() || null,
        icon,
        privacy,
        memberTaxonomy,
      };
      // Leaving coverKey out of an edit keeps whatever cover is already there.
      if (coverTouched || !editing) input.coverKey = coverKey;
      // The same three-state read: sent when it says something, left out when
      // this form never asked, so a circle's parent is never cleared by accident.
      if (showBranchField && parentId !== (circle?.parentCircleId ?? null)) {
        input.parentCircleId = parentId;
      } else if (!editing && parentId !== null) {
        input.parentCircleId = parentId;
      }
      if (!editing) {
        const categories: NewCategory[] = [
          ...BUILT_IN_CATEGORIES.filter((entry) => picked.includes(entry.itemType)).map((entry) => ({
            itemType: entry.itemType,
          })),
          ...custom,
        ];
        input.categories = categories;
      }
      if (!editing && invitees.length > 0) input.inviteMemberIds = invitees;
      await onSubmit(input);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That circle could not be saved.");
      setBusy(false);
    }
  }

  return (
    <Modal
      eyebrow={editing ? "Edit circle" : "New circle"}
      title={editing ? name || "Your circle" : "Start a circle"}
      onClose={onClose}
      busy={busy}
    >
      <label className="field">
        <span>Circle name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          autoFocus
        />
      </label>

      <label className="field">
        <span>Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this circle is for, and who it is for."
          rows={3}
          maxLength={600}
        />
      </label>

      {showBranchField &&
        (hasOwnBranches ? (
          <div className="field">
            <span className="field-label">Branch of</span>
            <p className="field-hint">
              This circle has branches of its own, so it cannot also be a branch. Detach them first
              if you want to move it under another circle.
            </p>
          </div>
        ) : (
          <label className="field">
            <span>Branch of</span>
            <select
              value={parentId === null ? "none" : String(parentId)}
              onChange={(e) => setParentId(e.target.value === "none" ? null : Number(e.target.value))}
            >
              <option value="none">None — independent circle</option>
              {presetParent && (
                <option value={presetParent.id}>
                  {presetParent.icon} {presetParent.name}
                </option>
              )}
              {currentParent && !parentChoices.some((option) => option.id === currentParent.id) && (
                <option value={currentParent.id}>
                  {currentParent.icon} {currentParent.name}
                </option>
              )}
              {parentChoices.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.icon} {option.name}
                </option>
              ))}
            </select>
            <p className="field-hint">
              A branch belongs to another circle organisationally and nothing more — it keeps its
              own members, admins, categories and posts, and joining one is not joining the other.
              You can call it just “Austin”; the circle above it supplies the rest.
            </p>
          </label>
        ))}

      <fieldset className="field">
        <legend>Icon</legend>
        <div className="icon-grid">
          {ICONS.map((option) => (
            <button
              key={option}
              type="button"
              className={option === icon ? "icon-option icon-option-on" : "icon-option"}
              onClick={() => setIcon(option)}
              aria-pressed={option === icon}
              aria-label={`Icon ${option}`}
            >
              {option}
            </button>
          ))}
        </div>
        <label className="icon-own">
          <span>Or use your own</span>
          <input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            maxLength={8}
            aria-label="Circle icon"
          />
        </label>
      </fieldset>

      <div className="field">
        <span className="field-label">Cover image (optional)</span>
        {coverUrl && <img className="cover-preview" src={coverUrl} alt="" />}
        <div className="cover-actions">
          <label className="btn btn-ghost cover-pick">
            {uploading ? "Uploading…" : coverUrl ? "Change image" : "Choose an image"}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => pickCover(e.target.files?.[0] ?? null)}
              disabled={uploading || busy}
            />
          </label>
          {coverUrl && (
            <button type="button" className="btn-text" onClick={clearCover} disabled={busy}>
              Remove
            </button>
          )}
        </div>
      </div>

      {!editing && (
        <fieldset className="field">
          <legend>What this circle is for</legend>
          <p className="field-hint">
            Only what you tick can be shared here. You can change this later, and switching a
            category off never deletes what is already in it.
          </p>
          <div className="category-picker">
            {BUILT_IN_CATEGORIES.map((entry) => (
              <label
                key={entry.itemType}
                className={
                  picked.includes(entry.itemType) ? "category-row category-row-on" : "category-row"
                }
              >
                <input
                  type="checkbox"
                  checked={picked.includes(entry.itemType)}
                  onChange={() => toggleCategory(entry.itemType)}
                />
                <span aria-hidden="true">{entry.icon}</span>
                <span>{entry.name}</span>
              </label>
            ))}
            {custom.map((entry) => (
              <div key={entry.name} className="category-row category-row-on">
                <span aria-hidden="true">{entry.icon}</span>
                <span>{entry.name}</span>
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => setCustom((prev) => prev.filter((row) => row !== entry))}
                  aria-label={`Remove ${entry.name}`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {adding ? (
            <div className="category-add">
              <label className="field">
                <span>Category name</span>
                <input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  maxLength={40}
                  autoFocus
                />
              </label>
              <div className="field">
                <span className="field-label">Icon</span>
                <div className="icon-grid">
                  {CATEGORY_ICONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={option === newIcon ? "icon-option icon-option-on" : "icon-option"}
                      onClick={() => setNewIcon(option)}
                      aria-pressed={option === newIcon}
                      aria-label={`Icon ${option}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <label className="icon-own">
                  <span>Or use your own</span>
                  <input
                    value={newIcon}
                    onChange={(e) => setNewIcon(e.target.value)}
                    maxLength={8}
                    aria-label="Category icon"
                  />
                </label>
              </div>
              <div className="category-add-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setAdding(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={addCategory}>
                  Add category
                </button>
              </div>
              <p className="field-hint">This category belongs to this circle alone.</p>
            </div>
          ) : (
            <button type="button" className="btn-text" onClick={() => setAdding(true)}>
              + Add category
            </button>
          )}
        </fieldset>
      )}

      <fieldset className="field privacy-picker">
        <legend>Privacy</legend>
        {PRIVACY.map((option) => (
          <label key={option.value} className="privacy-option">
            <input
              type="radio"
              checked={privacy === option.value}
              onChange={() => setPrivacy(option.value)}
            />
            <span>
              <strong>{option.label}</strong>
              <small>{option.hint}</small>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="field privacy-picker">
        <legend>Who can add subcategories</legend>
        <label className="privacy-option">
          <input
            type="radio"
            checked={memberTaxonomy}
            onChange={() => setMemberTaxonomy(true)}
          />
          <span>
            <strong>Anybody in the circle</strong>
            <small>
              A member can add a subcategory while they are posting, under whichever one they
              are filing into.
            </small>
          </span>
        </label>
        <label className="privacy-option">
          <input
            type="radio"
            checked={!memberTaxonomy}
            onChange={() => setMemberTaxonomy(false)}
          />
          <span>
            <strong>Only you and the circle’s admins</strong>
            <small>
              Members still choose any subcategory that exists, at any level. They just cannot
              invent one.
            </small>
          </span>
        </label>
      </fieldset>

      {!editing && (
        <fieldset className="field">
          <legend>Invite from your contacts</legend>
          {contacts.length === 0 ? (
            <p className="field-hint">
              Nobody else is in the group yet. Once the circle exists, “Invite people” on its page
              gives you a link that brings a friend straight into it.
            </p>
          ) : (
            <div className="contact-list">
              {contacts.map((contact) => (
                <label
                  key={contact.id}
                  className={
                    invitees.includes(contact.id) ? "contact-row contact-row-on" : "contact-row"
                  }
                >
                  <input
                    type="checkbox"
                    checked={invitees.includes(contact.id)}
                    onChange={() => toggleInvitee(contact.id)}
                  />
                  <span>{contact.name}</span>
                </label>
              ))}
            </div>
          )}
          {invitees.length > 0 && (
            <p className="field-hint">
              {invitees.length} {invitees.length === 1 ? "person" : "people"} will be invited. Each
              one decides whether to join.
            </p>
          )}
        </fieldset>
      )}

      <ErrorLine message={error} />

      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={submit} disabled={busy || uploading}>
          {busy ? "Saving…" : editing ? "Save changes" : "Create circle"}
        </button>
      </div>
    </Modal>
  );
}
