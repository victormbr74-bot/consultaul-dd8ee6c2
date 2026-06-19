import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, BarChart3, Copy, RotateCcw, Save, Trash2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type MassivaRecord = {
  id: string;
  id_massiva: string;
  circuito_pai: string | null;
  consorcio_ul: string;
  uf: string;
  tipo_link: string | null;
  tipo_massiva: string;
  chamado: string | null;
  qtd_circuitos: number;
  qtd_lotericas_isoladas: number;
  inc: string | null;
  data_hora_abertura: string | null;
  data_hora_normalizacao: string | null;
  status: string;
  atualizacao: string | null;
  operadora: string;
  primeiro_alarme: string | null;
  created_at: string;
  mascara_texto: string | null;
};

type EditState = {
  consorcio_ul: string;
  tipo_link: string;
  chamado: string;
  qtd_circuitos: string;
  qtd_lotericas_isoladas: string;
  inc: string;
  data_hora_abertura: string;
  status: string;
  data_hora_normalizacao: string;
  atualizacao: string;
  operadora: string;
};

type EditableField = keyof EditState;
type EditingCell = { id: string; field: EditableField } | null;

const MASSIVA_SELECT =
  "id,id_massiva,circuito_pai,consorcio_ul,uf,tipo_link,tipo_massiva,chamado,qtd_circuitos,qtd_lotericas_isoladas,inc,data_hora_abertura,data_hora_normalizacao,status,atualizacao,operadora,primeiro_alarme,created_at,mascara_texto";

async function fetchMassivas(): Promise<MassivaRecord[]> {
  const { data, error } = await supabase
    .from("massivas")
    .select(MASSIVA_SELECT)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as MassivaRecord[];
}

function eventDate(m: MassivaRecord): Date {
  return new Date(m.data_hora_abertura ?? m.primeiro_alarme ?? m.created_at);
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function weekStart(date: Date): Date {
  const out = new Date(date);
  const day = out.getDay() || 7;
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - day + 1);
  return out;
}

function isSameMonth(date: Date, ref: Date): boolean {
  return date.getFullYear() === ref.getFullYear() && date.getMonth() === ref.getMonth();
}

function isPrincipal(m: MassivaRecord): boolean {
  const type = `${m.tipo_link ?? ""} ${m.tipo_massiva ?? ""}`.toUpperCase();
  return type.includes("PRIM") || type.includes("PRINCIPAL");
}

function isBackup(m: MassivaRecord): boolean {
  const type = `${m.tipo_link ?? ""} ${m.tipo_massiva ?? ""}`.toUpperCase();
  return type.includes("SEC") || type.includes("BACKUP");
}

function chartByOperadora(rows: MassivaRecord[]) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = row.operadora || "NAO INFORMADA";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map, ([operadora, total]) => ({ operadora, total })).sort((a, b) => b.total - a.total);
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR");
}

function toDateTimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function editStateFrom(row: MassivaRecord): EditState {
  return {
    consorcio_ul: row.consorcio_ul ?? "CONSÓRCIO",
    tipo_link: row.tipo_link ?? (isBackup(row) ? "SECUNDÁRIO" : "PRIMÁRIO"),
    chamado: row.chamado ?? "",
    qtd_circuitos: String(row.qtd_circuitos ?? 0),
    qtd_lotericas_isoladas: String(row.qtd_lotericas_isoladas ?? 0),
    inc: row.inc ?? "",
    data_hora_abertura: toDateTimeLocal(row.data_hora_abertura ?? row.primeiro_alarme),
    status: row.status ?? "MASSIVA",
    data_hora_normalizacao: toDateTimeLocal(row.data_hora_normalizacao),
    atualizacao: row.atualizacao ?? "",
    operadora: row.operadora ?? "",
  };
}

export default function MassivasAbertas() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const q = useQuery({ queryKey: ["massivas-controle"], queryFn: fetchMassivas, staleTime: 30_000 });
  const [pending, setPending] = useState<Record<string, Partial<EditState>>>({});
  const [editingCell, setEditingCell] = useState<EditingCell>(null);

  const rows = q.data ?? [];
  const now = new Date();
  const monthRows = useMemo(() => rows.filter((m) => isSameMonth(eventDate(m), now)), [rows]);
  const weekRows = useMemo(() => {
    const start = weekStart(now).getTime();
    return rows.filter((m) => eventDate(m).getTime() >= start);
  }, [rows]);
  const dayRows = useMemo(() => rows.filter((m) => sameDay(eventDate(m), now)), [rows]);
  const abertas = rows.filter((m) => m.status !== "NORMALIZADO");
  const normalizadas = rows.filter((m) => m.status === "NORMALIZADO");

  const totalChart = useMemo(() => chartByOperadora(monthRows), [monthRows]);
  const principalChart = useMemo(() => chartByOperadora(monthRows.filter(isPrincipal)), [monthRows]);
  const backupChart = useMemo(() => chartByOperadora(monthRows.filter(isBackup)), [monthRows]);

  const changedCount = Object.keys(pending).length;

  const saveMutation = useMutation({
    mutationFn: async (changes: Record<string, Partial<EditState>>) => {
      for (const [id, values] of Object.entries(changes)) {
        const current = rows.find((row) => row.id === id);
        if (!current) continue;
        const merged = { ...editStateFrom(current), ...values };
        const payload = {
          consorcio_ul: merged.consorcio_ul,
          tipo_link: merged.tipo_link,
          chamado: merged.chamado || null,
          qtd_circuitos: Number(merged.qtd_circuitos) || 0,
          qtd_lotericas_isoladas: Number(merged.qtd_lotericas_isoladas) || 0,
          inc: merged.inc || null,
          data_hora_abertura: fromDateTimeLocal(merged.data_hora_abertura),
          status: merged.status,
          data_hora_normalizacao: fromDateTimeLocal(merged.data_hora_normalizacao),
          atualizacao: merged.atualizacao || null,
          operadora: merged.operadora,
        };
        const { error } = await supabase.from("massivas").update(payload).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["massivas-controle"] });
      setPending({});
      setEditingCell(null);
      toast.success("Alterações salvas");
    },
    onError: (error) => toast.error("Falha ao salvar alterações: " + (error as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("massivas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["massivas-controle"] });
      toast.success("Massiva excluída");
    },
    onError: (error) => toast.error("Falha ao excluir massiva: " + (error as Error).message),
  });

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Mascara copiada");
  };

  const valueFor = (row: MassivaRecord, field: EditableField): string => {
    const base = editStateFrom(row);
    return pending[row.id]?.[field] ?? base[field];
  };

  const setPendingValue = (row: MassivaRecord, field: EditableField, value: string) => {
    setPending((current) => ({
      ...current,
      [row.id]: {
        ...current[row.id],
        [field]: value,
      },
    }));
  };

  const saveAll = () => {
    if (changedCount === 0) return;
    saveMutation.mutate(pending);
  };

  const clearPending = () => {
    setPending({});
    setEditingCell(null);
  };

  const deleteMassiva = (row: MassivaRecord) => {
    if (!isAdmin) return;
    const ok = window.confirm(`Excluir a massiva ${row.circuito_pai || row.id_massiva}?`);
    if (ok) deleteMutation.mutate(row.id);
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide">Massivas abertas</h2>
          <p className="text-xs text-muted-foreground">Controle operacional das massivas registradas no banco.</p>
        </div>
        <div className="rounded-md border border-border bg-card px-3 py-2 text-xs">
          Total: <span className="font-mono font-semibold">{rows.length}</span>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-5">
        <Metric label="Massivas no mês" value={monthRows.length} />
        <Metric label="Massivas na semana" value={weekRows.length} />
        <Metric label="Massivas no dia" value={dayRows.length} />
        <Metric label="Em aberto" value={abertas.length} />
        <Metric label="Normalizadas" value={normalizadas.length} />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Massivas no mês por operadora" data={totalChart} />
        <ChartCard title="Primário no mês por operadora" data={principalChart} />
        <ChartCard title="Backup no mês por operadora" data={backupChart} />
      </section>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-noc-blue" />
            <h3 className="text-sm font-semibold uppercase tracking-wide">Controle de massivas</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">{changedCount} alteração{changedCount === 1 ? "" : "ões"} pendente{changedCount === 1 ? "" : "s"}</span>
            <Button size="sm" variant="outline" disabled={changedCount === 0 || saveMutation.isPending} onClick={clearPending}>
              <RotateCcw className="h-3.5 w-3.5" /> Descartar
            </Button>
            <Button size="sm" disabled={changedCount === 0 || saveMutation.isPending} onClick={saveAll}>
              <Save className="h-3.5 w-3.5" /> Salvar alterações
            </Button>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[1320px] text-xs">
            <thead className="bg-card">
              <tr className="border-b border-border text-left">
                <th className="px-3 py-2">Circuito Pai</th>
                <th className="px-3 py-2">Consórcio UL</th>
                <th className="px-3 py-2">UF</th>
                <th className="px-3 py-2">Primário ou Secundário</th>
                <th className="px-3 py-2">Chamado</th>
                <th className="px-3 py-2 text-right">QTD</th>
                <th className="px-3 py-2 text-right">QTDE Isoladas</th>
                <th className="px-3 py-2">INC</th>
                <th className="px-3 py-2">Data/Hora Abertura</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Data/Hora Normalização</th>
                <th className="px-3 py-2">Atualização</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && <tr><td colSpan={13} className="px-3 py-10 text-center text-muted-foreground">Carregando...</td></tr>}
              {!q.isLoading && rows.length === 0 && (
                <tr><td colSpan={13} className="px-3 py-10 text-center text-muted-foreground">Nenhuma massiva registrada.</td></tr>
              )}
              {rows.map((m) => (
                <tr key={m.id} className={pending[m.id] ? "border-b border-border/50 bg-primary/5" : "border-b border-border/50"}>
                  <td className="px-3 py-2 font-mono">{m.circuito_pai || "-"}</td>
                  <EditableCell row={m} field="consorcio_ul" value={valueFor(m, "consorcio_ul")} editingCell={editingCell} setEditingCell={setEditingCell} onChange={setPendingValue} />
                  <td className="px-3 py-2 font-mono">{m.uf}</td>
                  <EditableCell row={m} field="tipo_link" value={valueFor(m, "tipo_link")} editingCell={editingCell} setEditingCell={setEditingCell} onChange={setPendingValue} kind="tipo" />
                  <EditableCell row={m} field="chamado" value={valueFor(m, "chamado")} editingCell={editingCell} setEditingCell={setEditingCell} onChange={setPendingValue} mono />
                  <EditableCell row={m} field="qtd_circuitos" value={valueFor(m, "qtd_circuitos")} editingCell={editingCell} setEditingCell={setEditingCell} onChange={setPendingValue} type="number" align="right" mono />
                  <EditableCell row={m} field="qtd_lotericas_isoladas" value={valueFor(m, "qtd_lotericas_isoladas")} editingCell={editingCell} setEditingCell={setEditingCell} onChange={setPendingValue} type="number" align="right" mono />
                  <EditableCell row={m} field="inc" value={valueFor(m, "inc")} editingCell={editingCell} setEditingCell={setEditingCell} onChange={setPendingValue} mono />
                  <EditableCell row={m} field="data_hora_abertura" value={valueFor(m, "data_hora_abertura")} display={formatDateTime(fromDateTimeLocal(valueFor(m, "data_hora_abertura")) ?? m.data_hora_abertura ?? m.primeiro_alarme)} editingCell={editingCell} setEditingCell={setEditingCell} onChange={setPendingValue} type="datetime-local" mono />
                  <EditableCell row={m} field="status" value={valueFor(m, "status")} editingCell={editingCell} setEditingCell={setEditingCell} onChange={setPendingValue} kind="status" mono />
                  <EditableCell row={m} field="data_hora_normalizacao" value={valueFor(m, "data_hora_normalizacao")} display={formatDateTime(fromDateTimeLocal(valueFor(m, "data_hora_normalizacao")) ?? m.data_hora_normalizacao)} editingCell={editingCell} setEditingCell={setEditingCell} onChange={setPendingValue} type="datetime-local" mono />
                  <EditableCell row={m} field="atualizacao" value={valueFor(m, "atualizacao")} editingCell={editingCell} setEditingCell={setEditingCell} onChange={setPendingValue} kind="textarea" className="max-w-[260px]" />
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" disabled={!m.mascara_texto} onClick={() => copy(m.mascara_texto ?? "")}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      {isAdmin && (
                        <Button size="sm" variant="outline" disabled={deleteMutation.isPending} onClick={() => deleteMassiva(m)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold">{value}</div>
    </div>
  );
}

function ChartCard({ title, data }: { title: string; data: Array<{ operadora: string; total: number }> }) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wide">
          <BarChart3 className="h-4 w-4 text-noc-blue" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="h-64">
          {data.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Sem dados no mês.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 12, right: 12, bottom: 32, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="operadora" angle={-25} textAnchor="end" height={52} tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EditableCell({
  row,
  field,
  value,
  display,
  editingCell,
  setEditingCell,
  onChange,
  type = "text",
  kind,
  align = "left",
  mono,
  className = "",
}: {
  row: MassivaRecord;
  field: EditableField;
  value: string;
  display?: string;
  editingCell: EditingCell;
  setEditingCell: (cell: EditingCell) => void;
  onChange: (row: MassivaRecord, field: EditableField, value: string) => void;
  type?: string;
  kind?: "tipo" | "status" | "textarea";
  align?: "left" | "right";
  mono?: boolean;
  className?: string;
}) {
  const editing = editingCell?.id === row.id && editingCell.field === field;
  const text = (display ?? value) || "-";
  const baseClass = `${align === "right" ? "text-right" : "text-left"} ${mono ? "font-mono" : ""} ${className}`;

  if (editing) {
    if (kind === "tipo" || kind === "status") {
      const options = kind === "tipo" ? ["PRIMÁRIO", "SECUNDÁRIO"] : ["MASSIVA", "NORMALIZADO", "PENDENTE"];
      return (
        <td className="px-2 py-1">
          <select
            autoFocus
            className="h-8 w-full min-w-[130px] rounded-md border border-input bg-background px-2 text-xs"
            value={value}
            onChange={(e) => onChange(row, field, e.target.value)}
            onBlur={() => setEditingCell(null)}
          >
            {options.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </td>
      );
    }
    if (kind === "textarea") {
      return (
        <td className="px-2 py-1">
          <Textarea
            autoFocus
            rows={3}
            className="min-w-[260px] text-xs"
            value={value}
            onChange={(e) => onChange(row, field, e.target.value)}
            onBlur={() => setEditingCell(null)}
          />
        </td>
      );
    }
    return (
      <td className="px-2 py-1">
        <Input
          autoFocus
          type={type}
          className={`h-8 min-w-[120px] text-xs ${mono ? "font-mono" : ""} ${align === "right" ? "text-right" : ""}`}
          value={value}
          onChange={(e) => onChange(row, field, e.target.value)}
          onBlur={() => setEditingCell(null)}
        />
      </td>
    );
  }

  return (
    <td
      className={`cursor-text px-3 py-2 hover:bg-accent/50 ${baseClass}`}
      onClick={() => setEditingCell({ id: row.id, field })}
      title="Clique para editar"
    >
      <span className={className ? "block truncate" : ""}>{text}</span>
    </td>
  );
}
