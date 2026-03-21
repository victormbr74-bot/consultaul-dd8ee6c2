ALTER TABLE public.router_script_templates
  DROP CONSTRAINT IF EXISTS router_script_templates_script_variant_check;

UPDATE public.router_script_templates
SET script_variant = lower(trim(script_variant))
WHERE script_variant IS NOT NULL
  AND script_variant <> lower(trim(script_variant));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'router_script_templates_script_variant_not_blank_check'
  ) THEN
    ALTER TABLE public.router_script_templates
      ADD CONSTRAINT router_script_templates_script_variant_not_blank_check
      CHECK (btrim(script_variant) <> '');
  END IF;
END;
$$;
