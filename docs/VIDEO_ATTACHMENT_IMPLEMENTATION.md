# Video attachments in Share & Learn — PR #2

## Status

Implemented on the `feature/video-field-attachments` branch in [Draft PR #2](https://github.com/anidurg/shareNlearn/pull/2). **Not merged into `main`; production is unchanged.**

Video is an attachment type for existing built-in and custom categories, not a new top-level content type. The initial supported upload format is MP4 (`video/mp4`, `.mp4`). Browser/device codec compatibility still depends on the encoding of the file; the app does not transcode videos.

## Current limits

| Attachment type | Per-file upload limit |
| --- | --- |
| Video | **10 MiB** |
| Document | 10 MiB |
| Audio field recording | 20 MiB |

The existing **50 MiB combined field-attachment limit per share** remains unchanged. Video uploads use the existing 4 MiB chunk transport. Client-side checks, the server upload endpoint, and server field validation enforce the video cap.

## Implemented behavior

- Category field configuration supports **Video** as an upload kind alongside Audio and Document.
- A video field accepts one MP4, with upload errors, preview, removal, and inline HTML5 playback after saving.
- Android Share Sheet / WhatsApp MP4 sharing can pass a video into the app's existing incoming-share flow and save it to a compatible field in a Circle.
- Field-file serving (`/api/files/:key`) requires authentication and checks visibility of the referencing share, including applicable saved-library rules. The uploader can preview a newly uploaded, not-yet-attached file. Private file responses use `Cache-Control: private, no-store`.
- The footer shows build commit, deploy context, and build timestamp for preview verification.

## Tests completed on Deploy Preview

- MP4 upload, save, and playback for a file below the limit.
- MP4 **under 10 MiB accepted** and **over 10 MiB rejected**.
- Android WhatsApp → Android Share Sheet → Share & Learn → Circle save and playback.
- Existing audio and PDF attachments still play/open for an authorized Circle member.
- Copied direct video URL denied while logged out and for a signed-in non-member; unauthorized PDF and Excel URLs also denied. These tests do **not** establish that every access-revocation scenario is covered.
- TypeScript check and Vite build passed during prior PR checks. Recheck the latest CI status before merge.

## Outstanding work and release considerations

See [`docs/todo.md`](todo.md) for the detailed deferred work and verification steps:

1. **Server-side attachment metadata validation:** verify saved-answer name, size, content type, and uploader against trusted stored uploads; don't rely on client-submitted attachment metadata.
2. **Circle permission revocation regression:** test a copied file URL after Circle membership changes, including saved-library exceptions and block/hide behavior.
3. **Circle photo privacy:** `/api/photos/:key` still lacks equivalent Circle authorization and uses public immutable caching. This was explicitly deferred; successful field-file tests do not protect photos.
4. **Historical file-size audit:** obtain actual audio/video/document size distributions from authorized storage/database records before considering an increase to the video cap.

Other coverage not yet confirmed here includes iPhone Safari manual MP4 uploads, cancellation/retry, abandoned upload cleanup, and comprehensive automated authorization tests. Native iOS Share Extension support is a separate future phase.

## Release decision

**PR #2 remains Draft.** The functional tests above passed, but outstanding security work and deferred photo privacy must be acknowledged explicitly before any decision to merge. Do not merge or deploy to production without user approval.
