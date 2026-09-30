import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@netlify/identity";
import { acceptInvite, fetchInvitePreview, type InvitePreview } from "../api";
import { EmptyState, ErrorLine } from "./shared";
import { InstallButton } from "./InstallPrompt";

const PENDING_KEY = "share-and-learn:pending-invite";

/**
 * An invited friend usually has to sign up before the invite can be accepted, and
 * signing up may take a round trip through a confirmation email. Remembering the
 * token means they land back in the group instead of on a stranger's home page.
 */
export function rememberPendingInvite(token: string) {
  try {
    localStorage.setItem(PENDING_KEY, token);
  } catch {
    // Private browsing with storage blocked — the link still works while the tab is open.
  }
}

export function pendingInvite(): string | null {
  try {
    return localStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

export function forgetPendingInvite() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // Nothing to clean up.
  }
}

type JoinState = "loading" | "ready" | "joining" | "joined" | "problem";

export function JoinScreen({
  token,
  user,
  ready,
  onCreateAccount,
  onLogIn,
  onJoined,
  onEnterApp,
}: {
  token: string | null;
  user: User | null;
  ready: boolean;
  onCreateAccount: () => void;
  onLogIn: () => void;
  /**
   * The circle the link joined them into, when it was a circle invitation rather
   * than a plain one — the shell makes it the circle they land in.
   */
  onJoined: (circleId: number | null) => void;
  /**
   * The way into the app once the invite is settled, or once it turns out not to
   * be usable. It lands on Circles — the circle the link named, when it named
   * one — rather than on a dashboard, there no longer being one.
   */
  onEnterApp: () => void;
}) {
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [state, setState] = useState<JoinState>("loading");
  const [problem, setProblem] = useState<string | null>(null);
  // React runs effects twice in development; accepting is guarded so the second
  // pass does not race the first.
  const accepting = useRef(false);

  useEffect(() => {
    if (!token) {
      setState("problem");
      setProblem("That invite link is not complete. Ask your friend to send it again.");
      return;
    }
    let live = true;
    setState("loading");
    fetchInvitePreview(token)
      .then((found) => {
        if (!live) return;
        setPreview(found);
        if (found.status === "revoked") {
          setState("problem");
          setProblem("That invite was withdrawn. Ask your friend for a fresh link.");
          // Nothing here will ever work again, so it stops being remembered:
          // otherwise it is a link the app keeps steering back to.
          forgetPendingInvite();
        } else {
          setState("ready");
          rememberPendingInvite(token);
        }
      })
      .catch(() => {
        if (!live) return;
        setState("problem");
        setProblem("We could not find that invite. The link may have been mistyped.");
        forgetPendingInvite();
      });
    return () => {
      live = false;
    };
  }, [token]);

  const join = useCallback(async () => {
    if (!token || accepting.current) return;
    accepting.current = true;
    setState("joining");
    try {
      await acceptInvite(token);
      forgetPendingInvite();
      setState("joined");
      onJoined(preview?.circle?.id ?? null);
    } catch (err) {
      setState("problem");
      setProblem(err instanceof Error ? err.message : "That invite could not be accepted.");
    } finally {
      accepting.current = false;
    }
  }, [token, onJoined, preview]);

  // Once the friend has an account, accepting happens on its own — there is no
  // reason to make them press another button.
  useEffect(() => {
    if (ready && user && state === "ready") join();
  }, [ready, user, state, join]);

  const inviter = preview?.inviterName ?? "A member";
  const circle = preview?.circle ?? null;

  if (state === "problem") {
    return (
      <section className="join-screen">
        <EmptyState glyph="✉" title="This invite is not usable">
          {problem}
        </EmptyState>
        <button className="btn btn-ghost" onClick={onEnterApp}>
          Go to Share &amp; Learn
        </button>
      </section>
    );
  }

  if (state === "joined") {
    return (
      <section className="join-screen">
        <p className="join-eyebrow">You are in</p>
        <h1 className="join-title">
          {circle ? `Welcome to ${circle.icon} ${circle.name}` : "Welcome to Share & Learn"}
        </h1>
        <p className="join-copy">
          {inviter} knows you are here — everyone in the group can see that you joined, and your
          notifications have a welcome waiting.
          {circle && ` You are a member of ${circle.name}, so everything shared there is yours to read.`}
        </p>
        <div className="join-actions">
          <button className="btn btn-primary" onClick={onEnterApp}>
            See what the group shared
          </button>
          <InstallButton label="Keep it on your phone" />
        </div>
      </section>
    );
  }

  return (
    <section className="join-screen">
      <p className="join-eyebrow">{state === "joining" ? "Joining…" : "You are invited"}</p>
      <h1 className="join-title">
        {preview?.inviteeName ? `${preview.inviteeName}, ` : ""}
        {circle
          ? `${inviter} invited you to ${circle.icon} ${circle.name}`
          : `${inviter} invited you to Share & Learn`}
      </h1>
      {preview?.note && <blockquote className="join-note">“{preview.note}”</blockquote>}
      <p className="join-copy">
        {circle ? `${circle.name} is a circle inside Share & Learn — a ` : "It is a "}
        small, members-only room where a group shares the things it enjoys: songs they
        recorded, recipes worth cooking, books they finished, words worth knowing, and facts worth
        repeating. Everything is saved so you can come back to it.
      </p>

      <ul className="join-list">
        <li>
          <span aria-hidden="true">🎵</span> Listen to recordings the group made
        </li>
        <li>
          <span aria-hidden="true">🍲</span> Cook from recipes written by people you know
        </li>
        <li>
          <span aria-hidden="true">📚</span> Find your next book from what they read
        </li>
        <li>
          <span aria-hidden="true">🔖</span> Keep whatever you like in your own library
        </li>
      </ul>

      {state === "loading" && <p className="muted">Checking your invite…</p>}

      {ready && !user && state === "ready" && (
        <div className="join-actions">
          <button className="btn btn-primary" onClick={onCreateAccount}>
            Create your account
          </button>
          <button className="btn-text" onClick={onLogIn}>
            I already have one — log in
          </button>
        </div>
      )}

      {state === "joining" && <p className="muted">Adding you to the group…</p>}

      <ErrorLine message={problem} />

      <p className="join-footnote">
        Add Share &amp; Learn to your Home Screen once you are in, and it opens like any other app.
      </p>
      <InstallButton label="Install the app" className="btn-text" />
    </section>
  );
}
