ALTER TABLE public.router_script_templates
  ADD COLUMN IF NOT EXISTS operadora_4g TEXT NOT NULL DEFAULT 'any';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'router_script_templates_operadora_4g_check'
  ) THEN
    ALTER TABLE public.router_script_templates
      ADD CONSTRAINT router_script_templates_operadora_4g_check
      CHECK (operadora_4g IN ('any', 'vivo', 'tim', 'arqia', 'claro', 'brisanet', 'nao-se-aplica'));
  END IF;
END;
$$;

UPDATE public.router_script_templates
SET operadora_4g = 'any'
WHERE operadora_4g IS NULL OR operadora_4g = '';
