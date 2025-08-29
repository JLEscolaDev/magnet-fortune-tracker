-- Create lifestyle_entries table for daily habit tracking
CREATE TABLE public.lifestyle_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  dream_quality INTEGER CHECK (dream_quality >= 1 AND dream_quality <= 10) DEFAULT 5,
  dream_description TEXT,
  meals TEXT,
  alcohol_consumption INTEGER DEFAULT 0 CHECK (alcohol_consumption >= 0),
  mood TEXT CHECK (mood IN ('very_good', 'good', 'neutral', 'bad', 'very_bad')) DEFAULT 'neutral',
  sickness_level INTEGER CHECK (sickness_level >= 0 AND sickness_level <= 10) DEFAULT 0,
  exercise_type TEXT,
  exercise_duration INTEGER DEFAULT 0 CHECK (exercise_duration >= 0),
  sexual_appetite INTEGER CHECK (sexual_appetite >= 1 AND sexual_appetite <= 10) DEFAULT 5,
  sexual_performance INTEGER CHECK (sexual_performance >= 1 AND sexual_performance <= 10) DEFAULT 5,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Composite unique constraint to ensure one entry per user per date
  UNIQUE(user_id, date)
);

-- Enable Row Level Security
ALTER TABLE public.lifestyle_entries ENABLE ROW LEVEL SECURITY;

-- Create policies for users to manage their own lifestyle entries
CREATE POLICY "Users can view their own lifestyle entries" 
ON public.lifestyle_entries 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own lifestyle entries" 
ON public.lifestyle_entries 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lifestyle entries" 
ON public.lifestyle_entries 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lifestyle entries" 
ON public.lifestyle_entries 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_lifestyle_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_lifestyle_entries_updated_at
  BEFORE UPDATE ON public.lifestyle_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_lifestyle_entries_updated_at();