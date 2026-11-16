-- Extend the existing binding records so conversations survive service restarts.
ALTER TABLE public.line_bindings
 ADD COLUMN IF NOT EXISTS schedule_state jsonb NOT NULL DEFAULT '{}'::jsonb,
 ADD COLUMN IF NOT EXISTS schedule_version integer NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS favorite_project_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
