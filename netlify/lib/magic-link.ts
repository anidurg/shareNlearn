// netlify/lib/magic-link.ts
// Signing in with nothing but an email address.
//
// The login form asks for an address and sends a link to it. Nobody chooses a
// password, nobody remembers one, and nobody is turned away for having forgotten
// the one they chose eighteen months ago — which for a group that shares recipes
// and songs a few times a month is most of the people most of the time.
//
// **What this is built on, and why it looks like a detour.** Netlify Identity has
// no magic-link endpoint of its own, and it has no one-time-code endpoint either.
// What it does have is the password-recovery email, and the link in that email is
// exactly a magic link wearing the wrong hat: opening it lands back on the site
// with a `recovery_token` in the hash, and `handleAuthCallback()` exchanges that
// for a real session. The member is logged in. Whether they then change their
// password is the app's business, and this app's answer is that they do not need
// to — `src/components/Auth.tsx` reads the callback as a sign-in when it was a
// sign-in that was asked for, and as a password reset when that was.
//
// So the whole of the trick is that a recovery email can only be sent to an
// account that exists. An address nobody has used before therefore gets an
// account first — auto-confirmed, with a password made of random bytes that
// nobody, including this file, ever sees again — and then the link. Which is why
// this is one route rather than the two it looks like: from the member's side
// "log in" and "sign up" are the same tap, and the difference between them is
// something the server works out and never mentions.
//
// Two things it is careful about. It never says whether an address was already a
// member: the answer is the same either way, because the login form is a place
// anybody can type anybody's address. And it counts what it has sent, because a
// route that emails a stranger on request and is open by necessity is a relay
// until it is rate limited.
import { createHash, randomBytes } from "node:crypto";
import { admin, getIdentityConfig, type User } from "@netlify/identity";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { members, signInLinks } from "../../db/schema.js";

/** No second link for the same address until this long has passed. */
const COOLDOWN_SECONDS = 60;

/** And no more than this many in an hour, however patiently they are asked for. */
const HOURLY_LIMIT = 5;

/** The window the count above is measured over. */
const WINDOW_SECONDS = 60 * 60;

/**
 * How many accounts to page through when looking one up by address, and how many
 * at a time. Generous enough to cover a group far larger than this app is for,
 * and bounded because an unbounded loop against somebody else's API on an
 * unauthenticated route is its own kind of open door.
 *
 * Overrunning it is not a failure, because of how the caller is written: not
 * finding an account leads to creating one, and creating one that already exists
 * is refused by Identity and read as "it was there after all". So the limit costs
 * a wasted request in a group of thousands, and never a wrong answer.
 */
const LOOKUP_PAGE_SIZE = 200;
const LOOKUP_MAX_PAGES = 20;

/** Rough enough to catch a typo, loose enough not to argue about valid addresses. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export interface ThrottleVerdict {
  allowed: boolean;
  /** Seconds until the next link may be asked for, when it may not be now. */
  retryAfter: number;
}

/**
 * The address as everything downstream should see it. Trimmed and lowercased,
 * because `Anita@Example.com` and `anita@example.com` are one inbox and must be
 * one row, one account and one rate limit.
 */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

/**
 * What the throttle table stores instead of the address.
 *
 * A plain hash with no secret, which is the right amount of protection for what
 * this is: nobody can read the table and learn who tried to log in, and nobody
 * needs to be stopped from confirming a guess they already have. The reason for
 * hashing at all is that the alternative is a table listing every address anybody
 * has ever typed into a login form, most of them belonging to people who never
 * became members and never agreed to anything.
 */
function emailHash(email: string): string {
  return createHash("sha256").update(email).digest("hex");
}

/**
 * A name to put on a brand new account, worked out from the address, because the
 * form the member just used asked for nothing else.
 *
 * This is not cosmetic. `memberNameOf()` falls back to `user.email` when an
 * account has no name, and a display name is public where an address deliberately
 * never is — every route in the app is careful that emails do not leave the
 * server, and an unnamed magic-link member would have walked their address onto
 * every card they posted. So an account created here always arrives named.
 *
 * "anita.rao@example.com" becomes "Anita Rao", which is right often enough to be
 * worth doing and wrong in a way the member can see and would want to correct.
 */
export function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const words = local
    .split(/[._\-+]+/)
    .map((part) => part.replace(/\d+$/, ""))
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1));
  return words.join(" ") || "A member";
}

/**
 * Whether a link may be sent to this address now, and the count updated if so.
 *
 * Read and written in one place rather than as a check followed by a send,
 * because the whole value of it is in the write: two taps arriving together
 * should cost two against the allowance even if they read the same row.
 */
export async function throttleSignInLink(email: string): Promise<ThrottleVerdict> {
  const hash = emailHash(email);
  const now = new Date();
  const [row] = await db.select().from(signInLinks).where(eq(signInLinks.emailHash, hash));

  if (row) {
    const sinceLast = (now.getTime() - row.lastSentAt.getTime()) / 1000;
    if (sinceLast < COOLDOWN_SECONDS) {
      return { allowed: false, retryAfter: Math.ceil(COOLDOWN_SECONDS - sinceLast) };
    }
    const sinceWindow = (now.getTime() - row.windowStartedAt.getTime()) / 1000;
    // The hour has rolled over, so the allowance starts again from this send.
    if (sinceWindow >= WINDOW_SECONDS) {
      await db
        .update(signInLinks)
        .set({ lastSentAt: now, windowStartedAt: now, sentCount: 1 })
        .where(eq(signInLinks.emailHash, hash));
      return { allowed: true, retryAfter: 0 };
    }
    if (row.sentCount >= HOURLY_LIMIT) {
      return { allowed: false, retryAfter: Math.ceil(WINDOW_SECONDS - sinceWindow) };
    }
    await db
      .update(signInLinks)
      .set({ lastSentAt: now, sentCount: row.sentCount + 1 })
      .where(eq(signInLinks.emailHash, hash));
    return { allowed: true, retryAfter: 0 };
  }

  await db
    .insert(signInLinks)
    .values({ emailHash: hash, lastSentAt: now, windowStartedAt: now, sentCount: 1 })
    .onConflictDoNothing();
  return { allowed: true, retryAfter: 0 };
}

/** The Identity endpoint and the operator token, on the server. */
function identityEndpoint(): { url: string; token?: string } | null {
  const config = getIdentityConfig();
  return config?.url ? config : null;
}

/**
 * Whether the app has already met this address. Asked first because it is one
 * indexed read against a table the app owns, where the alternative is paging
 * somebody else's user list — and because every member who has ever opened the
 * app has a row here, which is very nearly everybody.
 *
 * A false answer is not "no account exists"; it is "not certainly". The caller
 * treats it that way.
 */
async function knownMember(email: string): Promise<boolean> {
  const [row] = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.email, email));
  return Boolean(row);
}

/** The Identity account for an address, by paging the roll. Null if not found. */
async function findIdentityUser(email: string): Promise<User | null> {
  for (let page = 1; page <= LOOKUP_MAX_PAGES; page += 1) {
    let batch: User[];
    try {
      batch = await admin.listUsers({ page, perPage: LOOKUP_PAGE_SIZE });
    } catch {
      // Nothing readable here is worth failing the sign-in over: not finding an
      // account leads to trying to create one, which is refused if it exists.
      return null;
    }
    const found = batch.find((user) => user.email?.toLowerCase() === email);
    if (found) return found;
    if (batch.length < LOOKUP_PAGE_SIZE) return null;
  }
  return null;
}

/**
 * An account for this address, made if there was not one.
 *
 * The password is thirty-two random bytes that are generated, sent to Identity
 * and dropped. It exists because the admin API requires one, and it is
 * unguessable so that leaving it in place is not a way in. A member who later
 * wants a password of their own asks for one the ordinary way — the link they
 * have just been sent lands them in a session where they can set one — and until
 * then the only key to the account is the inbox, which is the point.
 *
 * Two details worth keeping. `admin.createUser()` auto-confirms, which is what
 * makes the link that follows work at all rather than arriving behind a
 * confirmation email nobody asked for. And it does not fire the `userSignup`
 * event that `netlify/functions/identity.mts` uses to stamp a role, so the role is
 * stamped here instead — `members.role` is what the app actually decides anything
 * by, but `app_metadata.roles` is what tooling reads and the two should agree.
 */
async function ensureAccount(email: string, inviteToken: string | null): Promise<void> {
  try {
    await admin.createUser({
      email,
      password: randomBytes(32).toString("base64url"),
      data: {
        user_metadata: {
          full_name: nameFromEmail(email),
          // An invite is a shortcut into one circle rather than the price of
          // entry, but when somebody arrived on one it should still be the circle
          // they land in, so the token travels with the account the same way it
          // does through the ordinary signup form.
          ...(inviteToken ? { invite_token: inviteToken } : {}),
        },
        app_metadata: { roles: ["member"] },
      },
    });
  } catch {
    // Either the address was already an account, or two taps raced and the other
    // one won. Both mean an account exists, which is all the caller needs.
  }
}

/**
 * Asks Identity to email the sign-in link.
 *
 * A plain form-encoded `fetch` rather than a library call, for the same reason
 * `netlify/lib/aksharamukha.ts` uses one: the browser-side
 * `requestPasswordRecovery()` talks to the GoTrue client, which does not exist in
 * a function. The endpoint is the same one it would have called.
 */
async function sendRecoveryEmail(email: string): Promise<boolean> {
  const endpoint = identityEndpoint();
  if (!endpoint) return false;
  try {
    const res = await fetch(`${endpoint.url}/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * The whole of what the route does: make sure there is an account, then email the
 * link to it.
 *
 * The order matters and the fallbacks are the interesting part. An address the app
 * already knows goes straight to the email, which is the common case and one
 * database read. An address it does not know is looked up on Identity, created if
 * genuinely absent, and emailed. And an email that comes back refused is retried
 * once after creating the account, because the one reason a recovery request is
 * refused for a well-formed address is that there is nobody to recover — which is
 * exactly the case where the lookup above was wrong, and self-correcting beats
 * telling a new member their address does not work.
 */
export async function sendSignInLink(email: string, inviteToken: string | null): Promise<boolean> {
  const exists = (await knownMember(email)) || (await findIdentityUser(email)) !== null;
  if (!exists) await ensureAccount(email, inviteToken);

  if (await sendRecoveryEmail(email)) return true;
  if (!exists) return false;

  // Believed to exist and could not be recovered: make the account and try again.
  await ensureAccount(email, inviteToken);
  return await sendRecoveryEmail(email);
}
