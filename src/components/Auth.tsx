import { useEffect, useState } from "react";
import {
  login,
  signup,
  logout,
  getUser,
  getSettings,
  oauthLogin,
  onAuthChange,
  requestPasswordRecovery,
  updateUser,
  handleAuthCallback,
  AuthError,
  type AuthProvider,
  type User,
} from "@netlify/identity";
import { pendingInvite } from "./JoinScreen";
import { requestEmailSignIn } from "../api";
import {
  clearPasswordReset,
  keepSignedIn,
  pendingPasswordReset,
  rememberPasswordReset,
  restampFromStorage,
  restoreSession,
  setKeepSignedIn,
  withFreshSession,
} from "../session";

export function useIdentityUser() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    let mounted = true;
    // The order matters. `restoreSession()` puts the `nf_jwt` cookie back from the
    // session GoTrue persisted, because `getUser()` treats a persisted session
    // with no cookie beside it as a session to throw away — which is what asked
    // every member to log in again each time they opened the app.
    (async () => {
      await restoreSession();
      await handleAuthCallback().catch(() => {});
      const u = await getUser();
      if (mounted) {
        setUser(u);
        setReady(true);
      }
    })();
    const unsubscribe = onAuthChange((event, u) => {
      setUser(u);
      // Every token the library mints is written to a cookie with no expiry, so
      // each one is re-stamped with a real one as it arrives. `recovery` is in the
      // list because it does *not* emit `login`, and it is now the ordinary way
      // members arrive — a sign-in link that left the cookie without a lifetime
      // would be a login that died with the browser.
      if (event === "login" || event === "token_refresh" || event === "recovery") {
        restampFromStorage();
      }
      // Identity has one email that logs somebody in on one tap, and both the
      // sign-in link and the password reset are built on it, so the event alone
      // cannot say which was asked for. The device that asked remembers, and the
      // marker's whole job is to answer this once — hence reading and clearing it
      // in the same breath. With no marker the member is simply logged in, which
      // is what a sign-in link is for and a fine outcome for a reset besides.
      if (event === "recovery") {
        const asked = pendingPasswordReset();
        clearPasswordReset();
        setRecovering(asked);
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  /**
   * A device that slept through the hour its token was good for wakes up with a
   * stale one, and the library's refresh timer fires late. Renewing on the way
   * back to the front means the first request after waking carries a token the
   * functions will accept.
   */
  useEffect(() => {
    function renew() {
      if (document.visibilityState === "visible") void withFreshSession();
    }
    document.addEventListener("visibilitychange", renew);
    window.addEventListener("focus", renew);
    return () => {
      document.removeEventListener("visibilitychange", renew);
      window.removeEventListener("focus", renew);
    };
  }, []);

  return { user, ready, recovering, clearRecovering: () => setRecovering(false) };
}

/**
 * The providers offered above the email field, in the order they are offered.
 *
 * Which of them a member actually sees is the project's own Identity setting
 * rather than anything decided here: `getSettings()` answers which are switched
 * on, and a provider nobody enabled draws no button. So enabling Google in the
 * Netlify dashboard is the whole of what it takes to put a Google button on this
 * screen, and there is no list to keep in step.
 *
 * **Apple is deliberately absent, and it is not an oversight.** Netlify Identity's
 * `AuthProvider` is `google | github | gitlab | bitbucket | facebook | email`;
 * there is no Apple provider to switch on, and no amount of front-end work makes
 * one. Adding it would mean signing in against something other than Identity,
 * which is the one thing every `getUser()` call in `netlify/functions/` depends
 * on. When Identity ships it, one line here is the whole change.
 */
const OAUTH_PROVIDERS: { id: AuthProvider; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "facebook", label: "Facebook" },
  { id: "github", label: "GitHub" },
  { id: "gitlab", label: "GitLab" },
  { id: "bitbucket", label: "Bitbucket" },
];

/** How long the resend button waits, matching `COOLDOWN_SECONDS` on the server. */
const RESEND_SECONDS = 60;

type AuthMode = "welcome" | "inbox" | "password" | "signup" | "forgot" | "reset";

interface AuthPanelProps {
  onClose: () => void;
  initialMode?: "welcome" | "signup" | "reset";
}

/**
 * The front door.
 *
 * `welcome` is what almost everybody sees and is deliberately three things: the
 * providers, a rule with "or" through it, and one field. Nobody is asked to
 * choose a password, nobody is asked whether they are new — "log in" and "sign
 * up" are the same tap of Continue with Email, and which one it turns out to be
 * is worked out by `netlify/lib/magic-link.ts` and never mentioned.
 *
 * The password screens are still here and still work, because members who chose a
 * password before this existed have one and it is theirs. They are one link down
 * rather than the way in, which is the whole change.
 */
export function AuthPanel({ onClose, initialMode = "welcome" }: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [providers, setProviders] = useState<AuthProvider[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  /**
   * Whether to hold on to this login after the browser closes. Seeded from what
   * this device answered last time, so somebody who unticked it on a shared
   * computer is not quietly opted back in.
   */
  const [keep, setKeep] = useState(keepSignedIn);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Seconds until another link may be asked for, counted down on the inbox screen. */
  const [wait, setWait] = useState(0);

  // Which providers are on is the project's setting, so it is read rather than
  // assumed. A site with none — or an Identity that cannot be reached — simply
  // gets the email field, which is the part that always works.
  useEffect(() => {
    let mounted = true;
    getSettings()
      .then((settings) => {
        if (!mounted) return;
        setProviders(
          OAUTH_PROVIDERS.filter(({ id }) => settings.providers?.[id]).map(({ id }) => id),
        );
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  function goTo(next: AuthMode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  /**
   * Off to the provider, which navigates away and never comes back to this
   * function — `handleAuthCallback()` in `useIdentityUser` picks the member up on
   * the far side. How long to keep the login is answered first, because by the
   * time the cookies are written this panel no longer exists.
   */
  function continueWith(provider: AuthProvider) {
    setError(null);
    setKeepSignedIn(keep);
    try {
      oauthLogin(provider);
    } catch {
      setError("That way in is not available just now. Try an email link instead.");
    }
  }

  /** Asks the server to email a link, and moves to the "check your inbox" screen. */
  async function sendLink(resending: boolean) {
    setError(null);
    setNotice(null);
    setBusy(true);
    // Same reason as the provider path: the session is established by the link,
    // on a page load where nothing about this form survives.
    setKeepSignedIn(keep);
    try {
      await requestEmailSignIn(email.trim(), pendingInvite());
      setMode("inbox");
      setWait(RESEND_SECONDS);
      if (resending) setNotice("Sent again. It can take a minute to arrive.");
    } catch (err) {
      const retryAfter = (err as { retryAfter?: number })?.retryAfter;
      if (typeof retryAfter === "number") {
        // Refused for asking too soon, which means an earlier link is already on
        // its way — so the inbox screen is the truthful place to be, with the wait
        // counted down on the button rather than explained in a sentence.
        setWait(retryAfter);
        setMode("inbox");
      }
      setError(err instanceof Error ? err.message : "The link could not be sent just now.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "welcome") {
      await sendLink(false);
      return;
    }
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "password") {
        // Answered before the call rather than after it: the login writes the
        // cookies as it lands, and how long they last is what was just ticked.
        setKeepSignedIn(keep);
        await login(email, password);
        onClose();
      } else if (mode === "signup") {
        // Anybody may create an account. An invite link is not required, but when
        // the member arrived on one its token travels with the signup so the
        // circle that invited them is the circle they land in.
        const token = pendingInvite();
        const user = await signup(email, password, {
          full_name: name,
          ...(token ? { invite_token: token } : {}),
        });
        if (user.confirmedAt) {
          onClose();
        } else {
          setNotice("Check your inbox to confirm your account, then log in.");
        }
      } else if (mode === "forgot") {
        // Marked *before* the email goes, because the marker is what tells the
        // link apart from a sign-in link when it lands. See `src/session.ts`.
        rememberPasswordReset();
        await requestPasswordRecovery(email);
        setNotice("Check your email for a password reset link.");
      } else {
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          return;
        }
        await updateUser({ password });
        clearPasswordReset();
        onClose();
      }
    } catch (err) {
      if (err instanceof AuthError) {
        // A refused signup and a wrong password are both 401s, so which one it is
        // depends on what was being attempted.
        if (err.status === 401 && mode === "signup") {
          setError(
            "That account could not be created. If you have signed up before, log in instead — and if you have just registered, confirm your email first.",
          );
        } else if (err.status === 401) {
          setError(
            "That email and password do not match. If you never chose a password, ask for an email link instead.",
          );
        } else if (err.status === 403) setError("New accounts are closed for this site at the moment.");
        else if (err.status === 422) setError("Please use a full email and a password of at least 6 characters.");
        else setError(err.message);
      } else {
        setError("Something went wrong. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  const eyebrow =
    mode === "welcome"
      ? null
      : mode === "inbox"
        ? "One tap to go"
        : mode === "password"
          ? "Welcome back"
          : mode === "signup"
            ? "Join the room"
            : mode === "forgot"
              ? "Password recovery"
              : "Almost there";
  const title =
    mode === "welcome"
      ? "Welcome to Share & Learn"
      : mode === "inbox"
        ? "Check your inbox"
        : mode === "password"
          ? "Log in with a password"
          : mode === "signup"
            ? "Create your account"
            : mode === "forgot"
              ? "Reset your password"
              : "Choose a new password";
  const submitLabel = busy
    ? "One moment…"
    : mode === "welcome"
      ? "Continue with Email"
      : mode === "password"
        ? "Log in"
        : mode === "signup"
          ? "Create account"
          : mode === "forgot"
            ? "Send reset link"
            : "Update password";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        {eyebrow && <p className="modal-eyebrow">{eyebrow}</p>}
        <h2 className="modal-title">{title}</h2>

        {mode === "welcome" && (
          <>
            <p className="auth-lede">
              {pendingInvite()
                ? "Accept the invitation with whichever of these is easiest — the same button logs you in and creates your account."
                : "The same button logs you in and creates your account. Nobody has to invent a password."}
            </p>
            {providers.length > 0 && (
              <>
                <div className="auth-providers">
                  {providers.map((provider) => {
                    const label = OAUTH_PROVIDERS.find((p) => p.id === provider)?.label ?? provider;
                    return (
                      <button
                        key={provider}
                        type="button"
                        className="btn btn-provider"
                        onClick={() => continueWith(provider)}
                      >
                        Continue with {label}
                      </button>
                    );
                  })}
                </div>
                <p className="auth-divider">
                  <span>or</span>
                </p>
              </>
            )}
          </>
        )}

        {mode === "inbox" ? (
          // Not a form: everything on this screen is a wait or a way back out of
          // it, and the one thing that would have been submitted has been.
          <div className="auth-form">
            <p className="form-notice">
              A link is on its way to <strong>{email.trim()}</strong>. Open it on this device or any
              other and you are in — there is no password to type.
            </p>
            <p className="auth-hint">
              Nothing there? Look in the spam folder, and check the address for a typo.
            </p>
            {error && <p className="form-error">{error}</p>}
            {notice && <p className="form-notice">{notice}</p>}
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy || wait > 0}
              onClick={() => void sendLink(true)}
            >
              {wait > 0 ? `Send it again in ${wait}s` : "Send it again"}
            </button>
            <button type="button" className="link-toggle" onClick={() => goTo("welcome")}>
              Use a different address
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            {mode === "signup" && !pendingInvite() && (
              <p className="form-notice">
                Anybody can join. Create an account and you land in Discover, the circle everybody
                shares — read what is there, and add something of your own.
              </p>
            )}
            {mode === "signup" && (
              <label className="field">
                <span>Your name</span>
                <input required value={name} onChange={(e) => setName(e.target.value)} />
              </label>
            )}
            {mode !== "reset" && (
              <label className="field">
                <span>Email address</span>
                <input
                  required
                  type="email"
                  autoComplete="email"
                  autoFocus={mode === "welcome"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            )}
            {mode !== "forgot" && mode !== "welcome" && (
              <label className="field">
                <span>{mode === "reset" ? "New password" : "Password"}</span>
                <div className="field-password">
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? "🙈" : "👁"}
                  </button>
                </div>
              </label>
            )}
            {mode === "reset" && (
              <label className="field">
                <span>Confirm new password</span>
                <div className="field-password">
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </label>
            )}
            {(mode === "welcome" || mode === "password") && (
              // How long to hold on to this login, and — where there is a password
              // to have forgotten — the way out of having forgotten it.
              <div className="auth-options">
                <label className="auth-keep">
                  <input
                    type="checkbox"
                    checked={keep}
                    onChange={(e) => setKeep(e.target.checked)}
                  />
                  <span>Keep me logged in</span>
                </label>
                {mode === "password" && (
                  <button type="button" className="link-forgot" onClick={() => goTo("forgot")}>
                    Forgot password?
                  </button>
                )}
              </div>
            )}
            {error && <p className="form-error">{error}</p>}
            {notice && <p className="form-notice">{notice}</p>}
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {submitLabel}
            </button>
          </form>
        )}

        {mode === "welcome" && (
          <button className="link-toggle" onClick={() => goTo("password")}>
            Chose a password before? Log in with it
          </button>
        )}
        {mode === "password" && (
          <>
            <button className="link-toggle" onClick={() => goTo("welcome")}>
              Email me a link instead
            </button>
            <button className="link-toggle" onClick={() => goTo("signup")}>
              New here? Create an account
            </button>
          </>
        )}
        {(mode === "signup" || mode === "forgot") && (
          <button className="link-toggle" onClick={() => goTo("welcome")}>
            Back to log in
          </button>
        )}
      </div>
    </div>
  );
}

export function logoutUser() {
  return logout();
}
