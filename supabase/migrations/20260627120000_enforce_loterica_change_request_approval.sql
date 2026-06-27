-- Enforce the loterica edit approval workflow using only the active roles:
-- admin and user.
-- Non-admin users may only create pending change requests; only admins can
-- read/review all requests and apply updates to public.lotericas.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_last_seen_at_idx
  ON public.profiles(last_seen_at DESC)
  WHERE last_seen_at IS NOT NULL;

DELETE FROM public.user_roles ur
WHERE ur.role::text IN ('administrador_master', 'administrador', 'ADMIN')
  AND EXISTS (
    SELECT 1
    FROM public.user_roles existing
    WHERE existing.user_id = ur.user_id
      AND existing.role::text = 'admin'
  );

UPDATE public.user_roles
SET role = 'admin'::public.app_role
WHERE role::text IN ('administrador_master', 'administrador', 'ADMIN');

DELETE FROM public.user_roles ur
WHERE ur.role::text NOT IN ('admin', 'user')
  AND EXISTS (
    SELECT 1
    FROM public.user_roles existing
    WHERE existing.user_id = ur.user_id
      AND existing.role::text = 'user'
  );

UPDATE public.user_roles
SET role = 'user'::public.app_role
WHERE role::text NOT IN ('admin', 'user');

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_app_settings()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.is_admin(auth.uid()), false)
$$;

DROP POLICY IF EXISTS "Authenticated can update lotericas" ON public.lotericas;
DROP POLICY IF EXISTS "Temporary anon can update lotericas until 2026-02-27" ON public.lotericas;
DROP POLICY IF EXISTS "Admins can update lotericas" ON public.lotericas;
CREATE POLICY "Admins can update lotericas"
  ON public.lotericas
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can read own change requests" ON public.loterica_change_requests;
CREATE POLICY "Users can read own change requests"
  ON public.loterica_change_requests
  FOR SELECT TO authenticated
  USING (proposed_by = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update change requests" ON public.loterica_change_requests;
CREATE POLICY "Admins can update change requests"
  ON public.loterica_change_requests
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete change requests" ON public.loterica_change_requests;
CREATE POLICY "Admins can delete change requests"
  ON public.loterica_change_requests
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can create change requests" ON public.loterica_change_requests;
CREATE POLICY "Users can create change requests"
  ON public.loterica_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    proposed_by = auth.uid()
    AND status = 'pending'
    AND NOT public.is_admin(auth.uid())
    AND COALESCE(
      (
        SELECT s.value_boolean
        FROM public.app_settings s
        WHERE s.key = 'loterica_updates_enabled'
      ),
      true
    )
  );

DROP POLICY IF EXISTS "Admins can manage app settings" ON public.app_settings;
CREATE POLICY "Admins can manage app settings"
  ON public.app_settings
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
