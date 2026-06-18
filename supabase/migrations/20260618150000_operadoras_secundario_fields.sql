ALTER TABLE public.operadoras ADD COLUMN IF NOT EXISTS codigo_loterica text NOT NULL DEFAULT '';
ALTER TABLE public.operadoras ADD COLUMN IF NOT EXISTS operadora_4g text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_operadoras_codigo_loterica
  ON public.operadoras(codigo_loterica)
  WHERE codigo_loterica <> '';
