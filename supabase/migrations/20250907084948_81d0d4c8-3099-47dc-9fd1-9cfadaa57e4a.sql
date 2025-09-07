-- Add tutorial master achievement
INSERT INTO public.achievements (id, title, description, icon, state, required_count, category)
VALUES (
  'tutorial-master',
  'Tutorial Master',
  'Explored all features of Fortune Magnet',
  '🎓',
  'locked',
  8,
  'Other'
) ON CONFLICT (id) DO NOTHING;