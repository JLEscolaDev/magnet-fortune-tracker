-- Make photos bucket public to allow signed URLs to work properly
UPDATE storage.buckets 
SET public = true 
WHERE id = 'photos';

-- Verify the storage policies are correctly set for user access
-- (These should already exist based on the query results above)