-- Reduce audit noise: database triggers should only record material UPDATE/DELETE
-- changes. Download/export events continue to be logged by the application via
-- public.audit_logs inserts.

CREATE OR REPLACE FUNCTION public.audit_jsonb_without_noise(_value jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(_value, '{}'::jsonb) - ARRAY['created_at', 'updated_at', 'last_seen_at']
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
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND public.audit_jsonb_without_noise(to_jsonb(OLD)) = public.audit_jsonb_without_noise(to_jsonb(NEW))
  THEN
    RETURN NEW;
  END IF;

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

  IF TG_OP = 'UPDATE' THEN
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
        'CREATE TRIGGER trg_audit_%I_changes AFTER UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()',
        target_table,
        target_table
      );
    END IF;
  END LOOP;

  IF to_regclass('public.importacoes') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_audit_importacoes_changes ON public.importacoes;
  END IF;

  IF to_regclass('public.staging_bases') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_audit_staging_bases_changes ON public.staging_bases;
  END IF;
END;
$$;
