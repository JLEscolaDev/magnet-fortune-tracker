-- Add fortune_value column to fortunes table to support monetary values
ALTER TABLE public.fortunes 
ADD COLUMN fortune_value DECIMAL(10,2) NULL;