-- The organisation is SVKV. The migration before this one wrote it as SVKVA,
-- which was one letter wrong, so the circle everybody lands on and the chapter
-- beneath it are both misspelled. Nothing about the shape is wrong — the shares,
-- the categories, the shelves and the memberships are all where the previous
-- migration put them — so this corrects the four characters of text and touches
-- nothing else.
--
-- A name is the whole of what makes one circle a branch of another
-- (`src/branches.ts` — there is no parent_id), so the organisation and its
-- chapters have to be renamed together or the strip would empty out: SVKVA -
-- Austin is not a branch of SVKV. One statement over the pattern does both,
-- and every chapter opened since, so a Houston or a Dubai is carried along
-- without having to be named here.
--
-- Everything below is a no-op on a database that has already had it, and on a
-- deployment that never had an SVKVA in it at all: each statement only matches
-- text that still contains the misspelling, and replaces it with a name that
-- cannot match again.

-- The organisation and every chapter under it, in one statement. The match is
-- anchored so "SVKVA" is the start of the name and what follows it is either
-- nothing or one of the separators a branch is allowed to use — the same four
-- `SEPARATORS` the browser reads — because otherwise a circle that merely starts
-- with the same letters would be renamed along with them. The replacement is
-- anchored for the same reason: an SVKVA inside a name is somebody's own words.
UPDATE "circles"
SET "name" = regexp_replace("name", '^SVKVA', 'SVKV', 'i')
WHERE "name" ~* '^SVKVA($|\s*[-–—:])';
--> statement-breakpoint
-- The description carries the name too — the organisation's own words are "a
-- space for SVKVA - USA members" — and a page headed SVKV that describes itself
-- as SVKVA reads as two organisations rather than one corrected name.
UPDATE "circles"
SET "description" = regexp_replace("description", 'SVKVA', 'SVKV', 'gi')
WHERE "description" ~* 'SVKVA';
--> statement-breakpoint
-- A notification is written once and kept, so the rows already in the feed hold
-- the name as it was spelled the day they were written — "you are in 🛕 SVKVA -
-- Austin" and the rest. They name their circle by id and go on pointing at the
-- right one; it is only the sentence a member reads that is stale, and that is
-- worth correcting rather than leaving a misspelling in everybody's history.
UPDATE "notifications"
SET "message" = regexp_replace("message", 'SVKVA', 'SVKV', 'gi')
WHERE "message" ~* 'SVKVA';
