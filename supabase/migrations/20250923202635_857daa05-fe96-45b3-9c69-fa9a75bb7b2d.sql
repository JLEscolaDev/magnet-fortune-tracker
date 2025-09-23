-- Add room_temperature column to lifestyle_entries table
ALTER TABLE public.lifestyle_entries 
ADD COLUMN room_temperature INTEGER DEFAULT 3 CHECK (room_temperature >= 1 AND room_temperature <= 5);