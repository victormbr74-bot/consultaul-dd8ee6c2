import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DeviceType = "desktop" | "mobile" | "tablet" | "unknown";
type AuditStatus = "success" | "error" | "denied";

type AuditPayload = {
  action: string;
  module?: string;
  entity?: string;
  entity_id?: string;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  request_method?: string;
  request_path?: string;
  status?: AuditStatus;
  message?: string;
  observation?: string;
  browser?: string;
  os?: string;
  device_type?: DeviceType;
};

type RequestPayload =
  | { action: "log_audit"; payload?: AuditPayload }
  | { action: "accept_consent"; payload?: { terms_version_id?: string; privacy_policy_version_id?: string; browser?: string; os?: string; device_type?: DeviceType } }
  | { action: "export_personal_data"; payload?: Record<string, never> }
  | { action: "anonymize_user"; payload?: { user_id?: string } };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const asString = (value: unknown) => String(value ?? "").trim();

const getClientIp = (req: Request) => {
  const forwarded = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "";
  const first = forwarded.split(",")[0]?.trim();
  return first || null;
};

const maskSensitive = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(maskSensitive);
  if (!value || typeof value !== "object") return value;

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.toLowerCase();
    if (
      normalized.includes("password") ||
      normalized.includes("senha") ||
      normalized.includes("token") ||
      normalized.includes("secret") ||
      normalized.includes("authorization") ||
      normalized.includes("apikey")
    ) {
      output[key] = "[REDACTED]";
    } else {
      output[key] = maskSensitive(entry);
    }
  }
  return output;
};

const isAdminRole = (role: string) =>
  role === "admin" || role === "ADMIN" || role === "administrador" || role === "administrador_master";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: "Configuracao Supabase ausente." }, 500);
    }

    const body = (await req.json()) as RequestPayload;
    const authHeader = req.headers.get("Authorization");
    const clientIp = getClientIp(req);
    const userAgent = req.headers.get("user-agent");
    const adminClient = createClient(supabaseUrl, serviceKey);

    if (!authHeader && body.action === "log_audit" && body.payload?.action === "login_failed") {
      const payload = body.payload;
      const { error } = await adminClient.from("audit_logs").insert({
        user_id: null,
        user_name: null,
        user_email: null,
        action: "login_failed",
        module: payload.module || "auth",
        entity: payload.entity || "auth.users",
        entity_id: null,
        old_values: null,
        new_values: maskSensitive(payload.new_values ?? null),
        ip_address: clientIp,
        user_agent: userAgent,
        browser: payload.browser || null,
        os: payload.os || null,
        device_type: payload.device_type || "unknown",
        request_method: payload.request_method || req.method,
        request_path: payload.request_path || new URL(req.url).pathname,
        status: "denied",
        message: payload.message || "Tentativa de login invalida.",
        observation: payload.observation || "Usuario tentou acessar o sistema com credenciais invalidas.",
        origin: req.headers.get("origin"),
      });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (!authHeader) return json({ error: "Token de autenticacao ausente." }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      if (body.action === "log_audit" && body.payload?.action === "login_failed") {
        const payload = body.payload;
        const { error } = await adminClient.from("audit_logs").insert({
          user_id: null,
          user_name: null,
          user_email: null,
          action: "login_failed",
          module: payload.module || "auth",
          entity: payload.entity || "auth.users",
          entity_id: null,
          old_values: null,
          new_values: maskSensitive(payload.new_values ?? null),
          ip_address: clientIp,
          user_agent: userAgent,
          browser: payload.browser || null,
          os: payload.os || null,
          device_type: payload.device_type || "unknown",
          request_method: payload.request_method || req.method,
          request_path: payload.request_path || new URL(req.url).pathname,
          status: "denied",
          message: payload.message || "Tentativa de login invalida.",
          observation: payload.observation || "Usuario tentou acessar o sistema com credenciais invalidas.",
          origin: req.headers.get("origin"),
        });
        if (error) return json({ error: error.message }, 400);
        return json({ success: true });
      }
      return json({ error: "Nao autenticado." }, 401);
    }

    const user = authData.user;

    const { data: profile } = await adminClient
      .from("profiles")
      .select("name, email, user_code")
      .eq("id", user.id)
      .maybeSingle();

    const userName = asString(profile?.name) || asString(user.user_metadata?.name) || null;
    const userEmail = asString(profile?.email) || user.email || null;

    const insertAudit = async (payload: AuditPayload) => {
      const { error } = await adminClient.from("audit_logs").insert({
        user_id: user.id,
        user_name: userName,
        user_email: userEmail,
        action: asString(payload.action) || "unknown",
        module: asString(payload.module) || null,
        entity: asString(payload.entity) || null,
        entity_id: asString(payload.entity_id) || null,
        old_values: maskSensitive(payload.old_values ?? null),
        new_values: maskSensitive(payload.new_values ?? null),
        ip_address: clientIp,
        user_agent: userAgent,
        browser: asString(payload.browser) || null,
        os: asString(payload.os) || null,
        device_type: payload.device_type || "unknown",
        request_method: payload.request_method || req.method,
        request_path: payload.request_path || new URL(req.url).pathname,
        status: payload.status || "success",
        message: asString(payload.message) || null,
        observation: asString(payload.observation) || null,
        origin: req.headers.get("origin"),
      });
      if (error) throw new Error(error.message);
    };

    if (body.action === "log_audit") {
      const payload = body.payload;
      if (!payload?.action) return json({ error: "Acao de auditoria ausente." }, 400);
      await insertAudit(payload);
      return json({ success: true });
    }

    if (body.action === "accept_consent") {
      const payload = body.payload || {};
      const termsVersionId = asString(payload.terms_version_id);
      const privacyPolicyVersionId = asString(payload.privacy_policy_version_id);
      if (!termsVersionId || !privacyPolicyVersionId) {
        return json({ error: "Versoes dos termos e politica sao obrigatorias." }, 400);
      }

      const { error } = await adminClient.from("user_consents").upsert({
        user_id: user.id,
        terms_version_id: termsVersionId,
        privacy_policy_version_id: privacyPolicyVersionId,
        accepted_at: new Date().toISOString(),
        ip_address: clientIp,
        user_agent: userAgent,
        browser: asString(payload.browser) || null,
        os: asString(payload.os) || null,
        device_type: payload.device_type || "unknown",
      }, { onConflict: "user_id,terms_version_id,privacy_policy_version_id" });
      if (error) return json({ error: error.message }, 400);

      await insertAudit({
        action: "terms_accepted",
        module: "lgpd",
        entity: "user_consents",
        entity_id: user.id,
        new_values: {
          terms_version_id: termsVersionId,
          privacy_policy_version_id: privacyPolicyVersionId,
        },
        browser: payload.browser,
        os: payload.os,
        device_type: payload.device_type,
        status: "success",
        message: "Usuario aceitou Termos de Uso e Politica de Privacidade.",
        observation: "Usuario aceitou os Termos de Uso e a Politica de Privacidade vigentes.",
      });

      return json({ success: true });
    }

    if (body.action === "export_personal_data") {
      const { data: roles } = await adminClient.from("user_roles").select("role").eq("user_id", user.id);
      const { data: consents } = await adminClient.from("user_consents").select("*").eq("user_id", user.id);
      const { data: ownAudit } = await adminClient
        .from("audit_logs")
        .select("id, action, module, entity, status, message, created_at, ip_address, browser, os, device_type")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1000);

      await insertAudit({
        action: "personal_data_exported",
        module: "lgpd",
        entity: "profiles",
        entity_id: user.id,
        status: "success",
        message: "Usuario exportou seus dados pessoais.",
        observation: "Usuario baixou seus dados pessoais do sistema.",
      });

      return json({
        exported_at: new Date().toISOString(),
        user: {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
        },
        profile,
        roles: roles ?? [],
        consents: consents ?? [],
        audit_events: ownAudit ?? [],
      });
    }

    if (body.action === "anonymize_user") {
      const { data: roles } = await adminClient.from("user_roles").select("role").eq("user_id", user.id);
      if (!roles?.some((row: { role: string }) => isAdminRole(row.role))) {
        await insertAudit({
          action: "personal_data_anonymize_denied",
          module: "admin",
          entity: "profiles",
          status: "denied",
          message: "Usuario sem permissao tentou anonimizar dados pessoais.",
          observation: "Usuario tentou anonimizar dados pessoais sem permissao administrativa.",
        });
        return json({ error: "Apenas administradores podem anonimizar usuarios." }, 403);
      }

      const targetUserId = asString(body.payload?.user_id);
      if (!targetUserId) return json({ error: "Usuario alvo obrigatorio." }, 400);
      const { error } = await userClient.rpc("admin_anonymize_user", { _target_user_id: targetUserId });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Acao invalida." }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});
