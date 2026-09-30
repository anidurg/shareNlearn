-- A branch used to be a name and is now a column, and this is the one-time
-- conversion between the two.
--
-- Until the migration before this one, "SVKV - Austin" read as a branch of
-- "SVKV" because of the prefix: `src/branches.ts` compared the two names and
-- inferred the relationship, and nothing on the server knew branches existed.
-- `circles.parent_circle_id` is now the whole of what says so, and the browser
-- no longer looks at names at all — so a deployment that had chapters would
-- have lost them on this deploy, and the chapters would still be carrying their
-- organisation's name in their own. This writes down what was already being
-- displayed, and renames each branch to the part that was already being drawn.
--
-- Nothing is created, moved or deleted: no circle id changes, so every share,
-- membership, role, invitation, category, subcategory, field, report and
-- notification stays exactly where it is. The only columns touched are the new
-- parent and the branch's own name.
--
-- It is idempotent and harmless on a database with no such circles: the first
-- statement matches only a circle with no parent whose name still opens with
-- another circle's whole name, and it leaves neither of those true afterwards.

-- Link each branch to its organisation and rename it to the place.
--
-- The prefix has to be a whole circle's name followed by one of the four
-- separators the browser used to accept, because "Bookshelf" merely starting
-- with "Book" was never a branch of anything. Where two circles both match —
-- "SVKV" and "SVKV - USA" against "SVKV - USA - Austin" — the longest wins,
-- which is the rule the old client used, so `DISTINCT ON` picks it.
UPDATE "circles" AS c
SET "parent_circle_id" = m."parent_id",
    "name" = m."branch_name"
FROM (
  SELECT DISTINCT ON (child."id")
    child."id" AS "child_id",
    parent."id" AS "parent_id",
    btrim(regexp_replace(
      substring(child."name" FROM char_length(parent."name") + 1),
      '^\s*[-–—:]\s*', ''
    )) AS "branch_name"
  FROM "circles" child
  JOIN "circles" parent
    ON parent."id" <> child."id"
   AND parent."parent_circle_id" IS NULL
   AND char_length(child."name") > char_length(parent."name")
   AND lower(left(child."name", char_length(parent."name"))) = lower(parent."name")
   AND substring(child."name" FROM char_length(parent."name") + 1) ~ '^\s*[-–—:]\s*\S'
  WHERE child."parent_circle_id" IS NULL
    AND child."is_default" = false
  ORDER BY child."id", char_length(parent."name") DESC, parent."id"
) AS m
WHERE c."id" = m."child_id"
  AND m."branch_name" <> '';
--> statement-breakpoint
-- A branch of a branch is flattened onto the organisation above it. The app
-- presents one level — an organisation and its places — and a chain of three
-- read as a branch whose parent was itself a branch, which nothing draws.
-- Nobody loses anything: the circle keeps its own name and everything in it,
-- and simply sits beside its former parent rather than under it.
UPDATE "circles" AS c
SET "parent_circle_id" = p."parent_circle_id"
FROM "circles" AS p
WHERE c."parent_circle_id" = p."id"
  AND p."parent_circle_id" IS NOT NULL;
