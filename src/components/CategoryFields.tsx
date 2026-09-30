import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AUDIO_ACCEPT,
  FIELD_FILE_TYPE_OPTIONS,
  MAX_FIELD_FILE_BYTES,
  MAX_FILES_PER_FIELD,
  MAX_UPLOAD_BYTES,
  fieldFileAccept,
  fieldFileTypesLabel,
  fieldFilesValue,
  formatBytes,
  isAudioFileName,
  linkLabel,
  notAudioReason,
  parseFieldFiles,
  uploadFieldAudio,
  uploadFieldFile,
  webAddress,
  type AudioWay,
  type CategoryField,
  type CircleCategory,
  type FieldFile,
  type PostFieldValue,
} from "../api";
import {
  answerList,
  askedFields,
  audioWaysOf,
  choicesOffered,
  type FieldedBuiltIn,
} from "../fields";
import type { IncomingAttachment } from "../incoming-share";
import {
  AudioRecorder,
  canRecordAudio,
  readAudioDuration,
  useAudioRecorder,
} from "./AudioRecorder";
import type { ShareAndLearn } from "../store";
import { ErrorLine } from "./shared";
import { DocumentViewer } from "./DocumentViewer";

/**
 * The extra questions a category invented for itself. Every custom category
 * shares one hand-built form — a title, some details, a shelf — so this is how a
 * circle makes that form actually fit what it is for: Stotras asks which deity,
 * Travelogue asks which country and who you went with, Festivals asks whether you
 * tried it.
 *
 * This file is the **answering** side of that and nothing else. Unlike a
 * subcategory, which any member may add while posting, a field is the shape of
 * the form itself: everybody afterwards is asked it, and a needed one they have
 * to answer. So deciding the questions is a keeper's job on a screen of its own —
 * `ManageFields` — and this form only ever renders what has been decided. It used
 * to carry a "Manage fields" door of its own, which put a form's configuration
 * inside the form: nobody should be half way through writing a book in order to
 * change what the Books form asks, and a keeper mid-entry now reaches the same
 * view from the category page or the tab header instead.
 */

/**
 * The answers a form starts with: what the share said, keyed by question. A post
 * and a song both carry `fieldValues`, so this takes either.
 */
export function initialAnswers(item?: {
  fieldValues?: PostFieldValue[] | null;
}): Record<number, string> {
  const answers: Record<number, string> = {};
  for (const row of item?.fieldValues ?? []) answers[row.fieldId] = row.value;
  return answers;
}

/*
 * Who may reshape a form, which built-in kinds can be asked anything at all, and
 * which questions are still being asked all live in `src/fields.ts` now. They had
 * to leave this file when the admin view got a door of its own: this file draws
 * that door, so it imports the panel, and the panel needs the same three answers.
 * A module cannot be both above and below another one.
 */

/**
 * Whether this particular question could hold a file that arrived from the
 * device's share sheet.
 *
 * It is the same test `FileFieldInput` and `AudioFieldInput` already apply to a
 * file the member picks by hand, asked one step earlier: a recording only answers
 * a field that asked for audio, a document only answers one that asked for a
 * document of that format, and a field with its own smaller ceiling only answers
 * for a file inside it — the server refuses the rest whatever the browser does, so
 * seeding one of those would be offering an answer that cannot be saved.
 *
 * Exported because two surfaces have to agree about it: the seeding below, and the
 * note on the incoming-share screen that says this circle asks for no such file.
 */
export function fieldTakesAttachment(
  field: CategoryField,
  attachment: IncomingAttachment,
): boolean {
  if (field.kind !== "file" || field.hidden) return false;
  if (field.maxBytes !== null && attachment.file.size > field.maxBytes) return false;
  if (attachment.uploadKind === "audio") return field.uploadKind === "audio";
  if (field.uploadKind === "audio") return false;
  // An empty list is the field saying "any of the three", which is what every
  // upload field written before the column existed reads as.
  return (
    field.fileTypes.length === 0 ||
    (attachment.fileType !== null && field.fileTypes.includes(attachment.fileType))
  );
}

/** Whether any question this category still asks could hold that file. */
export function categoryTakesAttachment(
  category: CircleCategory,
  attachment: IncomingAttachment,
): boolean {
  return askedFields(category).some((field) => fieldTakesAttachment(field, attachment));
}

export function FieldInputs({
  category,
  values,
  onChange,
  attachment,
}: {
  category: CircleCategory;
  values: Record<number, string>;
  onChange: (next: Record<number, string>) => void;
  /**
   * A document, recording or clip that came in from the device's share sheet,
   * already uploaded. It answers the first question this category asks that could
   * hold it, exactly as it would if the member had picked the file by hand — which
   * is why what it writes is `fieldFilesValue()` and not a shape of its own.
   */
  attachment?: IncomingAttachment;
}) {
  const fields = useMemo(() => askedFields(category), [category]);

  function set(fieldId: number, value: string) {
    onChange({ ...values, [fieldId]: value });
  }

  /*
   * Seeding that file into the form, once, and only where the member has not
   * already answered the question themselves.
   *
   * The ref rather than a look at `values` is what makes it once: a guard reading
   * the answers it also writes would re-run on the render its own write caused,
   * and `onChange` spreads a `values` this closure captured — so two seedings in
   * one commit would each clobber the other rather than adding up.
   */
  const seeded = useRef(false);
  useEffect(() => {
    if (!attachment || seeded.current) return;
    const field = fields.find(
      (row) => fieldTakesAttachment(row, attachment) && !(values[row.id] ?? ""),
    );
    if (!field) return;
    seeded.current = true;
    onChange({ ...values, [field.id]: fieldFilesValue([attachment.file]) });
  }, [attachment, fields, values, onChange]);

  // Nothing to ask is nothing to draw, for everybody alike now: there is no
  // admin control down here to keep an empty block on screen for.
  if (fields.length === 0) return null;

  return (
    <div className="category-fields">
      {fields.map((field) => (
        <FieldInput
          key={field.id}
          field={field}
          value={values[field.id] ?? ""}
          onChange={(value) => set(field.id, value)}
        />
      ))}
    </div>
  );
}

/**
 * The same questions for one of the built-in kinds that can be asked them. A song
 * or a book may go to several circles at once and each keeps its own copy of the
 * category, so this is one `FieldInputs` per chosen circle — which is exactly the
 * union of fields the server checks the answers against. With one circle chosen it
 * reads as a single list, and only when there are two does it need to say which
 * circle is asking.
 *
 * It takes the kind rather than assuming one, so opening a third built-in up is a
 * new wrapper below and nothing else.
 */
export function BuiltInFields({
  itemType,
  store,
  categories,
  circleIds,
  values,
  onChange,
  attachment,
}: {
  itemType: FieldedBuiltIn;
  store: ShareAndLearn;
  /** Every category of every circle the member is in, as they see them. */
  categories: CircleCategory[];
  circleIds: number[];
  values: Record<number, string>;
  onChange: (next: Record<number, string>) => void;
  /** A file from the device's share sheet, offered to the first circle that asks. */
  attachment?: IncomingAttachment;
}) {
  const asking = useMemo(
    () =>
      categories.filter(
        (category) =>
          category.itemType === itemType &&
          circleIds.includes(category.circleId) &&
          // A circle with nothing to ask would otherwise contribute an empty box
          // with its name on it — and there is no longer a door down here that a
          // keeper needs an empty box in order to reach.
          (category.fields ?? []).some((field) => !field.hidden),
      ),
    [categories, circleIds, itemType],
  );

  if (asking.length === 0) return null;

  return (
    <>
      {asking.map((category, index) => (
        <div key={category.id} className="circle-asks">
          {asking.length > 1 && (
            <p className="field-label">
              {store.circleById.get(category.circleId)?.name ?? "This circle"} asks
            </p>
          )}
          {/* The file is offered to the first circle asking and to no other. Every
              list here writes into one shared set of answers, so two of them
              seeding at once would be two writes spread from the same captured
              `values` — the second landing on top of the first. One offer is the
              whole of the fix, and it is also the honest answer: the share sheet
              handed over one file. */}
          <FieldInputs
            category={category}
            values={values}
            onChange={onChange}
            attachment={index === 0 ? attachment : undefined}
          />
        </div>
      ))}
    </>
  );
}

/** What the circles a recording is going to ask about a song of their own. */
export function SongFields(props: Omit<Parameters<typeof BuiltInFields>[0], "itemType">) {
  return <BuiltInFields itemType="song" {...props} />;
}

/** And the same for a book: which shelf it came off, whether there is one to lend. */
export function BookFields(props: Omit<Parameters<typeof BuiltInFields>[0], "itemType">) {
  return <BuiltInFields itemType="book" {...props} />;
}

/**
 * And for a recipe: who can eat the dish, and what kind of dish it is. Those two
 * were hard-coded lists on the form until a circle that shares only vegetarian
 * food had to be offered "Non-vegetarian" anyway; they are the circle's own tick
 * boxes and its own dropdown now, which is why a recipe reaches this component at
 * all.
 */
export function RecipeFields(props: Omit<Parameters<typeof BuiltInFields>[0], "itemType">) {
  return <BuiltInFields itemType="recipe" {...props} />;
}

/** One question, drawn the way its kind says it should be. */
function FieldInput({
  field,
  value,
  onChange,
}: {
  field: CategoryField;
  value: string;
  onChange: (next: string) => void;
}) {
  if (field.kind === "checkbox") {
    return (
      <label className="field field-checkbox">
        <input
          type="checkbox"
          checked={/^yes$/i.test(value)}
          onChange={(e) => onChange(e.target.checked ? "Yes" : "")}
        />
        <span>
          {field.label}
          {field.required && <span className="field-required"> · needed</span>}
        </span>
        {field.hint && <span className="field-hint">{field.hint}</span>}
      </label>
    );
  }

  if (field.kind === "multiselect") {
    // Tick boxes over the circle's own list, which is the one question a
    // dropdown cannot answer: a sweet is Vegetarian and No onion & garlic both.
    // The answer is stored one choice per line — the shape a word keeps its
    // synonyms in and a recipe kept its menu types in — and derived in the order
    // the choices were offered rather than the order they were tapped, so it
    // reads the same however the form was filled in.
    const chosen = answerList(value);
    const offered = choicesOffered(field.options, chosen);
    function toggle(option: string) {
      const next = chosen.includes(option)
        ? chosen.filter((entry) => entry !== option)
        : [...chosen, option];
      onChange(offered.filter((entry) => next.includes(entry)).join("\n"));
    }
    return (
      <fieldset className="field">
        <legend>
          {field.label}
          {field.required && <span className="field-required"> · needed</span>}
        </legend>
        <div className="tick-choices">
          {offered.map((option) => {
            const on = chosen.includes(option);
            return (
              <label key={option} className={on ? "tick-choice tick-choice-on" : "tick-choice"}>
                <input type="checkbox" checked={on} onChange={() => toggle(option)} />
                <span className="tick-choice-name">{option}</span>
              </label>
            );
          })}
        </div>
        {/* Nothing marks a checkbox group `required` in the browser — the
            attribute would ask for every box rather than for one of them — so a
            needed answer says so in words and the server is what refuses a form
            with none ticked. */}
        {field.hint && <p className="field-hint">{field.hint}</p>}
      </fieldset>
    );
  }

  if (field.kind === "file") {
    // What an upload field takes is its own question, asked once when the keepers
    // made it, so the two answers are two controls rather than one control that
    // tries to be both: a document is picked off the device, and a recording is
    // sung into it or picked, whichever ways the field allows.
    return field.uploadKind === "audio" ? (
      <AudioFieldInput field={field} value={value} onChange={onChange} />
    ) : (
      <FileFieldInput field={field} value={value} onChange={onChange} />
    );
  }

  return (
    <label className="field">
      <span>
        {field.label}
        {field.required && <span className="field-required"> · needed</span>}
      </span>
      {field.kind === "textarea" ? (
        <textarea
          rows={4}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.kind === "select" ? (
        <select required={field.required} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose one…</option>
          {/* An answer the circle has since taken off the list is offered back at
              the end rather than dropped, so re-saving somebody's entry does not
              quietly take the answer they gave. */}
          {choicesOffered(field.options, value ? [value] : []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.kind === "link" ? (
        // `type="url"` is what makes the phone offer a keyboard with a slash on
        // it, and what stops a sentence being saved as an address — the browser
        // refuses the form before the server has to drop the answer.
        <input
          type="url"
          inputMode="url"
          required={field.required}
          maxLength={400}
          placeholder="https://…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          required={field.required}
          maxLength={600}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.hint && <span className="field-hint">{field.hint}</span>}
      {field.kind === "link" && !field.hint && (
        <span className="field-hint">Paste a web address — readers see it as a link to tap.</span>
      )}
    </label>
  );
}

/**
 * A question whose answer is a document. The file goes up the moment it is
 * picked — the same way a photo does — so the form holds a name and a key rather
 * than megabytes, and the member sees what they chose before they save anything.
 * The × takes one back off.
 *
 * What it accepts is the field's own business rather than the platform's: a
 * circle asking for a PDF of a book gets a picker that opens on PDFs, a ceiling
 * it can lower but never raise, and one file or several as the keepers decided.
 * All three are checked here so the refusal is a sentence at pick time, and again
 * on the server, which is the one that counts.
 */
function FileFieldInput({
  field,
  value,
  onChange,
}: {
  field: CategoryField;
  value: string;
  onChange: (next: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chosen = parseFieldFiles(value);
  const ceiling = field.multiple ? MAX_FILES_PER_FIELD : 1;
  const room = ceiling - chosen.length;

  async function take(files: FileList | null) {
    const picked = [...(files ?? [])];
    if (picked.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      // A field taking one file replaces what is there; a field taking several
      // adds to it, up to its own ceiling, and says so rather than dropping the
      // extras quietly.
      const kept = field.multiple ? chosen : [];
      const taking = picked.slice(0, Math.max(ceiling - kept.length, 0));
      if (taking.length < picked.length) {
        setError(`This field takes ${ceiling} file${ceiling === 1 ? "" : "s"}.`);
      }
      const added: FieldFile[] = [];
      for (const file of taking) {
        added.push(
          await uploadFieldFile(file, { types: field.fileTypes, maxBytes: field.maxBytes }),
        );
      }
      onChange(fieldFilesValue([...kept, ...added]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "That file could not be uploaded.");
    } finally {
      setBusy(false);
      // Let the same file be picked again after it is taken back off.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function drop(key: string) {
    onChange(fieldFilesValue(chosen.filter((file) => file.key !== key)));
  }

  return (
    <div className="field file-field">
      <span className="field-label">
        {field.label}
        {field.required && <span className="field-required"> · needed</span>}
      </span>

      {chosen.map((file) => (
        <p className="file-chosen" key={file.key}>
          <a href={file.url} target="_blank" rel="noreferrer">
            {file.name}
          </a>
          {file.size > 0 && <span className="muted"> · {formatBytes(file.size)}</span>}
          <button
            type="button"
            className="file-drop"
            title="Remove this file"
            aria-label={`Remove ${file.name}`}
            onClick={() => drop(file.key)}
          >
            ×
          </button>
        </p>
      ))}

      <input
        ref={inputRef}
        type="file"
        accept={fieldFileAccept(field.fileTypes)}
        multiple={field.multiple}
        className="photo-input"
        onChange={(e) => void take(e.target.files)}
      />
      {room > 0 && (
        <button
          type="button"
          className="btn btn-ghost photo-add"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy
            ? "Uploading…"
            : chosen.length === 0
              ? `+ Upload ${fieldFileTypesLabel(field.fileTypes)}`
              : field.multiple
                ? "+ Add another file"
                : "Choose a different file"}
        </button>
      )}
      <span className="field-hint">
        {field.hint ||
          `${fieldFileTypesLabel(field.fileTypes)}, up to ${formatBytes(
            field.maxBytes || MAX_FIELD_FILE_BYTES,
          )}${field.multiple ? ` — as many as ${MAX_FILES_PER_FIELD}` : ""}.`}
      </span>
      <ErrorLine message={error} />
    </div>
  );
}

/**
 * A question whose answer is a recording. It is the song form's two halves with
 * the song taken out of them: the same `useAudioRecorder` a member sings a
 * keertane into, the same audio picker with the same generous refusal, and the
 * same chunked upload — so there is one recorder in the app and this is its
 * second caller rather than a copy of it.
 *
 * Which of the two ways are on offer is the field's own answer, given when the
 * keepers made it, and a way the browser cannot manage is not offered whatever
 * the field says: a phone with no microphone permission still gets the picker
 * where the field allows one. An audio answer is one recording rather than
 * several, which is what the server stores either way, so a second take replaces
 * the first.
 *
 * What is stored is the same `{ key, name, size }` envelope a document answer is,
 * so every reader, every saved copy in My Library and the blob sweeper carry on
 * knowing nothing about audio.
 */
function AudioFieldInput({
  field,
  value,
  onChange,
}: {
  field: CategoryField;
  value: string;
  onChange: (next: string) => void;
}) {
  const ways = audioWaysOf(field);
  const mayRecord = ways.includes("record") && canRecordAudio;
  const mayUpload = ways.includes("upload");

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [way, setWay] = useState<AudioWay>(mayRecord ? "record" : "upload");
  const inputRef = useRef<HTMLInputElement>(null);
  const recorder = useAudioRecorder({
    onError: setError,
    alternative: mayUpload ? "choose “Upload an audio file” instead" : undefined,
  });
  const chosen = parseFieldFiles(value);

  async function keep(audio: Blob, name: string, durationSeconds: number | null) {
    setBusy(true);
    setProgress(0);
    setError(null);
    try {
      const file = await uploadFieldAudio(audio, { name, durationSeconds }, setProgress);
      // One recording per answer, matching what the server keeps, so a second
      // take is a replacement rather than a pair.
      onChange(fieldFilesValue([file]));
      recorder.again();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That recording could not be uploaded.");
    } finally {
      setBusy(false);
    }
  }

  async function take(picked: File | null) {
    if (!picked) return;
    if (picked.size > MAX_UPLOAD_BYTES) {
      setError(`That file is ${formatBytes(picked.size)} — the ceiling is ${formatBytes(MAX_UPLOAD_BYTES)}.`);
      return;
    }
    if (picked.size === 0) {
      setError(
        `${picked.name} came through empty — it may still be downloading from iCloud or Drive.`,
      );
      return;
    }
    const refusal = notAudioReason(picked);
    if (refusal) {
      setError(refusal);
      return;
    }
    await keep(picked, picked.name, await readAudioDuration(picked));
    // Let the same file be picked again after it is taken back off.
    if (inputRef.current) inputRef.current.value = "";
  }

  function drop(key: string) {
    onChange(fieldFilesValue(chosen.filter((file) => file.key !== key)));
  }

  return (
    <div className="field file-field">
      <span className="field-label">
        {field.label}
        {field.required && <span className="field-required"> · needed</span>}
      </span>

      {chosen.map((file) => (
        <p className="file-chosen" key={file.key}>
          <audio controls preload="none" src={file.url} className="recorder-preview" />
          <span className="muted">
            {file.name}
            {file.size > 0 && ` · ${formatBytes(file.size)}`}
          </span>
          <button
            type="button"
            className="file-drop"
            title="Remove this recording"
            aria-label={`Remove ${file.name}`}
            onClick={() => drop(file.key)}
            disabled={busy}
          >
            ×
          </button>
        </p>
      ))}

      {/* Only asked where there is a choice to make: a field offering one way, or
          a browser that cannot record, goes straight to the control. */}
      {mayRecord && mayUpload && (
        <div className="field-types">
          <label className="field-checkbox">
            <input
              type="radio"
              checked={way === "record"}
              onChange={() => setWay("record")}
              disabled={busy}
            />
            <span>Record it now</span>
          </label>
          <label className="field-checkbox">
            <input
              type="radio"
              checked={way === "upload"}
              onChange={() => setWay("upload")}
              disabled={busy}
            />
            <span>Upload an audio file</span>
          </label>
        </div>
      )}

      {mayRecord && way === "record" && (
        <>
          <AudioRecorder recorder={recorder} disabled={busy} />
          {recorder.recording && recorder.phase === "recorded" && (
            <button
              type="button"
              className="btn btn-ghost photo-add"
              disabled={busy}
              onClick={() => void keep(recorder.recording!, "", recorder.seconds)}
            >
              {busy ? "Uploading…" : chosen.length === 0 ? "Use this take" : "Use this take instead"}
            </button>
          )}
        </>
      )}

      {(!mayRecord || way === "upload") && mayUpload && (
        <>
          <input
            ref={inputRef}
            type="file"
            // `AUDIO_ACCEPT` names every extension outright rather than trusting
            // `audio/*`, which a phone's picker expands to a handful and greys out
            // the rest.
            accept={AUDIO_ACCEPT}
            className="photo-input"
            onChange={(e) => void take(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            className="btn btn-ghost photo-add"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy
              ? "Uploading…"
              : chosen.length === 0
                ? "+ Upload an audio file"
                : "Choose a different recording"}
          </button>
        </>
      )}

      {/* Nothing on offer at all is worth saying rather than leaving a question
          with no way to answer it: a field that only records, read on a browser
          that cannot. */}
      {!mayRecord && !mayUpload && (
        <span className="field-hint">
          This question asks for a recording, and this browser cannot make one — open the
          form on a phone to answer it.
        </span>
      )}

      <span className="field-hint">
        {field.hint ||
          `${mayRecord && mayUpload ? "Record it here or pick a file" : mayRecord ? "Recorded here on your device" : "MP3, M4A, WAV, FLAC, OGG or Opus"} — up to ${formatBytes(MAX_UPLOAD_BYTES)}.`}
      </span>

      {busy && (
        <div
          className="upload-progress"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="upload-progress-bar" style={{ width: `${progress}%` }} />
          <span className="upload-progress-label">
            {progress < 100 ? `Uploading… ${Math.round(progress)}%` : "Almost done…"}
          </span>
        </div>
      )}

      <ErrorLine message={error} />
    </div>
  );
}

/**
 * The answers, wherever a post is read. A question nobody answered has no line —
 * a form of twelve fields does not turn every post into a table of blanks.
 */
export function FieldAnswers({ values }: { values: PostFieldValue[] | undefined }) {
  if (!values || values.length === 0) return null;
  return (
    <dl className="post-fields">
      {values.map((row) => (
        <div className="post-field" key={row.fieldId}>
          <dt>{row.label}</dt>
          <dd>
            <FieldAnswer row={row} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * One answer, read. Everything but an upload and a link is the text the member
 * typed; an upload is the file itself — named and linked where it is a document,
 * and playable where it is a recording, because the answer to "Upload" is the
 * thing rather than a description of it — and a link is the address made
 * tappable, which is the whole reason for asking for one.
 */
function FieldAnswer({ row }: { row: PostFieldValue }) {
  const [viewing, setViewing] = useState<{ url: string; name: string; size: number } | null>(
    null,
  );
  if (row.kind === "link") {
    const href = webAddress(row.value);
    // An address stored before it was checked, or one that never was one, is
    // still worth showing as the words the member wrote.
    if (!href) return <>{row.value}</>;
    return (
      <a className="field-link" href={href} target="_blank" rel="noreferrer">
        🔗 {linkLabel(href)}
      </a>
    );
  }
  if (row.kind === "multiselect") {
    // Several choices, stored one per line and read as one line: they are the
    // answer to a single question, so they read as a list rather than as a
    // paragraph of their own.
    const chosen = answerList(row.value);
    return <>{chosen.length > 0 ? chosen.join(" · ") : row.value}</>;
  }
  if (row.kind !== "file") return <Linkified text={row.value} />;
  // A field may hold several documents now, and did hold exactly one before it
  // could — `parseFieldFiles` reads either shape, so an answer given last year
  // reads as the one attachment it is.
  const files = parseFieldFiles(row.value);
  if (files.length === 0) return <Linkified text={row.value} />;
  return (
    <span className="field-files">
      {/* A recording plays where it sits, because the answer to "sing it" is the
          singing rather than a link to it. Which answers are audio is read off the
          filename: a stored answer says its key, its name and its size and nothing
          about the field that asked for it, so the name is the only thing here that
          knows — and the name is ours, `field-audio.mts` giving every take an audio
          extension whether the member named it or not. The link is still under it,
          for a member who would rather download it. */}
      {files.map((file) =>
        isAudioFileName(file.name) ? (
          <span className="field-file-audio" key={file.key}>
            <audio controls preload="none" src={file.url} className="recorder-preview" />
            <a
              className="field-file-link"
              href={file.url}
              target="_blank"
              rel="noreferrer"
            >
              <span className="field-file-kind">Audio</span>
              <span className="field-file-name">{file.name}</span>
              {file.size > 0 && <span className="muted"> · {formatBytes(file.size)}</span>}
              <span className="field-file-open">Open</span>
            </a>
          </span>
        ) : isPdfName(file.name) ? (
          // A PDF opens in the app's own viewer, over the item it belongs to, so
          // Back returns to exactly this page rather than leaving the app behind.
          <button
            type="button"
            className="field-file-link"
            key={file.key}
            onClick={() => setViewing(file)}
          >
            <span className="field-file-kind">{attachmentKind(file.name)}</span>
            <span className="field-file-name">{file.name}</span>
            {file.size > 0 && <span className="muted"> · {formatBytes(file.size)}</span>}
            <span className="field-file-open">View PDF</span>
          </button>
        ) : (
        <a
          className="field-file-link"
          key={file.key}
          href={file.url}
          target="_blank"
          rel="noreferrer"
        >
          <span className="field-file-kind">{attachmentKind(file.name)}</span>
          <span className="field-file-name">{file.name}</span>
          {file.size > 0 && <span className="muted"> · {formatBytes(file.size)}</span>}
          <span className="field-file-open">Open</span>
        </a>
        ),
      )}
      {viewing && (
        <DocumentViewer
          url={viewing.url}
          name={viewing.name}
          size={viewing.size}
          onClose={() => setViewing(null)}
        />
      )}
    </span>
  );
}

function isPdfName(name: string): boolean {
  return /\.pdf$/i.test(name.trim());
}

/** "PDF", "Word", "Excel" — what a reader is about to open, from its name. */
function attachmentKind(name: string): string {
  const found = FIELD_FILE_TYPE_OPTIONS.find((option) =>
    option.extensions.some((ext) => name.trim().toLowerCase().endsWith(ext)),
  );
  return found?.label ?? "File";
}

/** Anything that looks like a web address inside a line somebody typed. */
const ADDRESS = /(?:https?:\/\/|www\.)[^\s<>]+/gi;

/**
 * A typed answer with its addresses made tappable. A member who pasted a link
 * into a Short text field — which is what everybody does before a category has a
 * Link field, and what a Notes field will always collect — should not have to
 * copy it back out by hand, so the reading side finds them wherever they are.
 * The link is worked out from the text at read time and nothing is stored, so
 * this changes no answer anybody has already given.
 */
function Linkified({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let at = 0;
  for (const match of text.matchAll(ADDRESS)) {
    const start = match.index ?? 0;
    // A full stop or a bracket at the end belongs to the sentence, not the address.
    const found = match[0].replace(/[.,;:!?)\]}'"]+$/, "");
    const href = webAddress(found);
    if (!href) continue;
    if (start > at) parts.push(text.slice(at, start));
    parts.push(
      <a key={start} href={href} target="_blank" rel="noreferrer">
        {found}
      </a>,
    );
    at = start + found.length;
  }
  if (parts.length === 0) return <>{text}</>;
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}
