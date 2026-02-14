
-- Fix: restrict UPDATE on lotericas to admins only
DROP POLICY IF EXISTS "Authenticated can update lotericas" ON public.lotericas;

CREATE POLICY "Admins can update lotericas"
ON public.lotericas
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
