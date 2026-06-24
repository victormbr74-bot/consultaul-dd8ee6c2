CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_staging_bases_importacao_id
  ON public.staging_bases (importacao_id, id)
  WHERE importacao_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_staging_bases_tipo_criado_id
  ON public.staging_bases (tipo, criado_em, id);
