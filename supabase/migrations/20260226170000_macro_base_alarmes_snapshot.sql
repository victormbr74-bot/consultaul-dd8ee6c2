-- Snapshot isolado da aba MACRO para abastecer exclusivamente os menus de alarmes.
-- Evita que os dashboards de alarmes usem a tabela public.lotericas (cadastro operacional).

CREATE TABLE IF NOT EXISTS public.macro_base_alarmes (
  cod_ul TEXT PRIMARY KEY,
  nome_loterica TEXT,
  ccto_oi TEXT,
  ccto_oemp TEXT,
  operadora TEXT,
  ip_nat TEXT,
  ip_wan TEXT,
  loopback_wan TEXT,
  loopback_lan TEXT,
  endereco TEXT,
  contato TEXT,
  status TEXT,
  cidade TEXT,
  uf TEXT,
  designacao_nova TEXT,
  raw_data JSONB,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_macro_base_alarmes_status ON public.macro_base_alarmes (status);
CREATE INDEX IF NOT EXISTS idx_macro_base_alarmes_operadora ON public.macro_base_alarmes (operadora);
CREATE INDEX IF NOT EXISTS idx_macro_base_alarmes_ccto_oi ON public.macro_base_alarmes (ccto_oi);
CREATE INDEX IF NOT EXISTS idx_macro_base_alarmes_ccto_oemp ON public.macro_base_alarmes (ccto_oemp);

ALTER TABLE public.macro_base_alarmes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'macro_base_alarmes'
      AND policyname = 'Authenticated can read macro_base_alarmes'
  ) THEN
    CREATE POLICY "Authenticated can read macro_base_alarmes"
      ON public.macro_base_alarmes
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

