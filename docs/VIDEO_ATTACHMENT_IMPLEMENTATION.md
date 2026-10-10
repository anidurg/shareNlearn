# Video attachments in existing Share & Learn content types

Status: implementation design / no production behavior changed.

## Product decision

Videos are attachments, not a new top-level content type. Existing built-in and custom categories may accept video when the category supports an appropriate upload field. Keep the Android PWA share-target declaration and service-worker mailbox intact. The first release targets MP4 (H.264/AAC) and short clips, with explicit rejection of unsupported formats rather than mislabeled audio.

## Existing code reviewed

- `public/manifest.webmanifest` already declares `video/mp4` and `.mp4` for Android share targeting.
- `public/sw.js` receives the file and stores it in the incoming-share mailbox.
- `src/components/IncomingShareScreen.tsx` deliberately rejects `video/*` before audio classification. This guard must remain until video upload is end-to-end.
- `src/api.ts`: documents <=10 MiB, audio <=20 MiB, photos <=5 MiB after resizing, up to 10 photos; chunking uses 4 MiB parts.
- `netlify/lib/fields.ts`: `UPLOAD_KINDS` is `document | audio`; server validates each field and caps the sum of field attachment sizes at 50 MiB.
- `src/components/ManageFields.tsx`: upload kind selector and configuration.
- `src/components/CategoryFields.tsx`: upload picker, incoming attachment compatibility, saved attachment rendering.
- `netlify/functions/field-audio.mts`: claims chunked uploads into the existing field-files blob store.
- `netlify/functions/file.mts`: serves field-files with range support, currently inline only for PDF/audio.
- `netlify/lib/attachments.ts`: attachment metadata, storage, and URL helpers.

## Implementation order

1. **Backend contract first.** Add `video` to server-side upload-kind parsing and validation; retain existing `document` and `audio` semantics. Define a separate video size ceiling, initially *proposed* at 50 MiB, and reconcile it with the existing 50 MiB combined field-attachment ceiling. Do not silently raise existing document/audio limits. Ensure the upload-part and collect/stitch paths enforce the video ceiling server-side and that uploaded video MIME/extension is validated before storage.
2. **Upload endpoint.** Add a dedicated authenticated video claim endpoint or carefully generalized field-media endpoint. Reuse multipart upload parts and `field-files` storage; persist accurate video content type and name. Check upload throttling and cleanup on failed or abandoned uploads.
3. **Category editor and form.** Offer Video as an upload kind in the category field editor, with a video file picker and progress/error feedback. Do not allow a video to be stored in an audio field or a document field. Add responsive HTML5 `<video controls playsInline preload="metadata">` to the saved field-answer view; retain the downloadable link as fallback.
4. **Incoming Share.** Recognize MP4 video from Android, upload through the new endpoint, and seed only a compatible field. When the chosen category has no video field, explain this before uploading or saving, with an option to save the source URL as a Bookmark when available.
5. **Test coverage.** Exercise server-side size/type checks, upload parts, final save (including the combined 50 MiB rule), video playback with Range requests, permissions, share-target handoff, and cancellation/retry. Test actual Android WhatsApp MP4 shares, iPhone Safari manual uploads, and saved-item playback.

## Security and behavior checks

- Existing `/api/files/:key` uses unguessable blob keys without login. Confirm whether that access model is acceptable for Circle videos before rollout; video previews must not accidentally expose private Circle content.
- Verify whether `audioContentType` treating `.mp4` as audio could cause an MP4 with a missing MIME type to be routed incorrectly. Preserve explicit video-first classification and avoid ambiguous extension-only acceptance.
- Verify browser codec compatibility. MP4 is a container, not a guarantee that a particular device can play its codecs. Prefer a documented supported encoding rather than automatic server-side transcoding in the first release.
- Do not treat the Android manifest's `video/mp4` declaration as proof that the app can save video. The share-target reception and persistence are separate capabilities.

## Release gate

Do not merge or deploy until TypeScript/build checks pass, server validation and cleanup are verified, and a real Android WhatsApp video is saved and played back from its Circle. The iOS Share Extension remains a separate future phase.
