/**
 * Branches: one circle standing under another, because somebody said so.
 *
 * A temple organisation with chapters — SVKV, with Austin, Houston and
 * Phoenix — wants a parent that lists its chapters and chapters that govern
 * themselves. Both of those are already true of circles: a branch is an
 * ordinary circle, owned by whoever runs it, with its own categories, its own
 * roll, its own admins and its own notifications. The only thing missing was a
 * way to say which organisation it belongs to.
 *
 * That relationship is now a **column** — `circles.parent_circle_id`, read here
 * as `Circle.parentCircleId` — and this file does nothing but arrange circles by
 * it. It used to be a naming convention: a circle whose name began with
 * "SVKV" and a separator was treated as a branch of SVKV. That inference is
 * gone, and it had to be, because it could not be set (the only way to attach a
 * chapter was to rename it), could not be undone (two unrelated circles that
 * happened to share an opening word were nested whether their owners liked it or
 * not), and forced every chapter to be named after its parent. Nothing in this
 * file looks at a name to decide structure any more.
 *
 * The relationship is **organisational only**. Nothing is inherited: opening a
 * branch, joining one, asking to join, moderating one and leaving one all go
 * through the paths circles already have, so being in SVKV grants nothing in
 * Austin and being in Austin grants nothing in SVKV.
 */
import type { Circle } from "./api";

/** A branch and what the parent's list needs to say about it. */
export interface Branch {
  circle: Circle;
  /** What to call it under its parent — "Austin", not "SVKV - Austin". */
  label: string;
  /** True when the member is already in it, so the row opens rather than asks. */
  joined: boolean;
}

/**
 * What a branch is called where its organisation has already been named.
 *
 * This is **presentation and nothing else** — no structure is decided here.
 * Branches are their own circles with their own names, and the ordinary case is
 * a chapter simply called "Austin", which comes back untouched. The trim exists
 * for the circles that predate the column: a chapter named "SVKV - Austin" back
 * when the prefix *was* the relationship reads as "Austin" under the SVKV card,
 * because saying the organisation twice in two lines is noise. Whether the two
 * are related was already settled by `parentCircleId` before this is called.
 */
export function branchLabel(parentName: string, circleName: string): string {
  const name = circleName.trim();
  const parent = parentName.trim();
  if (!parent || name.length <= parent.length) return name;
  if (name.slice(0, parent.length).toLowerCase() !== parent.toLowerCase()) return name;

  // Only when a separator follows, so "SVKVA" is never read as SVKV's "A". The
  // en dash, em dash and colon are here beside the hyphen because a phone
  // keyboard and an autocorrect both produce them.
  const rest = name.slice(parent.length).trimStart();
  const separator = ["-", "–", "—", ":"].find((mark) => rest.startsWith(mark));
  if (!separator) return name;

  const label = rest.slice(separator.length).trim();
  return label.length > 0 ? label : name;
}

/**
 * Every branch of one circle, out of what the browser already has: the member's
 * own circles and the ones they could join. No request is made — `GET
 * /api/circles` already carries a head count for a public or discoverable circle
 * the caller is not in, which is the one fact a row needs beyond its name.
 *
 * A **Private** branch is therefore absent, and correctly so: it is in neither
 * list unless the member is in it or invited, and a parent that advertised the
 * existence of circles nobody may see would be leaking exactly what Private
 * means.
 */
export function branchesOf(parent: Circle | null, mine: Circle[], onOffer: Circle[]): Branch[] {
  if (!parent) return [];

  const joinedIds = new Set(mine.map((circle) => circle.id));
  const seen = new Set<number>();
  const branches: Branch[] = [];

  for (const circle of [...mine, ...onOffer]) {
    if (circle.id === parent.id || seen.has(circle.id)) continue;
    if (circle.parentCircleId !== parent.id) continue;
    seen.add(circle.id);
    branches.push({
      circle,
      label: branchLabel(parent.name, circle.name),
      joined: joinedIds.has(circle.id),
    });
  }

  // By the name the reader sees, so the cities read down in order and a leftover
  // organisation prefix plays no part in it.
  return branches.sort((a, b) => a.label.localeCompare(b.label));
}

/** One line of a circle list, with the branches sitting under their organisation. */
export interface CircleRow {
  circle: Circle;
  /** "SVKV" for an organisation, "Austin" for a branch of one in the same list. */
  label: string;
  /** How far under its organisation it sits — 0 for a circle standing on its own. */
  depth: number;
}

/**
 * A flat list of circles, reordered so each organisation is followed by its own
 * branches and each branch says only the part that is its own.
 *
 * This is the dropdown's problem. A member of SVKV and of three of its chapters
 * would otherwise read four lines that are mostly the same seven characters,
 * with the one word that differs last, where it is hardest to scan. Nesting
 * moves the organisation into the line above and leaves the cities to read down.
 *
 * A branch whose organisation is **not** in the same list is a root of its own
 * and keeps its full name: a lone "Austin" indented under nothing would be a
 * place with no organisation. That is what makes this safe to run over the two
 * groups of the header menu separately — the member's own circles and the open
 * ones — without a row escaping its heading.
 */
export function organiseCircles(circles: Circle[]): CircleRow[] {
  const byId = new Map(circles.map((circle) => [circle.id, circle]));
  const parentOf = (circle: Circle): Circle | null =>
    circle.parentCircleId ? (byId.get(circle.parentCircleId) ?? null) : null;

  const children = new Map<number, Circle[]>();
  const roots: Circle[] = [];
  for (const circle of circles) {
    const parent = parentOf(circle);
    if (!parent || parent.id === circle.id) {
      roots.push(circle);
      continue;
    }
    const siblings = children.get(parent.id) ?? [];
    siblings.push(circle);
    children.set(parent.id, siblings);
  }

  const byName = (a: Circle, b: Circle) => a.name.localeCompare(b.name);
  const rows: CircleRow[] = [];
  // Depth is capped by `seen`: the routes refuse a cycle and a branch of a
  // branch, but a list is not the place to hang if the data ever says otherwise.
  const seen = new Set<number>();
  const walk = (circle: Circle, depth: number, parent: Circle | null) => {
    if (seen.has(circle.id)) return;
    seen.add(circle.id);
    rows.push({
      circle,
      label: parent ? branchLabel(parent.name, circle.name) : circle.name,
      depth,
    });
    for (const child of (children.get(circle.id) ?? []).sort(byName)) {
      walk(child, depth + 1, circle);
    }
  };
  for (const root of roots.sort(byName)) walk(root, 0, null);
  // Anything a cycle would have stranded still has to appear somewhere.
  for (const circle of circles.slice().sort(byName)) walk(circle, 0, null);
  return rows;
}
