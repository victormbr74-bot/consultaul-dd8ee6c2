CREATE OR REPLACE FUNCTION public.apply_principal_updates(payload jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected int := 0;
BEGIN
  WITH t AS (
    SELECT
      (e->>'cod_ul')::text AS cod_ul,
      NULLIF(e->>'ccto_oi','') AS ccto_oi,
      NULLIF(e->>'loopback_wan','') AS loopback_wan,
      NULLIF(e->>'modelo','') AS modelo,
      NULLIF(e->>'ip99','') AS ip99,
      NULLIF(e->>'ipsw','') AS ipsw
    FROM jsonb_array_elements(payload) AS e
  )
  UPDATE public.lotericas l SET
    ccto_oi = COALESCE(t.ccto_oi, l.ccto_oi),
    loopback_wan = COALESCE(t.loopback_wan, l.loopback_wan),
    raw_data = COALESCE(l.raw_data, '{}'::jsonb)
      || jsonb_build_object('MODELO ROTEADOR',
          CASE
            WHEN t.modelo IS NULL THEN l.raw_data->>'MODELO ROTEADOR'
            WHEN (l.raw_data->>'MODELO ROTEADOR') ILIKE '%/ SCT %'
              THEN t.modelo || ' / SCT ' || split_part(l.raw_data->>'MODELO ROTEADOR',' / SCT ',2)
            ELSE t.modelo
          END)
      || jsonb_build_object('REDE LAN', COALESCE(t.ip99, l.raw_data->>'REDE LAN'))
      || jsonb_build_object('IP SWITCH', COALESCE(t.ipsw, l.raw_data->>'IP SWITCH')),
    updated_at = now()
  FROM t
  WHERE l.cod_ul = t.cod_ul;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_principal_updates(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_principal_updates(jsonb) TO service_role;