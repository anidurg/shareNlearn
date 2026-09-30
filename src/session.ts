// src/session.ts
// Staying logged in between visits.
//
// `@netlify/identity` keeps two things in two places, and the mismatch between
// them is why members were asked to log in every time they opened the app.
//
//   * The *session* — the access token and, more importantly, the refresh token —
//     is persisted in `localStorage` by GoTrue, and survives a restart.
//   * The *cookie* the functions read, `nf_jwt`, is written with neither
//     `Max-Age` nor `Expires`, which makes it a session cookie. It dies when the
//     browser or the installed app is swept out of memory.
//
// On the next visit the session is therefore still there and the cookie is not —
// and `getUser()`, finding a persisted session with no cookie beside it, calls
// `clearSession()` and returns null. The credential that would have restored the
// login is destroyed by the call that goes looking for it.
//
// So two jobs live here. `restoreSession()` puts the cookie back from the
// persisted session before anything asks `getUser()`, and `stampAuthCookies()`
// re-writes it with a real expiry every time the library mints a new token. The
// library's own `refreshSession()` cannot do the first job: when the token still
// has more than a minute left it returns early *without* touching the cookies,
// which is exactly the case a member reopening the app is in.
//
// Beside them sit the two small things about logging in that belong to the device
// rather than to the account: whether this browser was asked to hold on to the
// login, and whether the link about to arrive in the inbox was asked for as a
// password reset or as a sign-in.
import { refreshSession } from "@netlify/identity";

/** How long the browser is asked to keep the auth cookies. */
const COOKIE_DAYS = 30;

/** Where gotrue-js persists the session. Its key, not ours, hence the string. */
const GOTRUE_STORAGE_KEY = "gotrue.user";

/** Ours: whether the member ticked "Keep me logged in" when they last logged in. */
const KEEP_KEY = "shareandlearn.keep-signed-in";

/** Ours: that this device asked for a password reset rather than a sign-in link. */
const RESET_KEY = "shareandlearn.password-reset-asked";

/**
 * How long a "I asked to reset my password" marker is believed. Long enough to
 * walk to the inbox and back, short enough that a marker left behind by a reset
 * abandoned last week does not turn next week's sign-in link into a password form.
 */
const RESET_WINDOW_MS = 2 * 60 * 60 * 1000;

/** The names the functions read, and the library writes. */
const JWT_COOKIE = "nf_jwt";
const REFRESH_COOKIE = "nf_refresh";

/** Refresh rather than reuse a token with less than this long to live. */
const MARGIN_SECONDS = 120;

/**
 * Whether this device was asked to hold on to the login.
 *
 * Defaults to true when nothing has been stored, which is deliberate: everybody
 * already logged in when the tick box arrived chose nothing, and thirty days is
 * what they had. Only somebody who unticks it says otherwise.
 */
export function keepSignedIn(): boolean {
  try {
    return window.localStorage.getItem(KEEP_KEY) !== "0";
  } catch {
    // Private mode, or storage turned off. The cookie is all there is either way,
    // so the safe answer is the one that does not silently keep somebody signed in.
    return false;
  }
}

/**
 * Remembers the answer to "Keep me logged in", which is a property of the device
 * rather than of the account — the same member may tick it on their phone and
 * leave it unticked on a shared computer.
 */
export function setKeepSignedIn(keep: boolean) {
  try {
    window.localStorage.setItem(KEEP_KEY, keep ? "1" : "0");
  } catch {
    // Nothing to remember it in; the cookie written below is still a session one.
  }
}

/**
 * Remembers that the member asked to *reset their password*, as against asking for
 * a sign-in link.
 *
 * Both arrive back the same way — Identity has one email that logs somebody in on
 * one tap, and `netlify/lib/magic-link.ts` explains why the sign-in link is built
 * on it — so `handleAuthCallback()` cannot tell the two apart and something has to.
 *
 * The marker deliberately sits on the *reset* rather than on the sign-in, which is
 * the way round that survives being wrong. A link is often asked for on a laptop
 * and opened on a phone, where nothing was ever stored: with no marker the reader
 * is signed in, which is what a sign-in link should do and also a perfectly good
 * outcome for a password reset, since Profile can change the password afterwards.
 * Marking the sign-in instead would have shown a stranger's phone a "choose a new
 * password" form for a link that was only ever meant to log them in.
 */
export function rememberPasswordReset() {
  try {
    window.localStorage.setItem(RESET_KEY, String(Date.now()));
  } catch {
    // Nothing to remember it in. The link still signs them in, and Profile still
    // changes a password, so the cost is one screen rather than the account.
  }
}

/** Whether a password reset was asked for from this device, recently enough. */
export function pendingPasswordReset(): boolean {
  try {
    const raw = window.localStorage.getItem(RESET_KEY);
    if (!raw) return false;
    const asked = Number(raw);
    if (!Number.isFinite(asked)) return false;
    if (Date.now() - asked > RESET_WINDOW_MS) {
      clearPasswordReset();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Forgets the marker, once the reset has been answered or abandoned. */
export function clearPasswordReset() {
  try {
    window.localStorage.removeItem(RESET_KEY);
  } catch {
    // Storage that cannot be written cannot be holding a marker either.
  }
}

interface StoredSession {
  accessToken: string;
  refreshToken?: string;
  /** Unix seconds, or undefined when the stored session did not say. */
  expiresAt?: number;
}

/**
 * The persisted session, or null. Everything here is defensive: private-mode
 * storage throws on read, and the shape belongs to another library, so anything
 * unexpected is treated as "no session" rather than as an error worth showing.
 */
function readStoredSession(): StoredSession | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(GOTRUE_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { token?: Record<string, unknown> };
    const token = parsed?.token;
    const accessToken = typeof token?.access_token === "string" ? token.access_token : null;
    if (!accessToken) return null;
    const refreshToken =
      typeof token?.refresh_token === "string" ? token.refresh_token : undefined;
    return { accessToken, refreshToken, expiresAt: secondsFrom(token?.expires_at) };
  } catch {
    return null;
  }
}

/**
 * gotrue-js stores `expires_at` in milliseconds and the JWT itself carries
 * seconds, so both turn up in practice. Anything past the year 33658 in seconds
 * is milliseconds — which is the same test the library makes.
 */
function secondsFrom(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value > 1e12 ? Math.floor(value / 1000) : value;
}

function expiringSoon(expiresAt: number | undefined) {
  if (expiresAt === undefined) return true;
  return expiresAt - Math.floor(Date.now() / 1000) <= MARGIN_SECONDS;
}

/**
 * Write the auth cookies with an expiry, in the same shape the library uses so
 * that whichever of us wrote last, the functions read the same thing. Called
 * after every login, signup and token refresh, because the library's own write
 * leaves the expiry off and the last write is the one that counts.
 *
 * How long is the member's own answer. Ticked, it is thirty days and the login
 * survives a restart; unticked, the cookies are written with no lifetime at all —
 * which is exactly what the library does by itself, and what closing the browser
 * is supposed to end.
 */
export function stampAuthCookies(accessToken: string, refreshToken?: string) {
  const maxAge = COOKIE_DAYS * 24 * 60 * 60;
  const lifetime = keepSignedIn() ? `max-age=${maxAge}; ` : "";
  const attributes = `path=/; ${lifetime}secure; samesite=lax`;
  document.cookie = `${JWT_COOKIE}=${encodeURIComponent(accessToken)}; ${attributes}`;
  if (refreshToken) {
    document.cookie = `${REFRESH_COOKIE}=${encodeURIComponent(refreshToken)}; ${attributes}`;
  }
}

/** Re-stamp from whatever the library has just persisted. */
export function restampFromStorage() {
  const session = readStoredSession();
  if (session) stampAuthCookies(session.accessToken, session.refreshToken);
}

/**
 * Put the login back together before anything asks who is logged in. Runs before
 * `getUser()` on purpose: after it, a missing cookie has already cost the member
 * their session.
 *
 * The cookie is written first and refreshed second, so a member whose token is
 * still good is logged in without a network round trip, and one whose token has
 * expired gets a new one rather than a stale cookie the functions would refuse.
 *
 * The one case where the session is deliberately *not* restored is the whole
 * point of the tick box. GoTrue persists the session in `localStorage` whatever
 * anybody ticked, so a session cookie dying with the browser would not end the
 * login by itself — this file would simply write it again. So when the member
 * asked not to be kept logged in and the cookie is gone, the browser has been
 * closed since they were last here, and the persisted session goes with it.
 */
export async function restoreSession() {
  if (!keepSignedIn() && !hasAuthCookie()) {
    forgetStoredSession();
    return;
  }
  const session = readStoredSession();
  if (!session) return;
  stampAuthCookies(session.accessToken, session.refreshToken);
  if (!expiringSoon(session.expiresAt)) return;
  try {
    // This one does write the cookies — it only declines to when the token is
    // fresh, which is the branch above.
    const jwt = await refreshSession();
    if (jwt) stampAuthCookies(jwt, readStoredSession()?.refreshToken);
  } catch {
    // Nothing to do: the cookie above is the best that could be offered, and a
    // request that fails on it retries through `withFreshSession()`.
  }
}

/** Whether the token cookie survived to this page load. */
function hasAuthCookie() {
  return document.cookie.split(";").some((part) => part.trim().startsWith(`${JWT_COOKIE}=`));
}

/**
 * Drops the persisted session without a network call, which is what a login the
 * member asked not to keep should amount to on the next visit. `getUser()` then
 * finds nobody, exactly as it would after logging out.
 */
function forgetStoredSession() {
  try {
    window.localStorage.removeItem(GOTRUE_STORAGE_KEY);
  } catch {
    // Storage that cannot be read cannot be holding a session either.
  }
}

/**
 * A token can expire while the app sits in a background tab or on a home screen,
 * and the library's refresh timer does not fire on time when the device was
 * asleep. So the session is renewed on the way back to the front, and again
 * behind any request that came back unauthorized.
 *
 * Answers whether anything actually changed, so a caller can decide whether
 * retrying is worth it.
 */
export async function withFreshSession(): Promise<boolean> {
  try {
    const jwt = await refreshSession();
    if (jwt) {
      stampAuthCookies(jwt, readStoredSession()?.refreshToken);
      return true;
    }
  } catch {
    return false;
  }
  // Nothing was minted, which means the token in hand is still valid. Re-stamping
  // is still worth it: the cookie may be the one thing that went missing.
  const session = readStoredSession();
  if (!session) return false;
  stampAuthCookies(session.accessToken, session.refreshToken);
  return true;
}

/** True when there is a persisted session to work from at all. */
export function hasStoredSession() {
  return readStoredSession() !== null;
}
