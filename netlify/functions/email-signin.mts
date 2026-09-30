// netlify/functions/email-signin.mts
// "Continue with Email": the route behind the one field on the login form.
//
// It takes an address and emails a link that logs whoever opens it in. There is
// no password to choose, no password to forget, and — from the member's side — no
// difference between signing up and signing in, because the difference is
// something the server works out and never mentions. See
// `netlify/lib/magic-link.ts` for how that is built on the one email channel this
// app has.
//
// This is the only write in the app that is not behind `admittedUser()`, and it
// has to be: the whole point of it is a member who is not signed in yet.
// `POST /api/transliterate` is the nearest thing and still asks for a login. So
// the two protections that would otherwise have come from the access helpers are
// written out by hand here — a rate limit per address, because every call sends an
// email, and an answer that is identical whether or not the address was already a
// member, because the form is a place anybody can type anybody's address.
import type { Config } from "@netlify/functions";
import { normalizeEmail, sendSignInLink, throttleSignInLink } from "../lib/magic-link.js";
import { badRequest, jsonBody } from "../lib/items.js";

export default async (req: Request) => {
  const body = await jsonBody(req);

  const email = normalizeEmail(body?.email);
  if (!email) return badRequest("Enter an email address we can send a link to.");

  // An invite is a shortcut into one circle rather than a requirement, but when
  // somebody followed a link to get here it should still decide where they land,
  // so it travels with the account exactly as it does through the signup form.
  const inviteToken = typeof body?.inviteToken === "string" ? body.inviteToken : null;

  const throttle = await throttleSignInLink(email);
  if (!throttle.allowed) {
    return Response.json(
      {
        error:
          throttle.retryAfter > 120
            ? "That address has been sent several links already. Try again a little later, and check the spam folder in the meantime."
            : "A link is already on its way. Give it a moment before asking for another.",
        retryAfter: throttle.retryAfter,
      },
      { status: 429, headers: { "Retry-After": String(throttle.retryAfter) } },
    );
  }

  const sent = await sendSignInLink(email, inviteToken);
  if (!sent) {
    return Response.json(
      { error: "The link could not be sent just now. Try again in a moment." },
      { status: 502 },
    );
  }

  // Deliberately says nothing about whether an account was found or made. The
  // member is told to check their inbox either way, which is true either way, and
  // is what keeps this from being a way to ask whether somebody is a member here.
  return Response.json({ sent: true });
};

export const config: Config = {
  path: "/api/email-signin",
  method: ["POST"],
};
