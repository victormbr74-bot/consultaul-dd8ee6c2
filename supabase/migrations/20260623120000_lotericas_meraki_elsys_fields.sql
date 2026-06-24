ALTER TABLE IF EXISTS public.lotericas
  ADD COLUMN IF NOT EXISTS cpe_meraki text;

ALTER TABLE IF EXISTS public.lotericas
  ADD COLUMN IF NOT EXISTS circuito_meraki text;

ALTER TABLE IF EXISTS public.lotericas
  ADD COLUMN IF NOT EXISTS circuito_elsys text;

NOTIFY pgrst, 'reload schema';
