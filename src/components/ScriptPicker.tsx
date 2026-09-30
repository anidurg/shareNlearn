// src/components/ScriptPicker.tsx
// Which scripts a share should be readable in — asked once, the same way, wherever it
// is asked.
//
// It used to be a dropdown of five, which was the right control for a list of five.
// The converter now writes fifty, and a fifty-item `<select>` is the worst control
// there is: it opens over the form, shows eight rows at a time, closes on every pick,
// and gives somebody looking for Sharada no way to look for it. So this is the control
// Aksharamukha itself uses for exactly this question — a search box and a scrolling
// list of tick boxes — because a member picking scripts is doing one of two things, and
// it serves both. Scanning for the two or three their family reads, which the order of
// the list is arranged for: the scripts this group actually writes in come first.
// Or searching for one by name, which is what the box is for.
//
// Ticking is the whole interaction. There is no Add button and no chip to remove
// afterwards: the list is the state, a tick is on and a second tick is off, and what
// is chosen is summarised above it for anybody who has scrolled far enough to lose
// sight of their own answer.
//
// It holds no store and knows nothing about songs or posts. `chosen` and `onChange`
// are the whole of it, which is why the recording form and the post form draw the same
// control rather than two that drift apart.
import { useId, useMemo, useState } from "react";

/** One script on offer. Deliberately the shape both option lists already have. */
export interface ScriptChoice {
  id: string;
  label: string;
  native: string;
  /** What tapping it does, said plainly. Shown under the name where there is room. */
  note?: string;
}

export function ScriptPicker({
  options,
  chosen,
  onChange,
  emptyNote = "None chosen yet — tick the scripts your people read.",
}: {
  options: readonly ScriptChoice[];
  chosen: readonly string[];
  onChange: (next: string[]) => void;
  emptyNote?: string;
}) {
  const [query, setQuery] = useState("");
  const searchId = useId();

  // Matched on the name and on the letters themselves, so somebody who can paste a
  // word in a script but cannot name it in English still finds it.
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) ||
        option.id.includes(needle) ||
        option.native.toLowerCase().includes(needle),
    );
  }, [options, query]);

  const picked = options.filter((option) => chosen.includes(option.id));

  function toggle(id: string) {
    onChange(chosen.includes(id) ? chosen.filter((entry) => entry !== id) : [...chosen, id]);
  }

  return (
    <div className="script-picker">
      <p className="script-picker-chosen">
        {picked.length === 0 ? (
          <span className="script-picker-none">{emptyNote}</span>
        ) : (
          picked.map((option) => (
            <button
              key={option.id}
              type="button"
              className="script-picker-tag"
              onClick={() => toggle(option.id)}
              aria-label={`Remove ${option.label}`}
            >
              {option.native} {option.label} <span aria-hidden="true">×</span>
            </button>
          ))
        )}
      </p>

      <input
        id={searchId}
        type="search"
        className="script-picker-search"
        value={query}
        placeholder="Search scripts…"
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Search scripts"
      />

      <ul className="script-picker-list">
        {shown.map((option) => (
          <li key={option.id}>
            <label className="script-picker-row">
              <input
                type="checkbox"
                checked={chosen.includes(option.id)}
                onChange={() => toggle(option.id)}
              />
              <span className="script-picker-native">{option.native}</span>
              <span className="script-picker-name">{option.label}</span>
            </label>
          </li>
        ))}
        {shown.length === 0 && (
          <li className="script-picker-empty">No script here goes by that name.</li>
        )}
      </ul>
    </div>
  );
}
