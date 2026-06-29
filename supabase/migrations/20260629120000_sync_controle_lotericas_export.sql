-- Synchronize the current Controle Operacional version with Consulta UL data.
-- This does not create versions, insert rows, delete rows, or change operational fields.

CREATE OR REPLACE FUNCTION public.controle_sync_norm_key(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(
    translate(
      lower(coalesce(value, '')),
      'áàãâäéèêëíìîïóòõôöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'
    ),
    '[^a-z0-9]',
    '',
    'g'
  )
$$;

CREATE OR REPLACE FUNCTION public.controle_sync_norm_codigo(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(upper(coalesce(value, '')), '\s+', '', 'g')
$$;

CREATE OR REPLACE FUNCTION public.controle_sync_first_filled(VARIADIC values text[])
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  item text;
BEGIN
  FOREACH item IN ARRAY values LOOP
    IF nullif(btrim(coalesce(item, '')), '') IS NOT NULL THEN
      RETURN btrim(item);
    END IF;
  END LOOP;

  RETURN '';
END;
$$;

CREATE OR REPLACE FUNCTION public.controle_sync_json_value(raw jsonb, aliases text[])
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  item record;
  alias text;
BEGIN
  IF raw IS NULL OR jsonb_typeof(raw) <> 'object' THEN
    RETURN '';
  END IF;

  FOR alias IN SELECT unnest(aliases) LOOP
    FOR item IN SELECT key, value FROM jsonb_each_text(raw) LOOP
      IF public.controle_sync_norm_key(item.key) = public.controle_sync_norm_key(alias) THEN
        IF nullif(btrim(item.value), '') IS NOT NULL THEN
          RETURN btrim(item.value);
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  RETURN '';
END;
$$;

CREATE OR REPLACE FUNCTION public.controle_sync_tipo_link(value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  key text := public.controle_sync_norm_key(value);
BEGIN
  IF key = '' THEN
    RETURN '';
  END IF;

  IF key ~ '(backup|secund|secundario|redund|contingencia)' THEN
    RETURN 'SECUNDARIO';
  END IF;

  IF key ~ '(principal|primario|primar|main)' THEN
    RETURN 'PRINCIPAL';
  END IF;

  RETURN upper(coalesce(value, ''));
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_controle_lotericas_export(
  _data_referencia date,
  _versao integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  caller_name text;
  total_lotericas integer := 0;
  evaluated integer := 0;
  matched integer := 0;
  updated_rows integer := 0;
  fields_updated integer := 0;
  no_match integer := 0;
  empresa_count integer := 0;
  designacao_parceiro_count integer := 0;
  novo_circuito_count integer := 0;
  responsavel_backup_count integer := 0;
  row_item record;
  empresa_next text;
  designacao_parceiro_next text;
  novo_circuito_next text;
  responsavel_backup_next text;
  row_changes integer;
BEGIN
  IF caller IS NULL OR NOT public.is_admin(caller) THEN
    RAISE EXCEPTION 'Você não tem permissão para sincronizar a base do Consulta UL.';
  END IF;

  SELECT count(*) INTO total_lotericas FROM public.lotericas;
  IF total_lotericas = 0 THEN
    RAISE EXCEPTION 'Não foi possível localizar os dados atuais do Consulta UL / lotericas_export.';
  END IF;

  SELECT coalesce(p.name, u.email, caller::text)
  INTO caller_name
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = caller;

  FOR row_item IN
    SELECT
      c.id,
      c.codigo_loterica,
      c.tipo_link,
      c.empresa,
      c.designacao_parceiro,
      c.novo_circuito,
      c.responsavel_backup,
      l.cod_ul,
      l.ccto_oemp,
      l.designacao_nova,
      l.operadora,
      l.raw_data
    FROM public.controle_diario c
    LEFT JOIN LATERAL (
      SELECT lot.*
      FROM public.lotericas lot
      WHERE public.controle_sync_norm_codigo(lot.cod_ul) = public.controle_sync_norm_codigo(c.codigo_loterica)
      ORDER BY lot.cod_ul
      LIMIT 1
    ) l ON true
    WHERE c.data_referencia = _data_referencia
      AND c.versao = _versao
    ORDER BY c.id
  LOOP
    evaluated := evaluated + 1;

    IF row_item.cod_ul IS NULL THEN
      no_match := no_match + 1;
      CONTINUE;
    END IF;

    matched := matched + 1;
    row_changes := 0;

    empresa_next := public.controle_sync_first_filled(
      public.controle_sync_json_value(row_item.raw_data, ARRAY['Empresa CEF']),
      public.controle_sync_json_value(row_item.raw_data, ARRAY['EMPRESA OEMP']),
      row_item.operadora,
      public.controle_sync_json_value(row_item.raw_data, ARRAY['Operadora'])
    );
    designacao_parceiro_next := public.controle_sync_first_filled(
      public.controle_sync_json_value(row_item.raw_data, ARRAY['Circuito OEMP', 'CIRCUITO OEMP', 'Designacao OEMP', 'Designação OEMP']),
      row_item.ccto_oemp
    );
    novo_circuito_next := public.controle_sync_first_filled(
      public.controle_sync_json_value(row_item.raw_data, ARRAY['Designacao Nova', 'Designação Nova', 'DESIGINACAO NOVA', 'Novo Circuito']),
      row_item.designacao_nova
    );
    responsavel_backup_next := public.controle_sync_first_filled(
      public.controle_sync_json_value(row_item.raw_data, ARRAY['OPERADORA 4G', 'RESP BACKUP']),
      row_item.operadora
    );

    IF empresa_next <> '' AND coalesce(row_item.empresa, '') IS DISTINCT FROM empresa_next THEN
      INSERT INTO public.historico_tratativas (controle_id, codigo_loterica, usuario, campo, valor_anterior, valor_novo)
      VALUES (row_item.id, row_item.codigo_loterica, caller_name, 'empresa', nullif(row_item.empresa, ''), empresa_next);
      row_changes := row_changes + 1;
      empresa_count := empresa_count + 1;
    END IF;

    IF designacao_parceiro_next <> '' AND coalesce(row_item.designacao_parceiro, '') IS DISTINCT FROM designacao_parceiro_next THEN
      INSERT INTO public.historico_tratativas (controle_id, codigo_loterica, usuario, campo, valor_anterior, valor_novo)
      VALUES (row_item.id, row_item.codigo_loterica, caller_name, 'designacao_parceiro', nullif(row_item.designacao_parceiro, ''), designacao_parceiro_next);
      row_changes := row_changes + 1;
      designacao_parceiro_count := designacao_parceiro_count + 1;
    END IF;

    IF novo_circuito_next <> '' AND coalesce(row_item.novo_circuito, '') IS DISTINCT FROM novo_circuito_next THEN
      INSERT INTO public.historico_tratativas (controle_id, codigo_loterica, usuario, campo, valor_anterior, valor_novo)
      VALUES (row_item.id, row_item.codigo_loterica, caller_name, 'novo_circuito', nullif(row_item.novo_circuito, ''), novo_circuito_next);
      row_changes := row_changes + 1;
      novo_circuito_count := novo_circuito_count + 1;
    END IF;

    IF public.controle_sync_tipo_link(row_item.tipo_link) = 'SECUNDARIO'
      AND responsavel_backup_next <> ''
      AND coalesce(row_item.responsavel_backup, '') IS DISTINCT FROM responsavel_backup_next
    THEN
      INSERT INTO public.historico_tratativas (controle_id, codigo_loterica, usuario, campo, valor_anterior, valor_novo)
      VALUES (row_item.id, row_item.codigo_loterica, caller_name, 'responsavel_backup', nullif(row_item.responsavel_backup, ''), responsavel_backup_next);
      row_changes := row_changes + 1;
      responsavel_backup_count := responsavel_backup_count + 1;
    END IF;

    IF row_changes > 0 THEN
      UPDATE public.controle_diario
      SET
        empresa = CASE WHEN empresa_next <> '' THEN empresa_next ELSE empresa END,
        designacao_parceiro = CASE WHEN designacao_parceiro_next <> '' THEN designacao_parceiro_next ELSE designacao_parceiro END,
        novo_circuito = CASE WHEN novo_circuito_next <> '' THEN novo_circuito_next ELSE novo_circuito END,
        responsavel_backup = CASE
          WHEN public.controle_sync_tipo_link(row_item.tipo_link) = 'SECUNDARIO' AND responsavel_backup_next <> ''
            THEN responsavel_backup_next
          ELSE responsavel_backup
        END,
        updated_at = now()
      WHERE id = row_item.id;

      updated_rows := updated_rows + 1;
      fields_updated := fields_updated + row_changes;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'data_referencia', _data_referencia,
    'versao', _versao,
    'avaliados', evaluated,
    'total_consulta_ul', total_lotericas,
    'encontrados_consulta_ul', matched,
    'atualizados', updated_rows,
    'campos_atualizados', fields_updated,
    'empresa_atualizada', empresa_count,
    'designacao_parceiro_atualizada', designacao_parceiro_count,
    'novo_circuito_atualizado', novo_circuito_count,
    'responsavel_backup_atualizado', responsavel_backup_count,
    'sem_correspondencia', no_match,
    'usuario', caller_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_controle_lotericas_export(date, integer) TO authenticated;
