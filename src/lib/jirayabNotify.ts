import { supabase } from "@/integrations/supabase/client";

export type JirayabEvent = "update" | "approved_change" | "manual";

/**
 * Dispara o webhook do Jirayab (n8n) para uma UL. Falhas são logadas e
 * silenciadas para não interromper o fluxo principal de salvamento.
 */
export const notifyJirayab = async (
  codUl: string,
  event: JirayabEvent = "update",
  extra?: Record<string, unknown>,
) => {
  const code = String(codUl || "").trim();
  if (!code) return;
  try {
    const { data, error } = await supabase.functions.invoke("notify-jirayab", {
      body: { cod_ul: code, event, source: "consulta-ul", extra },
    });
    if (error) console.warn("[jirayab] falhou", code, error.message);
    else if ((data as any)?.skipped) console.info("[jirayab] skipped", (data as any).reason);
  } catch (e) {
    console.warn("[jirayab] exception", e);
  }
};

export const notifyJirayabBatch = async (
  codes: string[],
  event: JirayabEvent = "update",
) => {
  await Promise.allSettled(codes.map((c) => notifyJirayab(c, event)));
};
