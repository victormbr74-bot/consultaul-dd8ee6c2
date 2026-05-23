
-- Revogar execução por anon/public em todas as funções SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_app_data(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_app_settings() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.search_lotericas_by_mac(text, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_loterica_history() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_router_script_templates_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.normalize_mac_text(text) FROM PUBLIC, anon;
