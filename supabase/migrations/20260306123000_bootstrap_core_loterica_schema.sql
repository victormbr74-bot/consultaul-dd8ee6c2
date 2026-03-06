-- Bootstrap core schema for environments that do not have the first migrations.
-- Safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'app_role'
  ) THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_code TEXT,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE TABLE IF NOT EXISTS public.lotericas (
  cod_ul TEXT PRIMARY KEY,
  nome_loterica TEXT,
  ccto_oi TEXT,
  ccto_oemp TEXT,
  operadora TEXT,
  ip_nat TEXT,
  ip_wan TEXT,
  loopback_wan TEXT,
  loopback_lan TEXT,
  endereco TEXT,
  contato TEXT,
  status TEXT,
  cidade TEXT,
  uf TEXT,
  designacao_nova TEXT,
  raw_data JSONB,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.loterica_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_ul TEXT NOT NULL REFERENCES public.lotericas(cod_ul) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  action TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB
);

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

CREATE INDEX IF NOT EXISTS loterica_change_requests_cod_ul_idx
  ON public.loterica_change_requests (cod_ul);
CREATE INDEX IF NOT EXISTS loterica_change_requests_status_idx
  ON public.loterica_change_requests (status);
CREATE INDEX IF NOT EXISTS loterica_change_requests_proposed_by_idx
  ON public.loterica_change_requests (proposed_by);
CREATE INDEX IF NOT EXISTS loterica_change_requests_proposed_at_idx
  ON public.loterica_change_requests (proposed_at DESC);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_loterica_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.loterica_history (cod_ul, changed_by, action, before_data, after_data)
  VALUES (NEW.cod_ul, NEW.updated_by, TG_OP, to_jsonb(OLD), to_jsonb(NEW));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_loterica_update ON public.lotericas;
CREATE TRIGGER on_loterica_update
  BEFORE UPDATE ON public.lotericas
  FOR EACH ROW
  EXECUTE FUNCTION public.record_loterica_history();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotericas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loterica_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loterica_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR id = auth.uid());

DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can read lotericas" ON public.lotericas;
CREATE POLICY "Authenticated can read lotericas" ON public.lotericas
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can update lotericas" ON public.lotericas;
CREATE POLICY "Admins can update lotericas" ON public.lotericas
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can insert lotericas" ON public.lotericas;
CREATE POLICY "Authenticated can insert lotericas" ON public.lotericas
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can delete lotericas" ON public.lotericas;
CREATE POLICY "Admins can delete lotericas" ON public.lotericas
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can read history" ON public.loterica_history;
CREATE POLICY "Authenticated can read history" ON public.loterica_history
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "System can insert history" ON public.loterica_history;
CREATE POLICY "System can insert history" ON public.loterica_history
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can create change requests" ON public.loterica_change_requests;
CREATE POLICY "Users can create change requests" ON public.loterica_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (proposed_by = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "Users can read own change requests" ON public.loterica_change_requests;
CREATE POLICY "Users can read own change requests" ON public.loterica_change_requests
  FOR SELECT TO authenticated
  USING (proposed_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update change requests" ON public.loterica_change_requests;
CREATE POLICY "Admins can update change requests" ON public.loterica_change_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete change requests" ON public.loterica_change_requests;
CREATE POLICY "Admins can delete change requests" ON public.loterica_change_requests
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
