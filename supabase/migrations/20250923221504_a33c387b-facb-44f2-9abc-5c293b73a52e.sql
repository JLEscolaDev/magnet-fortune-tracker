-- Create a test fortune_media record to verify photo display is working
-- This is just for testing - using a non-existent file path to see if gray rectangle appears

INSERT INTO fortune_media (
  fortune_id,
  user_id,
  bucket,
  path,
  mime_type,
  width,
  height,
  size_bytes
) VALUES (
  '04056c25-bffa-49f5-9cf1-dc8136f4c34a', -- One of your existing fortunes
  'b315cb91-5dda-43da-be32-cc7d9f65a245', -- Your user ID
  'photos',
  'test-path-that-does-not-exist.jpg',
  'image/jpeg',
  800,
  600,
  100000
);