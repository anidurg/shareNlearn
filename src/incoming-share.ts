// src/incoming-share.ts
// Something arriving *from* another app, which is the mirror of `ShareLink.tsx`
// and the one direction the app could not previously be pointed in.
//
// The outbound half hands somebody a link to an item. This half is the device's
// own share sheet handing *us* a link: a member reading a recipe in WhatsApp taps
// Share, picks Share & Learn, and lands on a form with the address already in it.
// Nothing here is a second way of creating an item — the payload is turned into a
// prefill and handed to the very same modal the "+ Share an item" sheet opens, so
// there is one item system and one set of rules about who may post what where.
//
// How it arrives is the Web Share Target API, and it now arrives in two shapes
// rather than one, because WhatsApp offers the share sheet on a photo and not on
// a message. Accepting a file means Level 2 of that API — `method: "POST"` with
// `multipart/form-data` — and a manifest holds exactly one `share_target`, so the
// text share came along with it:
//
//   * **A POST to `/share-target`**, which is what an installed Android app now
//     does with a photo *and* with a link. The page never sees that request:
//     `public/sw.js` answers it, puts what arrived in a Cache Storage mailbox,
//     and redirects to `#/incoming`, where `pendingSharedPayload()` below reads
//     it back. A photo is bytes rather than a string, which is the whole reason
//     for the mailbox — `localStorage` holds neither a `Blob` nor a `File`.
//   * **A query string on `/`**, which is what the manifest asked for before and
//     is deliberately still read. An app installed from the old manifest goes on
//     sharing that way until Android re-mints it, and a hand-made
//     `/?text=…` link is a perfectly good way in besides.
//
// The older shape decides three things about this file, and the mailbox follows
// the same three rules for the same reasons.
//
//   * **It is read once, at startup, before React draws.** A query string is not
//     a route, and this app has never had one — every screen is a hash. So the
//     payload is lifted out of `location.search`, written down, and the query is
//     stripped with `replaceState` so a refresh does not share the same thing
//     twice.
//   * **It is written down rather than held in state**, for the reason
//     `pendingInvite()` and `pendingShare()` are: logging in leaves the page
//     entirely. An OAuth provider navigates away and the email link comes back on
//     Identity's own address, so nothing in memory and no parameter in the URL
//     survives the trip. `localStorage` does.
//   * **The three parameters are a suggestion, not a shape.** Chrome sharing a
//     page fills in `title` and `url`; WhatsApp, Telegram and most Android
//     messaging apps put everything in `text` — the address included, usually with
//     a sentence around it. So `prefillOf()` below does the untangling once, and
//     every form reads the tidied result rather than guessing at it.
//
// What this file deliberately does not do is decide anything about circles,
// categories, folders or permissions. It carries three strings. Where the share
// may go is `IncomingShareScreen`'s question, and the server's answer.

import type { FieldFile, FieldFileType, ItemPhoto, UploadKind } from "./api";

/** Where the payload waits while the member goes off and logs in. */
const PENDING_KEY = "share-and-learn:incoming-share";

/**
 * What the share sheet handed over, exactly as it arrived: the source app's own
 * three fields, before anything is made of them.
 */
export interface IncomingShare {
  title: string;
  text: string;
  url: string;
}

/**
 * The same thing tidied into what a form can actually use — which is not the same
 * three fields, because the apps people share from do not agree about which field
 * holds the address.
 *
 * `url` is the web address if there was one anywhere; `note` is whatever words
 * came with it, with that address taken out so it is not said twice; and `title`
 * is the best short name available. Each of the three may be empty, and a form
 * skips whatever it was given nothing for.
 */
export interface SharePrefill {
  title: string;
  url: string;
  note: string;
  /**
   * Pictures that came with the share, already uploaded and ready to be attached
   * — `ItemPhoto` rows rather than bytes, so a form seeded from this holds keys
   * exactly as `PhotoField` leaves it when a member picks a photo by hand.
   *
   * Optional because most shares are words, and absent rather than empty when
   * none came, so a form can tell "no photos" from "photos, and none of them".
   */
  photos?: ItemPhoto[];
  /**
   * A document, recording or clip that came with the share, already uploaded the
   * way `FileFieldInput` and `AudioFieldInput` leave one — so a form seeded from
   * this holds a key and a name rather than megabytes, exactly as it would if the
   * member had picked the file by hand.
   *
   * Optional for the same reason `photos` is, and one rather than several because
   * a share sheet hands over one file at a time.
   */
  attachment?: IncomingAttachment;
}

/**
 * An attachment that came with the share, uploaded and ready to answer a
 * category's upload field.
 *
 * It carries more than a photo has to, and for one reason: a picture fits
 * anywhere pictures are taken, while a document only answers a field that asked
 * for a document of that format and a recording only answers a field that asked
 * for audio. So `uploadKind` says which of the two controls this is an answer to,
 * and `fileType` says which of PDF, Word or Excel a document turned out to be —
 * null for a recording, which is never asked that question.
 *
 * `file` is the `{ key, name, size, url }` envelope the server answered with, so
 * the `url` on it is a real address that outlives the mailbox. That is the whole
 * difference between this and `IncomingFile` below, whose `url` is a temporary
 * transport reference and must never be stored on a share.
 */
export interface IncomingAttachment {
  file: FieldFile;
  uploadKind: UploadKind;
  /** Which document format it is, and null for a recording. */
  fileType: FieldFileType | null;
}

/**
 * One picture waiting in the mailbox: where it sits, what it is called, and the
 * bytes themselves.
 *
 * It is deliberately not an `ItemPhoto` yet. Uploading needs a session, and a
 * share can arrive from the share sheet before anybody has logged in — so the
 * bytes wait where the service worker left them, are previewed straight from a
 * `Blob`, and become an `ItemPhoto` through the same `uploadItemPhoto()` any form
 * uses, once there is somebody to upload them for.
 */
export interface IncomingImage {
  /** Its address inside the mailbox, which is also its identity while it waits. */
  url: string;
  name: string;
  type: string;
  blob: Blob;
}

/**
 * One document, voice note or clip waiting in the mailbox — the same thing
 * `IncomingImage` is, one field along, and deliberately the same shape so a
 * screen reading both arrays asks them the same questions.
 *
 * It holds a `File` rather than a `Blob` because a document is the one attachment
 * whose *name* is part of it: a photo can be called `shared-photo.jpg` and lose
 * nothing, while `Q3-accounts.pdf` is most of what the member knows about what
 * they just shared. `File` carries the name, the type and the bytes as one thing,
 * which is also what every upload path in the app already takes, so there is no
 * separate `size` here — `file.size` is the byte count, and a second copy of it
 * could only ever disagree with the bytes themselves.
 *
 * `url` is its address **inside the mailbox** and nothing more. It is not a web
 * address, it is not where the file came from on the device, and it must never be
 * stored on a share or offered as a bookmark: `/share-target/file/0` means
 * nothing to anybody but this origin's Cache Storage, and only until the next
 * share replaces it.
 */
export interface IncomingFile {
  /** Its address inside the mailbox, which is also its identity while it waits. */
  url: string;
  name: string;
  type: string;
  file: File;
}

/**
 * Everything one arrival handed over: the three strings, any pictures, and any
 * documents, voice notes or clips.
 */
export interface IncomingPayload {
  share: IncomingShare;
  images: IncomingImage[];
  files: IncomingFile[];
}

/** The first http(s) address in a blob of text, which is where most apps put it. */
const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;

/**
 * A trailing bracket or full stop belongs to the sentence rather than to the
 * address, and `example.com/page).` is not a link anybody meant. Stripped from the
 * end only, since these characters are perfectly legal inside a path.
 */
function trimUrlTail(url: string): string {
  return url.replace(/[.,;:!?)\]}'"]+$/, "");
}

/**
 * Whether a string is an http(s) address and nothing else.
 *
 * Exported because `prefillOf()` below validates once, at the moment the share
 * arrives, and the incoming-share screen immediately copies that answer into an
 * editable field — so a surface deciding whether to offer the member a Bookmark
 * has to ask the same question again of what is in the field now. There is
 * exactly one rule about what may be saved as a web address, and this is it: a
 * mailbox reference such as `/share-target/file/0`, a `content://` path and a
 * `blob:` URL all fail it, which is the point.
 */
export function isWebAddress(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * A name for something that arrived as a bare link. The host is a poor title and
 * a much better one than nothing: "example.com" at least tells the member what
 * they are looking at while they type the real one.
 */
function nameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * The first line of a shared message, which is usually what it is about.
 *
 * Capped rather than truncated mid-word: a title box seeded with 300 characters of
 * somebody's paragraph is worse than an empty one, because it has to be cleared
 * before it can be filled in. Anything longer is left to `note`, where the whole
 * of it survives.
 */
function nameFromText(text: string): string {
  const first = text.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
  return first.length > 0 && first.length <= 90 ? first : "";
}

/**
 * The three fields as they arrived, turned into the three a form wants.
 *
 * The address is looked for in `url` first, because an app that filled it in meant
 * it, and then inside `text`, because most apps do not. When it came out of the
 * text it is removed from the note as well — otherwise a bookmark carries its own
 * link twice, once in the field and once in the sentence beside it.
 *
 * The title is the source app's own if it sent one, then the first line of the
 * message, then the host of the address. A `title` that is merely the address
 * repeated — which Chrome does on some pages — is not a name, so it is dropped.
 */
export function prefillOf(share: IncomingShare): SharePrefill {
  const text = share.text.trim();
  const declared = share.url.trim();

  const found = declared !== "" && isWebAddress(declared)
    ? declared
    : trimUrlTail(text.match(URL_PATTERN)?.[0] ?? "");
  const url = isWebAddress(found) ? found : "";

  // Only strip the address from the note when that is where it came from; a
  // sentence that never held it has nothing to take out.
  const note = url !== "" && text.includes(url)
    ? text.replace(url, "").replace(/\s{2,}/g, " ").trim()
    : text;

  const declaredTitle = share.title.trim();
  const title =
    (declaredTitle !== "" && declaredTitle !== url ? declaredTitle : "") ||
    nameFromText(note) ||
    nameFromUrl(url);

  return { title, url, note };
}

/** Whether anything at all came through, so a screen knows which face to show. */
export function hasContent(share: IncomingShare): boolean {
  return share.title.trim() !== "" || share.text.trim() !== "" || share.url.trim() !== "";
}

/**
 * Lifts a share out of the query string, writes it down, and cleans the address
 * bar — the whole of the arrival, done once before React renders.
 *
 * The query is stripped rather than left in place for two reasons: a refresh would
 * otherwise re-share whatever was last shared, and the app's screens are hashes,
 * so a stray `?text=` hanging off every subsequent navigation is noise in every
 * link a member might copy. `replaceState` rather than a navigation, so the back
 * button does not lead to a URL that shares something again.
 *
 * Answers whether one was found, which is what tells `App` to open the screen.
 * Nothing else in this app uses query parameters at all, so their presence *is*
 * the signal — there is no marker parameter to get out of step with the manifest.
 */
export function captureIncomingShare(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    const share: IncomingShare = {
      title: params.get("title") ?? "",
      text: params.get("text") ?? "",
      url: params.get("url") ?? "",
    };
    // A share sheet that sent nothing at all still opened the app on purpose, so
    // the screen is still worth showing — but only when the parameters were there
    // to be empty, rather than on an ordinary visit with no query at all.
    const arrived = ["title", "text", "url"].some((key) => params.has(key));
    if (!arrived) return false;

    rememberIncomingShare(share);
    const { pathname, hash } = window.location;
    window.history.replaceState(null, "", `${pathname}${hash}`);
    return true;
  } catch {
    // A blocked `localStorage` or an exotic URL: the app still opens, without the
    // share. Losing it is a disappointment rather than a fault.
    return false;
  }
}

export function rememberIncomingShare(share: IncomingShare) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(share));
  } catch {
    // Private browsing with storage blocked. The share survives while the tab is
    // open, because the screen holds it in state as well.
  }
}

/** Whatever is waiting, or null. Read on the way back from logging in. */
export function pendingIncomingShare(): IncomingShare | null {
  try {
    const stored = localStorage.getItem(PENDING_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== "object" || parsed === null) return null;
    const row = parsed as Partial<IncomingShare>;
    return {
      title: typeof row.title === "string" ? row.title : "",
      text: typeof row.text === "string" ? row.text : "",
      url: typeof row.url === "string" ? row.url : "",
    };
  } catch {
    return null;
  }
}

export function forgetIncomingShare() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // Nothing to clean up.
  }
  // The strings and the bytes are two stores, and a share is finished with or
  // dismissed as one thing, so the mailbox goes at the same moment. Nothing
  // waits for it: a mailbox that outlives its share costs a few hundred
  // kilobytes until the next one replaces it.
  void forgetSharedPayload();
}

/*
 * Where `public/sw.js` leaves a share that arrived as a POST. Both names are the
 * service worker's and have to be changed with it.
 */
const SHARE_CACHE = "share-and-learn-incoming";
const SHARE_PAYLOAD_URL = "/share-target/payload.json";

/**
 * Whatever the service worker put in the mailbox, or null.
 *
 * It **reads rather than takes**, which is the same decision `pendingIncomingShare()`
 * made and matters more here: a member who shares a photo and is then asked to log
 * in leaves the page entirely, and a mailbox emptied on the way out would hand
 * them an empty screen on the way back. It is cleared by `forgetIncomingShare()`
 * instead — when the share has been saved, or when they say Not now.
 *
 * `caches.match` with a `cacheName` is used rather than `caches.open`, because
 * opening a cache creates it: every ordinary page load would otherwise leave an
 * empty mailbox behind. Nothing here throws — no Cache Storage, a private window,
 * a payload that will not parse: the answer is null and the screen opens with its
 * fields empty, which is the same face it wears on iOS, where inbound share
 * targets do not exist at all.
 */
export async function pendingSharedPayload(): Promise<IncomingPayload | null> {
  try {
    if (typeof caches === "undefined") return null;
    const stored = await caches.match(SHARE_PAYLOAD_URL, { cacheName: SHARE_CACHE });
    if (!stored) return null;
    const parsed: unknown = await stored.json();
    if (typeof parsed !== "object" || parsed === null) return null;
    const row = parsed as {
      title?: unknown;
      text?: unknown;
      url?: unknown;
      images?: unknown;
      files?: unknown;
    };
    const share: IncomingShare = {
      title: typeof row.title === "string" ? row.title : "",
      text: typeof row.text === "string" ? row.text : "",
      url: typeof row.url === "string" ? row.url : "",
    };

    const images: IncomingImage[] = [];
    for (const entry of Array.isArray(row.images) ? row.images : []) {
      if (typeof entry !== "object" || entry === null) continue;
      const image = entry as { url?: unknown; name?: unknown; type?: unknown };
      if (typeof image.url !== "string") continue;
      const bytes = await caches.match(image.url, { cacheName: SHARE_CACHE });
      if (!bytes) continue;
      const blob = await bytes.blob();
      if (blob.size === 0) continue;
      images.push({
        url: image.url,
        name: typeof image.name === "string" ? image.name : "shared-photo.jpg",
        type: typeof image.type === "string" ? image.type : blob.type,
        blob,
      });
    }

    return { share, images, files: await mailboxFiles(row.files) };
  } catch {
    return null;
  }
}

/**
 * The `files[]` rows of a payload, with the bytes fetched back and rebuilt into
 * `File`s.
 *
 * Its own function, and its own `try` per row, for one reason worth keeping: a
 * part whose bytes have gone — a mailbox half-swept, a quota eviction between the
 * share arriving and the app opening — costs the member that one attachment and
 * not the whole share. Falling through to `pendingSharedPayload()`'s own `catch`
 * would answer null and lose the words and the pictures along with it.
 *
 * Nothing is deleted here. The mailbox is read rather than taken, exactly as the
 * pictures are, because the member may still be on their way back from logging
 * in; `forgetIncomingShare()` is what empties it, once the share is saved or
 * dismissed.
 */
async function mailboxFiles(rows: unknown): Promise<IncomingFile[]> {
  const files: IncomingFile[] = [];
  for (const entry of Array.isArray(rows) ? rows : []) {
    try {
      if (typeof entry !== "object" || entry === null) continue;
      const row = entry as { url?: unknown; name?: unknown; type?: unknown };
      if (typeof row.url !== "string") continue;
      const bytes = await caches.match(row.url, { cacheName: SHARE_CACHE });
      if (!bytes) continue;
      const blob = await bytes.blob();
      if (blob.size === 0) continue;
      // The service worker wrote both down; the blob answers for either if it did
      // not, which is the same fallback the pictures take.
      const name = typeof row.name === "string" && row.name !== "" ? row.name : "shared-file";
      const type = typeof row.type === "string" && row.type !== "" ? row.type : blob.type;
      files.push({ url: row.url, name, type, file: new File([blob], name, { type }) });
    } catch {
      // One unreadable part is one attachment missing, not a lost share.
      continue;
    }
  }
  return files;
}

/** Empties the mailbox, cache and all. The next share re-creates it. */
export async function forgetSharedPayload() {
  try {
    if (typeof caches === "undefined") return;
    await caches.delete(SHARE_CACHE);
  } catch {
    // Nothing to clean up.
  }
}

/**
 * The note and the address as one piece of text, for a form whose only free field
 * is a paragraph.
 *
 * A recipe has somewhere to put the method and nowhere to put a link; a remedy is
 * the same, and so is a post in a category a circle invented. Dropping the address
 * would be the one thing the member most wanted kept, so it goes into the same box
 * with a blank line above it, which is what anybody pasting both by hand would do.
 * A blank half contributes nothing, so nothing arrives with a stray gap in it.
 */
export function prefillText(prefill: SharePrefill | undefined): string {
  if (!prefill) return "";
  return [prefill.note, prefill.url].filter((part) => part !== "").join("\n\n");
}
