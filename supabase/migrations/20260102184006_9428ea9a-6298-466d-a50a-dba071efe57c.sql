-- Make photos bucket private (was set to public but signed URLs are used everywhere)
-- This improves security by requiring signed URLs for all file access
UPDATE storage.buckets 
SET public = false 
WHERE id = 'photos';