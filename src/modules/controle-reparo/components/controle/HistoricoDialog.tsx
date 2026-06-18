import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { formatDateBR } from "@/modules/controle-reparo/lib/date";
import { hasControleVersaoColumn } from "@/modules/controle-reparo/lib/db";
import { History } from "lucide-react";

const CAMPO_LABEL: Record<string, string> = {
  ordem: "Ordem",
  novo_circuito: "Novo Circuito",
  situacao: "Situação",
  status_planilha: "Status Planilha",
  status_jira: "Status Jira",
  obs: "Obs",
  responsavel: "Responsável",
  status_zabbix: "Status Zabbix",
};

export function HistoricoDialog({
  codigo,
  loterica,
  open,
  onOpenChange,
}: {
  codigo: string | null;
  loterica: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: hist } = useQuery({
    queryKey: ["historico", codigo],
    enabled: !!codigo && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historico_tratativas")
        .select("*")
        .eq("codigo_loterica", codigo!)
        .order("data_hora", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: snapshots } = useQuery({
    queryKey: ["historico-snap", codigo],
    enabled: !!codigo && open,
    queryFn: async () => {
      const supportsVersao = await hasControleVersaoColumn();
      if (!supportsVersao) {
        const { data, error } = await supabase
          .from("controle_diario")
          .select("data_referencia, status_normalizacao, situacao, responsavel, status_planilha")
          .eq("codigo_loterica", codigo!)
          .order("data_referencia", { ascending: false });
        if (error) throw error;
        return (data ?? []).map((row) => ({ ...row, versao: 1 }));
      }

      const { data, error } = await supabase
        .from("controle_diario")
        .select(
          "data_referencia, versao, status_normalizacao, situacao, responsavel, status_planilha",
        )
        .eq("codigo_loterica", codigo!)
        .order("data_referencia", { ascending: false })
        .order("versao", { ascending: false });
      if (error) {
        const message = error.message?.toLowerCase() ?? "";
        const missingVersao =
          error.code === "42703" ||
          message.includes("column controle_diario.versao does not exist") ||
          (message.includes("schema cache") && message.includes("versao"));
        if (!missingVersao) throw error;

        const fallback = await supabase
          .from("controle_diario")
          .select("data_referencia, status_normalizacao, situacao, responsavel, status_planilha")
          .eq("codigo_loterica", codigo!)
          .order("data_referencia", { ascending: false });
        if (fallback.error) throw fallback.error;
        return (fallback.data ?? []).map((row) => ({ ...row, versao: 1 }));
      }
      return data;
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico — {codigo} {loterica ? `· ${loterica}` : ""}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-6">
            <section>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                Linha do tempo de alterações
              </h3>
              {(hist ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>
              ) : (
                <ol className="relative space-y-4 border-l pl-5">
                  {(hist ?? []).map((h) => (
                    <li key={h.id} className="relative">
                      <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-primary" />
                      <div className="text-xs text-muted-foreground">
                        {new Date(h.data_hora).toLocaleString("pt-BR")} · {h.usuario ?? "—"}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">{CAMPO_LABEL[h.campo] ?? h.campo}:</span>{" "}
                        <span className="text-muted-foreground line-through">
                          {h.valor_anterior || "vazio"}
                        </span>{" "}
                        → <span className="font-medium">{h.valor_novo || "vazio"}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Presença diária</h3>
              <div className="space-y-1">
                {(snapshots ?? []).map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <span>
                      {formatDateBR(s.data_referencia)} · V{s.versao ?? 1}
                    </span>
                    <div className="flex items-center gap-2">
                      {s.situacao && <Badge variant="outline">{s.situacao}</Badge>}
                      <Badge
                        className={
                          s.status_normalizacao === "NORMALIZADO"
                            ? "bg-faixa-ok text-faixa-ok-foreground"
                            : "bg-faixa-atencao text-faixa-atencao-foreground"
                        }
                      >
                        {s.status_normalizacao}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
