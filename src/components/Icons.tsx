/**
 * The app's icons, drawn inline rather than pulled from a font or an icon package.
 *
 * Three reasons they live here as SVG paths. They are `currentColor`, so an icon
 * inherits whatever colour the button around it has and follows the theme with no
 * second palette to keep in step. They ship with the bundle, so a recipe card is
 * never briefly wordless while a font loads. And there are fifteen of them, which
 * is not worth a dependency.
 *
 * Every icon is `aria-hidden`: an icon is never the label. A button with nothing
 * but an icon inside it says what it does through its own `aria-label` and
 * `title` — which is what `IconButton` below insists on — so a screen reader
 * reads "Edit" rather than "graphic".
 */

import type { MouseEvent } from "react";

export type IconName =
  | "edit"
  | "trash"
  | "play"
  | "stop"
  | "bookmark"
  | "bookmark-filled"
  | "share"
  | "check"
  | "close"
  | "plus"
  | "chevron-left"
  | "chevron-right"
  | "refresh"
  | "more"
  | "lock"
  | "folder";

/**
 * The paths, on a 24×24 grid. Stroked rather than filled wherever an outline
 * reads better at 16px, which is all of them but the play triangle and the
 * filled bookmark — a shape that small is clearer solid.
 */
const PATHS: Record<IconName, { d: string; fill?: boolean }[]> = {
  // A pencil, angled the way every other app draws one, so it needs no explaining.
  edit: [
    { d: "M4 20h4L20 8a2.83 2.83 0 0 0-4-4L4 16v4Z" },
    { d: "M14.5 5.5 18.5 9.5" },
  ],
  // A lidded bin with two staves, which reads as "delete" even at 16px.
  trash: [
    { d: "M4 7h16" },
    { d: "M10 4h4a1 1 0 0 1 1 1v2H9V5a1 1 0 0 1 1-1Z" },
    { d: "M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" },
    { d: "M10 11v6M14 11v6" },
  ],
  // The triangle, filled: on its own it is the whole of a play button.
  play: [{ d: "M8 5.5 19 12 8 18.5V5.5Z", fill: true }],
  stop: [{ d: "M7 7h10v10H7z", fill: true }],
  bookmark: [{ d: "M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1Z" }],
  // A folder with its tab, which is what a circle's own tree is drawn as
  // everywhere else — so the button that moves a share into one says so with the
  // same shape the folder grid uses.
  folder: [{ d: "M4 7a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7Z" }],
  "bookmark-filled": [{ d: "M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1Z", fill: true }],
  share: [
    { d: "M12 4v11" },
    { d: "M8.5 7.5 12 4l3.5 3.5" },
    { d: "M6 13v5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-5" },
  ],
  check: [{ d: "M5 12.5 10 17.5 19 7" }],
  close: [{ d: "M6 6l12 12M18 6 6 18" }],
  plus: [{ d: "M12 5v14M5 12h14" }],
  "chevron-left": [{ d: "M14.5 6 8.5 12l6 6" }],
  "chevron-right": [{ d: "M9.5 6l6 6-6 6" }],
  // Two arcs chasing each other with an arrowhead on each, which is the shape
  // every app draws for "read it again" — deliberately not a single circle, since
  // one arrow reads as "undo" and this is the opposite of undoing anything.
  refresh: [
    { d: "M20 12a8 8 0 0 1-13.7 5.7" },
    { d: "M4 12a8 8 0 0 1 13.7-5.7" },
    { d: "M17.7 3v3.5h-3.5" },
    { d: "M6.3 21v-3.5h3.5" },
  ],
  // A closed padlock, drawn small: it says "this row is part of the form itself"
  // beside a field's name, and the row's own words say "Built-in" as well, so the
  // icon is a reminder rather than the only place the status is written.
  lock: [
    { d: "M5.5 10.5h13a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z" },
    { d: "M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" },
  ],
  // Three dots in a row: the "more actions" control every phone draws this way.
  // Filled rather than stroked, a 1.2px circle being a smudge at 16px.
  more: [
    { d: "M6 12a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0Z", fill: true },
    { d: "M10.5 12a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0Z", fill: true },
    { d: "M15 12a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0Z", fill: true },
  ],
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name].map((path, index) => (
        <path
          key={index}
          d={path.d}
          fill={path.fill ? "currentColor" : "none"}
          stroke={path.fill ? "none" : "currentColor"}
        />
      ))}
    </svg>
  );
}

/**
 * A button that is an icon and nothing else — the shape every listing uses for
 * edit, delete, play and save.
 *
 * `label` is not optional, and that is the whole point of the component: an
 * icon-only control with no accessible name is invisible to a screen reader and
 * a guess to anybody else, and the four actions this replaced used to say what
 * they were in words. The label becomes both the `aria-label` and the `title`,
 * so the tooltip a mouse gets and the text a reader hears are the same sentence
 * and cannot drift apart.
 */
export function IconButton({
  icon,
  label,
  onClick,
  tone = "quiet",
  pressed,
  disabled,
  className,
}: {
  icon: IconName;
  label: string;
  /**
   * The event is handed over so a button drawn inside something else clickable —
   * the ⋯ on a circle card, which sits on a card that opens the circle — can call
   * `stopPropagation()`. A plain `() => void` handler still satisfies it.
   */
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  /** `strong` is filled in, for the one action a row leads with. */
  tone?: "quiet" | "strong" | "on" | "danger";
  /** Set on a toggle, so assistive tech reads the state rather than only the name. */
  pressed?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const tones = {
    quiet: "icon-button",
    strong: "icon-button icon-button-strong",
    on: "icon-button icon-button-on",
    danger: "icon-button icon-button-danger",
  };
  return (
    <button
      type="button"
      className={[tones[tone], className].filter(Boolean).join(" ")}
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
    >
      <Icon name={icon} />
    </button>
  );
}
