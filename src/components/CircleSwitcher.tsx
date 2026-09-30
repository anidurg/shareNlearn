import { useState } from "react";
import type { Circle, CircleCategory } from "../api";
import { sortedCategories } from "../categories";
import { organiseCircles } from "../branches";
import type { CircleRow } from "../branches";

/** The dropdown's value for "all circles" — never a circle id, so they cannot collide. */
const ALL = "all";

function memberLabel(count: number) {
  return `${count} ${count === 1 ? "member" : "members"}`;
}

/**
 * One line of the header dropdown. A branch is drawn under its organisation with
 * a turnstile and the place name alone.
 *
 * The indent is non-breaking spaces rather than ordinary ones or CSS: an
 * `<option>` collapses leading whitespace, and on a phone the list is drawn by
 * the operating system, which ignores anything the page would rather it did —
 * so the only indent that survives everywhere is one made of characters. The
 * arrow does the work either way, and a screen reader reads the place.
 */
function circleOption(row: CircleRow) {
  const indent = "\u00a0\u00a0".repeat(Math.max(0, row.depth - 1));
  const lead = row.depth > 0 ? `${indent}\u21b3 ` : "";
  return (
    <option key={row.circle.id} value={row.circle.id}>
      {lead}
      {row.circle.icon} {row.label}
    </option>
  );
}

/**
 * The circle in view, chosen from the top-left corner of every screen. Navigation
 * is circle-first, so this is the one control that decides what the whole app is
 * about: picking a circle here opens that circle's page.
 *
 * It lists two things, and the difference matters. The member's own circles are a
 * switch — they are already in them. Below those sit the circles that are **Open
 * to All**, which they are not in yet; picking one of those joins it first and
 * then switches, because an open circle is one nobody has to answer the door for.
 * A circle that has to be asked about is not here at all: that is a conversation,
 * and it belongs on the Circles tab where the asking happens.
 *
 * Above both sits **All circles**: every circle at once, nothing narrowed. It is
 * where the app opens and what the Circles listing under it is showing, and it is
 * a real answer rather than a placeholder — a member who has narrowed to one
 * circle picks it to get back out, and the per-type listings widen to everything
 * they can see. Somebody with no account is not offered it: they have one circle
 * to look at and no listing to widen to, so the corner goes on naming it.
 *
 * Both lists are **nested by organisation**: an SVKV with three chapters reads
 * as "SVKV" and then "↳ Austin", "↳ Dubai", "↳ Houston", rather than four lines
 * each opening with the same seven characters and differing only at the end,
 * which is the hardest place in a line to scan. The order and the labels come
 * from `organiseCircles()`; nothing else about the control changes, and a circle
 * that is nobody's branch is exactly where it was.
 *
 * A native select on purpose — on a phone it opens the operating system's own
 * picker, which is easier to hit than anything drawn in the page.
 */
export function CircleMenu({
  circles,
  openCircles,
  circleId,
  onChoose,
  onChooseAll,
  onJoin,
}: {
  circles: Circle[];
  /** Circles open to all that the member has not joined; picking one joins it. */
  openCircles: Circle[];
  circleId: number | null;
  onChoose: (circleId: number) => void;
  /** Steps back out to every circle at once, which is where the app opens. */
  onChooseAll: () => void;
  onJoin: (circleId: number) => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);

  // Nothing to switch between and nothing to walk into: the control would be an
  // empty box, and Circles is where somebody in that position is being sent.
  if (circles.length === 0 && openCircles.length === 0) return null;

  const mine = new Set(circles.map((circle) => circle.id));
  const mineRows = organiseCircles(circles);
  const openRows = organiseCircles(openCircles);

  // A visitor with no account has one circle here — Discover — and is looking at
  // it rather than in it, so neither the heading nor the "All circles" entry
  // claims something they have not got: no membership, and no listing to widen
  // to. Read off the role the server sent rather than off whether somebody is
  // logged in, so this component still knows nothing about accounts.
  const isMember = circles.some((circle) => circle.role);
  const mineLabel = isMember ? "My circles" : "Circle";

  function pick(value: string) {
    if (value === ALL) {
      onChooseAll();
      return;
    }
    const id = Number(value);
    if (!Number.isInteger(id) || id === circleId) return;
    if (mine.has(id)) {
      onChoose(id);
      return;
    }
    // An open circle is not one of theirs yet, so joining comes first — and only
    // a join that worked moves them, or they would land on a page they cannot read.
    setBusy(true);
    onJoin(id)
      .then(() => onChoose(id))
      .catch(() => {})
      .finally(() => setBusy(false));
  }

  return (
    <div className="header-circle">
      <span className="header-circle-label">Circle</span>
      <select
        className="header-circle-select"
        aria-label="Circle in view"
        disabled={busy}
        value={circleId === null ? (isMember ? ALL : "") : circleId}
        onChange={(event) => pick(event.target.value)}
      >
        {/* All circles, first, because it is what the app opens on and what the
            Circles listing under it is showing. A visitor gets the old
            placeholder instead: one circle, and no listing to widen to. */}
        {isMember ? (
          <option value={ALL}>{busy ? "Joining…" : "All circles"}</option>
        ) : (
          circleId === null && <option value="">{busy ? "Joining…" : "Choose a circle"}</option>
        )}
        {mineRows.length > 0 && (
          <optgroup label={mineLabel}>{mineRows.map(circleOption)}</optgroup>
        )}
        {openRows.length > 0 && (
          <optgroup label="Open to all — join and switch">{openRows.map(circleOption)}</optgroup>
        )}
      </select>
    </div>
  );
}

/**
 * The member's circles on their profile, with the one in view marked. Switching
 * from here is the same act as switching in the header dropdown, so it takes them
 * to that circle's page — the point of choosing a circle is to see what is in it.
 * It is a list
 * rather than a second dropdown on purpose: it says what each circle is, which
 * the picker in the header has no room for.
 */
export function MyCircles({
  circles,
  circleId,
  categoriesByCircle,
  onChoose,
  onOpen,
  onStartCircle,
  onOpenCircles,
}: {
  circles: Circle[];
  circleId: number | null;
  categoriesByCircle: Map<number, CircleCategory[]>;
  onChoose: (circleId: number) => void;
  onOpen: (circleId: number) => void;
  onStartCircle: () => void;
  onOpenCircles: () => void;
}) {
  return (
    <section className="home-section">
      <div className="section-head">
        <h2 className="section-title">My circles</h2>
        <button className="btn-text" onClick={onOpenCircles}>
          All circles
        </button>
      </div>

      {circles.length === 0 ? (
        <p className="card-meta">
          You are not in a circle yet. A circle is the audience for everything you share, and it
          decides what your home page holds.
        </p>
      ) : (
        <ul className="my-circles">
          {circles.map((circle) => {
            const current = circle.id === circleId;
            // What the circle is for, in its own order, as the icons of its categories.
            const shape = sortedCategories(categoriesByCircle.get(circle.id) ?? [])
              .filter((category) => !category.hidden)
              .map((category) => category.icon)
              .join(" ");
            return (
              <li key={circle.id} className={current ? "my-circle my-circle-on" : "my-circle"}>
                <span className="circle-icon" aria-hidden="true">
                  {circle.icon}
                </span>
                <div className="my-circle-text">
                  <p className="my-circle-name">
                    {circle.name}
                    {current && <span className="tag">Current</span>}
                  </p>
                  <p className="card-meta">
                    {/* Which organisation it belongs to, where it belongs to one.
                        The row keeps the circle's own full name above — this is a
                        flat list with no parent line over it to lean on — so the
                        relationship is said here instead, in the line that already
                        says what the circle is. */}
                    {circle.parentName && `Branch of ${circle.parentName} · `}
                    {memberLabel(circle.memberCount)}
                    {circle.role === "owner"
                      ? " · you keep this one"
                      : circle.role === "admin"
                        ? " · you look after this one"
                        : ""}
                    {shape && <span aria-hidden="true"> · {shape}</span>}
                  </p>
                </div>
                <span className="my-circle-actions">
                  {current ? (
                    <button className="chip-button" onClick={() => onOpen(circle.id)}>
                      Open
                    </button>
                  ) : (
                    <button className="chip-button chip-strong" onClick={() => onChoose(circle.id)}>
                      Switch to it
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <button className="btn btn-ghost" onClick={onStartCircle}>
        + Start a circle
      </button>
      <p className="card-meta">
        Switching circles changes what your home page holds — its categories, what you can share,
        and the shares underneath.
      </p>
    </section>
  );
}
