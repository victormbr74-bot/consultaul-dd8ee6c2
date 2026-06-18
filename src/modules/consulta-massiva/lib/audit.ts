import { supabase } from "@/integrations/supabase/client";

export async function logAudit(acao: string, entidade?: string, detalhes?: Record<string, unknown>) {
  try {
    // user_id and user_email are set server-side by a BEFORE INSERT trigger
    // to prevent log poisoning. Do not send them from the client.
    await supabase.from("auditoria").insert({
      acao,
      entidade: entidade ?? null,
      detalhes: (detalhes ?? null) as never,
    } as never);
  } catch (e) {
    console.error("audit failed", e);
  }
}
