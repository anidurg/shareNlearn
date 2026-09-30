// src/components/AccessGate.tsx
// The three doors between an account and the app, each of which says what it is
// waiting for. A gate that only says "no" leaves somebody stuck; every one of
// these names the thing that opens it.
import type { AccessState } from "../api";
import { EmptyState, WelcomeNote } from "./shared";

export type GateKind = "unavailable" | "suspended" | "circle-first";

/**
 * What the app shows instead of itself. `unavailable` and `suspended` replace
 * everything, because there is nothing an account in either state may read;
 * `circle-first` replaces only the surfaces that need a circle, since Circles is
 * exactly where the member is being sent.
 */
export function AccessGate({
  kind,
  access,
  memberName,
  onOpenCircles,
  onLogOut,
}: {
  kind: GateKind;
  access: AccessState;
  memberName?: string | null;
  onOpenCircles: () => void;
  onLogOut: () => void;
}) {
  if (kind === "unavailable") {
    // Anybody who can log in is a member, so this is not a refusal — it is the
    // app admitting it could not read the account's standing, which is usually
    // a moment's trouble rather than anything about the member.
    return (
      <EmptyState glyph="↻" title="We could not open your account just now">
        <p>
          Everybody is welcome here, so this is not about you — the app could not check where your
          account stands. Reload the page and it usually comes straight back.
        </p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Reload
        </button>
        <p className="card-meta">
          If it keeps happening, log out and back in, or ask an admin to take a look.
        </p>
        <button className="btn-text" onClick={onLogOut}>
          Log out
        </button>
      </EmptyState>
    );
  }

  if (kind === "suspended") {
    return (
      <EmptyState glyph="⏸" title="This account is paused">
        <p>
          An admin has paused it while something is looked into. Nothing you shared has been
          deleted, and it all comes back if the account is let back in.
        </p>
        <button className="btn-text" onClick={onLogOut}>
          Log out
        </button>
      </EmptyState>
    );
  }

  return (
    <>
      {/* Somebody held at this door has just arrived, and this is the only screen
          they can read — so the greeting belongs here. */}
      <WelcomeNote memberName={memberName} />
      <EmptyState glyph="◎" title="Join a circle to get started">
        <p>
          Everything here is shared into a circle — a group inside the group, with its own members
          and its own categories. Pick one to join, or accept an invitation waiting for you, and
          the app fills up around it.
        </p>
        {!access.canCreateCircle && (
          <p className="card-meta">
            {access.trustedInDays > 0
              ? `You can start a circle of your own in ${access.trustedInDays} ${
                  access.trustedInDays === 1 ? "day" : "days"
                } — new accounts join one first.`
              : "Once you are in a circle you can start one of your own."}
          </p>
        )}
        <button className="btn btn-primary" onClick={onOpenCircles}>
          Find a circle
        </button>
      </EmptyState>
    </>
  );
}

/**
 * Why the "+ Start a circle" button just said no. Shown as a note rather than
 * hiding the button, because a member who cannot find the button assumes the app
 * is broken, whereas one who is told the date waits.
 *
 * Every branch names something the member can actually do, and the first one it
 * names is the fast one: being let into a circle earns the account its own
 * straight away, so joining one is worth more than waiting out the days. There
 * used to be a branch asking them to confirm their email, and it was both first
 * and wrong: an unconfirmed account cannot log in at all, so anybody reading this
 * has already confirmed — and it was shown on an answer the server could not
 * reliably read, so a member an admin had vouched for was still sent looking for
 * an email nothing had sent them.
 */
export function CircleTrustNote({ access }: { access: AccessState }) {
  if (access.circleCount === 0) {
    return (
      <p className="form-note">
        Join a circle first. Being in one is what starting your own is built on, and it is the
        one thing every new member does before anything else.
      </p>
    );
  }
  return (
    <p className="form-note">
      Join a circle and you can start your own straight away — one that is open to all lets you
      in on the spot, and the owner of one that asks can approve you. Discover, which everybody
      is in, does not count for this.{" "}
      {access.trustedInDays > 0
        ? `Otherwise an account can start circles ${access.trustedAfterDays} days after it is made; yours can in ${access.trustedInDays} ${access.trustedInDays === 1 ? "day" : "days"}.`
        : "Yours qualifies now — try again in a moment."}{" "}
      An admin can also vouch for your account at any point.
    </p>
  );
}
