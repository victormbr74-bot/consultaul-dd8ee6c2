import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import type { ReactNode } from "react";
import type { ControleRow } from "@/modules/controle-reparo/lib/processing";
import { exportControle } from "@/modules/controle-reparo/lib/controleExport";
import { getFaixa, formatHoras, formatDataHora } from "@/modules/controle-reparo/lib/tempo";

export interface DrillData {
  title: string;
  rows: ControleRow[];
}

interface DrillColumn {
  header: string;
  className?: string;
  render: (row: ControleRow) => ReactNode;
}

function text(value: ReactNode): ReactNode {
  return value ?? "";
}

const DRILL_COLUMNS: DrillColumn[] = [
  { header: "Código", className: "font-medium", render: (r) => r.codigo_loterica },
  { header: "Lotérica", className: "max-w-[220px] truncate", render: (r) => r.loterica },
  { header: "Tipo", render: (r) => r.tipo_link },
  { header: "UF", render: (r) => r.uf },
  { header: "Designação", render: (r) => r.designacao },
  { header: "IP Loopback", render: (r) => r.ip_loopback },
  {
    header: "Início",
    className: "tabular-nums",
    render: (r) => formatDataHora(r.data_hora_inicial),
  },
  {
    header: "Tempo",
    render: (r) => {
      const fx = getFaixa(r.data_hora_inicial, r.duracao_h);
      return (
        <Badge className={`${fx.badgeClass} tabular-nums`}>
          {formatHoras(fx.horas)}
        </Badge>
      );
    },
  },
  { header: "Chamado", render: (r) => r.chamado },
  {
    header: "Previsão",
    className: "tabular-nums",
    render: (r) => formatDataHora(r.previsao_atendimento),
  },
  {
    header: "Último Comentário",
    className: "max-w-[420px] whitespace-pre-wrap break-words",
    render: (r) => r.ultimo_comentario,
  },
  { header: "Ordem", render: (r) => r.ordem },
  { header: "Novo Circuito", render: (r) => r.novo_circuito },
  {
    header: "Grafana",
    render: (r) => r.grafana ? <Badge variant="secondary">{r.grafana}</Badge> : "",
  },
  { header: "Empresa", render: (r) => r.empresa },
  { header: "Desig. Parceiro", render: (r) => r.designacao_parceiro },
  { header: "Responsável Backup", render: (r) => r.responsavel_backup },
  { header: "Situação", render: (r) => r.situacao },
  {
    header: "Status Planilha",
    className: "max-w-[260px] truncate",
    render: (r) => r.status_planilha,
  },
  { header: "Status Jira", render: (r) => r.status_jira },
  {
    header: "Obs",
    className: "max-w-[360px] whitespace-pre-wrap break-words",
    render: (r) => r.obs,
  },
  { header: "Responsável", render: (r) => r.responsavel },
  { header: "Fila Jira", render: (r) => r.fila_jira },
  { header: "INC Snow", render: (r) => r.inc_snow },
  { header: "Incid. MAM", render: (r) => r.incidente_mam },
  { header: "Status Zabbix", render: (r) => r.status_zabbix },
  { header: "Status Normalização", render: (r) => r.status_normalizacao },
  { header: "Normalizado em", render: (r) => formatDataHora(r.normalizado_em) },
];

export function DrillDownDialog({
  data,
  onClose,
}: {
  data: DrillData | null;
  onClose: () => void;
}) {
  const open = !!data;
  const rows = data?.rows ?? [];

  const slug = (data?.title ?? "indicador")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-5xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {data?.title}
            <Badge variant="secondary" className="tabular-nums">
              {rows.length} registros
            </Badge>
          </DialogTitle>
          <DialogDescription>Detalhamento dos registros do indicador selecionado.</DialogDescription>
        </DialogHeader>

        <div className="mb-2 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={rows.length === 0}
            onClick={() => exportControle(rows, "xlsx", `${slug}`)}
          >
            <Download className="mr-2 h-4 w-4" /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={rows.length === 0}
            onClick={() => exportControle(rows, "csv", `${slug}`)}
          >
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
        </div>

        <div className="overflow-auto rounded border" style={{ maxHeight: "60vh" }}>
          <table className="w-max min-w-full border-separate border-spacing-0 border border-border text-xs">
            <thead className="sticky top-0 z-10 bg-secondary text-secondary-foreground">
              <tr className="[&>th]:whitespace-nowrap [&>th]:border-b [&>th]:border-r [&>th]:border-border [&>th]:px-2 [&>th]:py-1.5 [&>th]:text-left [&>th]:font-semibold [&>th:last-child]:border-r-0">
                {DRILL_COLUMNS.map((column) => (
                  <th key={column.header}>{column.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={`${r.id ?? r.codigo_loterica}-${i}`}
                  className="border-b [&>td]:border-b [&>td]:border-r [&>td]:border-border/80 [&>td]:px-2 [&>td]:py-1 [&>td]:align-top [&>td:last-child]:border-r-0"
                >
                  {DRILL_COLUMNS.map((column) => {
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
      </DialogContent>
    </Dialog>
  );
}
