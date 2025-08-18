-- Add DELETE policy for fortunes table
CREATE POLICY "delete own fortunes" 
ON public.fortunes 
FOR DELETE 
USING (user_id = auth.uid());