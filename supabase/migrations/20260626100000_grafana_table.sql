-- Grafana table for Circuito -> Posto mapping
-- Used by Controle de Reparo to populate the Grafana column from the Consulta UL base
CREATE TABLE IF NOT EXISTS public.grafana (
  circuito TEXT PRIMARY KEY,
  posto TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grafana_circuito ON public.grafana (circuito);

ALTER TABLE public.grafana ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'grafana'
      AND policyname = 'Authenticated can read grafana'
  ) THEN
    CREATE POLICY "Authenticated can read grafana"
      ON public.grafana
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grafana TO authenticated;
