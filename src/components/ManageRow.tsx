// src/components/ManageRow.tsx
// The one shape every admin list in the app is drawn in, and the one place the
// words on those actions are written.
//
// It exists because the three management screens had grown three different
// answers to the same question. Manage fields had already arrived at the right
// one — a row that says what the thing is and a ⋯ holding what can be done to
// it — while Manage categories and Manage subcategories still drew every action
// as its own chip, which on a 360px phone is seven tap targets wrapping under a
// name and a row tall enough that three of them fill the screen. A subcategory
// called "Fiction" should read as `Fiction · 0 entries ⋯`, and everything else
// belongs behind the ⋯.
//
// So the row is a component rather than a convention, and the recurring actions
// are functions rather than literals: `moveActions()`, `disableAction()` and
// `deleteAction()` are why a category, a subcategory and a field all say
// "Disable" and "Delete" in the same order with the same glyphs, and why
// changing that wording is one edit rather than three.
//
// Two things it deliberately does not do, both for the same reasons `ActionSheet`
// does not. It decides no permissions — the caller passes the rows it has already
// worked out, so an action nobody may take is simply not in the list, and the
// server refuses it regardless. And it confirms nothing: a destructive row closes
// the sheet and opens `ManageConfirm`, because a panel that dismisses on any tap
// is the wrong place to ask "are you sure?".
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActionSheet, type SheetAction } from "./ActionSheet";
import { IconButton } from "./Icons";
import { ErrorLine } from "./shared";

/** How far in a nested row is drawn, and the depth past which it stops indenting. */
const INDENT_STEP = 14;
const MAX_INDENT_LEVELS = 5;

/**
 * One thing being managed: its name, a line of status under it, and the ⋯.
 *
 * `editing` is how renaming, moving and merging happen in place: the row keeps
 * its position, its indent and its twist, and the panel takes the place of the
 * name and the menu. Nothing about the list moves while a keeper is typing into
 * it, which is what makes a deep tree possible to edit at all.
 */
export function ManageRow({
  name,
  icon,
  tag,
  meta,
  depth = 0,
  lead,
  sheetSubtitle,
  actions,
  busy = false,
  editing,
}: {
  /** The plain name, which is also what the ⋯'s accessible label is built from. */
  name: string;
  /** An emoji in front of it, where the thing has one. */
  icon?: string;
  /** The "Off" pill, or anything else the name line should carry. */
  tag?: ReactNode;
  /** The status line: "0 entries", "Short text · Required". */
  meta?: ReactNode;
  /** 1 for a top-level node, 2 for its children, and so on. 0 for a flat list. */
  depth?: number;
  /** The twist on a tree row, or the spacer that keeps a leaf's name in line. */
  lead?: ReactNode;
  sheetSubtitle?: string;
  actions: SheetAction[];
  busy?: boolean;
  /** A panel shown in place of the name and the ⋯ — a rename, a move, a merge. */
  editing?: ReactNode;
}) {
  const [sheet, setSheet] = useState(false);
  // The indent is applied inline because how deep something sits is a fact about
  // the thing rather than a style, and it is capped so a tenth-generation
  // grandchild is still readable on a 360px phone.
  const indent =
    depth > 1 ? `${Math.min(depth - 1, MAX_INDENT_LEVELS) * INDENT_STEP}px` : undefined;

  return (
    <li
      className={[
        "manage-row",
        depth > 1 ? "manage-row-nested" : null,
        editing ? "manage-row-open" : null,
      ]
        .filter(Boolean)
        .join(" ")}
      style={indent ? { marginInlineStart: indent } : undefined}
    >
      {lead && <span className="manage-lead">{lead}</span>}

      {editing ? (
        <div className="manage-edit">{editing}</div>
      ) : (
        <>
          <span className="manage-main">
            <span className="manage-name">
              {icon && <span aria-hidden="true">{icon}</span>}
              <span className="manage-name-text">{name}</span>
              {tag}
            </span>
            {meta !== undefined && meta !== null && <span className="manage-meta">{meta}</span>}
          </span>
          <IconButton
            icon="more"
            label={`What to do with ${name}`}
            disabled={busy || actions.length === 0}
            onClick={() => setSheet(true)}
          />
          {sheet && (
            <ActionSheet
              title={name}
              subtitle={sheetSubtitle}
              actions={actions.map((action) => ({
                ...action,
                // A sheet row does its thing and gets out of the way, whether that
                // thing is a request or the opening of a panel behind it.
                onSelect: () => {
                  setSheet(false);
                  action.onSelect();
                },
              }))}
              onClose={() => setSheet(false)}
            />
          )}
        </>
      )}
    </li>
  );
}

/**
 * The question asked before anything is thrown away, in the same shape wherever
 * it is asked. It says what is about to happen in words, because a red button is
 * a colour rather than an explanation, and its "Keep it" is deliberately the
 * calmer of the two.
 */
export function ManageConfirm({
  title,
  children,
  error,
  confirmLabel,
  busyLabel = "Working…",
  cancelLabel = "Keep it",
  busy = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  children: ReactNode;
  error?: string | null;
  confirmLabel: string;
  busyLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);

  // The question opens under the list rather than over it, so on a phone reading a
  // long list it can open below the fold — where tapping Delete looks like it did
  // nothing at all. So it brings itself into view and takes the focus, on the
  // calmer of its two buttons: a keyboard lands on "Keep it" rather than one
  // Return away from the deletion.
  useEffect(() => {
    panel.current?.scrollIntoView({ block: "nearest" });
    panel.current?.querySelector<HTMLButtonElement>(".btn-ghost")?.focus();
  }, []);

  return (
    <div className="manage-confirm" ref={panel}>
      <h3 className="section-title">{title}</h3>
      {children}
      <ErrorLine message={error ?? null} />
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
        <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * Move up and move down, and only the ones that lead anywhere: the first thing in
 * a list has no "Move up", which is better than a row that is drawn and refuses.
 */
export function moveActions(
  index: number,
  total: number,
  move: (delta: number) => void,
): SheetAction[] {
  const actions: SheetAction[] = [];
  if (index > 0) {
    actions.push({ key: "up", label: "Move up", glyph: "↑", onSelect: () => move(-1) });
  }
  if (index < total - 1) {
    actions.push({ key: "down", label: "Move down", glyph: "↓", onSelect: () => move(1) });
  }
  return actions;
}

/**
 * The reversible one, and the ordinary move: disabling hides the thing and keeps
 * everything filed under it or answered into it. `note` is where a screen says
 * what survives — "posts keep", "answers keep" — since that is the whole reason
 * this is offered above Delete.
 *
 * `words` is there because "Disable" overstates what happens to a category: it is
 * taken off the circle page and nothing else — its posts, its shelves and its
 * form are exactly where they were — so the categories manager asks for Hide and
 * Show instead. The default is what every other manager still says.
 */
export function disableAction(
  hidden: boolean,
  onSelect: () => void,
  note?: string,
  words: { hide: string; show: string } = { hide: "Disable", show: "Enable" },
): SheetAction {
  return {
    key: "hidden",
    label: hidden ? words.show : words.hide,
    glyph: hidden ? "👁" : "🚫",
    note: hidden ? undefined : note,
    onSelect,
  };
}

/** The one row that takes something away, so the one row that is red. */
export function deleteAction(onSelect: () => void): SheetAction {
  return { key: "delete", label: "Delete", glyph: "🗑", tone: "danger", onSelect };
}
