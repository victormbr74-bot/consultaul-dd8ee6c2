CREATE TABLE IF NOT EXISTS public.analise_resultado_atual (
  id text PRIMARY KEY DEFAULT 'current',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analise_resultado_atual_singleton CHECK (id = 'current')
);

ALTER TABLE public.analise_resultado_atual ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.analise_resultado_atual TO authenticated;

DROP POLICY IF EXISTS compat_analise_resultado_atual_all ON public.analise_resultado_atual;
CREATE POLICY compat_analise_resultado_atual_all
  ON public.analise_resultado_atual
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
