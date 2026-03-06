-- Global toggle to allow/block non-admin loterica updates (change requests).

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value_boolean BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_app_settings()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin BOOLEAN := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- Se a tabela de papeis nao existir, ninguem gerencia essa configuracao.
  IF to_regclass('public.user_roles') IS NULL THEN
    RETURN false;
  END IF;

  EXECUTE $sql$
    SELECT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = $1
        AND ur.role::text = 'admin'
    )
  $sql$
  INTO is_admin
  USING auth.uid();

  RETURN COALESCE(is_admin, false);
END;
$$;

DROP POLICY IF EXISTS "Authenticated can read app settings" ON public.app_settings;
CREATE POLICY "Authenticated can read app settings"
  ON public.app_settings
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage app settings" ON public.app_settings;
CREATE POLICY "Admins can manage app settings"
  ON public.app_settings
  FOR ALL TO authenticated
  USING (public.can_manage_app_settings())
  WITH CHECK (public.can_manage_app_settings());

INSERT INTO public.app_settings (key, value_boolean)
VALUES ('loterica_updates_enabled', true)
ON CONFLICT (key) DO NOTHING;

DO $$
BEGIN
  IF to_regclass('public.loterica_change_requests') IS NOT NULL THEN
    EXECUTE $sql$
      DROP POLICY IF EXISTS "Users can create change requests" ON public.loterica_change_requests
    $sql$;

    EXECUTE $sql$
      CREATE POLICY "Users can create change requests"
        ON public.loterica_change_requests
        FOR INSERT TO authenticated
        WITH CHECK (
          proposed_by = auth.uid()
          AND status = 'pending'
          AND COALESCE(
            (
              SELECT s.value_boolean
              FROM public.app_settings s
              WHERE s.key = 'loterica_updates_enabled'
            ),
            true
          )
        )
    $sql$;
  ELSE
    RAISE NOTICE 'Tabela public.loterica_change_requests nao existe; policy de INSERT nao foi criada.';
  END IF;
END;
$$;
