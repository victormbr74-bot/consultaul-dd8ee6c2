import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { user_code } = await req.json();
  if (!user_code) {
    return new Response(JSON.stringify({ error: "user_code required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_code", user_code)
    .single();

  if (error || !data) {
    return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get email from auth.users
  const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(data.id);

  if (authError || !authUser?.user?.email) {
    return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ email: authUser.user.email }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
