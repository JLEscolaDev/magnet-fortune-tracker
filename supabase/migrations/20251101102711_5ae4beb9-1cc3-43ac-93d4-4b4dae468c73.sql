-- Add energy_level column to lifestyle_entries table
ALTER TABLE public.lifestyle_entries 
ADD COLUMN energy_level integer DEFAULT 3;