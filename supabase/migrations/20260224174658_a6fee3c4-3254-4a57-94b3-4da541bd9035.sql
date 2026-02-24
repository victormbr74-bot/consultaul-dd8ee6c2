
-- Fix #1: Restrict loterica_history to admins only
DROP POLICY IF EXISTS "Authenticated can read history" ON public.loterica_history;

CREATE POLICY "Admins can read history"
ON public.loterica_history
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
