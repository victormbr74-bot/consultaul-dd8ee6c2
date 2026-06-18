import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2, Upload, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportToXlsx } from "@/modules/consulta-massiva/lib/excel";
import { logAudit } from "@/modules/consulta-massiva/lib/audit";
import { AdminGuard } from "@/modules/consulta-massiva/components/AdminGuard";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import type { DbOperadora } from "@/modules/consulta-massiva/lib/db-types";

const PAGE = 50;

export default function Page() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [edit, setEdit] = useState<Partial<DbOperadora> | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const q = useQuery({
    queryKey: ["operadoras", search, page],
    queryFn: async () => {
      let qb = supabase.from("operadoras").select("*", { count: "exact" })
        .order("designacao", { ascending: true })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (search.trim()) {
        const s = search.trim();
        qb = qb.or(`designacao.ilike.%${s}%,ip_loopback.ilike.%${s}%,operadora.ilike.%${s}%`);
      }
      const { data, count, error } = await qb;
      if (error) throw error;
      return { rows: (data ?? []) as DbOperadora[], total: count ?? 0 };
    },
  });

  const save = async () => {
    if (!edit) return;
    const payload = {
      designacao: edit.designacao ?? "",
      ip_loopback: edit.ip_loopback ?? "",
      ip_loopback_secundario: edit.ip_loopback_secundario ?? "",
      operadora: edit.operadora ?? "",
      tipo_empresa: (edit.tipo_empresa ?? "VTAL") as "VTAL"|"OEMP",
      ativo: edit.ativo ?? true,
    };
    if (!payload.operadora) { toast.error("Operadora é obrigatória"); return; }
    let err;
    if (edit.id) {
      ({ error: err } = await supabase.from("operadoras").update(payload).eq("id", edit.id));
      await logAudit("UPDATE_OPERADORA", "operadoras", { id: edit.id });
    } else {
      ({ error: err } = await supabase.from("operadoras").insert(payload));
      await logAudit("INSERT_OPERADORA", "operadoras", payload);
    }
    if (err) { toast.error(err.message); return; }
    toast.success("Salvo"); setEdit(null);
    qc.invalidateQueries({ queryKey: ["operadoras"] });
    qc.invalidateQueries({ queryKey: ["operadoras-all"] });
  };

  const del = async (id: string) => {
    if (!confirm("Excluir registro?")) return;
    const { error } = await supabase.from("operadoras").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await logAudit("DELETE_OPERADORA", "operadoras", { id });
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["operadoras"] });
    qc.invalidateQueries({ queryKey: ["operadoras-all"] });
  };

  const exportAll = async () => {
    const { data } = await supabase.from("operadoras").select("*").order("designacao");
    exportToXlsx((data ?? []).map((r) => ({
      Designação: r.designacao, "IP Loopback": r.ip_loopback, "IP Loopback Sec": r.ip_loopback_secundario,
      Operadora: r.operadora, "Tipo Empresa": r.tipo_empresa, Ativo: r.ativo,
    })), "operadoras.xlsx");
  };

  const importXlsx = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
      const norm = (v: unknown) => String(v ?? "").trim();
      const records = rows.map((r) => {
        const tipo = norm(r["Tipo Empresa"] ?? r["tipo_empresa"]).toUpperCase();
        return {
          designacao: norm(r["Designação"] ?? r["designacao"]).toUpperCase(),
          ip_loopback: norm(r["IP Loopback"] ?? r["ip_loopback"]),
          ip_loopback_secundario: norm(r["IP Loopback Sec"] ?? r["ip_loopback_secundario"]),
          operadora: norm(r["Operadora"] ?? r["operadora"]).toUpperCase(),
          tipo_empresa: (tipo === "OEMP" ? "OEMP" : "VTAL") as "VTAL"|"OEMP",
          ativo: true,
        };
      }).filter((r) => r.operadora);
      // Batch insert
      for (let i = 0; i < records.length; i += 500) {
        const { error } = await supabase.from("operadoras").insert(records.slice(i, i + 500));
        if (error) throw error;
      }
      await logAudit("IMPORT_OPERADORAS", "operadoras", { total: records.length, arquivo: file.name });
      toast.success(`${records.length} operadoras importadas`);
      qc.invalidateQueries({ queryKey: ["operadoras"] });
      qc.invalidateQueries({ queryKey: ["operadoras-all"] });
    } catch (e) {
      toast.error("Falha import: " + (e as Error).message);
    }
  };

  const totalPages = Math.max(1, Math.ceil((q.data?.total ?? 0) / PAGE));

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-6">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-bold">Operadoras</h1>
        <span className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-mono">{q.data?.total ?? 0} registros</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importXlsx(f); e.currentTarget.value = ""; }} />
          <Button size="sm" variant="outline" onClick={() => importRef.current?.click()}><Upload className="h-4 w-4" /> Importar</Button>
          <Button size="sm" variant="outline" onClick={exportAll}><Download className="h-4 w-4" /> Exportar</Button>
          <Button size="sm" onClick={() => setEdit({ tipo_empresa: "VTAL", ativo: true })}><Plus className="h-4 w-4" /> Novo</Button>
        </div>
      </header>

      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Buscar por designação, IP ou operadora..."
          value={search} onChange={(e) => { setPage(0); setSearch(e.target.value); }} />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-left">
                <th className="px-3 py-2">Designação</th>
                <th className="px-3 py-2">IP Loopback</th>
                <th className="px-3 py-2">IP Loopback Sec</th>
                <th className="px-3 py-2">Operadora</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Ativo</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {q.data?.rows.map((r) => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-accent/30">
                  <td className="px-3 py-2 font-mono">{r.designacao}</td>
                  <td className="px-3 py-2 font-mono">{r.ip_loopback}</td>
                  <td className="px-3 py-2 font-mono">{r.ip_loopback_secundario}</td>
                  <td className="px-3 py-2 font-mono">{r.operadora}</td>
                  <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${r.tipo_empresa === "VTAL" ? "bg-noc-blue/15 text-noc-blue" : "bg-noc-yellow/15 text-noc-yellow"}`}>{r.tipo_empresa}</span></td>
                  <td className="px-3 py-2">{r.ativo ? "✓" : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="icon" variant="ghost" onClick={() => setEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              ))}
              {q.isLoading && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Carregando...</td></tr>}
              {!q.isLoading && (q.data?.rows.length ?? 0) === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Sem resultados.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border p-2 text-xs">
          <span className="text-muted-foreground">Página {page + 1} de {totalPages}</span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        </div>
      </div>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar Operadora" : "Nova Operadora"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-3">
            <div><Label>Designação</Label><Input value={edit?.designacao ?? ""} onChange={(e) => setEdit({ ...edit!, designacao: e.target.value.toUpperCase() })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>IP Loopback</Label><Input value={edit?.ip_loopback ?? ""} onChange={(e) => setEdit({ ...edit!, ip_loopback: e.target.value })} /></div>
              <div><Label>IP Loopback Sec.</Label><Input value={edit?.ip_loopback_secundario ?? ""} onChange={(e) => setEdit({ ...edit!, ip_loopback_secundario: e.target.value })} /></div>
            </div>
            <div><Label>Operadora *</Label><Input value={edit?.operadora ?? ""} onChange={(e) => setEdit({ ...edit!, operadora: e.target.value.toUpperCase() })} /></div>
            <div><Label>Tipo Empresa</Label>
              <Select value={edit?.tipo_empresa ?? "VTAL"} onValueChange={(v) => setEdit({ ...edit!, tipo_empresa: v as "VTAL"|"OEMP" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="VTAL">VTAL</SelectItem>
                  <SelectItem value="OEMP">OEMP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit?.ativo ?? true} onChange={(e) => setEdit({ ...edit!, ativo: e.target.checked })} /> Ativo</label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
