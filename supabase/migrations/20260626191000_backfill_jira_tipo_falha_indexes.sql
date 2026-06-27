UPDATE public.jira_abertos
SET tipo_falha = COALESCE(
  NULLIF(btrim(raw_data->>'Tipo de Falha'), ''),
  NULLIF(btrim(raw_data->>'Tipo da falha'), ''),
  NULLIF(btrim(raw_data->>'Tipo Falha'), ''),
  NULLIF(btrim(raw_data->>'TIPO DE FALHA'), ''),
  NULLIF(btrim(raw_data->>'tipo_falha'), '')
)
WHERE raw_data IS NOT NULL
  AND NULLIF(btrim(COALESCE(tipo_falha, '')), '') IS NULL
  AND COALESCE(
    NULLIF(btrim(raw_data->>'Tipo de Falha'), ''),
    NULLIF(btrim(raw_data->>'Tipo da falha'), ''),
    NULLIF(btrim(raw_data->>'Tipo Falha'), ''),
    NULLIF(btrim(raw_data->>'TIPO DE FALHA'), ''),
    NULLIF(btrim(raw_data->>'tipo_falha'), '')
  ) IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jira_abertos_tipo_falha
  ON public.jira_abertos (tipo_falha)
  WHERE tipo_falha IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_falhas_gis_chamado
  ON public.falhas_gis (chamado)
  WHERE chamado IS NOT NULL;
