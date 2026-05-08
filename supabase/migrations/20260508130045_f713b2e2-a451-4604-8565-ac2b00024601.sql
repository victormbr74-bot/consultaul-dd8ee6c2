ALTER TABLE public.loterica_change_requests REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.loterica_change_requests;