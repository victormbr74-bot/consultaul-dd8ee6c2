import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import type { ControleRow } from "@/modules/controle-reparo/lib/processing";
import type { Row } from "@/modules/controle-reparo/lib/parse";
import { exportControle, exportGenericRows } from "@/modules/controle-reparo/lib/controleExport";
import { getFaixa, formatHoras, formatDataHora } from "@/modules/controle-reparo/lib/tempo";

export interface DrillData {
  title: string;
  rows: ControleRow[] | Row[];
  dataType?: "controle" | "jira";
}

interface DrillColumn {
  header: string;
  className?: string;
  render: (row: ControleRow | Row) => ReactNode;
}

function text(value: ReactNode): ReactNode {
  return value ?? "";
}

const DRILL_COLUMNS: DrillColumn[] = [
  { header: "Código", className: "font-medium", render: (r) => (r as ControleRow).codigo_loterica },
  { header: "Lotérica", className: "max-w-[220px] truncate", render: (r) => (r as ControleRow).loterica },
  { header: "Tipo", render: (r) => (r as ControleRow).tipo_link },
  { header: "UF", render: (r) => (r as ControleRow).uf },
  { header: "Designação", render: (r) => (r as ControleRow).designacao },
  { header: "IP Loopback", render: (r) => (r as ControleRow).ip_loopback },
  {
    header: "Início",
    className: "tabular-nums",
    render: (r) => formatDataHora((r as ControleRow).data_hora_inicial),
  },
  {
    header: "Tempo",
    render: (r) => {
      const fx = getFaixa((r as ControleRow).data_hora_inicial, (r as ControleRow).duracao_h);
      return (
        <Badge className={`${fx.badgeClass} tabular-nums`}>
          {formatHoras(fx.horas)}
        </Badge>
      );
    },
  },
  { header: "Chamado", render: (r) => (r as ControleRow).chamado },
  {
    header: "Previsão de Atendimento",
    className: "tabular-nums",
    render: (r) => formatDataHora((r as ControleRow).previsao_atendimento),
  },
  {
    header: "Último Comentário",
    className: "max-w-[420px] whitespace-pre-wrap break-words",
    render: (r) => (r as ControleRow).ultimo_comentario,
  },
  { header: "Ordem", render: (r) => (r as ControleRow).ordem },
  { header: "Novo Circuito", render: (r) => (r as ControleRow).novo_circuito },
  {
    header: "Grafana",
    render: (r) => (r as ControleRow).grafana ? <Badge variant="secondary">{(r as ControleRow).grafana}</Badge> : "",
  },
  { header: "Empresa", render: (r) => (r as ControleRow).empresa },
  { header: "Desig. Parceiro", render: (r) => (r as ControleRow).designacao_parceiro },
  { header: "Responsável Backup", render: (r) => (r as ControleRow).responsavel_backup },
  { header: "Situação", render: (r) => (r as ControleRow).situacao },
  {
    header: "Status Planilha",
    className: "max-w-[260px] truncate",
    render: (r) => (r as ControleRow).status_planilha,
  },
  { header: "Tipo de Falha", render: (r) => (r as ControleRow).tipo_falha ?? "" },
];

const JIRA_DRILL_COLUMNS: DrillColumn[] = [
  { header: "INC / Chave", className: "font-medium", render: (r) => (r as Row)["Chave"] ?? (r as Row)["Key"] ?? (r as Row)["Chamado"] ?? (r as Row)["INC"] ?? "" },
  { header: "Status Jira", render: (r) => (r as Row)["Status"] ?? "" },
  { header: "Tipo do Alarme", render: (r) => {
    const texto = String((r as Row)["Resumo"] ?? (r as Row)["Summary"] ?? (r as Row)["Descrição"] ?? (r as Row)["Descricao"] ?? "").toUpperCase();
    if (texto.includes("LINK PRINCIPAL INOPERANTE")) return "LINK PRINCIPAL INOPERANTE";
    if (texto.includes("LINK BACKUP INOPERANTE")) return "LINK BACKUP INOPERANTE";
    return "—";
  }},
  { header: "Resumo / Descrição", className: "max-w-[420px] truncate", render: (r) => String((r as Row)["Resumo"] ?? (r as Row)["Summary"] ?? (r as Row)["Descrição"] ?? (r as Row)["Descricao"] ?? "") },
  { header: "Fila Jira", render: (r) => (r as Row)["Fila"] ?? (r as Row)["Fila Jira"] ?? "" },
  { header: "Tipo de Falha", render: (r) => (r as Row)["Tipo de Falha"] ?? (r as Row)["Tipo Falha"] ?? (r as Row)["TIPO DE FALHA"] ?? "" },
  { header: "Último Comentário Cliente", className: "max-w-[360px] whitespace-pre-wrap break-words", render: (r) => (r as Row)["Último Comentário"] ?? (r as Row)["Ultimo Comentario"] ?? "" },
  { header: "Último Comentário Interno", className: "max-w-[360px] whitespace-pre-wrap break-words", render: (r) => (r as Row)["Último Comentário Interno"] ?? (r as Row)["Ultimo Comentario Interno"] ?? "" },
  { header: "Sem Correspondência", render: (r) => (r as Row)["_sem_correspondencia"] ? "SIM" : "NÃO" },
];

export function DrillDownDialog({
  data,
  onClose,
}: {
  data: DrillData | null;
  onClose: () => void;
}) {
  const open = !!data;
  const allRows = data?.rows ?? [];
  const [page, setPage] = useState(0);
  const pageSize = 30;
  const totalPages = Math.max(1, Math.ceil(allRows.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const rows = allRows.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const start = allRows.length === 0 ? 0 : safePage * pageSize + 1;
  const end = Math.min((safePage + 1) * pageSize, allRows.length);

  useEffect(() => {
    if (!open) setPage(0);
  }, [open]);

  const slug = (data?.title ?? "indicador")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  const columns = data?.dataType === "jira" ? JIRA_DRILL_COLUMNS : DRILL_COLUMNS;
  const handleExport = (fmt: "xlsx" | "csv") => {
    if (data?.dataType === "jira") {
      exportGenericRows(allRows as Row[], fmt, slug);
    } else {
      exportControle(allRows as ControleRow[], fmt, slug);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-5xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {data?.title}
            <Badge variant="secondary" className="tabular-nums">
              {allRows.length} registros
            </Badge>
          </DialogTitle>
          <DialogDescription>Detalhamento dos registros do indicador selecionado.</DialogDescription>
        </DialogHeader>

        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={allRows.length === 0}
              onClick={() => handleExport("xlsx")}
            >
              <Download className="mr-2 h-4 w-4" /> Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={allRows.length === 0}
              onClick={() => handleExport("csv")}
            >
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
          </div>
          {allRows.length > pageSize && (
            <span className="text-xs text-muted-foreground">
              {start}–{end} de {allRows.length}
            </span>
          )}
        </div>

        <div className="overflow-auto rounded border" style={{ maxHeight: "60vh" }}>
          <table className="w-max min-w-full border-separate border-spacing-0 border border-border text-xs">
            <thead className="sticky top-0 z-10 bg-secondary text-secondary-foreground">
              <tr className="[&>th]:whitespace-nowrap [&>th]:border-b [&>th]:border-r [&>th]:border-border [&>th]:px-2 [&>th]:py-1.5 [&>th]:text-left [&>th]:font-semibold [&>th:last-child]:border-r-0">
                {columns.map((column) => (
                  <th key={column.header}>{column.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={`${(r as ControleRow).id ?? (r as ControleRow).codigo_loterica ?? (r as Row)[Object.keys(r as Row)[0] ?? ""]}-${safePage}-${i}`}
                  className="border-b [&>td]:border-b [&>td]:border-r [&>td]:border-border/80 [&>td]:px-2 [&>td]:py-1 [&>td]:align-top [&>td:last-child]:border-r-0"
                >
                  {columns.map((column) => {
                    const value = column.render(r);
                    return (
                      <td
                        key={column.header}
                        className={column.className ?? "whitespace-nowrap"}
                        title={typeof value === "string" ? value : undefined}
                      >
                        {text(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={DRILL_COLUMNS.length} className="py-10 text-center text-muted-foreground">
                    Nenhum registro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {allRows.length > pageSize && (
          <div className="mt-3 flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={safePage <= 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground">
              Página {safePage + 1} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
            >
              Próxima <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
