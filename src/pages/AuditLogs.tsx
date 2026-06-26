import { useMemo, useState } from "react";
import { Download, Eye, Search } from "lucide-react";
import * as XLSX from "xlsx";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AuditLog = {
  id: string;
  created_at: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  action: string;
  module: string | null;
  entity: string | null;
  entity_id: string | null;
  old_values: unknown;
  new_values: unknown;
  ip_address: string | null;
  user_agent: string | null;
  browser: string | null;
  os: string | null;
  device_type: string | null;
  request_method: string | null;
  request_path: string | null;
  status: "success" | "error" | "denied";
  message: string | null;
  observation: string | null;
  origin: string | null;
  integrity_hash: string | null;
};

const ALL = "__all__";

const statusLabel: Record<string, string> = {
  success: "Sucesso",
  error: "Erro",
  denied: "Negado",
};

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(rows: AuditLog[]) {
  const exportRows = buildExportRows(rows);
  const headers = Object.keys(exportRows[0] ?? {});
  const lines = [headers.join(",")].concat(
    exportRows.map((row) => headers.map((header) => csvEscape(row[header as keyof typeof row])).join(",")),
  );
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function buildExportRows(rows: AuditLog[]) {
  return rows.map((row) => ({
    ID: row.id,
    "Data/Hora": new Date(row.created_at).toLocaleString("pt-BR"),
    "ID Usuario": row.user_id ?? "",
    Usuario: row.user_name ?? "",
    Email: row.user_email ?? "",
    Acao: row.action,
    Modulo: row.module ?? "",
    Entidade: row.entity ?? "",
    "ID Registro": row.entity_id ?? "",
    IP: row.ip_address ?? "",
    Navegador: row.browser ?? "",
    "Sistema Operacional": row.os ?? "",
    Dispositivo: row.device_type ?? "",
    "User-Agent": row.user_agent ?? "",
    Metodo: row.request_method ?? "",
    Caminho: row.request_path ?? "",
    Origem: row.origin ?? "",
    Status: statusLabel[row.status] ?? row.status,
    Observacao: row.observation ?? "",
    Mensagem: row.message ?? "",
    "Hash Integridade": row.integrity_hash ?? "",
    "Valores Anteriores": row.old_values ? JSON.stringify(row.old_values) : "",
    "Valores Novos": row.new_values ? JSON.stringify(row.new_values) : "",
  }));
}

function downloadXlsx(rows: AuditLog[]) {
  const ws = XLSX.utils.json_to_sheet(buildExportRows(rows));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Auditoria");
  XLSX.writeFile(wb, `audit_logs_${new Date().toISOString().slice(0, 10)}.xlsx`, { bookType: "xlsx" });
}

function formatSystem(row: AuditLog) {
  return [row.os, row.browser, row.device_type].filter(Boolean).join(" / ") || "-";
}

export default function AuditLogs() {
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [ipFilter, setIpFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const pageSize = 50;

  const query = useQuery({
    queryKey: ["audit-logs", userFilter, actionFilter, moduleFilter, ipFilter, statusFilter, startDate, endDate, page],
    queryFn: async () => {
      let builder = supabase
        .from("audit_logs" as never)
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);

      if (userFilter) builder = builder.or(`user_email.ilike.%${userFilter}%,user_name.ilike.%${userFilter}%`);
      if (actionFilter) builder = builder.ilike("action", `%${actionFilter}%`);
      if (moduleFilter) builder = builder.ilike("module", `%${moduleFilter}%`);
      if (ipFilter) builder = builder.eq("ip_address", ipFilter);
      if (statusFilter !== ALL) builder = builder.eq("status", statusFilter);
      if (startDate) builder = builder.gte("created_at", `${startDate}T00:00:00`);
      if (endDate) builder = builder.lte("created_at", `${endDate}T23:59:59`);

      const { data, error, count } = await builder;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as AuditLog[], count: count ?? 0 };
    },
  });

  const rows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const data = query.data?.rows ?? [];
    if (!normalized) return data;
    return data.filter((row) =>
      [
        row.id,
        row.user_name,
        row.user_email,
        row.action,
        row.module,
        row.entity,
        row.entity_id,
        row.ip_address,
        row.browser,
        row.os,
        row.device_type,
        row.user_agent,
        row.status,
        row.observation,
        row.message,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [query.data?.rows, search]);

  const total = query.data?.count ?? 0;
  const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);

  const handleExport = async (format: "csv" | "xlsx") => {
    if (format === "xlsx") {
      downloadXlsx(rows);
    } else {
      downloadCsv(rows);
    }

    await logAuditEvent({
      action: "audit_logs_exported",
      module: "admin",
      entity: "audit_logs",
      newValues: { format, count: rows.length, filters: { userFilter, actionFilter, moduleFilter, ipFilter, statusFilter, startDate, endDate, search } },
      message: `Administrador exportou logs de auditoria filtrados em ${format.toUpperCase()}.`,
      observation: `Administrador baixou os dados de auditoria em ${format.toUpperCase()}.`,
    });
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 p-6">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-semibold">Auditoria</h1>
          <p className="text-sm text-muted-foreground">Logs imutaveis de seguranca, consentimento e operacao.</p>
        </div>
        <Badge variant="secondary" className="ml-auto">
          {total} eventos
        </Badge>
        <Button variant="outline" onClick={() => void handleExport("csv")} disabled={!rows.length}>
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
        <Button variant="outline" onClick={() => void handleExport("xlsx")} disabled={!rows.length}>
          <Download className="h-4 w-4" />
          Exportar XLSX
        </Button>
      </header>

      <section className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Busca geral" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Input placeholder="Usuario" value={userFilter} onChange={(e) => { setPage(0); setUserFilter(e.target.value); }} />
        <Input placeholder="Acao" value={actionFilter} onChange={(e) => { setPage(0); setActionFilter(e.target.value); }} />
        <Input placeholder="Modulo" value={moduleFilter} onChange={(e) => { setPage(0); setModuleFilter(e.target.value); }} />
        <Input placeholder="IP" value={ipFilter} onChange={(e) => { setPage(0); setIpFilter(e.target.value); }} />
        <Select value={statusFilter} onValueChange={(value) => { setPage(0); setStatusFilter(value); }}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            <SelectItem value="success">Sucesso</SelectItem>
            <SelectItem value="error">Erro</SelectItem>
            <SelectItem value="denied">Negado</SelectItem>
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={startDate} onChange={(e) => { setPage(0); setStartDate(e.target.value); }} />
          <Input type="date" value={endDate} onChange={(e) => { setPage(0); setEndDate(e.target.value); }} />
        </div>
      </section>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Acao</TableHead>
              <TableHead>Modulo</TableHead>
              <TableHead>Entidade</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Sistema</TableHead>
              <TableHead>Observacao</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap font-mono text-xs">{new Date(row.created_at).toLocaleString("pt-BR")}</TableCell>
                <TableCell className="max-w-[220px] truncate">{row.user_name || row.user_email || "-"}</TableCell>
                <TableCell className="font-mono text-xs">{row.action}</TableCell>
                <TableCell>{row.module || "-"}</TableCell>
                <TableCell>{row.entity || "-"}</TableCell>
                <TableCell className="font-mono text-xs">{row.ip_address || "-"}</TableCell>
                <TableCell className="max-w-[260px] truncate text-xs">{formatSystem(row)}</TableCell>
                <TableCell className="max-w-[360px] truncate text-xs">{row.observation || "-"}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "success" ? "secondary" : "destructive"}>{statusLabel[row.status]}</Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => setSelected(row)} title="Detalhes">
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                  {query.isLoading ? "Carregando logs..." : "Nenhum log encontrado."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <footer className="flex items-center justify-end gap-2">
        <span className="text-sm text-muted-foreground">
          Pagina {page + 1} de {maxPage + 1}
        </span>
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>
          Anterior
        </Button>
        <Button variant="outline" size="sm" disabled={page >= maxPage} onClick={() => setPage((current) => Math.min(maxPage, current + 1))}>
          Proxima
        </Button>
      </footer>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detalhe do log</DialogTitle>
          </DialogHeader>
          <pre className="max-h-[70vh] overflow-auto rounded-md bg-muted p-4 text-xs">
            {selected ? JSON.stringify(selected, null, 2) : ""}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
