import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CreateUserInput = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).max(72),
  nome: z.string().min(1).max(120),
  role: z.enum(["ADMIN", "OPERADOR"]),
});

export const createUserServerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => CreateUserInput.parse(data))
  .handler(async ({ data, context }) => {
    // Verify caller is ADMIN
    const { data: roleRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (roleRow?.role !== "ADMIN") {
      throw new Error("Apenas ADMIN pode criar usuários.");
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar usuário");

    // Trigger created profile + default role. If requested role differs, update it.
    if (data.role === "ADMIN") {
      await supabaseAdmin
        .from("user_roles")
        .update({ role: "ADMIN" })
        .eq("user_id", created.user.id);
    }
    return { user_id: created.user.id };
  });

const DeleteUserInput = z.object({ user_id: z.string().uuid() });

export const deleteUserServerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => DeleteUserInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).maybeSingle();
    if (roleRow?.role !== "ADMIN") throw new Error("Apenas ADMIN.");
    if (data.user_id === context.userId) throw new Error("Não é possível excluir o próprio usuário.");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const SetRoleInput = z.object({ user_id: z.string().uuid(), role: z.enum(["ADMIN","OPERADOR"]) });

export const setRoleServerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SetRoleInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).maybeSingle();
    if (roleRow?.role !== "ADMIN") throw new Error("Apenas ADMIN.");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .update({ role: data.role })
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
