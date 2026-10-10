// src/components/IncomingShareScreen.tsx
// Where a share from another app lands: the screen the device's own share sheet
// sends a member to, and the only new screen this feature needed.
//
// It is deliberately thin. Nothing here creates an item, decides who may post
// what, or knows which content types exist — all of that already works, on the
// "+ Share an item" sheet a circle page and a folder page draw, so this screen
// draws the same `ShareItemButton` and lets it answer. What it adds is the three
// questions a share sheet cannot answer for itself:
//
//   * **What arrived**, shown as editable fields rather than as a summary. That
//     is not only a courtesy: on iOS, and in any browser without an installed
//     PWA, the Web Share Target API does not exist at all, so these same fields
//     are how a member pastes a link by hand. One screen serves both, which is
//     why nothing on it is read-only.
//   * **Which circle**, over `store.circles` — the member's own and nothing
//     else, so circle membership is respected by construction rather than by a
//     check that could be forgotten. The answer is derived with a fallback
//     rather than written back, the same trick `useCurrentCircle` uses, so the
//     circle they were last in is the default and the first render already has
//     one.
//   * **Which folder**, optionally. `folderOptions()` over `visibleFolders()`,
//     exactly as `MoveToFolderModal` asks it, with the top of the circle as a
//     real answer rather than a placeholder.
//   * **Whether a picture came with it**, which is the half of a share the
//     fields above cannot hold. A photo arrives as bytes in the service worker's
//     mailbox, is previewed straight from the `Blob`, and is uploaded through the
//     very same `uploadItemPhoto()` that `PhotoField` calls when a member picks
//     one by hand — so what the form is seeded with is an `ItemPhoto` exactly
//     like any other, and nothing about how photos are stored is duplicated here.
//   * **Whether a document, a recording or a clip came with it** — a PDF sent
//     from WhatsApp, a voice note, a video. It arrives the same way a photo
//     does, as bytes in the mailbox, and is checked and uploaded through the
//     very controls a category's own upload field already uses: a document
//     against `MAX_FIELD_FILE_BYTES` through `uploadFieldFile()`, a recording
//     against `MAX_UPLOAD_BYTES` through `uploadFieldAudio()`. What the form is
//     seeded with is therefore the same `{ key, name, size, url }` envelope a
//     picked file leaves behind, and no second size rule is written down here.
//     A file nothing takes — a video, for now — is said so in a sentence rather
//     than dropped: the mailbox is left exactly as it was, so the words, the
//     link and the picture that came with the same share are still shareable and
//     the file itself is still there if the member comes back to the screen.
//   * **Somewhere to go when the file cannot be kept**, which is the one thing a
//     refusal on its own does not give anybody. A file that is too large, a
//     video, or a kind no upload field asks for usually arrived with the address
//     it came from, and that address is a bookmark — so the screen offers the
//     Bookmarks content type it already draws rather than a dead end. It is
//     offered rather than assumed: the link has to pass the app's own
//     `isWebAddress()`, the circle has to have Bookmarks on offer, and where
//     there is no web address at all the screen says what would make one rather
//     than inventing it. The mailbox's own `/share-target/file/0` is a transport
//     reference and can never be it.
//
// The content types on offer come from that circle's own categories, which is
// the rule "only show content types enabled for the selected Circle" — kept in
// one place, because `ShareItemButton` is where it already lived. When a picture
// came with the share, that list is narrowed once more, by `takesPhotos()`: a
// word and a bookmark have no pictures anywhere in the app, so offering them
// would be offering to throw the photo away without saying so.
import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@netlify/identity";
import {
  MAX_FIELD_FILE_BYTES,
  MAX_PHOTOS_PER_ITEM,
  MAX_UPLOAD_BYTES,
  fieldFileTypeOf,
  formatBytes,
  isAudioFileName,
  uploadFieldAudio,
  uploadFieldVideo,
  MAX_VIDEO_BYTES,
  uploadFieldFile,
  uploadItemPhoto,
  type FieldFileType,
  type ItemPhoto,
  type UploadKind,
} from "../api";
import { categoryFor, takesPhotos, type ShareFlow } from "../categories";
import { folderOptions, folderTrail, visibleFolders, type ShareTarget } from "../folders";
import {
  hasContent,
  isWebAddress,
  prefillOf,
  type IncomingAttachment,
  type IncomingFile,
  type IncomingImage,
  type IncomingShare,
  type SharePrefill,
} from "../incoming-share";
import type { ShareAndLearn } from "../store";
import { pathText } from "../tree";
import { categoryTakesAttachment } from "./CategoryFields";
import { ShareItemButton } from "./CircleFolders";
import { EmptyState } from "./shared";

/**
 * Which of the app's two upload controls an incoming file is an answer to, the
 * ceiling that control keeps — or the sentence to show instead, when nothing in
 * Share & Learn takes a file of that kind at all.
 *
 * Both ceilings are read from `src/api.ts` rather than written down again here,
 * because they are the numbers `FileFieldInput` and `AudioFieldInput` refuse
 * against and the numbers the server refuses against: a document stops at
 * `MAX_FIELD_FILE_BYTES` and a recording at `MAX_UPLOAD_BYTES`.
 *
 * The order of the tests is load-bearing. `AUDIO_TYPES` in `src/api.ts` counts
 * `.mp4`, `.webm` and `.3gp` as audio, those containers usually holding a
 * recording when a field asked for one — so a video tested *after* audio would
 * be quietly uploaded as a recording, which is neither what the member shared
 * nor something the app supports. The video test therefore comes first of the
 * two, and answers a refusal rather than a kind.
 */
function attachmentPlan(
  file: File,
):
  | { uploadKind: UploadKind; fileType: FieldFileType | null; ceiling: number }
  | { refusal: string } {
  const fileType = fieldFileTypeOf(file);
  if (fileType) return { uploadKind: "document", fileType, ceiling: MAX_FIELD_FILE_BYTES };
  if (file.type.startsWith("video/")) {
    if (file.type !== "video/mp4" || !file.name.toLowerCase().endsWith(".mp4")) {
      return { refusal: "Only MP4 videos are supported at present." };
    }
    return { uploadKind: "video", fileType: null, ceiling: MAX_VIDEO_BYTES };
  }
  if (file.type.startsWith("audio/") || isAudioFileName(file.name)) {
    return { uploadKind: "audio", fileType: null, ceiling: MAX_UPLOAD_BYTES };
  }
  return {
    refusal: `${file.name} is not a kind of file Share & Learn takes — a PDF, a Word or Excel document, or a recording.`,
  };
}

/** The name of one folder, indented by how deep it sits, for a flat `<select>`. */
function optionLabel(path: string[], depth: number) {
  const name = path[path.length - 1] ?? "";
  return `${"  ".repeat(Math.max(0, depth - 1))}${name}`;
}

export function IncomingShareScreen({
  share,
  images,
  files,
  store,
  user,
  ready,
  currentCircleId,
  onShare,
  onSaved,
  onCreateAccount,
  onLogIn,
  onDismiss,
}: {
  /** The three strings the share sheet handed over. */
  share: IncomingShare;
  /**
   * Pictures that came with it, still as bytes. Empty for a share of words, and
   * for every share on iOS, where inbound share targets do not exist.
   */
  images: IncomingImage[];
  /**
   * A document, a recording or a clip that came with it, still as bytes. One at
   * a time is all a share sheet hands over, but it arrives as a list because
   * that is the shape the mailbox stores.
   */
  files: IncomingFile[];
  store: ShareAndLearn;
  user: User | null;
  /** Whether Identity has answered yet, so no door is offered before it has. */
  ready: boolean;
  /** The circle the member was last in, which is the default answer here. */
  currentCircleId: number | null;
  /**
   * A built-in content type was picked: the shell opens that form, seeded with
   * whatever the member has left in the fields above.
   */
  onShare: (
    flow: ShareFlow,
    circleId: number,
    folder: ShareTarget,
    prefill: SharePrefill,
  ) => void;
  /**
   * A custom category's post was saved, which finishes the flow from here. It
   * names the circle the post went into, because the shell learns that from
   * `onShare` for every other content type and this is the one form the sheet
   * opens itself — so without it there would be nowhere to send the member
   * afterwards.
   */
  onSaved: (circleId: number) => void;
  onCreateAccount: () => void;
  onLogIn: () => void;
  /** Nothing is going to be shared after all, so the payload is dropped. */
  onDismiss: () => void;
}) {
  const arrived = hasContent(share) || images.length > 0 || files.length > 0;
  const suggested = prefillOf(share);
  const [title, setTitle] = useState(suggested.title);
  const [url, setUrl] = useState(suggested.url);
  const [note, setNote] = useState(suggested.note);

  const circles = store.circles;
  const [chosen, setChosen] = useState<number | null>(null);
  // Derived rather than written back, so the first render already has an answer
  // and a circle joined a moment ago is not overwritten by a stale pick.
  const circleId = chosen ?? currentCircleId ?? circles[0]?.id ?? null;
  const circle = circles.find((row) => row.id === circleId) ?? null;

  const [folderId, setFolderId] = useState<number | null>(null);
  // A folder belongs to one circle, so an answer cannot outlive a change of
  // circle: it would name somewhere the new circle has never heard of.
  useEffect(() => setFolderId(null), [circleId]);

  // The circle's own categories and folders, which a share sheet's arrival has
  // given the store no reason to have read yet.
  useEffect(() => {
    if (!user || circleId === null) return;
    store.loadCircleCategories(circleId).catch(() => {});
    store.loadCircleFolders(circleId).catch(() => {});
  }, [user, circleId, store.loadCircleCategories, store.loadCircleFolders]);

  const categories =
    (circleId !== null ? store.circleCategories[circleId] : undefined) ??
    (circleId !== null ? store.categoriesByCircle.get(circleId) : undefined) ??
    [];
  const folders = circleId !== null ? visibleFolders(store.circleFolders[circleId] ?? []) : [];
  const target: ShareTarget = { id: folderId, path: folderTrail(folders, folderId) };

  /*
   * The pictures, shown before anything is decided about them. `createObjectURL`
   * rather than a data URL, so a 4 MB photo is not turned into six megabytes of
   * string, and revoked when the list changes or the screen goes — a blob URL is
   * a reference the page holds until it is let go of.
   *
   * Made in an effect and held in state rather than derived by a `useMemo`, which
   * is the shape a blob URL has to have: Strict Mode renders twice and then
   * unmounts and remounts, so a memo would mint a set nobody revokes and the
   * cleanup would revoke the very set left on screen. Minting and revoking in the
   * same effect keeps every URL paired with the render that is using it.
   */
  const [previews, setPreviews] = useState<
    { key: string; src: string; name: string }[]
  >([]);
  useEffect(() => {
    const made = images.map((image, index) => ({
      key: `${image.url}-${index}`,
      src: URL.createObjectURL(image.blob),
      name: image.name,
    }));
    setPreviews(made);
    return () => made.forEach((preview) => URL.revokeObjectURL(preview.src));
  }, [images]);

  /*
   * Uploading them, which waits for a session: a share sheet reaches whoever the
   * device handed it to, and that may be somebody who has not logged in yet. The
   * bytes sit in the mailbox until they have, and then go up through the same
   * call `PhotoField` makes — one request per picture, each shrunk in a canvas
   * first, because that is what the 6 MB request ceiling allows.
   *
   * The ref rather than the busy flag is what stops it happening twice: a guard
   * reading state it also sets would re-run the effect on its own first render.
   */
  const [photos, setPhotos] = useState<ItemPhoto[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const uploadStarted = useRef(false);
  useEffect(() => {
    if (!user || images.length === 0 || uploadStarted.current) return;
    uploadStarted.current = true;
    setUploading(true);
    void (async () => {
      const kept: ItemPhoto[] = [];
      try {
        for (const image of images.slice(0, MAX_PHOTOS_PER_ITEM)) {
          kept.push(await uploadItemPhoto(image.blob));
        }
      } catch (error) {
        setPhotoError(
          error instanceof Error ? error.message : "That photo could not be kept.",
        );
      } finally {
        // Whatever did arrive is still worth attaching, exactly as `PhotoField`
        // keeps the pictures that made it when the fourth one fails.
        setPhotos(kept.length > 0 ? kept : null);
        setUploading(false);
      }
    })();
  }, [user, images]);

  /*
   * The document, recording or clip, and what the app is willing to do with it.
   * One rather than several, because a share sheet hands over one file at a time.
   *
   * The plan is memoized so that it can be a dependency of the effect below
   * rather than a fresh object on every keystroke in the Title field.
   */
  const incoming = files[0] ?? null;
  const plan = useMemo(() => (incoming ? attachmentPlan(incoming.file) : null), [incoming]);
  /*
   * Why this file is not going anywhere, if it is not — read before a byte is
   * uploaded, and against the app's own configured ceilings rather than a second
   * number invented here.
   *
   * A refusal is a sentence on screen and nothing else. The mailbox is
   * deliberately left alone, so the words, the link and any picture that came
   * with the same share are still there to be shared, and the file itself is
   * still here if the member comes back to this screen.
   */
  const refusal =
    plan === null || incoming === null
      ? null
      : "refusal" in plan
        ? plan.refusal
        : incoming.file.size > plan.ceiling
          ? `This file is ${formatBytes(incoming.file.size)}. It is too large to upload to Share & Learn — the current upload limit is ${formatBytes(plan.ceiling)}.`
          : null;

  /*
   * Uploading it, which waits for a session exactly as the pictures do, and goes
   * through the very calls a category's own upload field makes — so what the
   * form is seeded with is a key and a name rather than megabytes, and nothing
   * about how an attachment is stored is duplicated here.
   *
   * The ref rather than the busy flag is what stops it happening twice, for the
   * same reason it is the photos' guard: an effect reading state it also sets
   * would re-run on its own first render.
   */
  const [attachment, setAttachment] = useState<IncomingAttachment | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const attachStarted = useRef(false);
  useEffect(() => {
    if (!user || !incoming || !plan || "refusal" in plan || refusal) return;
    if (attachStarted.current) return;
    attachStarted.current = true;
    setAttaching(true);
    void (async () => {
      try {
        const kept =
          plan.uploadKind === "audio"
            ? await uploadFieldAudio(incoming.file, { name: incoming.file.name })
            : plan.uploadKind === "video"
              ? await uploadFieldVideo(incoming.file)
              : await uploadFieldFile(incoming.file, {
                types: plan.fileType ? [plan.fileType] : undefined,
              });
        setAttachment({ file: kept, uploadKind: plan.uploadKind, fileType: plan.fileType });
      } catch (error) {
        setAttachError(
          error instanceof Error ? error.message : "That file could not be kept.",
        );
      } finally {
        setAttaching(false);
      }
    })();
  }, [user, incoming, plan, refusal]);

  const prefill: SharePrefill = {
    title: title.trim(),
    url: url.trim(),
    note: note.trim(),
    ...(photos ? { photos } : {}),
    ...(attachment ? { attachment } : {}),
  };

  /*
   * What the sheet offers. A picture came with the share, so the kinds of thing
   * that hold no pictures are not on the list — the photo is the reason the app
   * was opened, and a content type that would silently drop it is not an answer.
   */
  const offered = images.length > 0
    ? categories.filter((category) => takesPhotos(category.itemType))
    : categories;

  /*
   * Where the file came from, if the share said — the one thing that can be
   * saved when the file itself cannot be.
   *
   * It is read from the field rather than from `prefillOf()`'s answer because
   * the field is editable: a member who pastes the address by hand should get
   * the same offer as one whose app sent it. And it is put through the app's own
   * `isWebAddress()` on every render rather than trusted, which is what keeps a
   * mailbox reference, a `content://` path or a `blob:` URL out of a bookmark —
   * none of them is an http(s) address, so none of them can ever be this value.
   */
  const sourceUrl = isWebAddress(url.trim()) ? url.trim() : null;
  /*
   * Bookmarks is a content type a circle switches on like any other, and it is
   * off by default — so the offer is made against the same list the share sheet
   * draws from rather than against the flow existing. Where a picture came with
   * the share that list has already dropped the kinds that hold no pictures,
   * which is existing behaviour and includes this one: a bookmark would throw
   * the photo away.
   */
  const bookmarkable = categoryFor(offered, "bookmark") !== null;

  return (
    <section className="incoming-screen">
      <p className="join-eyebrow">Shared with Share &amp; Learn</p>
      <h1 className="join-title">Keep this in a circle</h1>
      <p className="join-copy">
        {arrived
          ? "This came from the app you shared it from. Tidy it up if you like, choose where it belongs, then pick what kind of thing it is."
          : "Nothing came through with the share, which some apps do. Paste the link or the words here instead, choose where it belongs, then pick what kind of thing it is."}
      </p>

      <label className="field">
        <span className="field-label">Title</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What is it?"
        />
      </label>

      <label className="field">
        <span className="field-label">Link</span>
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://"
          inputMode="url"
        />
      </label>

      <label className="field">
        <span className="field-label">Anything else</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={4}
          placeholder="Whatever came with it, or a note of your own."
        />
      </label>

      {previews.length > 0 && (
        <div className="field">
          <span className="field-label">
            {previews.length === 1 ? "The photo" : `${previews.length} photos`}
          </span>
          <ul className="photo-drafts">
            {previews.map((preview, index) => (
              <li key={preview.key}>
                <img src={preview.src} alt={preview.name || `Shared photo ${index + 1}`} />
              </li>
            ))}
          </ul>
          {uploading && <p className="field-hint">Keeping the photo…</p>}
          {photoError && <p className="form-error">{photoError}</p>}
          {!uploading && !photoError && ready && user && (
            <p className="field-hint">
              It goes on whatever you share below, and the form can take it back off
              again.
            </p>
          )}
        </div>
      )}

      {incoming && (
        <div className="field file-field">
          <span className="field-label">
            {plan && "uploadKind" in plan && plan.uploadKind === "audio"
              ? "The recording"
              : "The file"}
          </span>
          {/* The name it arrived under, which is the one the member recognises —
              the mailbox's own `/share-target/file/0` is a transport reference
              and is never shown, stored or offered as a link. */}
          <p className="file-chosen">
            <span className="muted">
              {incoming.name || incoming.file.name} · {formatBytes(incoming.file.size)}
            </span>
          </p>
          {refusal && <p className="form-error">{refusal}</p>}
          {attaching && <p className="field-hint">Keeping the file…</p>}
          {attachError && <p className="form-error">{attachError}</p>}
          {!refusal && !attaching && !attachError && ready && user && (
            <p className="field-hint">
              It answers whatever the form below asks for a file, and the form can take it
              back off again.
            </p>
          )}
        </div>
      )}

      {!ready && <p className="muted">One moment…</p>}

      {ready && !user && (
        <>
          <p className="join-copy">
            Log in and this will still be here — it is kept on this device until you have somewhere
            to put it.
          </p>
          <div className="join-actions">
            <button className="btn btn-primary" onClick={onCreateAccount}>
              Create your account
            </button>
            <button className="btn-text" onClick={onLogIn}>
              I already have one — log in
            </button>
          </div>
        </>
      )}

      {ready && user && circles.length === 0 && (
        <EmptyState glyph="◎" title="You are not in a circle yet">
          A share goes into a circle, so find one first — this will still be waiting.
        </EmptyState>
      )}

      {ready && user && circle && (
        <>
          <label className="field">
            <span className="field-label">Which circle?</span>
            <select
              value={String(circle.id)}
              onChange={(event) => setChosen(Number(event.target.value))}
            >
              {circles.map((row) => (
                <option key={row.id} value={String(row.id)}>
                  {row.icon} {row.name}
                </option>
              ))}
            </select>
          </label>

          {folders.length > 0 && (
            <label className="field">
              <span className="field-label">Whereabouts in it?</span>
              <select
                value={folderId === null ? "" : String(folderId)}
                onChange={(event) =>
                  setFolderId(event.target.value === "" ? null : Number(event.target.value))
                }
              >
                <option value="">Top of the circle</option>
                {folderOptions(folders).map((option) => (
                  <option
                    key={option.id ?? "top"}
                    value={option.id === null ? "" : String(option.id)}
                  >
                    {optionLabel(option.path, option.depth)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Nothing here uploads, retries or forgets anything: the refusal above
              still stands, the file is still in the mailbox, and this is one more
              way out of the screen beside "+ Share an item" and "Not now". The
              Bookmark it opens is the shell's own `BookmarkModal`, reached by the
              same `onShare` a content type picked off the sheet goes through. */}
          {refusal && (
            <div className="field file-field">
              {sourceUrl ? (
                <>
                  <p className="field-hint">
                    This file cannot be uploaded to Share &amp; Learn. You can still save
                    and share the original source as a Bookmark.
                  </p>
                  {bookmarkable ? (
                    <button
                      className="btn btn-ghost"
                      onClick={() =>
                        onShare("bookmark", circle.id, target, { ...prefill, url: sourceUrl })
                      }
                    >
                      Add as Bookmark
                    </button>
                  ) : (
                    <p className="join-footnote">
                      {circle.name} has no Bookmarks category on offer here, so the link
                      cannot be kept that way. Choose another circle, or its keepers can
                      switch Bookmarks on from the circle's own page.
                    </p>
                  )}
                </>
              ) : (
                /* Nothing is guessed at. The share said no address, so the screen
                   says what would make one and leaves it to the member. */
                <p className="field-hint">
                  If this content is available online, you can add its original web link as
                  a Bookmark instead. Paste or type it into the Link field above and the
                  Bookmark action appears here.
                </p>
              )}
            </div>
          )}

          <div className="join-actions">
            <ShareItemButton
              store={store}
              categories={offered}
              subtitle={pathText([circle.name, ...target.path])}
              folder={target}
              prefill={prefill}
              onPick={(flow) => onShare(flow, circle.id, target, prefill)}
              onSaved={() => onSaved(circle.id)}
            />
            <button className="btn-text" onClick={onDismiss}>
              Not now
            </button>
          </div>

          {offered.length === 0 && images.length > 0 && categories.length > 0 && (
            <p className="join-footnote">
              Nothing {circle.name} has switched on takes photos. Choose another circle, or its
              keepers can add a category that does from the circle's own page.
            </p>
          )}

          {categories.length === 0 && (
            <p className="join-footnote">
              {circle.name} has nothing switched on to share into yet. Its keepers can add a
              category from the circle's own page.
            </p>
          )}

          {/* The file is kept and the content types are all still on offer — the
              member may well want to share the words and the link regardless —
              but nothing here would hold the file, so the screen says so rather
              than letting it be dropped silently on save. */}
          {attachment &&
            offered.length > 0 &&
            !offered.some((category) => categoryTakesAttachment(category, attachment)) && (
              <p className="join-footnote">
                Nothing {circle.name} has switched on asks for a file like this one, so it
                will not be kept with whatever you share. Choose another circle, or its
                keepers can add an upload question to a category from the circle's own page.
              </p>
            )}
        </>
      )}
    </section>
  );
}
