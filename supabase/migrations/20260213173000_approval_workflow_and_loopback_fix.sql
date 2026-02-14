-- Change requests (approval workflow) + loopback_lan bugfix

-- 1) Table to store pending changes proposed by users
CREATE TABLE IF NOT EXISTS public.loterica_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_ul TEXT NOT NULL REFERENCES public.lotericas(cod_ul) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  proposed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proposed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  before_data JSONB,
  after_data JSONB
);

ALTER TABLE public.loterica_change_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS loterica_change_requests_cod_ul_idx
  ON public.loterica_change_requests (cod_ul);
CREATE INDEX IF NOT EXISTS loterica_change_requests_status_idx
  ON public.loterica_change_requests (status);
CREATE INDEX IF NOT EXISTS loterica_change_requests_proposed_by_idx
  ON public.loterica_change_requests (proposed_by);
CREATE INDEX IF NOT EXISTS loterica_change_requests_proposed_at_idx
  ON public.loterica_change_requests (proposed_at DESC);

-- RLS policies
DROP POLICY IF EXISTS "Users can create change requests" ON public.loterica_change_requests;
CREATE POLICY "Users can create change requests"
  ON public.loterica_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (proposed_by = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "Users can read own change requests" ON public.loterica_change_requests;
CREATE POLICY "Users can read own change requests"
  ON public.loterica_change_requests
  FOR SELECT TO authenticated
  USING (proposed_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update change requests" ON public.loterica_change_requests;
CREATE POLICY "Admins can update change requests"
  ON public.loterica_change_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete change requests" ON public.loterica_change_requests;
CREATE POLICY "Admins can delete change requests"
  ON public.loterica_change_requests
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) Enforce approval workflow: only admins can update lotericas
DROP POLICY IF EXISTS "Authenticated can update lotericas" ON public.lotericas;
CREATE POLICY "Admins can update lotericas"
  ON public.lotericas
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) Data fix: loopback_lan was incorrectly imported from "REDE LAN"
-- Backfill it from raw_data when possible.
UPDATE public.lotericas
SET loopback_lan = COALESCE(raw_data->>'LOOPBACK SECUNDARIO', raw_data->>'LOOPBACK SECUNDÁRIO', loopback_lan)
WHERE (raw_data ? 'LOOPBACK SECUNDARIO' OR raw_data ? 'LOOPBACK SECUNDÁRIO')
  AND (
    loopback_lan IS NULL
    OR loopback_lan = ''
    OR loopback_lan = (raw_data->>'REDE LAN')
  );

