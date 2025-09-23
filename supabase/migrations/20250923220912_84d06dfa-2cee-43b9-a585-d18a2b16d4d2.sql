-- Clean up orphaned fortune_media records that don't have corresponding storage objects
-- This is a one-time cleanup for the current issue

-- First, let's see what we have
-- SELECT fm.id, fm.path, fm.fortune_id 
-- FROM fortune_media fm
-- LEFT JOIN storage.objects so ON so.name = fm.path AND so.bucket_id = fm.bucket
-- WHERE so.id IS NULL;

-- Delete orphaned fortune_media records
DELETE FROM fortune_media fm
WHERE NOT EXISTS (
  SELECT 1 FROM storage.objects so 
  WHERE so.name = fm.path AND so.bucket_id = fm.bucket
);