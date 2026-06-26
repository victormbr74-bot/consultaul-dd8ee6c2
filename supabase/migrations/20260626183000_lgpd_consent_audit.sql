CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.terms_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('terms_of_use', 'privacy_policy')),
  version text NOT NULL,
  content text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE (type, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS terms_versions_one_active_per_type
  ON public.terms_versions(type)
  WHERE active;

CREATE TABLE IF NOT EXISTS public.user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version_id uuid NOT NULL REFERENCES public.terms_versions(id),
  privacy_policy_version_id uuid NOT NULL REFERENCES public.terms_versions(id),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text,
  browser text,
  os text,
  device_type text NOT NULL DEFAULT 'unknown' CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'unknown')),
  UNIQUE (user_id, terms_version_id, privacy_policy_version_id)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name text,
  user_email text,
  action text NOT NULL,
  module text,
  entity text,
  entity_id text,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  browser text,
  os text,
  device_type text NOT NULL DEFAULT 'unknown' CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'unknown')),
  request_method text,
  request_path text,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'denied')),
  message text,
  observation text,
  origin text,
  created_at timestamptz NOT NULL DEFAULT now(),
  integrity_hash text
);

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS observation text;

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS audit_logs_module_idx ON public.audit_logs(module);
CREATE INDEX IF NOT EXISTS audit_logs_status_idx ON public.audit_logs(status);
CREATE INDEX IF NOT EXISTS audit_logs_ip_idx ON public.audit_logs(ip_address);

CREATE OR REPLACE FUNCTION public.audit_redact_jsonb(_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  item record;
  normalized_key text;
BEGIN
  IF _value IS NULL THEN
    RETURN NULL;
  END IF;

  IF jsonb_typeof(_value) <> 'object' THEN
    RETURN _value;
  END IF;

  FOR item IN SELECT key, value FROM jsonb_each(_value)
  LOOP
    normalized_key := lower(item.key);
    IF normalized_key LIKE '%password%'
       OR normalized_key LIKE '%senha%'
       OR normalized_key LIKE '%token%'
       OR normalized_key LIKE '%secret%'
       OR normalized_key LIKE '%authorization%'
       OR normalized_key LIKE '%apikey%' THEN
      result := result || jsonb_build_object(item.key, '[REDACTED]');
    ELSIF jsonb_typeof(item.value) = 'object' THEN
      result := result || jsonb_build_object(item.key, public.audit_redact_jsonb(item.value));
    ELSE
      result := result || jsonb_build_object(item.key, item.value);
    END IF;
  END LOOP;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_request_headers()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  raw_headers text;
BEGIN
  raw_headers := NULLIF(current_setting('request.headers', true), '');
  IF raw_headers IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  BEGIN
    RETURN raw_headers::jsonb;
  EXCEPTION WHEN others THEN
    RETURN '{}'::jsonb;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_request_ip()
RETURNS inet
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  headers jsonb := public.audit_request_headers();
  raw_ip text;
BEGIN
  raw_ip := COALESCE(
    split_part(headers->>'x-forwarded-for', ',', 1),
    headers->>'cf-connecting-ip',
    headers->>'x-real-ip'
  );

  IF raw_ip IS NULL OR btrim(raw_ip) = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    RETURN btrim(raw_ip)::inet;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_browser_from_ua(_ua text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _ua IS NULL OR _ua = '' THEN NULL
    WHEN lower(_ua) LIKE '%edg/%' THEN 'Microsoft Edge'
    WHEN lower(_ua) LIKE '%opr/%' OR lower(_ua) LIKE '%opera%' THEN 'Opera'
    WHEN lower(_ua) LIKE '%chrome/%' THEN 'Chrome'
    WHEN lower(_ua) LIKE '%firefox/%' THEN 'Firefox'
    WHEN lower(_ua) LIKE '%safari/%' THEN 'Safari'
    ELSE 'Desconhecido'
  END;
$$;

CREATE OR REPLACE FUNCTION public.audit_os_from_ua(_ua text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _ua IS NULL OR _ua = '' THEN NULL
    WHEN lower(_ua) LIKE '%windows%' THEN 'Windows'
    WHEN lower(_ua) LIKE '%android%' THEN 'Android'
    WHEN lower(_ua) LIKE '%iphone%' OR lower(_ua) LIKE '%ipad%' THEN 'iOS'
    WHEN lower(_ua) LIKE '%mac os%' OR lower(_ua) LIKE '%macintosh%' THEN 'macOS'
    WHEN lower(_ua) LIKE '%linux%' THEN 'Linux'
    ELSE 'Desconhecido'
  END;
$$;

CREATE OR REPLACE FUNCTION public.audit_device_from_ua(_ua text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _ua IS NULL OR _ua = '' THEN 'unknown'
    WHEN lower(_ua) LIKE '%ipad%' OR lower(_ua) LIKE '%tablet%' THEN 'tablet'
    WHEN lower(_ua) LIKE '%mobi%' OR lower(_ua) LIKE '%iphone%' OR lower(_ua) LIKE '%android%' THEN 'mobile'
    ELSE 'desktop'
  END;
$$;

CREATE OR REPLACE FUNCTION public.audit_module_for_table(_table_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _table_name IN ('massivas', 'operadoras', 'analises', 'escalonamentos', 'base_cidades') THEN 'consulta-massiva'
    WHEN _table_name IN ('controle_diario', 'historico_tratativas', 'importacoes', 'staging_bases') THEN 'controle-reparo'
    WHEN _table_name IN ('terms_versions', 'user_consents') THEN 'lgpd'
    WHEN _table_name IN ('profiles', 'user_roles', 'app_settings') THEN 'admin'
    WHEN _table_name IN ('lotericas', 'loterica_change_requests', 'loterica_router_configs', 'loterica_notices', 'router_script_templates', 'knowledge_base', 'ping_automation_results') THEN 'consulta-ul'
    WHEN _table_name IN ('agencias', 'parceiras', 'topologia', 'cod_encerramento', 'meus_casos') THEN 'agencia-integrador'
    ELSE 'database'
  END;
$$;

CREATE OR REPLACE FUNCTION public.audit_changed_fields(_old jsonb, _new jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  item record;
  parts text[] := ARRAY[]::text[];
BEGIN
  IF _old IS NULL OR _new IS NULL THEN
    RETURN NULL;
  END IF;

  FOR item IN
    SELECT n.key, o.value AS old_value, n.value AS new_value
    FROM jsonb_each(_new) n
    LEFT JOIN jsonb_each(_old) o ON o.key = n.key
    WHERE n.value IS DISTINCT FROM o.value
      AND n.key NOT IN ('updated_at', 'created_at')
  LOOP
    parts := parts || format(
      '%s: %s -> %s',
      item.key,
      left(COALESCE(item.old_value::text, 'null'), 120),
      left(COALESCE(item.new_value::text, 'null'), 120)
    );
  END LOOP;

  IF array_length(parts, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN array_to_string(parts, '; ');
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_observation_for_change(
  _table_name text,
  _operation text,
  _record_id text,
  _old jsonb,
  _new jsonb
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  changed_fields text := public.audit_changed_fields(_old, _new);
  loterica_code text := COALESCE(_new->>'cod_ul', _old->>'cod_ul', _new->>'codigo_loterica', _old->>'codigo_loterica', _record_id);
  import_type text := COALESCE(_new->>'tipo', _old->>'tipo');
BEGIN
  IF _table_name = 'lotericas' AND _operation = 'UPDATE' THEN
    RETURN format(
      'Usuario alterou os dados (%s) da loterica %s.',
      COALESCE(changed_fields, 'sem diferencas materiais detectadas'),
      COALESCE(loterica_code, 'nao informada')
    );
  END IF;

  IF _table_name = 'lotericas' AND _operation = 'INSERT' THEN
    RETURN format('Usuario cadastrou a loterica %s.', COALESCE(loterica_code, 'nao informada'));
  END IF;

  IF _table_name = 'lotericas' AND _operation = 'DELETE' THEN
    RETURN format('Usuario excluiu ou inativou a loterica %s.', COALESCE(loterica_code, 'nao informada'));
  END IF;

  IF _table_name IN ('importacoes', 'staging_bases') AND _operation IN ('INSERT', 'UPDATE') THEN
    RETURN format(
      'Usuario importou um arquivo de dados para o sistema%s.',
      CASE WHEN import_type IS NOT NULL THEN format(' (%s)', import_type) ELSE '' END
    );
  END IF;

  IF _table_name IN ('controle_diario', 'historico_tratativas') AND _operation = 'UPDATE' THEN
    RETURN format(
      'Usuario alterou dados do Controle de Reparo%s%s.',
      CASE WHEN loterica_code IS NOT NULL THEN format(' da loterica %s', loterica_code) ELSE '' END,
      CASE WHEN changed_fields IS NOT NULL THEN format(' Campos: %s', changed_fields) ELSE '' END
    );
  END IF;

  IF _table_name IN ('massivas', 'operadoras', 'analises', 'escalonamentos', 'base_cidades') THEN
    RETURN format(
      'Usuario %s dados no modulo Consulta Massiva%s.',
      CASE _operation WHEN 'INSERT' THEN 'criou/importou' WHEN 'UPDATE' THEN 'alterou' WHEN 'DELETE' THEN 'excluiu' ELSE lower(_operation) END,
      CASE WHEN changed_fields IS NOT NULL THEN format('. Campos: %s', changed_fields) ELSE '' END
    );
  END IF;

  RETURN format(
    'Usuario %s registro em %s%s.',
    CASE _operation WHEN 'INSERT' THEN 'criou' WHEN 'UPDATE' THEN 'alterou' WHEN 'DELETE' THEN 'excluiu' ELSE lower(_operation) END,
    _table_name,
    CASE WHEN changed_fields IS NOT NULL THEN format('. Campos: %s', changed_fields) ELSE '' END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id uuid := auth.uid();
  old_payload jsonb := NULL;
  new_payload jsonb := NULL;
  record_id text := NULL;
  action_name text;
  actor_name text := NULL;
  actor_email text := NULL;
  headers jsonb := public.audit_request_headers();
  request_ua text := NULL;
  observation_text text := NULL;
BEGIN
  request_ua := NULLIF(headers->>'user-agent', '');

  IF actor_id IS NOT NULL THEN
    SELECT
      COALESCE(NULLIF(p.name, ''), NULLIF(p.full_name, ''), NULLIF(p.nome, '')),
      COALESCE(NULLIF(p.email, ''), au.email)
    INTO actor_name, actor_email
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id OR p.user_id = au.id
    WHERE au.id = actor_id
    LIMIT 1;
  END IF;

  IF TG_OP = 'INSERT' THEN
    new_payload := public.audit_redact_jsonb(to_jsonb(NEW));
    record_id := COALESCE(new_payload->>'id', new_payload->>'cod_ul', new_payload->>'key');
    action_name := 'record_created';
  ELSIF TG_OP = 'UPDATE' THEN
    old_payload := public.audit_redact_jsonb(to_jsonb(OLD));
    new_payload := public.audit_redact_jsonb(to_jsonb(NEW));
    record_id := COALESCE(new_payload->>'id', old_payload->>'id', new_payload->>'cod_ul', old_payload->>'cod_ul', new_payload->>'key', old_payload->>'key');
    action_name := 'record_updated';
  ELSIF TG_OP = 'DELETE' THEN
    old_payload := public.audit_redact_jsonb(to_jsonb(OLD));
    record_id := COALESCE(old_payload->>'id', old_payload->>'cod_ul', old_payload->>'key');
    action_name := 'record_deleted';
  END IF;

  observation_text := public.audit_observation_for_change(TG_TABLE_NAME, TG_OP, record_id, old_payload, new_payload);

    INSERT INTO public.audit_logs (
    user_id,
    user_name,
    user_email,
    action,
    module,
    entity,
    entity_id,
    old_values,
    new_values,
    ip_address,
    user_agent,
    browser,
    os,
    device_type,
    request_method,
    request_path,
    status,
    message,
    observation
  ) VALUES (
    actor_id,
    actor_name,
    actor_email,
    action_name,
    public.audit_module_for_table(TG_TABLE_NAME),
    TG_TABLE_NAME,
    record_id,
    old_payload,
    new_payload,
    public.audit_request_ip(),
    request_ua,
    public.audit_browser_from_ua(request_ua),
    public.audit_os_from_ua(request_ua),
    public.audit_device_from_ua(request_ua),
    COALESCE(headers->>'method', headers->>'x-method'),
    COALESCE(headers->>'path', headers->>'x-original-url'),
    'success',
    format('%s em %s.%s', TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME),
    observation_text
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  target_table text;
  target_tables text[] := ARRAY[
    'lotericas',
    'loterica_change_requests',
    'loterica_router_configs',
    'loterica_notices',
    'profiles',
    'user_roles',
    'terms_versions',
    'app_settings',
    'router_script_templates',
    'knowledge_base',
    'ping_automation_results',
    'controle_diario',
    'historico_tratativas',
    'importacoes',
    'staging_bases',
    'operadoras',
    'massivas',
    'analises',
    'escalonamentos',
    'base_cidades',
    'agencias',
    'parceiras',
    'topologia',
    'cod_encerramento',
    'meus_casos'
  ];
BEGIN
  FOREACH target_table IN ARRAY target_tables
  LOOP
    IF to_regclass(format('public.%I', target_table)) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I_changes ON public.%I', target_table, target_table);
      EXECUTE format(
        'CREATE TRIGGER trg_audit_%I_changes AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()',
        target_table,
        target_table
      );
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_log_set_hash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  NEW.integrity_hash := encode(
    digest(
      convert_to(
      concat_ws('|',
        NEW.id::text,
        COALESCE(NEW.user_id::text, ''),
        COALESCE(NEW.action, ''),
        COALESCE(NEW.module, ''),
        COALESCE(NEW.entity, ''),
        COALESCE(NEW.entity_id, ''),
        COALESCE(NEW.status, ''),
        COALESCE(NEW.message, ''),
        COALESCE(NEW.observation, ''),
        COALESCE(NEW.created_at::text, ''),
        COALESCE(NEW.old_values::text, ''),
        COALESCE(NEW.new_values::text, '')
      ),
      'UTF8'
      ),
      'sha256'::text
    ),
    'hex'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_hash ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_hash
BEFORE INSERT ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.audit_log_set_hash();

CREATE OR REPLACE FUNCTION public.admin_anonymize_user(_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin(v_actor) THEN
    RAISE EXCEPTION 'Apenas administradores podem anonimizar usuarios.';
  END IF;

  UPDATE public.profiles
  SET
    name = 'Usuario anonimizado',
    full_name = 'Usuario anonimizado',
    nome = 'Usuario anonimizado',
    email = NULL,
    username = NULL,
    employee_id = NULL,
    user_code = NULL,
    active = false,
    ativo = false,
    is_active = false,
    updated_at = now()
  WHERE id = _target_user_id OR user_id = _target_user_id;

  INSERT INTO public.audit_logs (
    user_id,
    action,
    module,
    entity,
    entity_id,
    status,
    message,
    observation
  ) VALUES (
    v_actor,
    'personal_data_anonymized',
    'admin',
    'profiles',
    _target_user_id::text,
    'success',
    'Dados pessoais do usuario foram anonimizados por solicitacao administrativa.',
    'Administrador anonimizou os dados pessoais do usuario informado.'
  );
END;
$$;

ALTER TABLE public.terms_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read active terms" ON public.terms_versions;
CREATE POLICY "Authenticated can read active terms"
ON public.terms_versions
FOR SELECT TO authenticated
USING (
  active
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.user_consents uc
    WHERE uc.user_id = auth.uid()
      AND (uc.terms_version_id = terms_versions.id OR uc.privacy_policy_version_id = terms_versions.id)
  )
);

DROP POLICY IF EXISTS "Admins can manage terms" ON public.terms_versions;
CREATE POLICY "Admins can manage terms"
ON public.terms_versions
FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can read own consents" ON public.user_consents;
CREATE POLICY "Users can read own consents"
ON public.user_consents
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own consents" ON public.user_consents;
CREATE POLICY "Users can insert own consents"
ON public.user_consents
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can read audit logs" ON public.audit_logs;
CREATE POLICY "Admins can read audit logs"
ON public.audit_logs
FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated can insert audit logs"
ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

GRANT SELECT ON public.terms_versions TO authenticated;
GRANT SELECT, INSERT ON public.user_consents TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_anonymize_user(uuid) TO authenticated;

INSERT INTO public.terms_versions (type, version, content, active)
VALUES
  (
    'terms_of_use',
    '2026-06-26',
    'Termos de Uso do Consulta Lotericas. O sistema deve ser utilizado apenas para finalidades operacionais autorizadas. As acoes realizadas por usuarios autenticados podem ser auditadas para seguranca, rastreabilidade, prevencao de fraude, apuracao de incidentes e cumprimento de obrigacoes legais. E proibido compartilhar credenciais, extrair dados sem autorizacao ou usar informacoes fora das finalidades do servico.',
    true
  ),
  (
    'privacy_policy',
    '2026-06-26',
    'Politica de Privacidade. Coletamos dados de identificacao do usuario, data e hora de acesso, IP, User-Agent, navegador, sistema operacional, tipo de dispositivo e eventos de uso estritamente necessarios para seguranca, auditoria, operacao do sistema e cumprimento da LGPD. Senhas, tokens e segredos nao devem ser registrados em logs. Os logs possuem retencao operacional recomendada de 180 dias, salvo necessidade legal, contratual ou investigativa.',
    true
  )
ON CONFLICT (type, version) DO UPDATE
SET content = EXCLUDED.content,
    active = EXCLUDED.active;
