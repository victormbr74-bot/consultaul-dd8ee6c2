-- Avisos colaborativos por UL, exibidos no topo da consulta.

CREATE TABLE IF NOT EXISTS public.loterica_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_ul TEXT NOT NULL REFERENCES public.lotericas(cod_ul) ON DELETE CASCADE,
  observacao TEXT NOT NULL CHECK (btrim(observacao) <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS loterica_notices_cod_ul_idx
  ON public.loterica_notices (cod_ul);

CREATE INDEX IF NOT EXISTS loterica_notices_created_at_idx
  ON public.loterica_notices (created_at DESC);

ALTER TABLE public.loterica_notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read loterica notices" ON public.loterica_notices;
CREATE POLICY "Authenticated can read loterica notices"
  ON public.loterica_notices
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can create loterica notices" ON public.loterica_notices;
CREATE POLICY "Authenticated can create loterica notices"
  ON public.loterica_notices
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND btrim(observacao) <> ''
  );

DROP POLICY IF EXISTS "Admins can delete loterica notices" ON public.loterica_notices;
CREATE POLICY "Admins can delete loterica notices"
  ON public.loterica_notices
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
  );
