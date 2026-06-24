DO $$
BEGIN
  IF to_regclass('public.controle_diario') IS NULL THEN
    RAISE NOTICE 'Tabela public.controle_diario nao existe; indices de desempenho nao foram criados.';
    RETURN;
  END IF;

  CREATE INDEX IF NOT EXISTS idx_controle_diario_data_ref_id
    ON public.controle_diario (data_referencia DESC, id DESC);

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'controle_diario'
      AND column_name = 'versao'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_controle_diario_data_ref_versao_id
      ON public.controle_diario (data_referencia DESC, versao DESC, id ASC);

    CREATE INDEX IF NOT EXISTS idx_controle_diario_data_ref_versao_responsavel
      ON public.controle_diario (data_referencia DESC, versao DESC, responsavel);
  END IF;
END $$;
