CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT,
  content TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_base_updated_at_idx
  ON public.knowledge_base (updated_at DESC);

CREATE INDEX IF NOT EXISTS knowledge_base_title_idx
  ON public.knowledge_base USING gin (to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(content, '')));

ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read knowledge base" ON public.knowledge_base;
CREATE POLICY "Authenticated can read knowledge base"
  ON public.knowledge_base
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can insert knowledge base" ON public.knowledge_base;
CREATE POLICY "Authenticated can insert knowledge base"
  ON public.knowledge_base
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Owners and admins can update knowledge base" ON public.knowledge_base;
CREATE POLICY "Owners and admins can update knowledge base"
  ON public.knowledge_base
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Owners and admins can delete knowledge base" ON public.knowledge_base;
CREATE POLICY "Owners and admins can delete knowledge base"
  ON public.knowledge_base
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

UPDATE public.lotericas
SET raw_data =
  jsonb_set(
    COALESCE(raw_data, '{}'::jsonb) - 'SIM CARD 4G',
    '{CIRCUITO BACKUP}',
    to_jsonb(raw_data->>'SIM CARD 4G'),
    true
  )
WHERE raw_data ? 'SIM CARD 4G'
  AND NULLIF(btrim(raw_data->>'SIM CARD 4G'), '') IS NOT NULL
  AND (
    raw_data->>'SIM CARD 4G' ILIKE '%BRISANET%'
    OR operadora ILIKE '%BRISANET%'
    OR raw_data->>'OPERADORA 4G' ILIKE '%BRISANET%'
    OR raw_data->>'RESP BACKUP' ILIKE '%BRISANET%'
  );
