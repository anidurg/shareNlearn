# TODO

## Circle photo attachment privacy — deferred

- **Issue:** `GET /api/photos/:key` (`netlify/functions/photo.mts`) currently serves photos without authentication or Circle membership checks. It relies on unguessable blob keys and sends `Cache-Control: public, max-age=31536000, immutable`. A copied photo URL may therefore remain accessible to someone who is not authorized to view the Circle.
- **Required fix:** Enforce authenticated, server-side authorization for each photo based on its referencing share and existing Circle visibility, hide/block and saved-library rules. Preserve uploader preview before a photo is attached to a saved share. Review Circle covers and any other image-serving endpoints separately. Remove shared/public caching for private media, and consider previously cached copies.
- **Verification:** Test a private Circle photo URL while logged out, while signed in as a non-member, and while signed in as an authorized member; confirm previews and normal display still work. Include revocation after membership or visibility changes.
- **Status:** Deferred at user's request. Do not interpret the successful audio, video, PDF, and Excel tests as proof that photos are protected.
