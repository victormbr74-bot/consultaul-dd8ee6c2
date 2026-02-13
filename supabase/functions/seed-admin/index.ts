import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Create admin user
  const { data, error } = await supabase.auth.admin.createUser({
    email: "418118@admin.lotericas.com",
    password: "Oi@12345",
    email_confirm: true,
    user_metadata: { name: "Manoel Victor da Costa Barros" },
  });

  if (error && !error.message.includes("already been registered")) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }

  const userId = data?.user?.id;
  if (userId) {
    // Update profile
    await supabase.from("profiles").update({ user_code: "418118", name: "Manoel Victor da Costa Barros" }).eq("id", userId);
    // Set admin role
    await supabase.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
  }

  return new Response(JSON.stringify({ success: true, userId }), {
    headers: { "Content-Type": "application/json" },
  });
});
