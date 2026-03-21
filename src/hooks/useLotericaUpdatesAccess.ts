import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export const useLotericaUpdatesAccess = () => {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchSetting = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: queryError } = await (supabase as any)
          .from("app_settings")
          .select("value_boolean")
          .eq("key", "loterica_updates_enabled")
          .maybeSingle();

        if (queryError) {
          const message = String((queryError as any)?.message || "");
          if (message.includes("app_settings") && message.includes("Could not find the table")) {
            if (cancelled) return;
            setEnabled(true);
            setError(
              "Banco desatualizado: falta a tabela app_settings.\n" +
                "Aplique a migracao Supabase '20260306103000_loterica_updates_global_toggle.sql'.",
            );
            return;
          }

          throw new Error(message || "Erro ao carregar configuracao de atualizacao.");
        }

        if (cancelled) return;
        setEnabled(Boolean((data as any)?.value_boolean ?? true));
      } catch (fetchError) {
        if (cancelled) return;
        console.error("Falha inesperada ao carregar configuracao de atualizacao", fetchError);
        setEnabled(true);
        setError(
          fetchError instanceof Error ? fetchError.message : "Erro ao carregar configuracao de atualizacao.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchSetting();

    return () => {
      cancelled = true;
    };
  }, []);

  return { enabled, loading, error };
};
