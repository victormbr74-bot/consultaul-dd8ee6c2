import { supabase } from "@/integrations/supabase/client";
import { detectClientMetadata, type DeviceType } from "@/lib/clientMetadata";

export type AuditStatus = "success" | "error" | "denied";

export type AuditEventInput = {
  action: string;
  module?: string;
  entity?: string;
  entityId?: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  status?: AuditStatus;
  message?: string;
  observation?: string;
};

const SENSITIVE_KEYS = ["password", "senha", "token", "secret", "authorization", "apikey"];
const DOWNLOAD_ACTION_PATTERNS = ["export", "download", "baix", "xlsx", "csv", "pdf"];

export function shouldPersistAuditEvent(action: string): boolean {
  const normalized = action.toLowerCase();
  return DOWNLOAD_ACTION_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function maskSensitiveValues(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskSensitiveValues);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      const normalizedKey = key.toLowerCase();
      if (SENSITIVE_KEYS.some((sensitive) => normalizedKey.includes(sensitive))) {
        return [key, "[REDACTED]"];
      }
      return [key, maskSensitiveValues(entry)];
    }),
  );
}

export async function logAuditEvent(input: AuditEventInput) {
  if (!shouldPersistAuditEvent(input.action)) return;

  const metadata = detectClientMetadata();
  const requestPath = `${window.location.pathname}${window.location.search}`;
  const payload = {
    action: input.action,
    module: input.module,
    entity: input.entity,
    entity_id: input.entityId,
    old_values: maskSensitiveValues(input.oldValues ?? null),
    new_values: maskSensitiveValues(input.newValues ?? null),
    request_method: "CLIENT",
    request_path: requestPath,
    status: input.status ?? "success",
    message: input.message,
    observation: input.observation,
    browser: metadata.browser,
    os: metadata.os,
    device_type: metadata.deviceType,
  };

  try {
    const { error } = await supabase.functions.invoke("lgpd-audit", {
      body: { action: "log_audit", payload },
    });
    if (!error) return;
  } catch {
    // Fallback below keeps local environments usable before the Edge Function is deployed.
  }

  try {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    await supabase.from("audit_logs" as never).insert({
      user_id: user?.id ?? null,
      user_name: String(user?.user_metadata?.name ?? "") || null,
      user_email: user?.email ?? null,
      action: payload.action,
      module: payload.module ?? null,
      entity: payload.entity ?? null,
      entity_id: payload.entity_id ?? null,
      old_values: payload.old_values as never,
      new_values: payload.new_values as never,
      user_agent: metadata.userAgent,
      browser: metadata.browser,
      os: metadata.os,
      device_type: metadata.deviceType as DeviceType,
      request_method: payload.request_method,
      request_path: payload.request_path,
      status: payload.status,
      message: payload.message ?? null,
      observation: payload.observation ?? null,
      origin: window.location.origin,
    } as never);
  } catch (error) {
    console.error("audit failed", error);
  }
}

export async function exportOwnPersonalData() {
  const { data, error } = await supabase.functions.invoke("lgpd-audit", {
    body: { action: "export_personal_data", payload: {} },
  });
  if (error) throw error;
  return data;
}

export async function requestUserAnonymization(userId: string) {
  const { data, error } = await supabase.functions.invoke("lgpd-audit", {
    body: { action: "anonymize_user", payload: { user_id: userId } },
  });
  if (error) throw error;
  return data;
}
