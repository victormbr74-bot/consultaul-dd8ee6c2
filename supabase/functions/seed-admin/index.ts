import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const adminEmail = "418118@admin.lotericas.com";
  const adminName = "Manoel Victor da Costa Barros";

  // Create admin user
  const { data, error } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: "Oi@12345",
    email_confirm: true,
    user_metadata: { name: adminName },
  });

  if (error && !error.message.includes("already been registered")) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }

  let userId = data?.user?.id ?? null;

  // If user already exists, resolve id by email and still apply profile/role.
  if (!userId) {
    const { data: users, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) {
      return new Response(JSON.stringify({ error: listError.message }), { status: 400 });
    }
    userId = users.users.find((u) => (u.email || "").toLowerCase() === adminEmail.toLowerCase())?.id ?? null;
  }

  if (userId) {
    // Update profile
    await supabase.from("profiles").update({ user_code: "418118", name: adminName }).eq("id", userId);
    // Set admin role
    await supabase.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
  }

  return new Response(JSON.stringify({ success: true, userId }), {
    headers: { "Content-Type": "application/json" },
  });
});
