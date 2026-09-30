// src/components/Guidelines.tsx
// The one thing every member is asked before their first share.
//
// It is a gate rather than a notice, and it is asked exactly once: the answer is
// stamped on the member, so the second share opens the form straight away. What
// it asks for is short on purpose — three lines somebody can actually read
// standing at a bus stop, rather than terms nobody finishes.
import { useState } from "react";
import type { ShareAndLearn } from "../store";
import { ErrorLine, Modal } from "./shared";

/** The guidelines themselves, in the words the group agreed to. */
export const COMMUNITY_GUIDELINES = [
  "Respect others.",
  "Share only content you own or have permission to share.",
  "No offensive or illegal material.",
];

/**
 * The list on its own, so the same three lines can be read outside the gate —
 * on Profile, where a member who has already agreed can look them up again.
 */
export function GuidelinesList() {
  return (
    <ul className="guidelines-list">
      {COMMUNITY_GUIDELINES.map((line) => (
        <li key={line}>
          <span className="guidelines-tick" aria-hidden="true">
            ✓
          </span>
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The gate wired up, for any surface that opens a share form of its own — which
 * is every per-type tab, since each one has its own "+ Add" button rather than
 * going through the shell. `guard` stands in front of whatever opens the form:
 * it runs the action straight away for a member who has already agreed, and
 * otherwise holds it until they have, so agreeing lands them in the form they
 * were heading for rather than back where they started. `gate` is the modal, and
 * is null the rest of the time.
 *
 * The same gate is on the server, on the seven routes that create a share, so a
 * surface that forgets this is refused rather than let through.
 */
export function useGuidelinesGate(store: ShareAndLearn) {
  const [held, setHeld] = useState<{ run: () => void } | null>(null);

  function guard(action: () => void) {
    if (store.accessLoaded && !store.access.acceptedGuidelines) {
      setHeld({ run: action });
      return;
    }
    action();
  }

  const gate = held ? (
    <GuidelinesGate
      onAgree={store.acceptGuidelines}
      onAgreed={() => {
        held.run();
        setHeld(null);
      }}
      onClose={() => setHeld(null)}
    />
  ) : null;

  return { guard, gate };
}

/**
 * The gate itself. Opened in front of whatever the member was about to share, and
 * `onAgreed` is what carries them into it — so agreeing feels like the first
 * step of posting rather than an interruption on the way to it.
 */
export function GuidelinesGate({
  onAgree,
  onAgreed,
  onClose,
}: {
  /** Records the agreement. Resolves once the server has it. */
  onAgree: () => Promise<unknown>;
  /** Where the member was heading, opened once they have agreed. */
  onAgreed: () => void;
  onClose: () => void;
}) {
  const [ticked, setTicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ticked) return;
    setBusy(true);
    setError(null);
    try {
      await onAgree();
      onAgreed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record that just now.");
      setBusy(false);
    }
  }

  return (
    <Modal
      eyebrow="Before you post"
      title="Community Guidelines"
      onClose={onClose}
      busy={busy}
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <p className="form-note">
          Everything shared here is read by people you know. These are the three things the group
          asks of everybody — you are asked once, and then never again.
        </p>
        <GuidelinesList />
        <label className="guidelines-agree">
          <input
            type="checkbox"
            checked={ticked}
            onChange={(e) => setTicked(e.target.checked)}
          />
          <span>I have read the Community Guidelines and agree to them.</span>
        </label>
        <ErrorLine message={error} />
        {/* Disabled rather than hidden: the button is visibly waiting on the tick,
            so nobody wonders where it went. */}
        <button type="submit" className="btn btn-primary" disabled={!ticked || busy}>
          {busy ? "Saving…" : "Agree and continue"}
        </button>
      </form>
    </Modal>
  );
}
