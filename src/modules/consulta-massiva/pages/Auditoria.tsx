import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import { exportToCsv, exportToPdf, exportToXlsx } from "@/modules/consulta-massiva/lib/excel";
import { formatAction, formatDetalhes } from "@/modules/consulta-massiva/lib/audit-format";
import { AdminGuard } from "@/modules/consulta-massiva/components/AdminGuard";

export default function Page() {
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["auditoria"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auditoria")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = (q.data ?? []).filter((r) =>
    !search ||
    r.acao.toLowerCase().includes(search.toLowerCase()) ||
    formatAction(r.acao).toLowerCase().includes(search.toLowerCase()) ||
    (r.user_email ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (r.entidade ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const exportRows = rows.map((r) => ({
    "Data/Hora": new Date(r.created_at).toLocaleString("pt-BR"),
    Usuário: r.user_email ?? "",
    Ação: formatAction(r.acao),
    Entidade: r.entidade ?? "",
    Descrição: formatDetalhes(r.acao, r.detalhes as Record<string, unknown> | null, r.entidade),
  }));

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-6">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-bold">Auditoria</h1>
        <span className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-mono">{rows.length} de 500</span>
        <Input className="ml-4 max-w-xs" placeholder="Filtrar..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="outline" onClick={() => exportToCsv(exportRows, "auditoria.csv")}>CSV</Button>
          <Button size="sm" variant="outline" onClick={() => exportToXlsx(exportRows, "auditoria.xlsx")}><Download className="h-4 w-4" /> XLSX</Button>
          <Button size="sm" variant="outline" onClick={() => exportToPdf(exportRows, "auditoria.pdf", "Auditoria")}><FileText className="h-4 w-4" /> PDF</Button>
        </div>
      </header>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="max-h-[75vh] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-left">
                <th className="px-3 py-2">Data/Hora</th>
                <th className="px-3 py-2">Usuário</th>
                <th className="px-3 py-2">Ação</th>
                <th className="px-3 py-2">Entidade</th>
                <th className="px-3 py-2">Descrição</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-2 font-mono">{r.user_email ?? "-"}</td>
                  <td className="px-3 py-2"><span className="rounded bg-noc-blue/15 px-1.5 py-0.5 text-[11px] text-noc-blue">{formatAction(r.acao)}</span></td>
                  <td className="px-3 py-2 font-mono">{r.entidade ?? "-"}</td>
                  <td className="px-3 py-2 max-w-[520px] text-[12px] text-foreground/90">
                    {formatDetalhes(r.acao, r.detalhes as Record<string, unknown> | null, r.entidade)}
                  </td>
                </tr>
              ))}
              {!rows.length && !q.isLoading && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Sem eventos.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
