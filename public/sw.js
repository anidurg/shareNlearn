/*
 * public/sw.js — the bit that makes Share & Learn behave like an installed app:
 * the shell opens instantly and still opens with no connection.
 *
 * Rules, in order of importance:
 *  1. Never touch anything under /api/ or /.netlify/ — those answers depend on
 *     who is logged in, and audio replies to byte-range requests. Always network.
 *  2. Navigations go to the network first and fall back to the cached shell, so a
 *     new deploy is picked up on the next visit rather than being pinned forever.
 *  3. Hashed build assets are immutable, so they are served from the cache first.
 */
/*
 * Bumped whenever something cached by name rather than by a hashed filename
 * changes, since an installed app would otherwise keep serving its own copy: the
 * blue retheme moved the icons, the favicon and the font, v3 moved the manifest,
 * whose `start_url` is `#/circles` now that Circles is the landing page and Home
 * is gone, and v4 moves it again — it now declares `share_target`, which is what
 * puts Share & Learn in the device's own share sheet. An installed app reads that
 * member from the manifest it has cached, so a copy from v3 would go on being
 * absent from the share sheet however many times the app was opened.
 *
 * v5 moves it a third time, and for a reason worth knowing before touching it:
 * WhatsApp offers the share sheet on a photo and not on a message, so a
 * `share_target` that only accepted text was never going to appear where members
 * were actually sharing from. Accepting a file means Web Share Target Level 2,
 * which is `method: "POST"` with `multipart/form-data` — and a manifest may hold
 * exactly one `share_target`, so the text share moved to the POST as well.
 *
 * v6 widens what that one `share_target` will accept rather than moving it again:
 * a second file param beside `image`, taking a PDF, a voice note and an mp4.
 * WhatsApp types those shares `application/pdf`, `audio/ogg` and `video/mp4`, and
 * an app whose manifest does not name a type is filtered out of the share sheet
 * before a member ever sees it — so declaring them is the whole of what puts
 * Share & Learn where the content actually is. Nothing reads the new field yet:
 * `receiveShare()` still lifts `image` alone, so one of these arrives as a member
 * on the incoming screen with the words and no attachment, which is deliberate
 * until the upload side is built.
 */
const VERSION = "v6";
const SHELL_CACHE = `share-and-learn-shell-${VERSION}`;
const ASSET_CACHE = `share-and-learn-assets-${VERSION}`;
const FONT_CACHE = `share-and-learn-fonts-${VERSION}`;
/*
 * Where a share that arrived by POST waits while the app starts up — a mailbox
 * rather than a cache, which is why it is deliberately *not* versioned and is
 * listed below so `activate` does not sweep it away: a member who shares a photo
 * and is then asked to log in would otherwise come back to an empty screen.
 * `src/incoming-share.ts` reads these four names and must be changed with them.
 */
const SHARE_CACHE = "share-and-learn-incoming";
const SHARE_PAYLOAD_URL = "/share-target/payload.json";
const SHARE_IMAGE_URL = "/share-target/image/";
/** How many pictures one share may hand over: `MAX_PHOTOS_PER_ITEM` in the app. */
const SHARE_IMAGE_LIMIT = 10;
/*
 * Where a document, a voice note or a clip waits — the same mailbox one street
 * along, because a PDF arriving from WhatsApp is the same handoff a photo is and
 * splitting it into a second store would mean two things to sweep and two things
 * for the incoming screen to read. The cap is a guard on this cache rather than
 * the app's own ceiling: `ACTION_SEND_MULTIPLE` can name as many files as the
 * sender likes, and the mailbox is not a place to stream an afternoon into. What
 * a member may actually attach is the upload side's answer, and it is not
 * written yet.
 */
const SHARE_FILE_URL = "/share-target/file/";
const SHARE_FILE_LIMIT = 10;
/** Where the member lands afterwards, which is the screen that was already there. */
const SHARE_LANDING = "/#/incoming";
const CURRENT_CACHES = [SHELL_CACHE, ASSET_CACHE, FONT_CACHE, SHARE_CACHE];

const SHELL_URLS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // One missing file should not fail the whole install, so each is fetched on its own.
      .then((cache) =>
        Promise.all(
          SHELL_URLS.map(async (url) => {
            try {
              const response = await fetch(url, { cache: "reload" });
              if (response.ok) await cache.put(url, response);
            } catch {
              // Offline during install, or the file moved — the runtime cache will cope.
            }
          }),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !CURRENT_CACHES.includes(key)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

function isFontRequest(url) {
  return url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
}

function isImmutableAsset(url) {
  return (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/favicon.svg" ||
    url.pathname === "/manifest.webmanifest"
  );
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") cache.put(request, response.clone());
  return response;
}

async function shellFirstFromNetwork(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put("/", response.clone());
    return response;
  } catch (error) {
    const cached = (await cache.match(request)) ?? (await cache.match("/"));
    if (cached) return cached;
    throw error;
  }
}

/** A form field as a string, since `FormData.get` may answer a `File`. */
function fieldText(form, name) {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * The `File` parts sent under one field name: the strings dropped, since a text
 * field and a file field can share a name, the empty ones dropped with them, and
 * the rest capped. One function for both fields, the question being identical.
 */
function filePartsIn(form, name, limit) {
  return form
    .getAll(name)
    .filter((entry) => typeof entry !== "string" && entry && entry.size > 0)
    .slice(0, limit);
}

/**
 * The share itself: read the multipart body, put it in the mailbox, and send the
 * member to the screen that already knows what to do with it.
 *
 * A POST share target cannot be answered anywhere but here — the page never sees
 * the request, and a Netlify function could not identify the member if it did,
 * the auth cookies being `samesite=lax` and a share sheet's POST cross-site. So
 * this is the whole of the handoff, and it is deliberately tiny: it stores what
 * arrived and decides nothing. Which circle, which folder and which content type
 * are `IncomingShareScreen`'s questions, and the photo is uploaded by the same
 * `uploadItemPhoto()` any other form uses, once there is a session to upload it
 * with. A document, a voice note or a clip is parked the same way and has no
 * uploader yet — `/api/files` takes one request and a share can be larger than
 * one request carries — so for now those arrive and wait.
 *
 * The redirect is a **303**, which turns the POST into a following GET: a refresh
 * of the screen afterwards cannot re-submit the share. It needs an absolute URL,
 * which is the one thing `Response.redirect` is strict about.
 *
 * Nothing here throws. A body that cannot be read still lands the member on the
 * incoming screen, where the fields are editable and they can paste what they
 * meant to share — which is the same face the screen shows on iOS, where inbound
 * share targets do not exist at all.
 */
async function receiveShare(request) {
  const landing = new URL(SHARE_LANDING, self.location.origin).href;
  try {
    const form = await request.formData();
    const cache = await caches.open(SHARE_CACHE);

    // Anything left from a share nobody finished, so two arrivals cannot be
    // read as one.
    await clearShareMailbox(cache);

    const images = [];
    for (const [index, file] of filePartsIn(form, "image", SHARE_IMAGE_LIMIT).entries()) {
      const type = file.type || "image/jpeg";
      const url = `${SHARE_IMAGE_URL}${index}`;
      await cache.put(
        url,
        new Response(file, { headers: { "Content-Type": type } }),
      );
      images.push({ url, name: file.name || `shared-photo-${index + 1}.jpg`, type });
    }

    /*
     * A document, a voice note or a clip, parked exactly as a photo is. The size
     * is written down rather than left to be measured off the blob, which is the
     * one thing these rows carry that an image row does not: a video is the first
     * share that can be too big to upload at all, and the screen deciding that
     * should not have to fetch the bytes back in order to find out.
     */
    const files = [];
    for (const [index, file] of filePartsIn(form, "file", SHARE_FILE_LIMIT).entries()) {
      const type = file.type || "application/octet-stream";
      const url = `${SHARE_FILE_URL}${index}`;
      await cache.put(
        url,
        new Response(file, { headers: { "Content-Type": type } }),
      );
      files.push({ url, name: file.name || `shared-file-${index + 1}`, type, size: file.size });
    }

    const payload = {
      title: fieldText(form, "title"),
      text: fieldText(form, "text"),
      url: fieldText(form, "url"),
      images,
      files,
    };
    await cache.put(
      SHARE_PAYLOAD_URL,
      new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json" },
      }),
    );
  } catch {
    // The screen opens with empty hands rather than not at all.
  }
  return Response.redirect(landing, 303);
}

async function clearShareMailbox(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.map((key) => cache.delete(key)));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // The one thing this app answers with something other than a cached file, and
  // the only request that is not a GET it ever sees.
  if (request.method === "POST") {
    const target = new URL(request.url);
    if (target.origin === self.location.origin && target.pathname === "/share-target") {
      event.respondWith(receiveShare(request));
    }
    return;
  }

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/.netlify/")) return;
    if (request.mode === "navigate") {
      event.respondWith(shellFirstFromNetwork(request));
      return;
    }
    if (isImmutableAsset(url)) {
      event.respondWith(cacheFirst(request, ASSET_CACHE));
    }
    return;
  }

  if (isFontRequest(url)) {
    event.respondWith(cacheFirst(request, FONT_CACHE).catch(() => fetch(request)));
  }
});
