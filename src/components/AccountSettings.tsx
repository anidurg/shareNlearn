// src/components/AccountSettings.tsx
// The two halves of a login — the address it is made with and the password that
// opens it — changed from the member's own Profile.
//
// Neither is a row in this app's database, so nothing here goes through
// `src/api.ts`: Identity owns the account and `updateUser()` is the whole of the
// write. What is added on top is the current password, asked for before either
// change goes through. The session on this device lasts thirty days, so a signed
// in phone is not the same thing as the person who signed it in — and somebody
// who could change the address an account logs in with would be walking off with
// the account itself. Re-typing the password is the one small thing that stops
// that, and it is what every other app asks for at this moment too.
//
// A new address is not the login until it is confirmed. Identity emails the link
// and `handleAuthCallback()` — already called on every page load in `Auth.tsx` —
// completes the change when it is opened, which is why nothing here waits on it.
import { useState } from "react";
import { AuthError, login, requestPasswordRecovery, updateUser, type User } from "@netlify/identity";
import { rememberPasswordReset } from "../session";

type Panel = "email" | "password";

export function AccountSettings({ user }: { user: User }) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [current, setCurrent] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // An account made through a provider has no password here to change and no
  // address of its own to move — both live wherever it signs in.
  if (user.provider && user.provider !== "email") {
    return (
      <p className="card-meta">
        You sign in with {user.provider}. Your email and password are changed there.
      </p>
    );
  }
  // Nothing to prove the account with, so nothing safe to offer. Every account
  // made through this app has an address; this is the odd one made another way.
  if (!user.email) return null;

  const address = user.email;

  function choose(next: Panel) {
    setPanel((open) => (open === next ? null : next));
    setCurrent("");
    setEmail("");
    setPassword("");
    setConfirm("");
    setShow(false);
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const wanted = email.trim();
    if (panel === "email" && wanted.toLowerCase() === address.toLowerCase()) {
      setError("That is already the address you log in with.");
      return;
    }
    if (panel === "password" && password !== confirm) {
      setError("Those two passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      // The account is proved rather than assumed. This also mints a fresh token,
      // which the `login` event re-stamps in the usual way.
      await login(address, current);
      if (panel === "email") {
        await updateUser({ email: wanted });
        setNotice(
          `Check ${wanted} for a confirmation link. Until you open it you still log in with ${address}.`,
        );
      } else {
        await updateUser({ password });
        setNotice("Your password has been changed. It is the one to use next time you log in.");
      }
      setPanel(null);
      setCurrent("");
      setEmail("");
      setPassword("");
      setConfirm("");
      setShow(false);
    } catch (err) {
      if (err instanceof AuthError) {
        // The first call is the login, so a 401 here is the current password
        // rather than anything about what was being changed.
        if (err.status === 401) setError("That is not your current password.");
        else if (err.status === 422) {
          setError(
            panel === "email"
              ? "That does not look like a full email address."
              : "Choose a password of at least 6 characters.",
          );
        } else if (err.status === 409) setError("Another account already uses that address.");
        else setError(err.message);
      } else {
        setError("Something went wrong. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function sendReset() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      // The marker is what tells this link apart from a sign-in link, which arrives
      // by the same email and through the same `recovery` callback. Without it the
      // reader is simply logged in — harmless here, since they already are, and
      // useless, since the point was to reach the "choose a new password" form.
      rememberPasswordReset();
      await requestPasswordRecovery(address);
      setPanel(null);
      setNotice(`Check ${address} for a link to set a new password.`);
    } catch {
      setError("That reset link could not be sent. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="account-settings">
      <div className="account-links">
        <button
          className="btn-text"
          onClick={() => choose("email")}
          aria-expanded={panel === "email"}
        >
          Change login email
        </button>
        <button
          className="btn-text"
          onClick={() => choose("password")}
          aria-expanded={panel === "password"}
        >
          Change password
        </button>
      </div>

      {/* Said whether or not a panel is open: a change that is waiting on an
          email is the reason somebody comes back to this corner of Profile. */}
      {user.pendingEmail && (
        <p className="card-meta">
          Waiting on confirmation at {user.pendingEmail} — open the link sent there to finish the
          change.
        </p>
      )}

      {panel && (
        <form className="account-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Current password</span>
            <div className="field-password">
              <input
                required
                type={show ? "text" : "password"}
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide passwords" : "Show passwords"}
                aria-pressed={show}
              >
                {show ? "🙈" : "👁"}
              </button>
            </div>
          </label>

          {panel === "email" ? (
            <label className="field">
              <span>New email</span>
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          ) : (
            <>
              <label className="field">
                <span>New password</span>
                <input
                  required
                  type={show ? "text" : "password"}
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Confirm new password</span>
                <input
                  required
                  type={show ? "text" : "password"}
                  minLength={6}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </label>
            </>
          )}

          <p className="card-meta">
            {panel === "email"
              ? "We send a link to the new address. The change happens when you open it, so make sure you can read the email there."
              : "You stay logged in on this device. Anywhere else, use the new password next time."}
          </p>

          <div className="account-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "One moment…" : panel === "email" ? "Send confirmation" : "Update password"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => choose(panel)}>
              Cancel
            </button>
          </div>

          {/* The way through for somebody who cannot answer the question above.
              It is the same recovery email the log-in form sends. */}
          {panel === "password" && (
            <button type="button" className="link-forgot" onClick={sendReset} disabled={busy}>
              I do not remember my current password
            </button>
          )}
        </form>
      )}

      {error && <p className="form-error">{error}</p>}
      {notice && <p className="form-notice">{notice}</p>}
    </div>
  );
}
