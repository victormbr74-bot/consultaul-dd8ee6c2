-- Rollback: remove temporary anonymous access to lotericas
-- (introduced only for emergency login downtime).

DROP POLICY IF EXISTS "Temporary anon can read lotericas until 2026-02-27" ON public.lotericas;
DROP POLICY IF EXISTS "Temporary anon can update lotericas until 2026-02-27" ON public.lotericas;
