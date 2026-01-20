-- Fix fortune_media paths that incorrectly include the bucket prefix
UPDATE fortune_media 
SET path = REPLACE(path, 'photos/', '') 
WHERE path LIKE 'photos/%';