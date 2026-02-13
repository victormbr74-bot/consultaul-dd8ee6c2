
-- Enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_code TEXT,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Lotericas table
CREATE TABLE public.lotericas (
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
ALTER TABLE public.lotericas ENABLE ROW LEVEL SECURITY;

-- History table
CREATE TABLE public.loterica_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_ul TEXT NOT NULL REFERENCES public.lotericas(cod_ul) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  action TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB
);
ALTER TABLE public.loterica_history ENABLE ROW LEVEL SECURITY;

-- Trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger: auto-record history on loterica update
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

CREATE TRIGGER on_loterica_update
  BEFORE UPDATE ON public.lotericas
  FOR EACH ROW
  EXECUTE FUNCTION public.record_loterica_history();

-- RLS Policies

-- Profiles: users read own, admins read all
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR id = auth.uid());

-- User roles: admins manage, users read own
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Lotericas: authenticated can read, authenticated can update
CREATE POLICY "Authenticated can read lotericas" ON public.lotericas
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated can update lotericas" ON public.lotericas
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert lotericas" ON public.lotericas
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can delete lotericas" ON public.lotericas
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- History: authenticated can read
CREATE POLICY "Authenticated can read history" ON public.loterica_history
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "System can insert history" ON public.loterica_history
  FOR INSERT TO authenticated
  WITH CHECK (true);
