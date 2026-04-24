CREATE OR REPLACE FUNCTION public.normalize_mac_text(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT regexp_replace(lower(COALESCE(value, '')), '[^0-9a-f]', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.search_lotericas_by_mac(
  search_mac text,
  page_size integer DEFAULT 20,
  page_offset integer DEFAULT 0
)
RETURNS TABLE (
  cod_ul text,
  nome_loterica text,
  ccto_oi text,
  ccto_oemp text,
  designacao_nova text,
  operadora text,
  cidade text,
  uf text,
  status text,
  matched_field text,
  matched_value text,
  raw_data jsonb,
  total_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      public.normalize_mac_text(search_mac) AS normalized_search,
      GREATEST(COALESCE(page_size, 20), 1) AS safe_page_size,
      GREATEST(COALESCE(page_offset, 0), 0) AS safe_page_offset
  ),
  matches AS (
    SELECT
      l.cod_ul,
      l.nome_loterica,
      l.ccto_oi,
      l.ccto_oemp,
      l.designacao_nova,
      l.operadora,
      l.cidade,
      l.uf,
      l.status,
      kv.key AS matched_field,
      kv.value AS matched_value,
      l.raw_data
    FROM public.lotericas l
    CROSS JOIN params p
    CROSS JOIN LATERAL jsonb_each_text(COALESCE(l.raw_data, '{}'::jsonb)) AS kv(key, value)
    WHERE p.normalized_search <> ''
      AND length(p.normalized_search) >= 6
      AND (
        kv.key ILIKE '%mac%'
        OR kv.value ~* '([0-9A-F]{2}([-:.]?)){5}[0-9A-F]{2}'
      )
      AND public.normalize_mac_text(kv.value) LIKE '%' || p.normalized_search || '%'
  ),
  deduped AS (
    SELECT DISTINCT ON (cod_ul, matched_field, matched_value)
      cod_ul,
      nome_loterica,
      ccto_oi,
      ccto_oemp,
      designacao_nova,
      operadora,
      cidade,
      uf,
      status,
      matched_field,
      matched_value,
      raw_data
    FROM matches
    ORDER BY cod_ul, matched_field, matched_value
  ),
  counted AS (
    SELECT
      deduped.*,
      COUNT(*) OVER()::integer AS total_count
    FROM deduped
  ),
  paginated AS (
    SELECT
      counted.*,
      row_number() OVER (
        ORDER BY counted.cod_ul, counted.matched_field
      )::integer AS row_num
    FROM counted
  )
  SELECT
    paginated.cod_ul,
    paginated.nome_loterica,
    paginated.ccto_oi,
    paginated.ccto_oemp,
    paginated.designacao_nova,
    paginated.operadora,
    paginated.cidade,
    paginated.uf,
    paginated.status,
    paginated.matched_field,
    paginated.matched_value,
    paginated.raw_data,
    paginated.total_count
  FROM paginated
  CROSS JOIN params p
  WHERE paginated.row_num > p.safe_page_offset
    AND paginated.row_num <= (p.safe_page_offset + p.safe_page_size)
  ORDER BY paginated.row_num;
$$;

GRANT EXECUTE ON FUNCTION public.normalize_mac_text(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_lotericas_by_mac(text, integer, integer) TO authenticated;
