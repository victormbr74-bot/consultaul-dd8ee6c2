-- Compatibility schema for the modules migrated into Consulta UL:
-- - Consulta Massiva GIS
-- - Controle de Reparo
--
-- This migration is intentionally additive/idempotent. It does not rename or
-- drop existing Consulta UL tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'tipo_empresa_enum'
  ) THEN
    CREATE TYPE public.tipo_empresa_enum AS ENUM ('VTAL', 'OEMP');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'tipo_massiva_enum'
  ) THEN
    CREATE TYPE public.tipo_massiva_enum AS ENUM ('PRINCIPAL_VTAL','PRINCIPAL_OEMP','SECUNDARIO_UF','SECUNDARIO_NACIONAL');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'tipo_importacao'
  ) THEN
    CREATE TYPE public.tipo_importacao AS ENUM ('gis1', 'gis2', 'controle_d1', 'jira', 'grafana', 'planta', 'os_reparo');
  END IF;
END;
$$;

DO $$
BEGIN
  -- Consulta UL already owns app_role. Extend it for migrated modules instead
  -- of replacing it. Enum labels are case-sensitive in Postgres.
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'user';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operacao';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'leitura';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ADMIN';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'OPERADOR';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'administrador';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'administrador_master';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'consulta';
EXCEPTION
  WHEN undefined_object THEN
    CREATE TYPE public.app_role AS ENUM (
      'admin',
      'user',
      'operacao',
      'leitura',
      'ADMIN',
      'OPERADOR',
      'administrador',
      'administrador_master',
      'consulta'
    );
END;
$$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nome text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS criado_em timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.profiles
SET
  user_id = COALESCE(user_id, id),
  nome = COALESCE(NULLIF(nome, ''), NULLIF(name, ''), email),
  ativo = COALESCE(ativo, active, true)
WHERE user_id IS NULL
   OR nome IS NULL
   OR ativo IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_unique_idx
  ON public.profiles(user_id)
  WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.compat_role_text(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY
    CASE role::text
      WHEN 'administrador_master' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'ADMIN' THEN 3
      WHEN 'administrador' THEN 4
      WHEN 'operacao' THEN 5
      WHEN 'OPERADOR' THEN 6
      WHEN 'user' THEN 7
      WHEN 'consulta' THEN 8
      ELSE 99
    END
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_admin_master()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role::text IN ('administrador_master', 'admin', 'ADMIN')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_master(_user_id uuid)
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
      AND role::text IN ('administrador_master', 'admin', 'ADMIN')
  )
$$;

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
      AND role::text IN ('administrador_master', 'administrador', 'admin', 'ADMIN')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_write(_user_id uuid)
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
      AND role::text IN ('administrador_master', 'administrador', 'admin', 'ADMIN', 'operacao', 'OPERADOR', 'user')
  )
$$;

CREATE OR REPLACE FUNCTION public.compat_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.operadoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_loterica text NOT NULL DEFAULT '',
  designacao text NOT NULL DEFAULT '',
  ip_loopback text NOT NULL DEFAULT '',
  ip_loopback_secundario text NOT NULL DEFAULT '',
  operadora text NOT NULL,
  operadora_4g text NOT NULL DEFAULT '',
  tipo_empresa public.tipo_empresa_enum NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operadoras ADD COLUMN IF NOT EXISTS codigo_loterica text NOT NULL DEFAULT '';
ALTER TABLE public.operadoras ADD COLUMN IF NOT EXISTS operadora_4g text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_operadoras_codigo_loterica ON public.operadoras(codigo_loterica) WHERE codigo_loterica <> '';
CREATE INDEX IF NOT EXISTS idx_operadoras_designacao ON public.operadoras(designacao) WHERE designacao <> '';
CREATE INDEX IF NOT EXISTS idx_operadoras_loopback ON public.operadoras(ip_loopback) WHERE ip_loopback <> '';
CREATE INDEX IF NOT EXISTS idx_operadoras_loopback_sec ON public.operadoras(ip_loopback_secundario) WHERE ip_loopback_secundario <> '';

DROP TRIGGER IF EXISTS trg_operadoras_updated ON public.operadoras;
CREATE TRIGGER trg_operadoras_updated
  BEFORE UPDATE ON public.operadoras
  FOR EACH ROW EXECUTE FUNCTION public.compat_set_updated_at();

CREATE TABLE IF NOT EXISTS public.escalonamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operadora text NOT NULL UNIQUE,
  n1_nome text DEFAULT '',
  n1_telefone text DEFAULT '',
  n1_email text DEFAULT '',
  n2_nome text DEFAULT '',
  n2_telefone text DEFAULT '',
  n2_email text DEFAULT '',
  n3_nome text DEFAULT '',
  n3_telefone text DEFAULT '',
  n3_email text DEFAULT '',
  n4_nome text DEFAULT '',
  n4_telefone text DEFAULT '',
  n4_email text DEFAULT '',
  observacao text DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_escalonamentos_updated ON public.escalonamentos;
CREATE TRIGGER trg_escalonamentos_updated
  BEFORE UPDATE ON public.escalonamentos
  FOR EACH ROW EXECUTE FUNCTION public.compat_set_updated_at();

CREATE TABLE IF NOT EXISTS public.analises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  total_registros integer NOT NULL DEFAULT 0,
  qtd_principal_vtal integer NOT NULL DEFAULT 0,
  qtd_principal_oemp integer NOT NULL DEFAULT 0,
  qtd_secundario_uf integer NOT NULL DEFAULT 0,
  qtd_secundario_nacional integer NOT NULL DEFAULT 0,
  circuitos_impactados integer NOT NULL DEFAULT 0,
  ufs_impactadas integer NOT NULL DEFAULT 0,
  arquivo_1link text,
  arquivo_2links text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.massivas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analise_id uuid REFERENCES public.analises(id) ON DELETE CASCADE,
  id_massiva text NOT NULL,
  tipo_massiva public.tipo_massiva_enum NOT NULL,
  operadora text NOT NULL DEFAULT '',
  uf text NOT NULL DEFAULT '',
  qtd_circuitos integer NOT NULL,
  primeiro_alarme timestamptz,
  ultimo_alarme timestamptz,
  status text NOT NULL DEFAULT 'MASSIVA',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.massivas ADD COLUMN IF NOT EXISTS qtd_lotericas_isoladas integer NOT NULL DEFAULT 0;
ALTER TABLE public.massivas ADD COLUMN IF NOT EXISTS cidade_epicentro text;
ALTER TABLE public.massivas ADD COLUMN IF NOT EXISTS uf_epicentro text;
ALTER TABLE public.massivas ADD COLUMN IF NOT EXISTS sinalizacao_60km text;
ALTER TABLE public.massivas ADD COLUMN IF NOT EXISTS raio_maximo_km numeric;
ALTER TABLE public.massivas ADD COLUMN IF NOT EXISTS mascara_texto text;
ALTER TABLE public.massivas ADD COLUMN IF NOT EXISTS circuito_pai text;
ALTER TABLE public.massivas ADD COLUMN IF NOT EXISTS consorcio_ul text NOT NULL DEFAULT 'CONSÓRCIO';
ALTER TABLE public.massivas ADD COLUMN IF NOT EXISTS tipo_link text;
ALTER TABLE public.massivas ADD COLUMN IF NOT EXISTS chamado text;
ALTER TABLE public.massivas ADD COLUMN IF NOT EXISTS inc text;
ALTER TABLE public.massivas ADD COLUMN IF NOT EXISTS data_hora_abertura timestamptz;
ALTER TABLE public.massivas ADD COLUMN IF NOT EXISTS data_hora_normalizacao timestamptz;
ALTER TABLE public.massivas ADD COLUMN IF NOT EXISTS atualizacao text;
CREATE INDEX IF NOT EXISTS idx_massivas_analise ON public.massivas(analise_id);
CREATE INDEX IF NOT EXISTS idx_massivas_status_created ON public.massivas(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_massivas_abertura ON public.massivas(data_hora_abertura DESC);

CREATE TABLE IF NOT EXISTS public.massiva_circuitos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  massiva_id uuid NOT NULL REFERENCES public.massivas(id) ON DELETE CASCADE,
  codigo_loterica text,
  loterica text,
  tipo_link text,
  cidade text,
  uf text,
  telefone text,
  designacao text,
  ip_loopback text,
  data_hora timestamptz,
  empresa text,
  mensagem text,
  alarme_id text,
  regional text,
  tecnologia text,
  operadora text,
  tipo_empresa text,
  status text
);
CREATE INDEX IF NOT EXISTS idx_massiva_circ_massiva ON public.massiva_circuitos(massiva_id);

CREATE TABLE IF NOT EXISTS public.auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  acao text NOT NULL,
  entidade text,
  detalhes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auditoria_created ON public.auditoria(created_at DESC);

CREATE TABLE IF NOT EXISTS public.base_cidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cidade text NOT NULL,
  uf text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  cidade_normalizada text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS base_cidades_cidade_uf_uniq
  ON public.base_cidades (cidade_normalizada, uf);
CREATE INDEX IF NOT EXISTS base_cidades_uf_idx ON public.base_cidades (uf);
CREATE INDEX IF NOT EXISTS base_cidades_cidade_norm_idx ON public.base_cidades (cidade_normalizada);

DROP TRIGGER IF EXISTS base_cidades_set_updated ON public.base_cidades;
CREATE TRIGGER base_cidades_set_updated
  BEFORE UPDATE ON public.base_cidades
  FOR EACH ROW EXECUTE FUNCTION public.compat_set_updated_at();

CREATE TABLE IF NOT EXISTS public.importacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo text NOT NULL,
  tipo public.tipo_importacao NOT NULL,
  usuario_id uuid REFERENCES auth.users(id),
  usuario_nome text,
  data_importacao timestamptz NOT NULL DEFAULT now(),
  registros integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'carregado'
);

ALTER TABLE public.importacoes ADD COLUMN IF NOT EXISTS arquivo text;
ALTER TABLE public.importacoes ADD COLUMN IF NOT EXISTS tipo public.tipo_importacao;
ALTER TABLE public.importacoes ADD COLUMN IF NOT EXISTS usuario_id uuid REFERENCES auth.users(id);
ALTER TABLE public.importacoes ADD COLUMN IF NOT EXISTS usuario_nome text;
ALTER TABLE public.importacoes ADD COLUMN IF NOT EXISTS data_importacao timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.importacoes ADD COLUMN IF NOT EXISTS registros integer NOT NULL DEFAULT 0;
ALTER TABLE public.importacoes ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'carregado';

CREATE TABLE IF NOT EXISTS public.staging_bases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.tipo_importacao NOT NULL,
  importacao_id uuid REFERENCES public.importacoes(id) ON DELETE CASCADE,
  linhas jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staging_bases ADD COLUMN IF NOT EXISTS tipo public.tipo_importacao;
ALTER TABLE public.staging_bases ADD COLUMN IF NOT EXISTS importacao_id uuid REFERENCES public.importacoes(id) ON DELETE CASCADE;
ALTER TABLE public.staging_bases ADD COLUMN IF NOT EXISTS linhas jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.staging_bases ADD COLUMN IF NOT EXISTS criado_em timestamptz NOT NULL DEFAULT now();

DO $$
DECLARE
  target_table text;
  item record;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['importacoes', 'staging_bases']
  LOOP
    FOR item IN
      SELECT c.conname
      FROM pg_constraint c
      WHERE c.conrelid = format('public.%I', target_table)::regclass
        AND c.contype = 'u'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', target_table, item.conname);
    END LOOP;

    FOR item IN
      SELECT i.indexrelid::regclass AS index_name
      FROM pg_index i
      WHERE i.indrelid = format('public.%I', target_table)::regclass
        AND i.indisunique
        AND NOT i.indisprimary
        AND NOT EXISTS (
          SELECT 1 FROM pg_constraint c WHERE c.conindid = i.indexrelid
        )
    LOOP
      EXECUTE format('DROP INDEX IF EXISTS %s', item.index_name);
    END LOOP;
  END LOOP;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_importacoes_tipo_data
  ON public.importacoes (tipo, data_importacao DESC);
CREATE INDEX IF NOT EXISTS idx_staging_bases_tipo_criado
  ON public.staging_bases (tipo, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_staging_bases_importacao
  ON public.staging_bases (importacao_id);

CREATE TABLE IF NOT EXISTS public.controle_diario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_referencia date NOT NULL,
  codigo_loterica text NOT NULL,
  loterica text,
  tipo_link text,
  uf text,
  cidade text,
  designacao text,
  ip_loopback text,
  data_hora_inicial timestamptz,
  duracao_h numeric,
  chamado text,
  previsao_atendimento timestamptz,
  ultimo_comentario text,
  grafana text,
  empresa text,
  designacao_parceiro text,
  fila_jira text,
  inc_snow text,
  incidente_mam text,
  ordem text,
  novo_circuito text,
  situacao text,
  status_planilha text,
  status_jira text,
  obs text,
  responsavel text,
  status_zabbix text,
  status_normalizacao text NOT NULL DEFAULT 'ATIVO',
  normalizado_em timestamptz,
  pendente_enriquecimento boolean NOT NULL DEFAULT false,
  tem_os_reparo boolean NOT NULL DEFAULT false,
  chave text,
  versao integer NOT NULL DEFAULT 1,
  responsavel_backup text,
  responsavel_chip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS data_referencia date;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS codigo_loterica text;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS loterica text;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS tipo_link text;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS uf text;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS cidade text;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS designacao text;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS ip_loopback text;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS data_hora_inicial timestamptz;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS duracao_h numeric;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS chamado text;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS previsao_atendimento timestamptz;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS ultimo_comentario text;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS grafana text;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS empresa text;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS designacao_parceiro text;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS fila_jira text;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS inc_snow text;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS incidente_mam text;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS ordem text;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS novo_circuito text;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS situacao text;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS status_planilha text;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS status_jira text;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS obs text;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS responsavel text;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS status_zabbix text;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS status_normalizacao text NOT NULL DEFAULT 'ATIVO';
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS normalizado_em timestamptz;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS pendente_enriquecimento boolean NOT NULL DEFAULT false;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS tem_os_reparo boolean NOT NULL DEFAULT false;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS chave text;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 1;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS responsavel_backup text;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS responsavel_chip text;
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.controle_diario ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.controle_diario ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.controle_diario ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.controle_diario ALTER COLUMN updated_at SET DEFAULT now();

UPDATE public.controle_diario
SET
  id = COALESCE(id, gen_random_uuid()),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now())
WHERE id IS NULL OR created_at IS NULL OR updated_at IS NULL;

ALTER TABLE public.controle_diario ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.controle_diario ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.controle_diario ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_controle_data ON public.controle_diario (data_referencia);
CREATE INDEX IF NOT EXISTS idx_controle_codigo ON public.controle_diario (codigo_loterica);
CREATE INDEX IF NOT EXISTS idx_controle_chave ON public.controle_diario (chave);
CREATE INDEX IF NOT EXISTS idx_controle_data_versao ON public.controle_diario (data_referencia, versao);

ALTER TABLE public.controle_diario
  DROP CONSTRAINT IF EXISTS controle_diario_data_referencia_codigo_loterica_key;
ALTER TABLE public.controle_diario
  DROP CONSTRAINT IF EXISTS controle_diario_data_chave_key;
ALTER TABLE public.controle_diario
  DROP CONSTRAINT IF EXISTS controle_diario_data_chave_versao_key;

DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.controle_diario'::regclass
      AND c.contype = 'u'
      AND EXISTS (
        SELECT 1
        FROM unnest(c.conkey) k
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
        WHERE a.attname = 'data_referencia'
      )
      AND EXISTS (
        SELECT 1
        FROM unnest(c.conkey) k
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
        WHERE a.attname = 'chave'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(c.conkey) k
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
        WHERE a.attname = 'versao'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.controle_diario DROP CONSTRAINT IF EXISTS %I', item.conname);
  END LOOP;

  FOR item IN
    SELECT i.indexrelid::regclass AS index_name
    FROM pg_index i
    WHERE i.indrelid = 'public.controle_diario'::regclass
      AND i.indisunique
      AND NOT i.indisprimary
      AND NOT EXISTS (
        SELECT 1 FROM pg_constraint c WHERE c.conindid = i.indexrelid
      )
      AND EXISTS (
        SELECT 1
        FROM unnest(i.indkey) k
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k
        WHERE a.attname = 'data_referencia'
      )
      AND EXISTS (
        SELECT 1
        FROM unnest(i.indkey) k
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k
        WHERE a.attname = 'chave'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(i.indkey) k
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k
        WHERE a.attname = 'versao'
      )
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %s', item.index_name);
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'controle_diario_data_chave_versao_key'
      AND conrelid = 'public.controle_diario'::regclass
  ) THEN
    ALTER TABLE public.controle_diario
      ADD CONSTRAINT controle_diario_data_chave_versao_key UNIQUE (data_referencia, chave, versao);
  END IF;
EXCEPTION
  WHEN duplicate_table OR duplicate_object THEN
    NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_controle_updated ON public.controle_diario;
CREATE TRIGGER trg_controle_updated
  BEFORE UPDATE ON public.controle_diario
  FOR EACH ROW EXECUTE FUNCTION public.compat_set_updated_at();

CREATE TABLE IF NOT EXISTS public.historico_tratativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  controle_id uuid REFERENCES public.controle_diario(id) ON DELETE SET NULL,
  codigo_loterica text NOT NULL,
  usuario text,
  campo text NOT NULL,
  valor_anterior text,
  valor_novo text,
  data_hora timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid DEFAULT auth.uid()
);
ALTER TABLE public.historico_tratativas ADD COLUMN IF NOT EXISTS controle_id uuid REFERENCES public.controle_diario(id) ON DELETE SET NULL;
ALTER TABLE public.historico_tratativas ADD COLUMN IF NOT EXISTS codigo_loterica text;
ALTER TABLE public.historico_tratativas ADD COLUMN IF NOT EXISTS usuario text;
ALTER TABLE public.historico_tratativas ADD COLUMN IF NOT EXISTS campo text;
ALTER TABLE public.historico_tratativas ADD COLUMN IF NOT EXISTS valor_anterior text;
ALTER TABLE public.historico_tratativas ADD COLUMN IF NOT EXISTS valor_novo text;
ALTER TABLE public.historico_tratativas ADD COLUMN IF NOT EXISTS data_hora timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.historico_tratativas ADD COLUMN IF NOT EXISTS recorded_by uuid DEFAULT auth.uid();
CREATE INDEX IF NOT EXISTS idx_hist_codigo ON public.historico_tratativas (codigo_loterica);

CREATE TABLE IF NOT EXISTS public.implantacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_loterica text NOT NULL,
  loterica text,
  status_censitec text,
  analise_tipo text,
  parceira text,
  fase text,
  evento text,
  data_atualizacao timestamptz,
  novo_circuito text,
  nova_designacao text,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (codigo_loterica)
);

ALTER TABLE public.implantacoes ADD COLUMN IF NOT EXISTS codigo_loterica text;
ALTER TABLE public.implantacoes ADD COLUMN IF NOT EXISTS loterica text;
ALTER TABLE public.implantacoes ADD COLUMN IF NOT EXISTS status_censitec text;
ALTER TABLE public.implantacoes ADD COLUMN IF NOT EXISTS analise_tipo text;
ALTER TABLE public.implantacoes ADD COLUMN IF NOT EXISTS parceira text;
ALTER TABLE public.implantacoes ADD COLUMN IF NOT EXISTS fase text;
ALTER TABLE public.implantacoes ADD COLUMN IF NOT EXISTS evento text;
ALTER TABLE public.implantacoes ADD COLUMN IF NOT EXISTS data_atualizacao timestamptz;
ALTER TABLE public.implantacoes ADD COLUMN IF NOT EXISTS novo_circuito text;
ALTER TABLE public.implantacoes ADD COLUMN IF NOT EXISTS nova_designacao text;
ALTER TABLE public.implantacoes ADD COLUMN IF NOT EXISTS atualizado_em timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'implantacoes_codigo_loterica_key'
      AND conrelid = 'public.implantacoes'::regclass
  ) THEN
    ALTER TABLE public.implantacoes
      ADD CONSTRAINT implantacoes_codigo_loterica_key UNIQUE (codigo_loterica);
  END IF;
EXCEPTION
  WHEN duplicate_table OR duplicate_object THEN
    NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_app_role(
  _target_user_id uuid,
  _role public.app_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin(v_actor) THEN
    RAISE EXCEPTION 'sem permissao para alterar perfis';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _target_user_id) THEN
    RAISE EXCEPTION 'usuario nao encontrado';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = _target_user_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_target_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.compat_role_text(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin_master() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_master(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_user_app_role(uuid, public.app_role) TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operadoras TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.escalonamentos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analises TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.massivas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.massiva_circuitos TO authenticated;
GRANT SELECT, INSERT ON public.auditoria TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.base_cidades TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.importacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staging_bases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.controle_diario TO authenticated;
GRANT SELECT, INSERT ON public.historico_tratativas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.implantacoes TO authenticated;

ALTER TABLE public.operadoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalonamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.massivas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.massiva_circuitos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_cidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staging_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controle_diario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_tratativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implantacoes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT *
    FROM (VALUES
      ('operadoras', 'compat_operadoras_read', 'SELECT', 'true', NULL),
      ('operadoras', 'compat_operadoras_write', 'ALL', 'public.is_admin(auth.uid())', 'public.is_admin(auth.uid())'),
      ('escalonamentos', 'compat_escalonamentos_read', 'SELECT', 'true', NULL),
      ('escalonamentos', 'compat_escalonamentos_write', 'ALL', 'public.is_admin(auth.uid())', 'public.is_admin(auth.uid())'),
      ('analises', 'compat_analises_all', 'ALL', 'auth.uid() IS NOT NULL', 'auth.uid() IS NOT NULL'),
      ('massivas', 'compat_massivas_all', 'ALL', 'auth.uid() IS NOT NULL', 'auth.uid() IS NOT NULL'),
      ('massiva_circuitos', 'compat_massiva_circuitos_all', 'ALL', 'auth.uid() IS NOT NULL', 'auth.uid() IS NOT NULL'),
      ('auditoria', 'compat_auditoria_insert', 'INSERT', NULL, 'auth.uid() IS NOT NULL'),
      ('auditoria', 'compat_auditoria_read_admin', 'SELECT', 'public.is_admin(auth.uid())', NULL),
      ('base_cidades', 'compat_base_cidades_read', 'SELECT', 'true', NULL),
      ('base_cidades', 'compat_base_cidades_write', 'ALL', 'public.is_admin(auth.uid())', 'public.is_admin(auth.uid())'),
      ('importacoes', 'compat_importacoes_read', 'SELECT', 'true', NULL),
      ('importacoes', 'compat_importacoes_write', 'ALL', 'public.can_write(auth.uid())', 'public.can_write(auth.uid())'),
      ('staging_bases', 'compat_staging_read', 'SELECT', 'true', NULL),
      ('staging_bases', 'compat_staging_write', 'ALL', 'public.can_write(auth.uid())', 'public.can_write(auth.uid())'),
      ('controle_diario', 'compat_controle_read', 'SELECT', 'true', NULL),
      ('controle_diario', 'compat_controle_write', 'ALL', 'public.can_write(auth.uid())', 'public.can_write(auth.uid())'),
      ('historico_tratativas', 'compat_historico_read', 'SELECT', 'true', NULL),
      ('historico_tratativas', 'compat_historico_insert', 'INSERT', NULL, 'public.can_write(auth.uid())'),
      ('implantacoes', 'compat_implantacoes_read', 'SELECT', 'true', NULL),
      ('implantacoes', 'compat_implantacoes_write', 'ALL', 'public.can_write(auth.uid())', 'public.can_write(auth.uid())')
    ) AS v(table_name, policy_name, command_name, using_expr, check_expr)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policy_name, r.table_name);

    IF r.command_name = 'INSERT' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',
        r.policy_name, r.table_name, r.check_expr
      );
    ELSIF r.command_name = 'SELECT' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)',
        r.policy_name, r.table_name, r.using_expr
      );
    ELSIF r.command_name = 'ALL' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
        r.policy_name, r.table_name, r.using_expr, r.check_expr
      );
    END IF;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
