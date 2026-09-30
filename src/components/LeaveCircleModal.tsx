import { useState } from "react";
import type { Circle, CirclePrivacy } from "../api";
import { ErrorLine, Modal } from "./shared";

/**
 * What a member is told before they leave. The three doors do not cost the same
 * to walk back through, so the sentence says which one this is: an open circle
 * can be rejoined on a tap, an "ask to join" one waits on its owner, and a
 * private one waits on somebody remembering to invite them.
 */
const WARNING: Record<CirclePrivacy, string> = {
  private:
    "You will lose access to this private circle. You may need a new invitation or approval to join again.",
  discoverable:
    "You will lose access to this circle and everything shared into it. It is not open to all, so joining again means asking its owner and waiting to be let back in.",
  public:
    "You will no longer have access to this circle or its shared content. You can rejoin later if the circle allows it.",
};

/**
 * The two circles nobody can leave, and why. Both are refused by the server as
 * well; this is what the member reads instead of a failed request.
 *
 * These sentences used to be the whole design: the button was drawn for
 * everybody and the dialog explained the refusal, on the same argument
 * `CircleTrustNote` makes — somebody who cannot find a button assumes the app is
 * broken. That argument does not survive contact with either of these two cases.
 * `CircleTrustNote` explains a *temporary* refusal with a remedy attached, so
 * the sentence behind the button tells the member how to make it work. Owning a
 * circle has no such remedy, and neither does being in the circle every account
 * is joined to, so for those two members the button's only possible outcome was
 * a dialog saying no — the same shape of thing as a lyric-script button that
 * could only fail, which the app already declines to draw.
 *
 * So `canLeaveCircle()` now keeps the button off those cards, and this stays as
 * the catch for the leave that gets attempted anyway: a card read before the
 * member became the owner, an older client, a `DELETE` the server turns down for
 * a reason the browser did not know about. A hidden control is never the check.
 */
function heldBack(circle: Circle): string | null {
  if (circle.isDefault) {
    return `${circle.name} is the circle everybody in the group is in — it is where new members land and how anybody finds their first circle, so it cannot be left.`;
  }
  if (circle.role === "owner") {
    return `A circle keeps its owner, so you cannot leave ${circle.name} while it is yours. Handing a circle to somebody else is not possible yet, so deleting it is the only way out — and that closes it for everybody in it. Nothing anybody shared is deleted: a post left with no circles becomes private to whoever wrote it.`;
  }
  return null;
}

/**
 * Whether to offer this member a way out of this circle at all. The one rule
 * behind both halves of it: the dialog reads `heldBack()` to explain a refusal,
 * and every surface that draws a Leave button asks this, so the button and the
 * sentence can never disagree about who may leave.
 *
 * An admin is deliberately not held back. Looking after a circle is a job rather
 * than a tie to it, and walking away from one is something the app supports.
 */
export function canLeaveCircle(circle: Circle): boolean {
  return heldBack(circle) === null;
}

/**
 * Leaving a circle, asked about first. It used to happen on the tap, which is a
 * lot to lose to a mis-press: everything the circle holds goes out of view at
 * once, and a private circle cannot be walked back into without somebody else
 * acting.
 *
 * The dialog owns the busy state and the refusal, so a leave the server turns
 * down leaves the member exactly where they were with the reason on screen,
 * rather than closing on an error nobody read.
 */
export function LeaveCircleModal({
  circle,
  onCancel,
  onLeave,
}: {
  circle: Circle;
  onCancel: () => void;
  /** The leave itself, resolving once the membership has actually gone. */
  onLeave: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refusal = heldBack(circle);

  function leave() {
    setBusy(true);
    setError(null);
    onLeave()
      .catch((err) => {
        setError(err instanceof Error ? err.message : "That did not work.");
        setBusy(false);
      });
  }

  return (
    <Modal
      eyebrow="Circles"
      // The circle's own name, so nobody leaves the wrong one.
      title={refusal ? `You cannot leave ${circle.name}` : `Leave ${circle.name}?`}
      onClose={onCancel}
      busy={busy}
    >
      <p className="form-note">{refusal ?? WARNING[circle.privacy]}</p>
      <ErrorLine message={error} />
      <div className="modal-actions">
        {refusal ? (
          <button className="btn btn-primary" onClick={onCancel}>
            Understood
          </button>
        ) : (
          <>
            {/* Cancel first and plain, the leave second and never the primary:
                the safe answer should be the easy one. */}
            <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={leave} disabled={busy}>
              {busy ? "Leaving…" : "Leave circle"}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
