ALTER TABLE public.lotericas
  ADD COLUMN IF NOT EXISTS cpe_meraki TEXT,
  ADD COLUMN IF NOT EXISTS circuito_meraki TEXT,
  ADD COLUMN IF NOT EXISTS circuito_elsys TEXT;

UPDATE public.lotericas
SET cpe_meraki = COALESCE(
  NULLIF(btrim(cpe_meraki), ''),
  NULLIF(btrim(raw_data ->> 'CPE MERAKI'), ''),
  NULLIF(btrim(raw_data ->> 'CIRCUITO MERAKI'), ''),
  NULLIF(btrim(raw_data ->> 'CIRCUITOS MERAKI'), ''),
  NULLIF(btrim(raw_data ->> 'MERAKI'), '')
)
WHERE raw_data IS NOT NULL
  AND NULLIF(btrim(cpe_meraki), '') IS NULL;

UPDATE public.lotericas
SET circuito_meraki = COALESCE(
  NULLIF(btrim(circuito_meraki), ''),
  NULLIF(btrim(raw_data ->> 'CIRCUITO MERAKI'), ''),
  NULLIF(btrim(raw_data ->> 'CIRCUITOS MERAKI'), ''),
  NULLIF(btrim(raw_data ->> 'MERAKI'), '')
)
WHERE raw_data IS NOT NULL
  AND NULLIF(btrim(circuito_meraki), '') IS NULL;

UPDATE public.lotericas
SET circuito_elsys = COALESCE(
  NULLIF(btrim(circuito_elsys), ''),
  NULLIF(btrim(raw_data ->> 'CIRCUITO ELSYS'), ''),
  NULLIF(btrim(raw_data ->> 'ELSYS'), '')
)
WHERE raw_data IS NOT NULL
  AND NULLIF(btrim(circuito_elsys), '') IS NULL;
