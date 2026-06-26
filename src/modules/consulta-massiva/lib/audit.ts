import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/lib/audit";

export async function logAudit(acao: string, entidade?: string, detalhes?: Record<string, unknown>) {
  try {
    await logAuditEvent({
      action: acao.toLowerCase(),
      module: "consulta-massiva",
      entity: entidade,
      entityId: typeof detalhes?.id === "string" ? detalhes.id : undefined,
      newValues: detalhes ?? null,
      message: `Evento ${acao} em ${entidade ?? "consulta-massiva"}.`,
      observation: `Usuario executou ${acao} no modulo Consulta Massiva${entidade ? ` (${entidade})` : ""}.`,
    });

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
