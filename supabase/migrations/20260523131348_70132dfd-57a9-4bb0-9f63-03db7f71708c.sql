
UPDATE public.lotericas l SET
  ccto_oi = COALESCE(NULLIF(btrim(s.circuito),''), l.ccto_oi),
  designacao_nova = COALESCE(NULLIF(btrim(s.circuito),''), l.designacao_nova),
  operadora = COALESCE(NULLIF(btrim(s.resp_backup),''), l.operadora),
  raw_data = COALESCE(l.raw_data,'{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
    'EMPRESA OEMP', NULLIF(btrim(s.resp_principal),''),
    'RESPONSAVEL PRINCIPAL', NULLIF(btrim(s.resp_principal),''),
    'SIM CARD 4G', NULLIF(btrim(s.sim_card),'')
  )),
  updated_at = now()
FROM public.jirayab_stage s
WHERE l.cod_ul = s.cod_ul;

DROP TABLE public.jirayab_stage;
