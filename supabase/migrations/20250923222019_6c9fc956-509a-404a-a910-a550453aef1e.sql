-- Update the test record to use an actual uploaded photo if one exists
-- First, let's see what photos are in storage
DO $$
DECLARE 
    photo_path text;
BEGIN
    -- Try to find an actual photo in storage
    SELECT name INTO photo_path 
    FROM storage.objects 
    WHERE bucket_id = 'photos' 
    AND name LIKE '%.jpg' OR name LIKE '%.jpeg' OR name LIKE '%.png'
    LIMIT 1;
    
    IF photo_path IS NOT NULL THEN
        -- Update our test record to use the real photo
        UPDATE fortune_media 
        SET path = photo_path
        WHERE path = 'test-path-that-does-not-exist.jpg';
        
        RAISE NOTICE 'Updated test record to use photo: %', photo_path;
    ELSE
        RAISE NOTICE 'No photos found in storage bucket';
    END IF;
END $$;