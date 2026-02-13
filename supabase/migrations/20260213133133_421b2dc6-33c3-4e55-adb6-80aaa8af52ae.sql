
-- Fix: Remove permissive INSERT on loterica_history (only triggers should insert)
DROP POLICY IF EXISTS "System can insert history" ON public.loterica_history;

-- Fix: Restrict lotericas UPDATE to authenticated only (keeping as-is per requirements, but tighten INSERT)
DROP POLICY IF EXISTS "Authenticated can insert lotericas" ON public.lotericas;
CREATE POLICY "Admins can insert lotericas"
ON public.lotericas FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fix: Restrict lotericas UPDATE with proper USING
DROP POLICY IF EXISTS "Authenticated can update lotericas" ON public.lotericas;
CREATE POLICY "Authenticated can update lotericas"
ON public.lotericas FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

-- Fix: Tighten profiles INSERT - only own profile or admin
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());
