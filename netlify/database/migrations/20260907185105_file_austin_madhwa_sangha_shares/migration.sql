-- Folders arrived after the shares did, and this is the one-time catch-up for the
-- circle that has already been tidied into them.
--
-- A share names its folder on the form that made it, so everything shared into
-- Austin Madhwa Sangha before that circle had folders sits at the top of the
-- circle with `item_circles.folder_id` still null — which is what a member sees
-- when they make "Recipes", "Home remedies" and "Books" and find them empty. The
-- app can now move a share (the ⧉ folder button on its row), so this is a
-- convenience rather than the only way; what it saves is doing it by hand for
-- every recipe already there.
--
-- What it does is narrow on purpose:
--
--   * one circle, matched by name, because filing everybody's shares by a name
--     rule is a decision for each circle to make rather than a migration's;
--   * only rows whose `folder_id` is null, so nothing already filed is moved and
--     running it twice does nothing the second time;
--   * only `folder_id`, so no share changes its circle, its category, its shelf,
--     its author, its audience or its words, and no row is created or deleted.
--
-- It is harmless where none of that exists: no circle of that name, or no folder
-- of that name in it, matches nothing and updates nothing.

-- Put each kind of unfiled share into the folder that circle made for it.
--
-- The pairing is by name, since that is the only thing that says a folder is
-- "the Recipes folder" — a folder is a place a circle invented and carries no
-- content type of its own. A remedy has two acceptable spellings because the
-- folder was described as "Home remedies" and a circle could as easily have
-- called it "Remedies"; the preference column is which one wins where both
-- exist, and a folder at the top of the circle is preferred over one buried in
-- a branch of it.
UPDATE "item_circles" AS ic
SET "folder_id" = t."folder_id"
FROM (
  SELECT DISTINCT ON (f."circle_id", m."item_type")
    f."circle_id" AS "circle_id",
    m."item_type" AS "item_type",
    f."id" AS "folder_id"
  FROM (VALUES
    ('recipe', 'recipes', 1),
    ('remedy', 'home remedies', 1),
    ('remedy', 'remedies', 2),
    ('book', 'books', 1)
  ) AS m("item_type", "folder_name", "preference")
  JOIN "folders" f
    ON lower(btrim(f."name")) = m."folder_name"
   AND f."status" = 'active'
  JOIN "circles" c
    ON c."id" = f."circle_id"
   AND lower(btrim(c."name")) = 'austin madhwa sangha'
  ORDER BY f."circle_id", m."item_type", m."preference",
           (f."parent_id" IS NULL) DESC, f."id"
) AS t
WHERE ic."circle_id" = t."circle_id"
  AND ic."item_type" = t."item_type"
  AND ic."folder_id" IS NULL;
