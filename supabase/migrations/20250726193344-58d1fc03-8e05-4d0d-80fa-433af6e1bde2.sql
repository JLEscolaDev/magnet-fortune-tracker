-- Fix security definer view issue by dropping the active_subscription view
-- Since the frontend no longer uses this view, we can safely remove it
DROP VIEW IF EXISTS active_subscription;