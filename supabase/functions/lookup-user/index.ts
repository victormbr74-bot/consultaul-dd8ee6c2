import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const normalizeUserCode = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const buildEmail = (userCode: string) => `${userCode}@colaborador.lotericas.com`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const body = await req.json().catch(() => ({}));
  const userCode = normalizeUserCode((body as { user_code?: unknown }).user_code);
  if (!userCode) {
    return new Response(JSON.stringify({ error: "user_code required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, active, created_at")
    .eq("user_code", userCode)
    .order("active", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  if (!error && Array.isArray(profiles) && profiles.length > 0) {
    for (const row of profiles) {
      const profileId = String((row as { id?: string }).id || "").trim();
      if (!profileId) continue;

      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(profileId);
      if (!authError && authUser?.user?.email) {
        return new Response(JSON.stringify({ email: authUser.user.email }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
  }

  // Fallback: evita falso negativo quando houver inconsistência entre profiles e auth.users.
  return new Response(JSON.stringify({ email: buildEmail(userCode) }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
