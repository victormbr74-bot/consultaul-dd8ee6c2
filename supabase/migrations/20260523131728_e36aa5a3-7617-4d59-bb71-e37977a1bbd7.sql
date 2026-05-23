
-- 1) parceiras: restringir contatos a ops/admin
DROP POLICY IF EXISTS "Authenticated can read parceiras" ON public.parceiras;
CREATE POLICY "Ops can read parceiras" ON public.parceiras
  FOR SELECT TO authenticated
  USING (public.can_manage_app_data(auth.uid()));

-- 2) ping_automation_results: somente admins podem inserir/atualizar
DROP POLICY IF EXISTS "Admins can insert ping automation results" ON public.ping_automation_results;
CREATE POLICY "Admins can insert ping automation results" ON public.ping_automation_results
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update ping automation results" ON public.ping_automation_results;
CREATE POLICY "Admins can update ping automation results" ON public.ping_automation_results
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3) profiles: permitir exclusão por administradores
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4) realtime.messages: restringir broadcasts a usuários autenticados
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can use realtime" ON realtime.messages;
CREATE POLICY "Authenticated can use realtime" ON realtime.messages
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can publish realtime" ON realtime.messages;
CREATE POLICY "Authenticated can publish realtime" ON realtime.messages
  FOR INSERT TO authenticated WITH CHECK (true);

-- 5) Corrigir search_path da função de trigger
CREATE OR REPLACE FUNCTION public.touch_router_script_templates_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
