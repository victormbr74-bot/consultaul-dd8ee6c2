-- Snapshot tables for alarmes/chamados importados da planilha Base_Lotericas (abas Jira Abertos e Falhas GIS)
CREATE TABLE IF NOT EXISTS public.jira_abertos (
  chave TEXT PRIMARY KEY,
  cod_ul TEXT,
  resumo TEXT,
  tipo_falha TEXT,
  status TEXT,
  criado TIMESTAMPTZ,
  data_hora_normalizacao TIMESTAMPTZ,
  data_proxima_atualizacao TIMESTAMPTZ,
  data_agendamento TIMESTAMPTZ,
  n_inc_snow TEXT,
  n_incidente_mam TEXT,
  n_req_caixa TEXT,
  responsavel TEXT,
  site_owner TEXT,
  relator TEXT,
  descricao TEXT,
  categoria_sintoma TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_data JSONB
);

CREATE INDEX IF NOT EXISTS idx_jira_abertos_cod_ul ON public.jira_abertos (cod_ul);
CREATE INDEX IF NOT EXISTS idx_jira_abertos_status ON public.jira_abertos (status);
CREATE INDEX IF NOT EXISTS idx_jira_abertos_criado ON public.jira_abertos (criado DESC);

ALTER TABLE public.jira_abertos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jira_abertos'
      AND policyname = 'Authenticated can read jira_abertos'
  ) THEN
    CREATE POLICY "Authenticated can read jira_abertos"
      ON public.jira_abertos
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.falhas_gis (
  record_key TEXT PRIMARY KEY,
  id_alarme TEXT,
  cod_ul TEXT,
  loterica TEXT,
  tipo_link TEXT,
  cidade TEXT,
  uf TEXT,
  telefone TEXT,
  designacao TEXT,
  ip_loopback TEXT,
  data_hora_inicial TIMESTAMPTZ,
  duracao_horas DOUBLE PRECISION,
  empresa TEXT,
  categoria_gis TEXT,
  categoria_gis_secundaria TEXT,
  chamado TEXT,
  previsao_atendimento TIMESTAMPTZ,
  status TEXT,
  status_secundario TEXT,
  situacao TEXT,
  ultimo_comentario_em TIMESTAMPTZ,
  n_req_caixa TEXT,
  regional TEXT,
  tecnologia TEXT,
  site_owner TEXT,
  pontuacao_ul DOUBLE PRECISION,
  m_duration DOUBLE PRECISION,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_data JSONB
);

CREATE INDEX IF NOT EXISTS idx_falhas_gis_cod_ul ON public.falhas_gis (cod_ul);
CREATE INDEX IF NOT EXISTS idx_falhas_gis_tipo_link ON public.falhas_gis (tipo_link);
CREATE INDEX IF NOT EXISTS idx_falhas_gis_status ON public.falhas_gis (status);
CREATE INDEX IF NOT EXISTS idx_falhas_gis_data_hora_inicial ON public.falhas_gis (data_hora_inicial DESC);
CREATE INDEX IF NOT EXISTS idx_falhas_gis_duracao_horas ON public.falhas_gis (duracao_horas DESC);

ALTER TABLE public.falhas_gis ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'falhas_gis'
      AND policyname = 'Authenticated can read falhas_gis'
  ) THEN
    CREATE POLICY "Authenticated can read falhas_gis"
      ON public.falhas_gis
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
