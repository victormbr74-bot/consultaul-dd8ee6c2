
CREATE TABLE IF NOT EXISTS public.jirayab_stage (
  cod_ul text PRIMARY KEY,
  circuito text,
  resp_principal text,
  resp_backup text,
  sim_card text
);
ALTER TABLE public.jirayab_stage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage jirayab_stage" ON public.jirayab_stage;
CREATE POLICY "Admins manage jirayab_stage" ON public.jirayab_stage
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
TRUNCATE public.jirayab_stage;
