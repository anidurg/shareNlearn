// src/components/ManageFields.tsx
// "Manage fields": the one admin view behind every category's own questions.
//
// It exists because configuring a form and filling one in are two different jobs
// that used to share a screen. The "+" that adds a question lived on the share
// form itself, which meant a keeper who wanted to add "PDF version of the book"
// had to start writing a book entry they did not want in order to reach it, and
// the only way to rename, reorder or switch one off was a panel with no door into
// it at all. So the questions get their own view: a list of what the category
// asks, a ⋯ on each row, and "+ Add field" under them.
//
// It shows the **whole form** rather than only the part that is stored: the
// built-in questions the form ships with are listed first, locked, so a keeper
// deciding what to add can read what is already asked. Those rows are a
// description of `SongModal`, `BookModal` and `PostModal` — there is no row
// anywhere to rename or reorder — so they carry no actions at all rather than
// pretending to rules the forms do not have.
//
// One view for every category, because there is one field system. A category the
// circle invented, its Songs and its Books all reach the same list through the
// same door, and adding a third built-in to `FIELDED_BUILT_INS` gives that one
// the same view for free.
//
// It decides nothing about permission beyond whether to draw the door:
// `canAddFields()` is the client's copy of the server's answer, and every route
// behind it is gated on `moderatorOf()` for that particular circle, so a member
// who reaches this markup some other way is refused all the same.
import { useEffect, useState } from "react";
import {
  AUDIO_WAY_OPTIONS,
  FIELD_KIND_OPTIONS,
  FIELD_FILE_TYPE_OPTIONS,
  MAX_FIELDS_PER_CATEGORY,
  MAX_FIELD_FILE_BYTES,
  MAX_FILES_PER_FIELD,
  UPLOAD_KIND_OPTIONS,
  formatBytes,
  type AudioWay,
  type CategoryField,
  type CircleCategory,
  type FieldFileType,
  type FieldKind,
  type UploadKind,
} from "../api";
import {
  builtInCategoryFor,
  builtInFormFields,
  canAddFields,
  fieldTypeText,
  orderedFields,
  takesOptions,
  type BuiltInFormField,
  type FieldedBuiltIn,
} from "../fields";
import type { ShareAndLearn } from "../store";
import type { SheetAction } from "./ActionSheet";
import { Icon } from "./Icons";
import {
  deleteAction,
  disableAction,
  ManageConfirm,
  ManageRow,
  moveActions,
} from "./ManageRow";
import { ErrorLine, Modal } from "./shared";

/**
 * The suggested help text on an upload field, offered where a circle is plainly
 * asking for a copy of something somebody else wrote. It is a suggestion rather
 * than a rule — the app cannot know what anybody has permission to share — and it
 * is worded as the one thing that is always true: upload it if it is yours to
 * upload.
 */
const RIGHTS_NOTE = "Upload only if you own the rights or have permission to share this file.";

/**
 * The door. Drawn for the circle's owner, its admins and the app admin, and for
 * nobody else, which is why every caller is one line: the button decides for
 * itself whether it exists.
 */
export function ManageFieldsButton({
  store,
  category,
  className = "btn btn-ghost",
  label = "Manage fields",
}: {
  store: ShareAndLearn;
  category: CircleCategory;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!canAddFields(store, category)) return null;
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <ManageFieldsModal store={store} category={category} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

/**
 * The same door for one of the built-in kinds, named by the circle in view: the
 * Books category of this circle rather than every circle's copy of Books, since a
 * field belongs to one circle's form. With no circle in view there is no single
 * answer, so nothing is drawn — a keeper narrows to the circle first, which is
 * the same thing every other circle-shaped control asks of them.
 */
export function BuiltInFieldsButton({
  store,
  itemType,
  circleId,
  className,
  label,
}: {
  store: ShareAndLearn;
  itemType: FieldedBuiltIn;
  circleId: number | null;
  className?: string;
  label?: string;
}) {
  const category = builtInCategoryFor(store.categories, itemType, circleId);
  if (!category) return null;
  return (
    <ManageFieldsButton
      store={store}
      category={category}
      className={className}
      label={label}
    />
  );
}

/**
 * The view itself, in a modal rather than on the page. Two of its three doors are
 * on a form that is already half filled in — the share form's own "Manage
 * fields" — and a keeper answering a question about the form should not lose what
 * they had typed into it.
 */
export function ManageFieldsModal({
  store,
  category,
  onClose,
}: {
  store: ShareAndLearn;
  category: CircleCategory;
  onClose: () => void;
}) {
  return (
    <Modal eyebrow={category.name} title="Manage fields" onClose={onClose}>
      <ManageFields store={store} category={category} />
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}

/** One of three things: the list, the form for one field, or a confirmation. */
type Panel =
  | { view: "list" }
  | { view: "form"; field: CategoryField | null }
  | { view: "remove"; field: CategoryField };

/**
 * The list of questions and everything a keeper does to them. Compact on purpose:
 * a row is the label, what kind of answer it takes and whether it is required,
 * and everything else is behind the ⋯ — which is what keeps a category asking
 * twelve things readable on a 360px screen.
 */
export function ManageFields({
  store,
  category: given,
}: {
  store: ShareAndLearn;
  category: CircleCategory;
}) {
  const [panel, setPanel] = useState<Panel>({ view: "list" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A share form reads the member's own view of the categories, and that view has
  // the switched-off fields taken out of it — rightly, since it is the list of
  // questions to ask. A manager's view of one circle keeps them, which is the
  // whole difference between a field that can be switched back on and one that
  // has silently gone, so this panel reads that list and asks for it if the
  // circle's own page has not already fetched it.
  const fuller = (store.circleCategories[given.circleId] ?? []).find(
    (row) => row.id === given.id,
  );
  const category = fuller ?? given;

  useEffect(() => {
    if (fuller) return;
    void store.loadCircleCategories(given.circleId).catch(() => {
      // Nothing to say: the panel still has the member's own view to work from,
      // which is every question except the ones already switched off.
    });
  }, [fuller, given.circleId, store]);

  const fields = orderedFields(category);
  // What the form asks before anybody adds anything to it. Described rather than
  // stored, so the list is read from the kind of category this is: `null` is one a
  // circle invented, and the two built-ins opened up to questions have their own
  // hand-built forms to describe.
  const builtIns: BuiltInFormField[] = builtInFormFields(category.itemType);
  const full = fields.length >= MAX_FIELDS_PER_CATEGORY;

  function run(key: string, action: Promise<unknown>, after?: () => void) {
    setBusy(key);
    setError(null);
    action
      .then(() => after?.())
      .catch((err) => setError(err instanceof Error ? err.message : "That did not work."))
      .finally(() => setBusy(null));
  }

  /** Moving is between neighbours, which is the only place the order means anything. */
  function move(field: CategoryField, delta: number) {
    const order = fields.map((row) => row.id);
    const at = order.indexOf(field.id);
    const to = at + delta;
    if (to < 0 || to >= order.length) return;
    [order[at], order[to]] = [order[to], order[at]];
    run(`order:${field.id}`, store.reorderFields(category.circleId, category.id, order));
  }

  /**
   * What the ⋯ holds, built from what this row can actually do rather than from a
   * longer list with rows greyed out: the first field has no "Move up". The
   * recurring three come from `ManageRow`, so a field, a category and a
   * subcategory all word them the same way.
   */
  function actionsFor(field: CategoryField, index: number): SheetAction[] {
    return [
      {
        key: "edit",
        label: "Edit",
        glyph: "✏️",
        onSelect: () => setPanel({ view: "form", field }),
      },
      ...moveActions(index, fields.length, (delta) => move(field, delta)),
      // Whether an answer is compulsory is the one part of a field a keeper
      // changes oftener than they rewrite it, so it is here as well as inside
      // Edit. It binds new entries and edits from now on and chases nobody for
      // an answer they were never asked for.
      {
        key: "required",
        label: field.required ? "Make optional" : "Make required",
        glyph: field.required ? "○" : "●",
        note: "from now on",
        onSelect: () =>
          run(
            `required:${field.id}`,
            store.editField(category.circleId, category.id, field.id, {
              required: !field.required,
            }),
          ),
      },
      disableAction(
        field.hidden,
        () =>
          run(
            `hide:${field.id}`,
            store.editField(category.circleId, category.id, field.id, { hidden: !field.hidden }),
          ),
        "answers keep",
      ),
      deleteAction(() => setPanel({ view: "remove", field })),
    ];
  }

  if (panel.view === "form") {
    return (
      <FieldForm
        store={store}
        category={category}
        field={panel.field}
        onDone={() => setPanel({ view: "list" })}
      />
    );
  }

  if (panel.view === "remove") {
    const field = panel.field;
    return (
      <div className="field-admin">
        <ManageConfirm
          title={`Delete “${field.label}”?`}
          error={error}
          busy={busy === `remove:${field.id}`}
          busyLabel="Deleting…"
          confirmLabel="Delete the field"
          onCancel={() => setPanel({ view: "list" })}
          onConfirm={() =>
            run(
              `remove:${field.id}`,
              store.removeField(category.circleId, category.id, field.id),
              () => setPanel({ view: "list" }),
            )
          }
        >
          <p>
            Every answer anybody gave to it goes too, and nothing else on their entries changes. If
            you only want the form to stop asking, disable it instead — the answers keep, and
            enabling it again brings them with it.
          </p>
        </ManageConfirm>
      </div>
    );
  }

  return (
    <div className="field-admin">
      <p className="muted">
        The whole {category.name} form in this circle, in the order it is asked. The locked rows
        are built in and are the same wherever {category.name} appears; the rest are this circle's
        own, and a new one is asked of everybody sharing from now on and never changes an answer
        already given.
      </p>

      <ErrorLine message={error} />

      <ul className="manage-list">
        {/*
          The built-in half of the form: what the entry form already collects, so a
          keeper can see that Books asks for the author before adding a field that
          asks again. They are markup rather than rows in a table, which is why the
          lock is honest — there is nothing here to rename, reorder or switch off,
          so the ⋯ holds nothing and says so by being unavailable.
        */}
        {builtIns.map((field) => (
          <ManageRow
            key={`built-in:${field.key}`}
            name={field.label}
            tag={
              // The row's own words say "Built-in" as well, so the lock needs no
              // hidden label of its own — it is the quick read rather than the
              // only place the status is written.
              <span className="manage-lock" title="Built in — part of the form itself">
                <Icon name="lock" />
              </span>
            }
            meta={
              <>
                {field.type}
                {" · "}
                {field.required ? "Required" : "Optional"}
                {field.several ? " · several" : ""}
                {" · Built-in"}
              </>
            }
            actions={[]}
          />
        ))}

        {fields.map((field, index) => (
          <ManageRow
            key={field.id}
            name={field.label}
            tag={field.hidden ? <span className="tag">Off</span> : undefined}
            meta={
              <>
                {fieldTypeText(field)}
                {" · "}
                {field.required ? "Required" : "Optional"}
                {field.kind === "file" && field.multiple ? " · several" : ""}
                {" · Custom"}
              </>
            }
            sheetSubtitle={`${fieldTypeText(field)} · ${
              field.required ? "Required" : "Optional"
            }`}
            busy={busy !== null}
            actions={actionsFor(field, index)}
          />
        ))}
      </ul>

      {fields.length === 0 && (
        <p className="muted">
          Nothing has been added to it yet — everything above is the built-in form.
        </p>
      )}

      {full ? (
        <p className="muted">
          {category.name} is already asking {MAX_FIELDS_PER_CATEGORY} questions, which is as many
          as we allow. Remove one to make room for another.
        </p>
      ) : (
        <button
          type="button"
          className="btn btn-ghost field-admin-add"
          onClick={() => setPanel({ view: "form", field: null })}
        >
          <Icon name="plus" /> Add field
        </button>
      )}
    </div>
  );
}

/**
 * One question, being written or rewritten. The same form both ways round, so a
 * field can be corrected exactly as it was made and there is one place the six
 * kinds and their settings are asked about.
 */
function FieldForm({
  store,
  category,
  field,
  onDone,
}: {
  store: ShareAndLearn;
  category: CircleCategory;
  /** Null to add a new question, a field to change that one. */
  field: CategoryField | null;
  onDone: () => void;
}) {
  const [label, setLabel] = useState(field?.label ?? "");
  const [kind, setKind] = useState<FieldKind>(field?.kind ?? "text");
  const [options, setOptions] = useState((field?.options ?? []).join("\n"));
  const [required, setRequired] = useState(field?.required ?? false);
  const [hint, setHint] = useState(field?.hint ?? "");
  const [uploadKind, setUploadKind] = useState<UploadKind>(field?.uploadKind ?? "document");
  const [fileTypes, setFileTypes] = useState<FieldFileType[]>(field?.fileTypes ?? []);
  const [maxBytes, setMaxBytes] = useState<number | null>(field?.maxBytes ?? null);
  const [multiple, setMultiple] = useState(field?.multiple ?? false);
  const [audioWays, setAudioWays] = useState<AudioWay[]>(field?.audioWays ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const note = FIELD_KIND_OPTIONS.find((option) => option.id === kind)?.note;

  /**
   * Choosing "Upload" is nearly always a circle asking for somebody's document —
   * a PDF of a book, a scan of a recipe — so the sentence about rights is put in
   * front of them rather than left to be thought of. It is prefilled only into an
   * empty box and can be typed over or cleared, because it is a suggestion.
   */
  function chooseKind(next: FieldKind) {
    setKind(next);
    if (next === "file" && hint.trim() === "") setHint(RIGHTS_NOTE);
  }

  /**
   * An empty list means all three, which is what every field written before a
   * circle could narrow one already says. So unticking one of three that are only
   * ticked because the list is empty has to write the other two down rather than
   * leaving the absence to be read as "all of them" again.
   */
  function toggleType(id: FieldFileType) {
    setFileTypes((prev) => {
      const all = FIELD_FILE_TYPE_OPTIONS.map((option) => option.id);
      const current = prev.length === 0 ? all : prev;
      const next = current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id];
      // Back to all three, or down to none, is the same thing: take any of them.
      return next.length === all.length || next.length === 0 ? [] : next;
    });
  }

  /**
   * The same absence rule for the two ways of answering an audio field: an empty
   * list means both, which is what a field written before audio existed would say
   * if it were one, so unticking one of two that are only ticked because nothing
   * was stored has to write the other one down. Unticking both lands back on
   * both rather than on a field nobody can answer.
   */
  function toggleWay(id: AudioWay) {
    setAudioWays((prev) => {
      const all = AUDIO_WAY_OPTIONS.map((option) => option.id);
      const current = prev.length === 0 ? all : prev;
      const next = current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id];
      return next.length === all.length || next.length === 0 ? [] : next;
    });
  }

  async function save() {
    const clean = label.trim();
    if (!clean) return;
    const list = options
      .split(/\r?\n|,/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    // Both kinds that draw their answers from a list need one to be worth asking.
    if (takesOptions(kind) && list.length === 0) {
      setError(
        kind === "select"
          ? "A dropdown needs something to choose from."
          : "Tick boxes need something to tick.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // The upload rules travel whatever the kind is: the server drops them on
      // anything that is not an upload, so a field changed from a file to a line
      // of text does not keep rules that would mean nothing.
      const changes = {
        label: clean,
        kind,
        options: list,
        hint: hint.trim() || null,
        required,
        uploadKind,
        fileTypes,
        maxBytes,
        multiple,
        audioWays,
      };
      if (field) await store.editField(category.circleId, category.id, field.id, changes);
      else await store.addField(category.circleId, category.id, changes);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That field could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field-admin">
      <h3 className="section-title">{field ? `Edit “${field.label}”` : "Add a field"}</h3>

      <label className="field">
        <span>Field label</span>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={60}
          autoFocus
        />
        <span className="field-hint">What everybody sharing to {category.name} is asked.</span>
      </label>

      <label className="field">
        <span>Field type</span>
        <select value={kind} onChange={(e) => chooseKind(e.target.value as FieldKind)}>
          {FIELD_KIND_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        {note && <span className="field-hint">{note}</span>}
      </label>

      {takesOptions(kind) && (
        <label className="field">
          <span>The choices</span>
          <textarea rows={3} value={options} onChange={(e) => setOptions(e.target.value)} />
          <span className="field-hint">
            One per line, in the order they should be offered.
            {kind === "multiselect"
              ? " Members can tick as many as apply."
              : " Members pick exactly one."}
          </span>
        </label>
      )}

      {kind === "file" && (
        <div className="field-upload-rules">
          {/*
            What an upload actually asks for. It is the question before all the
            others, because the rules underneath it are not the same two lists: a
            document is asked which formats and how big, and a recording is asked
            how somebody may answer it. Which is also why "Upload" itself no
            longer carries a sentence saying what it takes — the answer is this
            question rather than anything a description could cover.
          */}
          <label className="field">
            <span>Upload kind</span>
            <select
              value={uploadKind}
              onChange={(e) => setUploadKind(e.target.value as UploadKind)}
            >
              {UPLOAD_KIND_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {uploadKind === "document" && (
            <>
              <fieldset className="field">
                <legend>Allowed file types</legend>
                <div className="field-types">
                  {FIELD_FILE_TYPE_OPTIONS.map((option) => (
                    <label className="field-checkbox" key={option.id}>
                      <input
                        type="checkbox"
                        checked={fileTypes.length === 0 || fileTypes.includes(option.id)}
                        onChange={() => toggleType(option.id)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
                <span className="field-hint">
                  Choose which document types people can upload.
                </span>
              </fieldset>

              <label className="field">
                <span>Max file size</span>
                <select
                  value={maxBytes === null ? "" : String(maxBytes)}
                  onChange={(e) =>
                    setMaxBytes(e.target.value === "" ? null : Number(e.target.value))
                  }
                >
                  <option value="">Up to {formatBytes(MAX_FIELD_FILE_BYTES)}</option>
                  <option value={1024 * 1024}>1 MB</option>
                  <option value={2 * 1024 * 1024}>2 MB</option>
                  <option value={5 * 1024 * 1024}>5 MB</option>
                </select>
                <span className="field-hint">
                  {formatBytes(MAX_FIELD_FILE_BYTES)} is as much as one file may hold, so a field
                  can ask for less and never for more.
                </span>
              </label>

              <label className="field">
                <span>How many files</span>
                <select
                  value={multiple ? "several" : "one"}
                  onChange={(e) => setMultiple(e.target.value === "several")}
                >
                  <option value="one">One file</option>
                  <option value="several">Several — up to {MAX_FILES_PER_FIELD}</option>
                </select>
              </label>
            </>
          )}

          {uploadKind === "audio" && (
            <fieldset className="field">
              <legend>How can people add audio?</legend>
              <div className="field-types">
                {AUDIO_WAY_OPTIONS.map((option) => (
                  <label className="field-checkbox" key={option.id}>
                    <input
                      type="checkbox"
                      checked={audioWays.length === 0 || audioWays.includes(option.id)}
                      onChange={() => toggleWay(option.id)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <span className="field-hint">
                Allow people to record audio, upload an audio file, or both.
              </span>
            </fieldset>
          )}
        </div>
      )}

      {/*
        Whether an answer is compulsory is one bit, so it is one tick rather than a
        dropdown of two sentences, and it is unticked until somebody says otherwise.
        It sits below the kind's own settings because it is the last thing decided
        about a question rather than part of what the question is.
      */}
      <label className="field field-checkbox">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
        />
        <span>Required field</span>
      </label>

      <label className="field">
        <span>Help text</span>
        <input
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          maxLength={120}
          placeholder="Optional — a line of help under the field"
        />
        {kind === "file" && hint.trim() !== RIGHTS_NOTE && (
          <button type="button" className="btn-text" onClick={() => setHint(RIGHTS_NOTE)}>
            Use: “{RIGHTS_NOTE}”
          </button>
        )}
      </label>

      <ErrorLine message={error} />

      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onDone} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={save}
          disabled={busy || !label.trim()}
        >
          {busy ? "Saving…" : field ? "Save the field" : "Add the field"}
        </button>
      </div>
    </div>
  );
}
