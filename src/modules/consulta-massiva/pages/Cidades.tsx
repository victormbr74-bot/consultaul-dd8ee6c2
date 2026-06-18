import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2, Upload, Download, MapPin } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { exportToXlsx } from "@/modules/consulta-massiva/lib/excel";
import { logAudit } from "@/modules/consulta-massiva/lib/audit";
import { AdminGuard } from "@/modules/consulta-massiva/components/AdminGuard";
import {
  parseCidadesRows,
  upsertCidades,
  type DbBaseCidade,
} from "@/modules/consulta-massiva/lib/base-cidades";
import { normalizeCidade, normalizeUf } from "@/modules/consulta-massiva/lib/geo";

const PAGE = 50;
type EditRow = Partial<DbBaseCidade> & { id?: string };

export default function Page() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [edit, setEdit] = useState<EditRow | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const q = useQuery({
    queryKey: ["base_cidades", search, page],
    queryFn: async () => {
      let qb = supabase
        .from("base_cidades" as never)
        .select("*", { count: "exact" })
        .order("uf", { ascending: true })
        .order("cidade", { ascending: true })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      const s = search.trim();
      if (s) {
        const safe = s.replace(/[%,]/g, "");
        qb = qb.or(`cidade.ilike.%${safe}%,uf.ilike.%${safe}%`);
      }
      const { data, count, error } = await qb;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as DbBaseCidade[], total: count ?? 0 };
    },
  });

  const save = async () => {
    if (!edit) return;
    const cidade = String(edit.cidade ?? "").trim();
    const uf = normalizeUf(edit.uf ?? "");
    const lat = Number(edit.latitude);
    const lon = Number(edit.longitude);
    if (!cidade) return toast.error("Cidade é obrigatória");
    if (uf.length !== 2) return toast.error("UF inválida");
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return toast.error("Latitude inválida");
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) return toast.error("Longitude inválida");
    const payload = {
      cidade,
      uf,
      latitude: lat,
      longitude: lon,
      cidade_normalizada: normalizeCidade(cidade),
    };
    let err;
    if (edit.id) {
      ({ error: err } = await supabase.from("base_cidades" as never).update(payload as never).eq("id", edit.id));
      await logAudit("UPDATE_BASE_CIDADE", "base_cidades", { id: edit.id });
    } else {
      ({ error: err } = await supabase.from("base_cidades" as never).upsert(payload as never, { onConflict: "cidade_normalizada,uf" }));
      await logAudit("INSERT_BASE_CIDADE", "base_cidades", payload);
    }
    if (err) return toast.error(err.message);
    toast.success("Salvo");
    setEdit(null);
    qc.invalidateQueries({ queryKey: ["base_cidades"] });
    qc.invalidateQueries({ queryKey: ["base_cidades-all"] });
  };

  const del = async (id: string) => {
    if (!confirm("Excluir registro?")) return;
    const { error } = await supabase.from("base_cidades" as never).delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logAudit("DELETE_BASE_CIDADE", "base_cidades", { id });
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["base_cidades"] });
    qc.invalidateQueries({ queryKey: ["base_cidades-all"] });
  };

  const exportAll = async () => {
    const { data } = await supabase
      .from("base_cidades" as never)
      .select("cidade,uf,latitude,longitude")
      .order("uf")
      .order("cidade");
    const rows = (data ?? []) as unknown as Array<{ cidade: string; uf: string; latitude: number; longitude: number }>;
    exportToXlsx(rows.map((r) => ({
      Cidade: r.cidade, UF: r.uf, Latitude: r.latitude, Longitude: r.longitude,
    })), "base_cidades.xlsx");
  };

  const importXlsx = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
      const { valid, errors } = parseCidadesRows(rows);
      if (!valid.length) {
        toast.error(`Nenhum registro válido. ${errors.length} erro(s).`);
        return;
      }
      const { inserted } = await upsertCidades(valid);
      await logAudit("IMPORT_BASE_CIDADES", "base_cidades", {
        arquivo: file.name, total: inserted, erros: errors.length,
      });
      toast.success(`${inserted} cidades importadas${errors.length ? ` (${errors.length} ignoradas)` : ""}`);
      qc.invalidateQueries({ queryKey: ["base_cidades"] });
      qc.invalidateQueries({ queryKey: ["base_cidades-all"] });
    } catch (e) {
      toast.error("Falha import: " + (e as Error).message);
    }
  };

  const totalPages = Math.max(1, Math.ceil((q.data?.total ?? 0) / PAGE));

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-6">
      <header className="flex flex-wrap items-center gap-2">
        <MapPin className="h-5 w-5 text-noc-blue" />
        <h1 className="text-lg font-bold">Base de Cidades</h1>
        <span className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-mono">{q.data?.total ?? 0} registros</span>
        <span className="rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">Usada para sinalização informativa de raio de 60 km</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importXlsx(f); e.currentTarget.value = ""; }} />
          <Button size="sm" variant="outline" onClick={() => importRef.current?.click()}><Upload className="h-4 w-4" /> Importar</Button>
          <Button size="sm" variant="outline" onClick={exportAll}><Download className="h-4 w-4" /> Exportar</Button>
          <Button size="sm" onClick={() => setEdit({})}><Plus className="h-4 w-4" /> Nova</Button>
        </div>
      </header>

      <p className="text-[11px] text-muted-foreground">
        Colunas esperadas no arquivo: <span className="font-mono">Cidade</span>, <span className="font-mono">UF</span>, <span className="font-mono">Latitude</span>, <span className="font-mono">Longitude</span>. A importação faz upsert por cidade+UF normalizado (sem acentos, case-insensitive).
      </p>

      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Buscar por cidade ou UF..." value={search} onChange={(e) => { setPage(0); setSearch(e.target.value); }} />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-left">
                <th className="px-3 py-2">Cidade</th>
                <th className="px-3 py-2">UF</th>
                <th className="px-3 py-2 text-right">Latitude</th>
                <th className="px-3 py-2 text-right">Longitude</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {q.data?.rows.map((r) => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-accent/30">
                  <td className="px-3 py-2">{r.cidade}</td>
                  <td className="px-3 py-2 font-mono">{r.uf}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.latitude}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.longitude}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="icon" variant="ghost" onClick={() => setEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              ))}
              {q.isLoading && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Carregando...</td></tr>}
              {!q.isLoading && (q.data?.rows.length ?? 0) === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Sem resultados.</td></tr>}
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
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar Cidade" : "Nova Cidade"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-3">
            <div><Label>Cidade *</Label><Input value={edit?.cidade ?? ""} onChange={(e) => setEdit({ ...edit!, cidade: e.target.value })} /></div>
            <div><Label>UF * (2 letras)</Label><Input maxLength={2} value={edit?.uf ?? ""} onChange={(e) => setEdit({ ...edit!, uf: e.target.value.toUpperCase() })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Latitude *</Label><Input type="number" step="any" value={edit?.latitude ?? ""} onChange={(e) => setEdit({ ...edit!, latitude: e.target.value === "" ? undefined : Number(e.target.value) })} /></div>
              <div><Label>Longitude *</Label><Input type="number" step="any" value={edit?.longitude ?? ""} onChange={(e) => setEdit({ ...edit!, longitude: e.target.value === "" ? undefined : Number(e.target.value) })} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
