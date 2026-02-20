import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AppRole = "admin" | "user";

type UserPayload = {
  user_id?: string;
  name?: string;
  user_code?: string;
  role?: AppRole;
  active?: boolean;
  password?: string;
};

type SeedPayload = {
  users?: Array<{
    name: string;
    user_code: string;
    role?: AppRole;
  }>;
  default_password?: string;
};

type ResetPasswordPayload = {
  user_id?: string;
  reset_all?: boolean;
  default_password?: string;
};

type RequestPayload = {
  action?: "create_user" | "update_user" | "delete_user" | "seed_users" | "reset_passwords";
  payload?: UserPayload | SeedPayload | ResetPasswordPayload;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeUserCode = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const normalizeRole = (value: unknown): AppRole => (value === "admin" ? "admin" : "user");
const buildEmail = (userCode: string) => `${userCode}@colaborador.lotericas.com`;

// deno-lint-ignore no-explicit-any
const applyRole = async (adminClient: any, userId: string, role: AppRole) => {
  const { error: deleteError } = await adminClient.from("user_roles").delete().eq("user_id", userId);
  if (deleteError) throw new Error(deleteError.message);

  const { error: insertError } = await adminClient.from("user_roles").insert({ user_id: userId, role });
  if (insertError) throw new Error(insertError.message);
};

// deno-lint-ignore no-explicit-any
const findAuthUserIdByEmail = async (adminClient: any, email: string) => {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);

    const users = data.users || [];
    const found = users.find((u: any) => (u.email || "").toLowerCase() === email.toLowerCase());
    if (found) return found.id;

    if (users.length < perPage) return null;
    page += 1;
  }
};

// deno-lint-ignore no-explicit-any
const listAllAuthUserIds = async (adminClient: any) => {
  const ids: string[] = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);

    const users = data.users || [];
    for (const u of users) {
      const id = String(u?.id || "").trim();
      if (id) ids.push(id);
    }

    if (users.length < perPage) break;
    page += 1;
  }

  return ids;
};

// deno-lint-ignore no-explicit-any
const listAllProfileUserIds = async (adminClient: any) => {
  const ids: string[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await adminClient.from("profiles").select("id").range(from, to);
    if (error) throw new Error(error.message);

    const rows = data || [];
    for (const row of rows) {
      const id = String((row as { id?: string }).id || "").trim();
      if (id) ids.push(id);
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return ids;
};

// deno-lint-ignore no-explicit-any
const resetPasswordsInBatches = async (adminClient: any, userIds: string[], password: string) => {
  const batchSize = 20;
  let updated = 0;
  const failed: Array<{ user_id: string; reason: string }> = [];

  for (let i = 0; i < userIds.length; i += batchSize) {
    const chunk = userIds.slice(i, i + batchSize);
    const results = await Promise.all(
      chunk.map(async (targetUserId) => {
        const { error } = await adminClient.auth.admin.updateUserById(targetUserId, {
          password,
        });
        return { targetUserId, error };
      }),
    );

    for (const result of results) {
      if (result.error) {
        failed.push({ user_id: result.targetUserId, reason: result.error.message });
      } else {
        updated += 1;
      }
    }
  }

  return { updated, failed };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: "Configuração Supabase ausente no ambiente." }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Token de autenticação ausente." }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await callerClient.auth.getUser();
    if (authError || !authData.user) return json({ error: "Não autenticado." }, 401);

    const { data: adminCheck, error: adminCheckError } = await callerClient.rpc("has_role", {
      _user_id: authData.user.id,
      _role: "admin",
    });

    if (adminCheckError) return json({ error: adminCheckError.message }, 403);
    if (!adminCheck) return json({ error: "Apenas admins podem gerenciar usuários." }, 403);

    const body = (await req.json()) as RequestPayload;
    const action = body.action;
    const payload = body.payload || {};

    if (!action) return json({ error: "Ação não informada." }, 400);

    const adminClient = createClient(supabaseUrl, serviceKey);

    if (action === "create_user") {
      const p = payload as UserPayload;
      const name = String(p.name || "").trim();
      const userCode = normalizeUserCode(p.user_code);
      const role = normalizeRole(p.role);
      const rawPassword = typeof p.password === "string" ? p.password.trim() : "";
      if (role === "admin" && !rawPassword) {
        return json({ error: "Senha obrigatoria para usuarios admin." }, 400);
      }
      const password = rawPassword || "Oi@12345";

      if (!name || !userCode) return json({ error: "Nome e código do usuário são obrigatórios." }, 400);

      const email = buildEmail(userCode);
      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });

      if (createError || !created.user?.id) return json({ error: createError?.message || "Falha ao criar usuário." }, 400);

      const userId = created.user.id;
      const { error: profileError } = await adminClient
        .from("profiles")
        .update({ name, user_code: userCode, active: true })
        .eq("id", userId);

      if (profileError) return json({ error: profileError.message }, 400);
      await applyRole(adminClient, userId, role);

      return json({ success: true, user_id: userId, email });
    }

    if (action === "update_user") {
      const p = payload as UserPayload;
      const userId = String(p.user_id || "").trim();
      if (!userId) return json({ error: "ID do usuário é obrigatório." }, 400);

      const updates: Record<string, unknown> = {};
      if (typeof p.name === "string") updates.name = p.name.trim();
      if (typeof p.user_code !== "undefined") updates.user_code = normalizeUserCode(p.user_code);
      if (typeof p.active === "boolean") updates.active = p.active;

      if (Object.keys(updates).length) {
        const { error: profileError } = await adminClient.from("profiles").update(updates).eq("id", userId);
        if (profileError) return json({ error: profileError.message }, 400);
      }

      if (typeof p.role !== "undefined") {
        await applyRole(adminClient, userId, normalizeRole(p.role));
      }

      if (typeof p.password === "string" && p.password.trim()) {
        const { error: passError } = await adminClient.auth.admin.updateUserById(userId, {
          password: p.password.trim(),
        });
        if (passError) return json({ error: passError.message }, 400);
      }

      return json({ success: true });
    }

    if (action === "delete_user") {
      const p = payload as UserPayload;
      const userId = String(p.user_id || "").trim();
      if (!userId) return json({ error: "ID do usuário é obrigatório." }, 400);

      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "seed_users") {
      const p = payload as SeedPayload;
      const users = Array.isArray(p.users) ? p.users : [];
      const defaultPassword = String(p.default_password || "").trim() || "Oi@12345";

      let created = 0;
      let updated = 0;
      const failed: Array<{ user_code: string; name: string; reason: string }> = [];

      for (const entry of users) {
        const name = String(entry.name || "").trim();
        const userCode = normalizeUserCode(entry.user_code);
        const role = normalizeRole(entry.role);

        if (!name || !userCode) {
          failed.push({ user_code: userCode, name, reason: "Nome ou código inválido." });
          continue;
        }

        try {
          let userId: string | null = null;
          const { data: existingProfile, error: existingProfileError } = await adminClient
            .from("profiles")
            .select("id")
            .eq("user_code", userCode)
            .maybeSingle();

          if (existingProfileError) throw new Error(existingProfileError.message);
          if (existingProfile?.id) {
            userId = existingProfile.id;
          } else {
            if (role === "admin") {
              throw new Error("Seed nao cria usuario admin sem senha explicita. Crie o admin manualmente.");
            }
            const email = buildEmail(userCode);
            const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
              email,
              password: defaultPassword,
              email_confirm: true,
              user_metadata: { name },
            });

            if (createError) {
              if (createError.message.includes("already been registered")) {
                userId = await findAuthUserIdByEmail(adminClient, email);
              } else {
                throw new Error(createError.message);
              }
            } else {
              userId = createdUser.user?.id ?? null;
              created += 1;
            }
          }

          if (!userId) throw new Error("Não foi possível resolver o ID do usuário.");

          const { error: profileUpdateError } = await adminClient
            .from("profiles")
            .update({ name, user_code: userCode, active: true })
            .eq("id", userId);

          if (profileUpdateError) throw new Error(profileUpdateError.message);

          await applyRole(adminClient, userId, role);

          // Reset password for non-admin users (keep admins untouched).
          if (role !== "admin") {
            const { error: passError } = await adminClient.auth.admin.updateUserById(userId, {
              password: defaultPassword,
            });
            if (passError) throw new Error(passError.message);
          }
          updated += 1;
        } catch (error) {
          failed.push({
            user_code: userCode,
            name,
            reason: error instanceof Error ? error.message : "Falha desconhecida",
          });
        }
      }

      return json({
        success: true,
        total: users.length,
        created,
        updated,
        failed: failed.length,
        failures: failed,
      });
    }

    if (action === "reset_passwords") {
      const p = payload as ResetPasswordPayload;
      const defaultPassword = String(p.default_password || "").trim() || "Oi@12345";
      const resetAll = p.reset_all === true;
      const userId = String(p.user_id || "").trim();

      if (!resetAll && !userId) {
        return json({ error: "ID do usuario e obrigatorio para reset individual." }, 400);
      }

      if (!resetAll) {
        const result = await resetPasswordsInBatches(adminClient, [userId], defaultPassword);
        if (result.failed.length) {
          return json({ error: result.failed[0].reason }, 400);
        }
        return json({ success: true, total: 1, updated: 1, failed: 0, failures: [] });
      }

      const [profileIds, authUserIds] = await Promise.all([
        listAllProfileUserIds(adminClient),
        listAllAuthUserIds(adminClient),
      ]);

      const profileSet = new Set(profileIds);
      const targetIds = authUserIds.filter((id) => profileSet.has(id));

      const { updated, failed } = await resetPasswordsInBatches(adminClient, targetIds, defaultPassword);

      return json({
        success: true,
        total: targetIds.length,
        updated,
        failed: failed.length,
        failures: failed,
      });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});
