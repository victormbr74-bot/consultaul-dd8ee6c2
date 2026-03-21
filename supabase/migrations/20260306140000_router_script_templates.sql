CREATE TABLE IF NOT EXISTS public.router_script_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  router_role TEXT NOT NULL CHECK (router_role IN ('principal', 'backup')),
  model TEXT NOT NULL CHECK (model IN ('any', 'cisco1900', 'huawei', 'hp20-11', 'hp1002-4', 'hpmsr900', 'hpmsr931', 'hpmsr920')),
  technology TEXT NOT NULL CHECK (technology IN ('any', 'fibra', '4g', 'vsat')),
  owner TEXT NOT NULL CHECK (owner IN ('any', 'oi', 'sencinet')),
  switch_topology TEXT NOT NULL CHECK (switch_topology IN ('any', 'com-switch', 'sem-switch')),
  script_variant TEXT NOT NULL CHECK (script_variant IN ('completo', 'bgp', 'nqa')),
  content TEXT NOT NULL,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS router_script_templates_lookup_idx
  ON public.router_script_templates (router_role, script_variant, is_active);

CREATE INDEX IF NOT EXISTS router_script_templates_updated_at_idx
  ON public.router_script_templates (updated_at DESC);

CREATE OR REPLACE FUNCTION public.touch_router_script_templates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_router_script_templates_update ON public.router_script_templates;
CREATE TRIGGER on_router_script_templates_update
  BEFORE UPDATE ON public.router_script_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_router_script_templates_updated_at();

ALTER TABLE public.router_script_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read active router script templates" ON public.router_script_templates;
CREATE POLICY "Authenticated can read active router script templates"
  ON public.router_script_templates
  FOR SELECT TO authenticated
  USING (is_active OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert router script templates" ON public.router_script_templates;
CREATE POLICY "Admins can insert router script templates"
  ON public.router_script_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update router script templates" ON public.router_script_templates;
CREATE POLICY "Admins can update router script templates"
  ON public.router_script_templates
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete router script templates" ON public.router_script_templates;
CREATE POLICY "Admins can delete router script templates"
  ON public.router_script_templates
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
