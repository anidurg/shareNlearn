// netlify/lib/upload-rate.ts
// How fast one member may upload, which is a different question from how much
// they may keep.
//
// Every other size rule in the app is about one request — `MAX_PHOTO_BYTES`,
// `MAX_ATTACHMENT_BYTES`, `MAX_PART_BYTES`, `MAX_ITEM_UPLOAD_BYTES` — and each of
// them is met perfectly by a loop. Blobs has no expiry and no total-size ceiling
// worth relying on, so bytes written once are billed to store and billed again
// every time they are read; the one thing worth refusing is therefore not a large
// upload but a fast one.
//
// The algorithm is `throttleSignInLink()`'s in `magic-link.ts`, which is the other
// rate limit in the app: one row, one window, reset when the hour rolls over,
// refused with a `Retry-After` the caller can act on. Two things differ, and both
// are because this is counting bytes rather than emails. There is no cooldown
// between one upload and the next — a recording legitimately arrives as five parts
// back to back — and the allowance has two numbers rather than one, since a
// request count alone lets a hundred 4 MB parts through and a byte count alone
// lets a thousand tiny writes through.
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { uploadRates } from "../../db/schema.js";
import { recordUpload } from "./usage.js";

/** The hour the allowance is counted over. */
const WINDOW_SECONDS = 60 * 60;

/**
 * How many upload requests one member may make in that hour.
 *
 * Sized against the busiest honest hour anybody has: a 20 MB recording arrives as
 * five parts, a share may carry ten photos and a category may ask for a dozen
 * documents, so somebody setting up a circle's worth of content in one sitting is
 * a few dozen requests. A hundred and twenty leaves that comfortable and still
 * bounds a script to something a person could plausibly have done.
 */
const HOURLY_UPLOADS = 120;

/**
 * How many bytes those requests may carry between them.
 *
 * Three hundred megabytes is fifteen full-length recordings, or sixty photos and
 * thirty documents — more than a member does in an hour and less than a mistake
 * anybody has to pay for. It is the number that actually matters: the request
 * count above stops the small-writes shape, and this stops the large-writes one.
 */
const HOURLY_BYTES = 300 * 1024 * 1024;

/** Enough of a member to count against, so a caller can pass the user it has. */
type Uploader = { id: string };

function refusal(retryAfter: number, what: string): Response {
  const minutes = Math.max(1, Math.ceil(retryAfter / 60));
  return Response.json(
    {
      error: `That is a lot of uploading in one go — ${what} Please try again in ${minutes === 1 ? "a minute" : `${minutes} minutes`}.`,
      retryAfter,
    },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

/**
 * The refusal when this member has uploaded too much too quickly, and null when
 * they have not — the shape `unsafeText()` has, so an ingest route adds two lines
 * and returns what it is given.
 *
 * Read and written in one place rather than as a check and then a record, for the
 * same reason the sign-in throttle is: the value of it is in the write, and two
 * requests arriving together should each cost their bytes even though they read
 * the same row.
 *
 * `bytes` is what this request is about to store, so it is charged before the blob
 * is written rather than after — a refusal has to cost the member nothing, and a
 * write that then fails has cost them a little of their allowance, which is the
 * right way round. A chunked upload passes its real bytes on each part and then
 * **zero** on the claim route that stitches them, since the bytes were counted on
 * the way in and counting them again would bill one recording twice.
 *
 * It is also where the cumulative ledger is written, on each of the three accept
 * paths: `recordUpload()` in `usage.ts` keeps a permanent per-day total beside
 * this hourly window, since a window that resets can never answer what a member
 * has cost. Charging it here rather than in the ingest routes means every route
 * that can store a blob is counted by having already been written — including the
 * claim route's deliberate zero, which must not be counted twice either.
 */
export async function throttleUpload(
  user: Uploader,
  bytes: number,
): Promise<Response | null> {
  const charge = Number.isFinite(bytes) && bytes > 0 ? Math.ceil(bytes) : 0;
  const now = new Date();
  const [row] = await db.select().from(uploadRates).where(eq(uploadRates.memberId, user.id));

  if (row) {
    const sinceWindow = (now.getTime() - row.windowStartedAt.getTime()) / 1000;

    // The hour has rolled over, so the allowance starts again from this upload.
    if (sinceWindow >= WINDOW_SECONDS) {
      await db
        .update(uploadRates)
        .set({ windowStartedAt: now, uploadCount: 1, uploadBytes: charge })
        .where(eq(uploadRates.memberId, user.id));
      await recordUpload(user, charge);
      return null;
    }

    const retryAfter = Math.max(1, Math.ceil(WINDOW_SECONDS - sinceWindow));
    if (row.uploadCount >= HOURLY_UPLOADS) {
      return refusal(retryAfter, "this account has made a lot of uploads in the past hour.");
    }
    if (row.uploadBytes + charge > HOURLY_BYTES) {
      return refusal(retryAfter, "this account has uploaded a lot in the past hour.");
    }

    await db
      .update(uploadRates)
      .set({ uploadCount: row.uploadCount + 1, uploadBytes: row.uploadBytes + charge })
      .where(eq(uploadRates.memberId, user.id));
    await recordUpload(user, charge);
    return null;
  }

  // Nobody has uploaded under this id within living memory, so the window starts
  // here. `onConflictDoNothing()` because two first uploads can race, and the
  // cost of the loser not being counted is one upload out of a hundred and twenty.
  await db
    .insert(uploadRates)
    .values({ memberId: user.id, windowStartedAt: now, uploadCount: 1, uploadBytes: charge })
    .onConflictDoNothing();
  await recordUpload(user, charge);
  return null;
}
