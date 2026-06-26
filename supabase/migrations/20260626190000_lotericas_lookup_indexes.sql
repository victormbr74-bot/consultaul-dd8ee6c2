CREATE INDEX IF NOT EXISTS lotericas_ccto_oi_idx
  ON public.lotericas (ccto_oi)
  WHERE ccto_oi IS NOT NULL;

CREATE INDEX IF NOT EXISTS lotericas_ccto_oemp_idx
  ON public.lotericas (ccto_oemp)
  WHERE ccto_oemp IS NOT NULL;

CREATE INDEX IF NOT EXISTS lotericas_designacao_nova_idx
  ON public.lotericas (designacao_nova)
  WHERE designacao_nova IS NOT NULL;
