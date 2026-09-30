// src/components/ActionSheet.tsx
// The list of things a card can do, opened from its ⋯ and shown the way a phone
// shows them: a sheet that comes up from the bottom of the screen, one action per
// row, a full-width Cancel under them.
//
// It exists because the alternative had run out of room. A circle card used to
// carry its actions as buttons on the card itself — Open, a pencil, Leave — which
// on a 360px screen is three tap targets competing with the circle's own name, and
// every action a keeper might want (invite somebody, answer a report, close the
// circle) had to be found somewhere else entirely. A sheet holds as many as the
// member is allowed and costs the card one 40px button.
//
// Two things it deliberately does not do. It does not decide who may do what: the
// caller passes the actions it has already worked out, and the server refuses
// anything a hidden control would not have stopped anyway. And it does not confirm
// anything — a destructive row closes the sheet and opens the question, because a
// sheet that dismisses on any tap is the wrong place to ask "are you sure?".
import { useEffect, useRef, type ReactNode } from "react";

export interface SheetAction {
  /** Stable key, and what a caller matches on when it handles the tap. */
  key: string;
  label: string;
  /** The glyph in front of the label. An emoji, so no icon has to be drawn for it. */
  glyph?: string;
  /** A word or a count set at the end of the row — "3" on Admin tools. */
  note?: ReactNode;
  /** `danger` is the red row: leaving a circle, closing one. */
  tone?: "default" | "danger";
  onSelect: () => void;
}

/**
 * The sheet itself. `title` names what the actions are about, because a sheet
 * with no header on a page of near-identical cards is a menu with no subject.
 */
export function ActionSheet({
  title,
  subtitle,
  actions,
  onClose,
}: {
  title: string;
  subtitle?: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const pressedBackdrop = useRef(false);

  // Escape closes it, and the first row takes focus so a keyboard reaches the
  // actions without tabbing through the page behind the sheet.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="sheet-backdrop"
      onPointerDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        // Only a tap that started on the backdrop dismisses, the same rule
        // `Modal` follows: a drag that happens to end outside is not a dismissal.
        if (event.target !== event.currentTarget || !pressedBackdrop.current) return;
        pressedBackdrop.current = false;
        onClose();
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={panel}>
        {/* The grab handle: it does nothing, and it is what tells a thumb that
            this panel belongs to the bottom of the screen. */}
        <span className="sheet-grip" aria-hidden="true" />
        <header className="sheet-head">
          <p className="sheet-title">{title}</p>
          {subtitle && <p className="sheet-subtitle">{subtitle}</p>}
        </header>
        <ul className="sheet-actions">
          {actions.map((action) => (
            <li key={action.key}>
              <button
                type="button"
                className={
                  action.tone === "danger" ? "sheet-action sheet-action-danger" : "sheet-action"
                }
                onClick={() => action.onSelect()}
              >
                {action.glyph && (
                  <span className="sheet-action-glyph" aria-hidden="true">
                    {action.glyph}
                  </span>
                )}
                <span className="sheet-action-label">{action.label}</span>
                {action.note !== undefined && action.note !== null && (
                  <span className="sheet-action-note">{action.note}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="sheet-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
