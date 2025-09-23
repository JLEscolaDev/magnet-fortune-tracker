-- Clean up test fortune_media records
DELETE FROM fortune_media WHERE path LIKE '%test-path%' OR path = 'test-path-that-does-not-exist.jpg';

-- Ensure the unique constraint exists properly
ALTER TABLE fortune_media DROP CONSTRAINT IF EXISTS unique_fortune_photo;
ALTER TABLE fortune_media ADD CONSTRAINT unique_fortune_photo UNIQUE (fortune_id);