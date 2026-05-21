ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS value_text text;

INSERT INTO public.app_settings (key, value_boolean, value_text)
VALUES ('jirayab_webhook_url', true, NULL)
ON CONFLICT (key) DO NOTHING;