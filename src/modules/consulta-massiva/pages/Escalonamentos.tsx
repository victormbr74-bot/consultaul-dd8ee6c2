import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, FileText, Mail, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { exportToCsv, exportToPdf, exportToXlsx } from "@/modules/consulta-massiva/lib/excel";
import { logAudit } from "@/modules/consulta-massiva/lib/audit";
import { AdminGuard } from "@/modules/consulta-massiva/components/AdminGuard";
import { toast } from "sonner";
import type { DbEscalonamento } from "@/modules/consulta-massiva/lib/db-types";

export default function Page() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Partial<DbEscalonamento> | null>(null);
  const [view, setView] = useState<DbEscalonamento | null>(null);
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["esc-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("escalonamentos").select("*").order("operadora");
      if (error) throw error;
      return (data ?? []) as DbEscalonamento[];
    },
  });

  const filtered = (q.data ?? []).filter((r) => !search || r.operadora.toLowerCase().includes(search.toLowerCase()));

  const save = async () => {
    if (!edit?.operadora) { toast.error("Operadora obrigatória"); return; }
    const payload = { ...edit, operadora: edit.operadora.toUpperCase() } as Partial<DbEscalonamento>;
    delete (payload as { id?: string }).id;
    delete (payload as { created_at?: string }).created_at;
    delete (payload as { updated_at?: string }).updated_at;
    let err;
    if (edit.id) ({ error: err } = await supabase.from("escalonamentos").update(payload).eq("id", edit.id));
    else ({ error: err } = await supabase.from("escalonamentos").insert(payload as never));
    if (err) { toast.error(err.message); return; }
    await logAudit(edit.id ? "UPDATE_ESCALONAMENTO" : "INSERT_ESCALONAMENTO", "escalonamentos", { operadora: payload.operadora });
    toast.success("Salvo"); setEdit(null);
    qc.invalidateQueries({ queryKey: ["esc-admin"] });
    qc.invalidateQueries({ queryKey: ["escalonamentos"] });
  };

  const del = async (id: string) => {
    if (!confirm("Excluir escalonamento?")) return;
    const { error } = await supabase.from("escalonamentos").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await logAudit("DELETE_ESCALONAMENTO", "escalonamentos", { id });
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["esc-admin"] });
    qc.invalidateQueries({ queryKey: ["escalonamentos"] });
  };

  const exportRows = filtered.map((r) => ({
    Operadora: r.operadora,
    N1: r.n1_nome, "N1 Tel": r.n1_telefone, "N1 Email": r.n1_email,
    N2: r.n2_nome, "N2 Tel": r.n2_telefone, "N2 Email": r.n2_email,
    N3: r.n3_nome, "N3 Tel": r.n3_telefone, "N3 Email": r.n3_email,
    N4: r.n4_nome, "N4 Tel": r.n4_telefone, "N4 Email": r.n4_email,
    Observação: r.observacao, Ativo: r.ativo ? "Sim" : "Não",
  }));

  const niveis = (r: DbEscalonamento) => [
    !!r.n1_nome, !!r.n2_nome, !!r.n3_nome, !!r.n4_nome,
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-6">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-bold">Escalonamentos</h1>
        <span className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-mono">{q.data?.length ?? 0} parceiras</span>
        <Input className="ml-4 max-w-xs" placeholder="Buscar operadora..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="outline" onClick={() => exportToCsv(exportRows, "escalonamentos.csv")}>CSV</Button>
          <Button size="sm" variant="outline" onClick={() => exportToXlsx(exportRows, "escalonamentos.xlsx")}><Download className="h-4 w-4" /> XLSX</Button>
          <Button size="sm" variant="outline" onClick={() => exportToPdf(exportRows, "escalonamentos.pdf", "Matriz de Escalonamento")}><FileText className="h-4 w-4" /> PDF</Button>
          <Button size="sm" onClick={() => setEdit({ ativo: true })}><Plus className="h-4 w-4" /> Nova</Button>
        </div>
      </header>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-left">
                <th className="px-3 py-2">Operadora</th>
                <th className="px-3 py-2">Níveis</th>
                <th className="px-3 py-2">Última atualização</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const lv = niveis(r);
                return (
                  <tr key={r.id} className="cursor-pointer border-b border-border/50 hover:bg-accent/30" onClick={() => setView(r)}>
                    <td className="px-3 py-2 font-mono font-semibold">{r.operadora}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        {["N1","N2","N3","N4"].map((n, i) => (
                          <span key={n} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold font-mono ${lv[i] ? "bg-noc-green/15 text-noc-green" : "bg-muted text-muted-foreground"}`}>
                            {n} {lv[i] ? "✓" : "—"}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">
                      {r.updated_at ? new Date(r.updated_at).toLocaleString("pt-BR") : "-"}
                    </td>
                    <td className="px-3 py-2">{r.ativo ? <span className="rounded bg-noc-green/15 px-1.5 py-0.5 text-[10px] font-semibold text-noc-green">ATIVO</span> : <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">INATIVO</span>}</td>
                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" onClick={() => setView(r)} title="Visualizar"><Eye className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setEdit(r)} title="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => del(r.id)} title="Excluir"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!view} onOpenChange={(v) => !v && setView(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-mono">{view?.operadora}</DialogTitle>
          </DialogHeader>
          {view && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span>Status: <span className={view.ativo ? "text-noc-green font-semibold" : "text-muted-foreground"}>{view.ativo ? "ATIVO" : "INATIVO"}</span></span>
                {view.updated_at && <span>· Última atualização: <span className="font-mono">{new Date(view.updated_at).toLocaleString("pt-BR")}</span></span>}
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {[1,2,3,4].map((n) => {
                  const nome = (view as unknown as Record<string,string>)[`n${n}_nome`] ?? "";
                  const tel = (view as unknown as Record<string,string>)[`n${n}_telefone`] ?? "";
                  const email = (view as unknown as Record<string,string>)[`n${n}_email`] ?? "";
                  return (
                    <div key={n} className="rounded-md border border-border bg-card p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Nível {n}</div>
                      <div className="mt-1 font-medium">{nome || "—"}</div>
                      {tel && <div className="mt-1 flex items-center gap-1 text-xs"><Phone className="h-3 w-3 text-muted-foreground" /><span className="font-mono break-all">{tel}</span></div>}
                      {email && <div className="mt-1 flex items-center gap-1 text-xs"><Mail className="h-3 w-3 text-muted-foreground" /><span className="font-mono break-all">{email}</span></div>}
                    </div>
                  );
                })}
              </div>
              {view.observacao && (
                <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Observação</div>
                  <div className="mt-1 whitespace-pre-wrap">{view.observacao}</div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setView(null)}>Fechar</Button>
            <Button onClick={() => { if (view) { setEdit(view); setView(null); } }}><Pencil className="h-4 w-4" /> Editar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar Escalonamento" : "Novo Escalonamento"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Operadora *</Label><Input value={edit?.operadora ?? ""} onChange={(e) => setEdit({ ...edit!, operadora: e.target.value })} /></div>
            {[1, 2, 3, 4].map((n) => (
              <fieldset key={n} className="rounded-md border border-border p-3">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nível {n}</legend>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <Input placeholder="Nome" value={(edit as any)?.[`n${n}_nome`] ?? ""} onChange={(e) => setEdit({ ...edit!, [`n${n}_nome`]: e.target.value } as any)} />
                  <Input placeholder="Telefone" value={(edit as any)?.[`n${n}_telefone`] ?? ""} onChange={(e) => setEdit({ ...edit!, [`n${n}_telefone`]: e.target.value } as any)} />
                  <Input placeholder="E-mail" value={(edit as any)?.[`n${n}_email`] ?? ""} onChange={(e) => setEdit({ ...edit!, [`n${n}_email`]: e.target.value } as any)} />
                </div>
              </fieldset>
            ))}
            <div><Label>Observação</Label><Textarea rows={2} value={edit?.observacao ?? ""} onChange={(e) => setEdit({ ...edit!, observacao: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit?.ativo ?? true} onChange={(e) => setEdit({ ...edit!, ativo: e.target.checked })} /> Ativo</label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
