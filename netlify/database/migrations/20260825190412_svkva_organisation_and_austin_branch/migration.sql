-- SVKVA was one circle holding everything, and then it became two: SVKVA, the
-- organisation, and SVKVA - Austin, the chapter. The second was started fresh
-- and seeded with its own empty categories, and the shares — three recordings
-- and seven bookmarks, with their shelves, the Events category the circle
-- invented and the field it asks — all stayed on the first one, whose categories
-- were then switched off so it would read as an organisation page. The result
-- was an organisation page listing nothing and a chapter page holding nothing.
--
-- The two circles are the same shape, so the shares are put in the right place
-- by changing which circle is called what rather than by moving ten rows across
-- and remapping every category and shelf id on the way. Nothing moves, nothing
-- is dropped, and — the reason this is the safer of the two — the seven
-- notifications, the invites and the reports that name a circle by id go on
-- naming the circle that actually holds the shares they are about. Both circles
-- have exactly one member, their shared owner, so nobody is moved either.
--
-- The guard is that the circle called SVKVA has shares and the one called
-- SVKVA - Austin has none, which is precisely the state being repaired and is
-- false the moment the rename at the bottom lands. So this is a no-op on a
-- database that has already had it, on one where the owner sorted it out by
-- hand first, and on any deployment that has no SVKVA in it at all.

-- The chapter's categories hold the shares, so they are switched back on.
WITH "named" AS (
  SELECT
    (SELECT "id" FROM "circles" WHERE "name" = 'SVKVA' AND "is_default" = false ORDER BY "id" LIMIT 1) AS "holds_shares",
    (SELECT "id" FROM "circles" WHERE "name" = 'SVKVA - Austin' AND "is_default" = false ORDER BY "id" LIMIT 1) AS "holds_nothing"
), "swap" AS (
  SELECT "holds_shares", "holds_nothing" FROM "named"
  WHERE "holds_shares" IS NOT NULL
    AND "holds_nothing" IS NOT NULL
    AND EXISTS (SELECT 1 FROM "item_circles" WHERE "circle_id" = "named"."holds_shares")
    AND NOT EXISTS (SELECT 1 FROM "item_circles" WHERE "circle_id" = "named"."holds_nothing")
)
UPDATE "circle_categories"
SET "status" = 'active'
WHERE "status" = 'hidden'
  AND "circle_id" IN (SELECT "holds_shares" FROM "swap");
--> statement-breakpoint
-- ...and the organisation's are switched off, which is what makes its page the
-- description and the list of chapters rather than an empty grid and an empty
-- feed. Switched off rather than deleted: every one of them comes back with a
-- tick if the owner decides the organisation should hold something after all.
WITH "named" AS (
  SELECT
    (SELECT "id" FROM "circles" WHERE "name" = 'SVKVA' AND "is_default" = false ORDER BY "id" LIMIT 1) AS "holds_shares",
    (SELECT "id" FROM "circles" WHERE "name" = 'SVKVA - Austin' AND "is_default" = false ORDER BY "id" LIMIT 1) AS "holds_nothing"
), "swap" AS (
  SELECT "holds_shares", "holds_nothing" FROM "named"
  WHERE "holds_shares" IS NOT NULL
    AND "holds_nothing" IS NOT NULL
    AND EXISTS (SELECT 1 FROM "item_circles" WHERE "circle_id" = "named"."holds_shares")
    AND NOT EXISTS (SELECT 1 FROM "item_circles" WHERE "circle_id" = "named"."holds_nothing")
)
UPDATE "circle_categories"
SET "status" = 'hidden'
WHERE "status" = 'active'
  AND "circle_id" IN (SELECT "holds_nothing" FROM "swap");
--> statement-breakpoint
-- The description is the organisation's own words — "a space for SVKVA - USA
-- members" — so it follows the name onto the circle that is about to carry it,
-- with the cover image and the mark it was chosen with.
WITH "named" AS (
  SELECT
    (SELECT "id" FROM "circles" WHERE "name" = 'SVKVA' AND "is_default" = false ORDER BY "id" LIMIT 1) AS "holds_shares",
    (SELECT "id" FROM "circles" WHERE "name" = 'SVKVA - Austin' AND "is_default" = false ORDER BY "id" LIMIT 1) AS "holds_nothing"
), "swap" AS (
  SELECT "holds_shares", "holds_nothing" FROM "named"
  WHERE "holds_shares" IS NOT NULL
    AND "holds_nothing" IS NOT NULL
    AND EXISTS (SELECT 1 FROM "item_circles" WHERE "circle_id" = "named"."holds_shares")
    AND NOT EXISTS (SELECT 1 FROM "item_circles" WHERE "circle_id" = "named"."holds_nothing")
)
UPDATE "circles" AS "organisation"
SET "description" = "chapter"."description",
    "cover_key" = "chapter"."cover_key",
    "icon" = "chapter"."icon"
FROM "swap", "circles" AS "chapter"
WHERE "organisation"."id" = "swap"."holds_nothing"
  AND "chapter"."id" = "swap"."holds_shares";
--> statement-breakpoint
-- The chapter is left with no description and no cover rather than the
-- organisation's, because a copy of them on both would read as the same circle
-- twice — and because the owner said they would write Austin's own. The cover
-- moves rather than being shared: two circles pointing at one blob would mean
-- deleting either of them took the other's picture with it.
WITH "named" AS (
  SELECT
    (SELECT "id" FROM "circles" WHERE "name" = 'SVKVA' AND "is_default" = false ORDER BY "id" LIMIT 1) AS "holds_shares",
    (SELECT "id" FROM "circles" WHERE "name" = 'SVKVA - Austin' AND "is_default" = false ORDER BY "id" LIMIT 1) AS "holds_nothing"
), "swap" AS (
  SELECT "holds_shares", "holds_nothing" FROM "named"
  WHERE "holds_shares" IS NOT NULL
    AND "holds_nothing" IS NOT NULL
    AND EXISTS (SELECT 1 FROM "item_circles" WHERE "circle_id" = "named"."holds_shares")
    AND NOT EXISTS (SELECT 1 FROM "item_circles" WHERE "circle_id" = "named"."holds_nothing")
)
UPDATE "circles"
SET "description" = NULL,
    "cover_key" = NULL
WHERE "id" IN (SELECT "holds_shares" FROM "swap");
--> statement-breakpoint
-- Both names change in one statement on purpose. Renaming them one at a time
-- would leave the second statement looking up a circle called SVKVA that the
-- first had just renamed, and it would find the wrong one or nothing at all.
-- This is also the statement that closes the door behind itself: afterwards the
-- circle called SVKVA has no shares, so every guard above reads false.
WITH "named" AS (
  SELECT
    (SELECT "id" FROM "circles" WHERE "name" = 'SVKVA' AND "is_default" = false ORDER BY "id" LIMIT 1) AS "holds_shares",
    (SELECT "id" FROM "circles" WHERE "name" = 'SVKVA - Austin' AND "is_default" = false ORDER BY "id" LIMIT 1) AS "holds_nothing"
), "swap" AS (
  SELECT "holds_shares", "holds_nothing" FROM "named"
  WHERE "holds_shares" IS NOT NULL
    AND "holds_nothing" IS NOT NULL
    AND EXISTS (SELECT 1 FROM "item_circles" WHERE "circle_id" = "named"."holds_shares")
    AND NOT EXISTS (SELECT 1 FROM "item_circles" WHERE "circle_id" = "named"."holds_nothing")
)
UPDATE "circles" AS "c"
SET "name" = CASE WHEN "c"."id" = "swap"."holds_shares" THEN 'SVKVA - Austin' ELSE 'SVKVA' END
FROM "swap"
WHERE "c"."id" IN ("swap"."holds_shares", "swap"."holds_nothing");
