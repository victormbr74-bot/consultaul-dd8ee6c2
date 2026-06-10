CREATE TABLE public.loterica_router_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cod_ul TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('PRINCIPAL','BACKUP')),
  config_type TEXT NOT NULL CHECK (config_type IN ('BYPASS','RETIRADO DE ROTA','NEGA TFL','PORTA EM SHUT','BAIXADO PRIORIDADE VRRP','TROCA DE OWNER')),
  observacao TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_router_configs_cod_ul ON public.loterica_router_configs(cod_ul);
CREATE INDEX idx_router_configs_created_by ON public.loterica_router_configs(created_by);
CREATE INDEX idx_router_configs_created_at ON public.loterica_router_configs(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loterica_router_configs TO authenticated;
GRANT ALL ON public.loterica_router_configs TO service_role;

ALTER TABLE public.loterica_router_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read router configs"
  ON public.loterica_router_configs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert router configs"
  ON public.loterica_router_configs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owner or admin can update router configs"
  ON public.loterica_router_configs FOR UPDATE
  TO authenticated USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owner or admin can delete router configs"
  ON public.loterica_router_configs FOR DELETE
  TO authenticated USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_router_configs_updated_at
  BEFORE UPDATE ON public.loterica_router_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();