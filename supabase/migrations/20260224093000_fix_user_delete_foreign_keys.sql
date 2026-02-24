-- Allow deleting auth users without breaking audit references.
-- Keep audit rows, but null out the user pointer when the auth user is removed.

ALTER TABLE IF EXISTS public.lotericas
  DROP CONSTRAINT IF EXISTS lotericas_updated_by_fkey;

ALTER TABLE IF EXISTS public.lotericas
  ADD CONSTRAINT lotericas_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.loterica_history
  DROP CONSTRAINT IF EXISTS loterica_history_changed_by_fkey;

ALTER TABLE IF EXISTS public.loterica_history
  ADD CONSTRAINT loterica_history_changed_by_fkey
  FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.loterica_change_requests
  DROP CONSTRAINT IF EXISTS loterica_change_requests_reviewed_by_fkey;

ALTER TABLE IF EXISTS public.loterica_change_requests
  ADD CONSTRAINT loterica_change_requests_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
