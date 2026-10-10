# TODO

## Circle photo attachment privacy — deferred

- **Issue:** `GET /api/photos/:key` (`netlify/functions/photo.mts`) currently serves photos without authentication or Circle membership checks. It relies on unguessable blob keys and sends `Cache-Control: public, max-age=31536000, immutable`. A copied photo URL may therefore remain accessible to someone who is not authorized to view the Circle.
- **Required fix:** Enforce authenticated, server-side authorization for each photo based on its referencing share and existing Circle visibility, hide/block and saved-library rules. Preserve uploader preview before a photo is attached to a saved share. Review Circle covers and any other image-serving endpoints separately. Remove shared/public caching for private media, and consider previously cached copies.
- **Verification:** Test a private Circle photo URL while logged out, while signed in as a non-member, and while signed in as an authorized member; confirm previews and normal display still work. Include revocation after membership or visibility changes.
- **Status:** Deferred at user's request. Do not interpret the successful audio, video, PDF, and Excel tests as proof that photos are protected.

## Attachment upload metadata validation — before PR #2 merge

- **Issue:** `netlify/lib/fields.ts` accepts attachment names and sizes from client-submitted field-answer JSON. A modified request may claim a different size or filename, bypassing checks that rely on that metadata. Existing `keeping` behavior also needs to remain safe.
- **Required fix:** Validate referenced attachment keys against trusted stored upload metadata (size, MIME/content type, name, and uploader) during save/update. Enforce field-specific type and size rules on the server; preserve legitimate existing attachments and avoid trusting client-supplied sizes for the combined per-share limit.
- **Verification:** Test forged size/name/type, keys from another uploader, edits that retain existing attachments, video/audio/document cross-field substitutions, and valid uploads.
- **Status:** Deferred at user's request; review finding, not yet fixed. Keep PR #2 in Draft pending release decision.
