/**
 * The crumbs under an organisation: its branches, by place, with head counts.
 *
 * A parent circle that has switched its own categories off has nothing of its
 * own to show, and that is the point of it — SVKV is the organisation, and
 * Austin, Houston and Dubai are where things actually happen. So the parent's
 * page is a description and a row of places, and tapping one goes there.
 *
 * The three ways in are the three doors a circle already has, and the crumb
 * says which one it is rather than trying them and failing:
 *   - already a member  → open it, which switches the circle in view
 *   - Open to All       → join and switch in one tap
 *   - Ask to Join       → ask, and afterwards say that it was asked
 * A Private branch never appears at all, because it is in neither of the lists
 * this reads and advertising it would be the opposite of private.
 */
import { useState } from "react";
import type { Circle } from "../api";
import { branchesOf } from "../branches";
import type { ShareAndLearn } from "../store";

interface Props {
  parent: Circle;
  store: ShareAndLearn;
  /** Choose a circle and open its page — the shell's own `switchCircle`. */
  onSwitch: (circleId: number) => void;
}

export function BranchStrip({ parent, store, onSwitch }: Props) {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const branches = branchesOf(parent, store.circles, store.discoverCircles);
  if (branches.length === 0) return null;

  async function enter(circle: Circle, joined: boolean) {
    setError(null);
    if (joined) {
      onSwitch(circle.id);
      return;
    }
    setBusy(circle.id);
    try {
      // Open to All joins on the spot; Ask to Join records the request and
      // leaves the member where they are, so only a real join switches.
      const result = await store.joinCircle(circle.id);
      if (result.joined) onSwitch(circle.id);
    } catch {
      setError(`${circle.name} could not be opened just now.`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="circle-section branch-strip">
      <div className="section-head">
        <h2 className="section-title">Branches of {parent.name}</h2>
      </div>
      <ul className="branch-list">
        {branches.map(({ circle, label, joined }) => {
          const asked = !joined && circle.standing === "requested";
          const invited = !joined && circle.standing === "invited";
          const working = busy === circle.id;
          return (
            <li key={circle.id}>
              <button
                type="button"
                className={`branch-crumb${joined ? " is-mine" : ""}`}
                onClick={() => void enter(circle, joined)}
                disabled={working || asked}
                // The visible text is a place and a number; the accessible name
                // has to be the whole sentence, since "Austin (6)" out of context
                // says nothing about what tapping it does.
                aria-label={
                  joined
                    ? `Open ${circle.name}, ${circle.memberCount} members`
                    : asked
                      ? `${circle.name} — you have already asked to join`
                      : invited
                        ? `Accept your invitation to ${circle.name}`
                        : circle.privacy === "public"
                          ? `Join ${circle.name} and open it, ${circle.memberCount} members`
                          : `Ask to join ${circle.name}, ${circle.memberCount} members`
                }
              >
                <span className="branch-icon" aria-hidden="true">
                  {circle.icon}
                </span>
                <span className="branch-name">{label}</span>
                <span className="branch-count" aria-hidden="true">
                  ({circle.memberCount})
                </span>
                {!joined && (
                  <span className="branch-door">
                    {working
                      ? "…"
                      : asked
                        ? "Asked"
                        : invited
                          ? "Invited"
                          : circle.privacy === "public"
                            ? "Join"
                            : "Ask to join"}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
