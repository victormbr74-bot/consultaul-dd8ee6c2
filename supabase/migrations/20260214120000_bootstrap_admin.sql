-- Bootstrap admin: allow the collaborator code 418118 to self-promote to admin once.
-- This avoids the system getting stuck without any admin role configured.

CREATE OR REPLACE FUNCTION public.bootstrap_my_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_code text;
BEGIN
  SELECT user_code INTO my_code
  FROM public.profiles
  WHERE id = auth.uid();

  IF my_code IS NULL THEN
    RETURN false;
  END IF;

  IF my_code <> '418118' THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bootstrap_my_admin() TO authenticated;

