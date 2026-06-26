import * as XLSX from "xlsx";
import type { ControleRow } from "./processing";
import { getFaixa, formatHoras, formatDataHora } from "./tempo";
import type { Row } from "./parse";
import { logAuditEvent } from "@/lib/audit";

/** Monta as linhas de exportação preservando o layout operacional. */
export function buildExportRows(rows: ControleRow[]) {
  return rows.map((r) => {
    const fx = getFaixa(r.data_hora_inicial, r.duracao_h);
    return {
      "Código da Lotérica": r.codigo_loterica,
      Versão: r.versao,
      Lotérica: r.loterica,
      "Tipo de Link": r.tipo_link,
      UF: r.uf,
      Designação: r.designacao,
      "IP Loopback": r.ip_loopback,
      Início: formatDataHora(r.data_hora_inicial),
      Tempo: formatHoras(fx.horas),
      "Duração (h)": r.duracao_h,
      Chamado: r.chamado,
      "Previsão de Atendimento": formatDataHora(r.previsao_atendimento),
      "Último Comentário": r.ultimo_comentario,
      Ordem: r.ordem,
      "Novo Circuito": r.novo_circuito,
      Grafana: r.grafana,
      Empresa: r.empresa,
      "Designação Parceiro": r.designacao_parceiro,
      "Responsável Backup": r.responsavel_backup,
      Situação: r.situacao,
      "Status Planilha": r.status_planilha,
      "Status Jira": r.status_jira,
      Obs: r.obs,
      Responsável: r.responsavel,
      "Fila Jira": r.fila_jira,
      "Nº INC Snow": r.inc_snow,
      "Nº Incidente MAM": r.incidente_mam,
      "Status Zabbix": r.status_zabbix,
      "Status Normalização": r.status_normalizacao,
      "Tipo de Falha": r.tipo_falha,
    };
  });
}

/** Exporta um conjunto de linhas em Excel ou CSV (reusado por tabela e dashboard). */
export function exportControle(rows: ControleRow[], fmt: "xlsx" | "csv", fileBase: string) {
  void logAuditEvent({
    action: "export_performed",
    module: "controle-reparo",
    entity: "controle_diario",
    newValues: { format: fmt, fileBase, rows: rows.length },
    message: "Exportacao de Controle de Reparo realizada.",
    observation: "Usuario baixou um arquivo de dados do sistema Controle de Reparo.",
  });

  const data = buildExportRows(rows);
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Controle");
  XLSX.writeFile(wb, `${fileBase}.${fmt}`, { bookType: fmt });
}

/** Exportação genérica para linhas do Jira (Row[]) quando o layout operacional não se aplica. */
export function exportGenericRows(rows: Row[], fmt: "xlsx" | "csv", fileBase: string) {
  void logAuditEvent({
    action: "export_performed",
    module: "controle-reparo",
    entity: "jira",
    newValues: { format: fmt, fileBase, rows: rows.length },
    message: "Exportacao generica de Controle de Reparo realizada.",
    observation: "Usuario baixou um arquivo de dados do sistema Controle de Reparo.",
  });

  const headers = Object.keys(rows[0] ?? {});
  const data = rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const h of headers) out[h] = r[h] ?? "";
    return out;
  });
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Jira");
  XLSX.writeFile(wb, `${fileBase}.${fmt}`, { bookType: fmt });
}
