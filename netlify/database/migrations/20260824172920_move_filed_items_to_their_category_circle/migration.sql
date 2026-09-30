-- A category belongs to exactly one circle, and `item_circles` records both the
-- circle a share reaches and the category it was filed under there. Moving a
-- category to another circle by hand leaves those two disagreeing: the filing
-- names a category the row's circle no longer has, so the share shows on no
-- category page at all — it has left the old circle's shelves without arriving
-- on the new one's.
--
-- This carries the shares over to the circle their category now lives in, which
-- is the only place the filing can still mean anything. It is written as a
-- repair of any such disagreement rather than against particular ids, so it is a
-- no-op wherever the two already agree, and running it twice changes nothing.

-- Where the share already reaches the destination circle, the filing moves onto
-- the row that is there rather than colliding with it.
UPDATE "item_circles" AS "dest"
SET "category_id" = "stale"."category_id",
    "subcategory_id" = "stale"."subcategory_id"
FROM "item_circles" AS "stale"
JOIN "circle_categories" AS "cc" ON "cc"."id" = "stale"."category_id"
WHERE "stale"."circle_id" <> "cc"."circle_id"
  AND "dest"."item_type" = "stale"."item_type"
  AND "dest"."item_id" = "stale"."item_id"
  AND "dest"."circle_id" = "cc"."circle_id";
--> statement-breakpoint
-- ...and the row it came from is then redundant.
DELETE FROM "item_circles" AS "stale"
USING "circle_categories" AS "cc", "item_circles" AS "dest"
WHERE "cc"."id" = "stale"."category_id"
  AND "stale"."circle_id" <> "cc"."circle_id"
  AND "dest"."item_type" = "stale"."item_type"
  AND "dest"."item_id" = "stale"."item_id"
  AND "dest"."circle_id" = "cc"."circle_id";
--> statement-breakpoint
-- The ordinary case: nothing in the way, so the share follows its category,
-- keeping the shelf it was on, which belongs to that category and moved with it.
UPDATE "item_circles" AS "ic"
SET "circle_id" = "cc"."circle_id"
FROM "circle_categories" AS "cc"
WHERE "cc"."id" = "ic"."category_id"
  AND "ic"."circle_id" <> "cc"."circle_id";
--> statement-breakpoint
-- A post shared before the filing column existed names its category on the
-- `posts` row alone, so its circle row has to be read the other way round. A
-- post only ever reaches the one circle its category is in, and the guard leaves
-- it alone in the impossible case that it somehow reaches the destination twice.
UPDATE "item_circles" AS "ic"
SET "circle_id" = "cc"."circle_id"
FROM "posts" AS "p"
JOIN "circle_categories" AS "cc" ON "cc"."id" = "p"."category_id"
WHERE "ic"."item_type" = 'post'
  AND "ic"."item_id" = "p"."id"
  AND "ic"."category_id" IS NULL
  AND "ic"."circle_id" <> "cc"."circle_id"
  AND NOT EXISTS (
    SELECT 1 FROM "item_circles" AS "other"
    WHERE "other"."item_type" = 'post'
      AND "other"."item_id" = "p"."id"
      AND "other"."circle_id" = "cc"."circle_id"
  );
