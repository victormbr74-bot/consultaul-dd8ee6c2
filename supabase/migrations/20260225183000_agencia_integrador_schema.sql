-- Agencia Integrador module schema (imported from conex-o-gil) adapted for loteria-vision-hub.
-- Idempotent migration: preserves existing lotericas logic and extends auth/profile schema for compatibility.

-- 1) Roles compatibility: keep legacy values and add Integrador values.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operacao';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'leitura';

-- 2) Profiles compatibility (loteria-vision-hub uses id/name/user_code/active; integrador expects user_id/full_name/...).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS employee_id text,
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS is_active boolean;

UPDATE public.profiles p
SET
  user_id = COALESCE(p.user_id, p.id),
  full_name = COALESCE(NULLIF(p.full_name, ''), NULLIF(p.name, '')),
  name = COALESCE(NULLIF(p.name, ''), NULLIF(p.full_name, ''), COALESCE(u.email, 'Usuário')),
  employee_id = COALESCE(NULLIF(p.employee_id, ''), NULLIF(p.user_code, '')),
  username = COALESCE(NULLIF(p.username, ''), NULLIF(p.user_code, ''), NULLIF(split_part(COALESCE(u.email, ''), '@', 1), '')),
  email = COALESCE(NULLIF(p.email, ''), u.email),
  is_active = COALESCE(p.is_active, p.active, true),
  active = COALESCE(p.active, p.is_active, true)
FROM auth.users u
WHERE u.id = p.id;

ALTER TABLE public.profiles
  ALTER COLUMN user_id SET DEFAULT NULL,
  ALTER COLUMN is_active SET DEFAULT true;

UPDATE public.profiles
SET is_active = COALESCE(is_active, true)
WHERE is_active IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_key ON public.profiles(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_key ON public.profiles(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_full_name_idx ON public.profiles(full_name);
CREATE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles(username);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_user_id_fkey'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

-- 3) Ensure signup trigger populates both legacy and integrador profile fields.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_user_code text;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', NEW.email, 'Usuário');
  v_user_code := NULLIF(
    COALESCE(
      NEW.raw_user_meta_data->>'user_code',
      NEW.raw_user_meta_data->>'employee_id',
      split_part(COALESCE(NEW.email, ''), '@', 1)
    ),
    ''
  );

  INSERT INTO public.profiles (
    id,
    user_id,
    user_code,
    name,
    active,
    full_name,
    employee_id,
    username,
    email,
    is_active
  )
  VALUES (
    NEW.id,
    NEW.id,
    v_user_code,
    v_name,
    true,
    v_name,
    v_user_code,
    v_user_code,
    NEW.email,
    true
  )
  ON CONFLICT (id) DO UPDATE
  SET
    user_id = COALESCE(public.profiles.user_id, EXCLUDED.user_id),
    user_code = COALESCE(NULLIF(public.profiles.user_code, ''), EXCLUDED.user_code),
    name = COALESCE(NULLIF(public.profiles.name, ''), EXCLUDED.name),
    active = COALESCE(public.profiles.active, true),
    full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
    employee_id = COALESCE(NULLIF(public.profiles.employee_id, ''), EXCLUDED.employee_id),
    username = COALESCE(NULLIF(public.profiles.username, ''), EXCLUDED.username),
    email = COALESCE(NULLIF(public.profiles.email, ''), EXCLUDED.email),
    is_active = COALESCE(public.profiles.is_active, true);

  -- Keep legacy default role for lotericas admin panel compatibility.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 4) Helper functions used by Integrador data import/management.
CREATE OR REPLACE FUNCTION public.can_manage_app_data(_user_id uuid)
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
      AND role::text IN ('admin', 'operacao')
  );
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 5) Integrador imported-data tables.
CREATE TABLE IF NOT EXISTS public.agencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_logico_ponto text NOT NULL DEFAULT '',
  nome_ponto text NOT NULL DEFAULT '',
  nome_rede text NOT NULL DEFAULT '',
  unidade text NOT NULL DEFAULT '',
  tipo_ponto text NOT NULL DEFAULT '',
  velocidade text NOT NULL DEFAULT '',
  velocidade_real_solicitada text NOT NULL DEFAULT '',
  tecnologia text NOT NULL DEFAULT '',
  degrau text NOT NULL DEFAULT '',
  cgc_unidade text NOT NULL DEFAULT '',
  cep text NOT NULL DEFAULT '',
  logradouro text NOT NULL DEFAULT '',
  endereco text NOT NULL DEFAULT '',
  numero text NOT NULL DEFAULT '',
  complemento text NOT NULL DEFAULT '',
  bairro text NOT NULL DEFAULT '',
  cidade text NOT NULL DEFAULT '',
  uf text NOT NULL DEFAULT '',
  provedor_final text NOT NULL DEFAULT '',
  tipo_atendimento text NOT NULL DEFAULT '',
  ip_lan text NOT NULL DEFAULT '',
  ip_wan text NOT NULL DEFAULT '',
  designacao_circuito text NOT NULL DEFAULT '',
  cpe1 text NOT NULL DEFAULT '',
  edd_cpe2 text NOT NULL DEFAULT '',
  ip_wan_edd_cpe2 text NOT NULL DEFAULT '',
  visao_felix text NOT NULL DEFAULT '',
  visao_freiria text NOT NULL DEFAULT '',
  faturamento text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.incidentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circuito text NOT NULL DEFAULT '',
  chamado text NOT NULL DEFAULT '',
  req text NOT NULL DEFAULT '',
  uf text NOT NULL DEFAULT '',
  data_hora_abertura timestamptz NOT NULL DEFAULT now(),
  data_hora_atualizacao timestamptz NOT NULL DEFAULT now(),
  oemp text NOT NULL DEFAULT '',
  rede text NOT NULL DEFAULT '',
  agencia_nome text NOT NULL DEFAULT '',
  ponto_codigo text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'EM ANDAMENTO',
  reclamacao text NOT NULL DEFAULT '',
  massiva boolean NOT NULL DEFAULT false,
  vulto text NOT NULL DEFAULT '',
  isolado text NOT NULL DEFAULT '',
  descricao_falha text NOT NULL DEFAULT '',
  causa text NOT NULL DEFAULT '',
  normalizacao_data_hora timestamptz,
  tipo_solicitacao text NOT NULL DEFAULT '',
  sla text NOT NULL DEFAULT '',
  tipo_ponto text NOT NULL DEFAULT '',
  tipo_circuito text NOT NULL DEFAULT '',
  contrato text NOT NULL DEFAULT '',
  gitec text NOT NULL DEFAULT '',
  protocolo_portal text NOT NULL DEFAULT '',
  descricao_inicial text NOT NULL DEFAULT '',
  tempo_total text NOT NULL DEFAULT '',
  causa_raiz text NOT NULL DEFAULT '',
  normalizacao_data_hora_fechamento timestamptz,
  periodo_ultima_atualizacao text NOT NULL DEFAULT '',
  ultimo_comentario text NOT NULL DEFAULT '',
  responsavel_portal text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.parceiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_operadora text NOT NULL DEFAULT '',
  contato text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  telefone text NOT NULL DEFAULT '',
  observacoes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.topologia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uf_regiao text NOT NULL DEFAULT '',
  concentrador text NOT NULL DEFAULT '',
  ip text NOT NULL DEFAULT '',
  descricao text NOT NULL DEFAULT '',
  comandos text NOT NULL DEFAULT '',
  vlan text NOT NULL DEFAULT '',
  wan1 text NOT NULL DEFAULT '',
  wan2 text NOT NULL DEFAULT '',
  lan text NOT NULL DEFAULT '',
  observacoes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cod_encerramento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL DEFAULT '',
  n1 text NOT NULL DEFAULT '',
  n2 text NOT NULL DEFAULT '',
  n3 text NOT NULL DEFAULT '',
  quando_utilizar text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meus_casos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incidente_chamado text NOT NULL DEFAULT '',
  usuario_nome text NOT NULL DEFAULT '',
  status_caso text NOT NULL DEFAULT 'Acompanhando',
  notas text[] NOT NULL DEFAULT '{}'::text[],
  criado_em timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meus_casos_status_check CHECK (status_caso IN ('Acompanhando', 'Atualizado', 'Encerrado'))
);

CREATE TABLE IF NOT EXISTS public.import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT '',
  registros integer NOT NULL DEFAULT 0,
  arquivo text NOT NULL DEFAULT '',
  data_hora timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.incidentes
  ADD COLUMN IF NOT EXISTS responsavel_portal text NOT NULL DEFAULT '';

-- 6) Indexes
CREATE INDEX IF NOT EXISTS agencias_nome_logico_ponto_idx ON public.agencias(nome_logico_ponto);
CREATE INDEX IF NOT EXISTS agencias_nome_ponto_idx ON public.agencias(nome_ponto);
CREATE INDEX IF NOT EXISTS incidentes_ponto_codigo_idx ON public.incidentes(ponto_codigo);
CREATE INDEX IF NOT EXISTS incidentes_chamado_idx ON public.incidentes(chamado);
CREATE INDEX IF NOT EXISTS incidentes_status_idx ON public.incidentes(status);
CREATE INDEX IF NOT EXISTS incidentes_responsavel_portal_idx ON public.incidentes(responsavel_portal);
CREATE INDEX IF NOT EXISTS meus_casos_usuario_nome_idx ON public.meus_casos(usuario_nome);
CREATE INDEX IF NOT EXISTS meus_casos_incidente_chamado_idx ON public.meus_casos(incidente_chamado);

-- 7) Update triggers
DROP TRIGGER IF EXISTS set_agencias_updated_at ON public.agencias;
CREATE TRIGGER set_agencias_updated_at
BEFORE UPDATE ON public.agencias
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_incidentes_updated_at ON public.incidentes;
CREATE TRIGGER set_incidentes_updated_at
BEFORE UPDATE ON public.incidentes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_parceiras_updated_at ON public.parceiras;
CREATE TRIGGER set_parceiras_updated_at
BEFORE UPDATE ON public.parceiras
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_topologia_updated_at ON public.topologia;
CREATE TRIGGER set_topologia_updated_at
BEFORE UPDATE ON public.topologia
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_cod_encerramento_updated_at ON public.cod_encerramento;
CREATE TRIGGER set_cod_encerramento_updated_at
BEFORE UPDATE ON public.cod_encerramento
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_meus_casos_updated_at ON public.meus_casos;
CREATE TRIGGER set_meus_casos_updated_at
BEFORE UPDATE ON public.meus_casos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8) Grants + RLS
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_app_data(uuid) TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agencias TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incidentes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parceiras TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topologia TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cod_encerramento TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meus_casos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_logs TO authenticated;

ALTER TABLE public.agencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parceiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topologia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cod_encerramento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meus_casos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read agencias" ON public.agencias;
DROP POLICY IF EXISTS "Ops can manage agencias" ON public.agencias;
CREATE POLICY "Authenticated can read agencias"
ON public.agencias FOR SELECT
USING (auth.uid() IS NOT NULL);
CREATE POLICY "Ops can manage agencias"
ON public.agencias FOR ALL
USING (public.can_manage_app_data(auth.uid()))
WITH CHECK (public.can_manage_app_data(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can read incidentes" ON public.incidentes;
DROP POLICY IF EXISTS "Ops can manage incidentes" ON public.incidentes;
CREATE POLICY "Authenticated can read incidentes"
ON public.incidentes FOR SELECT
USING (auth.uid() IS NOT NULL);
CREATE POLICY "Ops can manage incidentes"
ON public.incidentes FOR ALL
USING (public.can_manage_app_data(auth.uid()))
WITH CHECK (public.can_manage_app_data(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can read parceiras" ON public.parceiras;
DROP POLICY IF EXISTS "Ops can manage parceiras" ON public.parceiras;
CREATE POLICY "Authenticated can read parceiras"
ON public.parceiras FOR SELECT
USING (auth.uid() IS NOT NULL);
CREATE POLICY "Ops can manage parceiras"
ON public.parceiras FOR ALL
USING (public.can_manage_app_data(auth.uid()))
WITH CHECK (public.can_manage_app_data(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can read topologia" ON public.topologia;
DROP POLICY IF EXISTS "Ops can manage topologia" ON public.topologia;
CREATE POLICY "Authenticated can read topologia"
ON public.topologia FOR SELECT
USING (auth.uid() IS NOT NULL);
CREATE POLICY "Ops can manage topologia"
ON public.topologia FOR ALL
USING (public.can_manage_app_data(auth.uid()))
WITH CHECK (public.can_manage_app_data(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can read cod_encerramento" ON public.cod_encerramento;
DROP POLICY IF EXISTS "Ops can manage cod_encerramento" ON public.cod_encerramento;
CREATE POLICY "Authenticated can read cod_encerramento"
ON public.cod_encerramento FOR SELECT
USING (auth.uid() IS NOT NULL);
CREATE POLICY "Ops can manage cod_encerramento"
ON public.cod_encerramento FOR ALL
USING (public.can_manage_app_data(auth.uid()))
WITH CHECK (public.can_manage_app_data(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can read meus_casos" ON public.meus_casos;
DROP POLICY IF EXISTS "Ops can manage meus_casos" ON public.meus_casos;
CREATE POLICY "Authenticated can read meus_casos"
ON public.meus_casos FOR SELECT
USING (auth.uid() IS NOT NULL);
CREATE POLICY "Ops can manage meus_casos"
ON public.meus_casos FOR ALL
USING (public.can_manage_app_data(auth.uid()))
WITH CHECK (public.can_manage_app_data(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can read import_logs" ON public.import_logs;
DROP POLICY IF EXISTS "Ops can manage import_logs" ON public.import_logs;
CREATE POLICY "Authenticated can read import_logs"
ON public.import_logs FOR SELECT
USING (auth.uid() IS NOT NULL);
CREATE POLICY "Ops can manage import_logs"
ON public.import_logs FOR ALL
USING (public.can_manage_app_data(auth.uid()))
WITH CHECK (public.can_manage_app_data(auth.uid()));

