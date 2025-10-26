-- Step 1: Consolidate duplicate hotspots and their photos
-- For each group of duplicate hotspots (same floor_plan_id and title),
-- keep the oldest one and move all photos to it

WITH duplicate_groups AS (
  SELECT 
    floor_plan_id,
    title,
    MIN(created_at) as keep_created_at
  FROM hotspots
  GROUP BY floor_plan_id, title
  HAVING COUNT(*) > 1
),
hotspots_to_keep AS (
  SELECT h.id as keep_id, h.floor_plan_id, h.title
  FROM hotspots h
  INNER JOIN duplicate_groups dg 
    ON h.floor_plan_id = dg.floor_plan_id 
    AND h.title = dg.title 
    AND h.created_at = dg.keep_created_at
),
hotspots_to_delete AS (
  SELECT h.id as delete_id, htk.keep_id
  FROM hotspots h
  INNER JOIN hotspots_to_keep htk 
    ON h.floor_plan_id = htk.floor_plan_id 
    AND h.title = htk.title
  WHERE h.id != htk.keep_id
)
-- Move all panorama photos from duplicate hotspots to the main one
UPDATE panorama_photos pp
SET hotspot_id = htd.keep_id
FROM hotspots_to_delete htd
WHERE pp.hotspot_id = htd.delete_id;

-- Step 2: Delete duplicate panorama photos (same photo_url in same hotspot)
DELETE FROM panorama_photos pp1
WHERE EXISTS (
  SELECT 1 FROM panorama_photos pp2
  WHERE pp2.hotspot_id = pp1.hotspot_id
  AND pp2.photo_url = pp1.photo_url
  AND pp2.id < pp1.id
);

-- Step 3: Re-order panorama photos by capture_date and created_at
WITH ordered_photos AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY hotspot_id 
      ORDER BY capture_date ASC, created_at ASC
    ) - 1 as new_order
  FROM panorama_photos
)
UPDATE panorama_photos pp
SET display_order = op.new_order
FROM ordered_photos op
WHERE pp.id = op.id;

-- Step 4: Update panorama_count for all hotspots
UPDATE hotspots h
SET 
  panorama_count = (SELECT COUNT(*) FROM panorama_photos WHERE hotspot_id = h.id),
  has_panorama = (SELECT COUNT(*) > 0 FROM panorama_photos WHERE hotspot_id = h.id);

-- Step 5: Delete duplicate hotspots
WITH duplicate_groups AS (
  SELECT 
    floor_plan_id,
    title,
    MIN(created_at) as keep_created_at
  FROM hotspots
  GROUP BY floor_plan_id, title
  HAVING COUNT(*) > 1
)
DELETE FROM hotspots h
WHERE EXISTS (
  SELECT 1 FROM duplicate_groups dg
  WHERE h.floor_plan_id = dg.floor_plan_id
  AND h.title = dg.title
  AND h.created_at > dg.keep_created_at
);

-- Step 6: Re-order hotspots by their title for proper sequence
WITH ordered_hotspots AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY floor_plan_id 
      ORDER BY title ASC
    ) - 1 as new_order
  FROM hotspots
)
UPDATE hotspots h
SET display_order = oh.new_order
FROM ordered_hotspots oh
WHERE h.id = oh.id;

-- Step 7: Add unique constraint to prevent future duplicates
ALTER TABLE hotspots 
ADD CONSTRAINT unique_hotspot_per_floor_plan 
UNIQUE (floor_plan_id, title);