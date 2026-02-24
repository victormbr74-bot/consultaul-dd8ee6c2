-- Temporary emergency access while login is unavailable.
-- Expires automatically at 2026-02-27 03:00:00+00 (27/02/2026 00:00 UTC-3).

DROP POLICY IF EXISTS "Temporary anon can read lotericas until 2026-02-27" ON public.lotericas;
CREATE POLICY "Temporary anon can read lotericas until 2026-02-27"
  ON public.lotericas
  FOR SELECT TO anon
  USING (now() < TIMESTAMPTZ '2026-02-27 03:00:00+00');

DROP POLICY IF EXISTS "Temporary anon can update lotericas until 2026-02-27" ON public.lotericas;
CREATE POLICY "Temporary anon can update lotericas until 2026-02-27"
  ON public.lotericas
  FOR UPDATE TO anon
  USING (now() < TIMESTAMPTZ '2026-02-27 03:00:00+00')
  WITH CHECK (now() < TIMESTAMPTZ '2026-02-27 03:00:00+00');
