import { useState } from "react";
import {
  type IndicScript,
  ROMAN_SCHEME_OPTIONS,
  type RomanScheme,
  SCRIPT_OPTIONS,
  transliterate,
} from "../api";
import { ErrorLine } from "./shared";

/**
 * Type it in English letters, get it in Kannada.
 *
 * This is the other half of script conversion, and the half people actually asked for.
 * A member who knows a stotra by heart can say it in ten seconds and needs half an hour
 * to type it, because writing Kannada on a phone means a keyboard they may not have
 * installed and cannot touch-type. So the forms carry this: they type
 * `vakratuNDa mahaakaaya` the way they would type it in a chat message, tap Convert, and
 * ವಕ್ರತುಂಡ ಮಹಾಕಾಯ comes back for them to check and add.
 *
 * Three deliberate choices in a small control:
 *
 *   It converts on a tap, never as you type. A member mid-word is not asking for
 *   anything, and a control that fires on every keystroke would be both slower and
 *   more startling than one that waits to be told.
 *
 *   It adds rather than replaces. The result goes on the end of what is already in the
 *   field, so a member builds a verse a line at a time and nothing they typed is ever
 *   taken away by a button they pressed to get help.
 *
 *   Somebody has to say which convention they are typing. "English letters" is not one
 *   thing — `sh` or `ś`, `aa` or `ā` — and the four schemes cover how anybody in this
 *   group is likely to write. The first is the way people actually type, and is the
 *   default; the others are there for the members who know they want them.
 *
 * Nothing here is stored and no model is involved: it is a character mapping, so it
 * works on a deployment with no AI Gateway and costs nothing per tap.
 */
export function ScriptConverter({
  /** What the text is being added to — "the lyrics", "the details" — used in the button. */
  target,
  onAdd,
}: {
  target: string;
  onAdd: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [scheme, setScheme] = useState<RomanScheme>("itrans");
  const [script, setScript] = useState<IndicScript>("kannada");
  const [source, setSource] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosenScheme = ROMAN_SCHEME_OPTIONS.find((option) => option.id === scheme)!;
  const chosenScript = SCRIPT_OPTIONS.find((option) => option.id === script)!;

  if (!open) {
    return (
      <p className="converter-open">
        <button type="button" className="btn-text" onClick={() => setOpen(true)}>
          ⌨ Type in English letters instead
        </button>
      </p>
    );
  }

  async function convert() {
    setError(null);
    setResult(null);
    if (source.trim().length === 0) return;
    setBusy(true);
    try {
      setResult(await transliterate({ text: source, from: scheme, to: script }));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "That could not be converted just now. What you typed is still here.",
      );
    } finally {
      setBusy(false);
    }
  }

  function add() {
    if (!result) return;
    onAdd(result);
    // Cleared for the next line, and the panel stays open, because somebody writing a
    // stotra this way is about to do it again.
    setSource("");
    setResult(null);
  }

  return (
    <div className="script-converter">
      <p className="converter-head">
        <span className="converter-title">Type in English letters</span>
        <button type="button" className="btn-text" onClick={() => setOpen(false)}>
          Close
        </button>
      </p>

      <div className="converter-row">
        <label className="field">
          <span>I am typing</span>
          <select value={scheme} onChange={(e) => setScheme(e.target.value as RomanScheme)}>
            {ROMAN_SCHEME_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="field-hint">{chosenScheme.hint}</span>
        </label>

        <label className="field">
          <span>Write it in</span>
          <select value={script} onChange={(e) => setScript(e.target.value as IndicScript)}>
            {SCRIPT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.native} {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        <span>In English letters</span>
        <textarea
          rows={3}
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setResult(null);
          }}
          placeholder={`Like this: ${chosenScheme.example}`}
        />
      </label>

      <p className="converter-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={convert}
          disabled={busy || source.trim().length === 0}
        >
          {busy ? "Converting…" : `Convert to ${chosenScript.label}`}
        </button>
      </p>

      <ErrorLine message={error} />

      {result && (
        <div className="converter-result">
          <p className="converter-title">{chosenScript.label}</p>
          <pre className="lyrics-body">{result}</pre>
          <p className="converter-actions">
            <button type="button" className="btn btn-primary" onClick={add}>
              Add to {target}
            </button>
            <span className="field-hint">
              It goes on the end of what is already there, and you can correct it like
              anything else you typed.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

/** Puts converted text on the end of a field without eating a line break or adding one. */
export function appendText(existing: string, added: string) {
  if (existing.trim().length === 0) return added;
  return `${existing.replace(/\s+$/, "")}\n${added}`;
}
