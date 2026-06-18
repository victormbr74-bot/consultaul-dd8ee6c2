// Máscara de Evento Massivo — gera HTML e PDF para comunicação ao cliente.
// Não altera nenhuma regra de detecção; apenas formata os dados da massiva.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Massiva, ProcessedRow, TipoMassiva } from "./gis-types";

const COUNTER_KEY = "noc:mascara:counter";

export function nextChamadoInterno(): string {
  let n = 0;
  try {
    n = parseInt(localStorage.getItem(COUNTER_KEY) ?? "0", 10) || 0;
  } catch {
    /* ignore */
  }
  n += 1;
  try {
    localStorage.setItem(COUNTER_KEY, String(n));
  } catch {
    /* ignore */
  }
  return `INC-${String(n).padStart(6, "0")}`;
}

export interface MascaraInput {
  cliente?: string;
  chamado_interno: string;
  chamado_externo: string;
  caso: string;
  tipo_label: string;
  uf_label: string;
  operadora: string;
  qtd_total: number;
  qtd_isoladas: number;
  horario_falha: string;
  horario_normalizacao: string;
  causa_solucao: string;
  status_texto: string;
  observacoes: string;
  circuitos: Array<{ designacao: string; ip: string; cidade: string; uf: string; dataHora: string }>;
}

export const STATUS_PADRAO =
  "A equipe de campo foi mobilizada para diagnosticar a causa raiz da interrupção no meio de transmissão. " +
  "Prazo estimado de 2 horas para diagnóstico da falha e deslocamento da equipe de campo. " +
  "Acompanhamento contínuo pelo NOC até a normalização total dos circuitos afetados.";

export function tipoToLabel(tipo: TipoMassiva, parceira: string): string {
  switch (tipo) {
    case "PRINCIPAL_VTAL":
      return "PRINCIPAL — VTAL";
    case "PRINCIPAL_OEMP":
      return `PRINCIPAL — OEMP (${parceira})`;
    case "SECUNDARIO_UF":
      return "SECUNDÁRIO — UF";
    case "SECUNDARIO_NACIONAL":
      return "SECUNDÁRIO — NACIONAL";
  }
}

export function buildMascaraFromMassiva(
  m: Massiva,
  rows: ProcessedRow[],
  overrides: Partial<MascaraInput> = {},
): MascaraInput {
  const set = new Set(m.rowIds);
  const circuitos = rows
    .filter((r) => set.has(r.__rowId))
    .sort((a, b) => a.__ts - b.__ts)
    .map((r) => ({
      designacao: String(r["Designação"] ?? ""),
      ip: String(r["IP Loopback"] ?? ""),
      cidade: String(r["Cidade"] ?? ""),
      uf: r.__uf,
      dataHora: r.__dataHora,
    }));
  return {
    cliente: "CAIXA ECONÔMICA",
    chamado_interno: overrides.chamado_interno ?? nextChamadoInterno(),
    chamado_externo: overrides.chamado_externo ?? "",
    caso: m.id_massiva,
    tipo_label: tipoToLabel(m.tipo_massiva, m.parceira),
    uf_label: m.uf === "NACIONAL" ? "Brasil" : m.uf,
    operadora: m.tipo_massiva === "PRINCIPAL_VTAL" ? "VTAL" : (m.parceira && m.parceira !== "-" ? m.parceira : m.operadora || "-"),
    qtd_total: m.qtd_circuitos,
    qtd_isoladas: m.qtd_lotericas_isoladas ?? 0,
    horario_falha: m.primeiro_alarme,
    horario_normalizacao: overrides.horario_normalizacao ?? "PENDENTE",
    causa_solucao: overrides.causa_solucao ?? "PENDENTE",
    status_texto: overrides.status_texto ?? STATUS_PADRAO,
    observacoes: overrides.observacoes ?? "",
    circuitos,
    ...overrides,
  };
}

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildMascaraHtml(d: MascaraInput): string {
  const rowsHtml = d.circuitos
    .map(
      (c) =>
        `<tr><td style="padding:4px 8px;border:1px solid #ccc;font-family:monospace">${esc(c.designacao)}</td>` +
        `<td style="padding:4px 8px;border:1px solid #ccc;font-family:monospace">${esc(c.ip)}</td>` +
        `<td style="padding:4px 8px;border:1px solid #ccc">${esc(c.cidade)}/${esc(c.uf)}</td>` +
        `<td style="padding:4px 8px;border:1px solid #ccc;font-family:monospace">${esc(c.dataHora)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Evento Massivo — ${esc(d.caso)}</title></head>
<body style="font-family:Arial,sans-serif;color:#222;max-width:880px;margin:24px auto;padding:16px">
  <h2 style="margin:0 0 4px 0;color:#0b3a82">CONSÓRCIO LOTÉRICAS</h2>
  <h3 style="margin:0 0 16px 0">Evento Massivo — Chamado Aberto</h3>
  <table style="border-collapse:collapse;width:100%;font-size:13px">
    <tbody>
      <tr><td style="padding:4px 8px;background:#f3f4f6;width:200px"><b>Cliente</b></td><td style="padding:4px 8px">${esc(d.cliente ?? "")}</td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>Chamado interno</b></td><td style="padding:4px 8px">${esc(d.chamado_interno)}</td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>Chamado externo</b></td><td style="padding:4px 8px">${esc(d.chamado_externo) || "-"}</td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>Caso</b></td><td style="padding:4px 8px"><b>${esc(d.caso)}</b></td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>Tipo</b></td><td style="padding:4px 8px">${esc(d.tipo_label)}</td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>UF / Abrangência</b></td><td style="padding:4px 8px">${esc(d.uf_label)}</td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>Operadora</b></td><td style="padding:4px 8px">${esc(d.operadora)}</td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>Quantidade total</b></td><td style="padding:4px 8px">${d.qtd_total}</td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>Quantidade isoladas</b></td><td style="padding:4px 8px">${d.qtd_isoladas}</td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>Horário da falha</b></td><td style="padding:4px 8px">${esc(d.horario_falha)}</td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>Horário de normalização</b></td><td style="padding:4px 8px">${esc(d.horario_normalizacao)}</td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>Causa / Solução</b></td><td style="padding:4px 8px">${esc(d.causa_solucao)}</td></tr>
    </tbody>
  </table>
  <h4 style="margin:16px 0 4px 0">Status</h4>
  <p style="margin:0;font-size:13px">${esc(d.status_texto)}</p>
  ${d.observacoes ? `<h4 style="margin:16px 0 4px 0">Observações</h4><p style="margin:0;font-size:13px">${esc(d.observacoes)}</p>` : ""}
  <h4 style="margin:16px 0 4px 0">Circuitos afetados (${d.circuitos.length})</h4>
  <table style="border-collapse:collapse;width:100%;font-size:12px">
    <thead><tr style="background:#0b3a82;color:#fff">
      <th style="padding:6px 8px;text-align:left">Designação</th>
      <th style="padding:6px 8px;text-align:left">IP Loopback</th>
      <th style="padding:6px 8px;text-align:left">Cidade/UF</th>
      <th style="padding:6px 8px;text-align:left">Data/Hora</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body></html>`;
}

export function downloadMascaraHtml(d: MascaraInput) {
  const blob = new Blob([buildMascaraHtml(d)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mascara_${d.caso}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function copyMascaraToClipboard(d: MascaraInput): Promise<void> {
  const html = buildMascaraHtml(d);
  try {
    const clip = navigator.clipboard as unknown as {
      write?: (items: ClipboardItem[]) => Promise<void>;
      writeText: (s: string) => Promise<void>;
    };
    if (typeof ClipboardItem !== "undefined" && clip.write) {
      await clip.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([htmlToPlain(d)], { type: "text/plain" }),
        }),
      ]);
      return;
    }
    await clip.writeText(htmlToPlain(d));
  } catch {
    await navigator.clipboard.writeText(htmlToPlain(d));
  }
}

function htmlToPlain(d: MascaraInput): string {
  const linhas = [
    "CONSÓRCIO LOTÉRICAS",
    "Evento Massivo - Chamado Aberto",
    "===============================",
    "",
    `Cliente: ${d.cliente ?? ""}`,
    `Chamado interno: ${d.chamado_interno}`,
    `Chamado externo: ${d.chamado_externo || "-"}`,
    `Caso: ${d.caso}`,
    `Tipo: ${d.tipo_label}`,
    `UF: ${d.uf_label}`,
    `Operadora: ${d.operadora}`,
    `Quantidade total: ${d.qtd_total}`,
    `Quantidade isoladas: ${d.qtd_isoladas}`,
    `Horário da falha: ${d.horario_falha}`,
    `Horário de normalização: ${d.horario_normalizacao}`,
    `Causa/Solução: ${d.causa_solucao}`,
    "",
    `Status: ${d.status_texto}`,
  ];
  if (d.observacoes) linhas.push("", `Observações: ${d.observacoes}`);
  linhas.push("", `Circuitos (${d.circuitos.length}):`);
  linhas.push("Designação\tIP Loopback\tCidade/UF\tData/Hora");
  for (const c of d.circuitos) {
    linhas.push(`${c.designacao}\t${c.ip}\t${c.cidade}/${c.uf}\t${c.dataHora}`);
  }
  return linhas.join("\n");
}

export function exportMascaraPdf(d: MascaraInput) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(11, 58, 130);
  doc.text("CONSÓRCIO LOTÉRICAS", 40, 40);
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text("Evento Massivo — Chamado Aberto", 40, 58);
  doc.setDrawColor(200);
  doc.line(40, 64, w - 40, 64);

  const meta: Array<[string, string]> = [
    ["Cliente", d.cliente ?? ""],
    ["Chamado interno", d.chamado_interno],
    ["Chamado externo", d.chamado_externo || "-"],
    ["Caso", d.caso],
    ["Tipo", d.tipo_label],
    ["UF / Abrangência", d.uf_label],
    ["Operadora", d.operadora],
    ["Quantidade total", String(d.qtd_total)],
    ["Quantidade isoladas", String(d.qtd_isoladas)],
    ["Horário da falha", d.horario_falha],
    ["Horário de normalização", d.horario_normalizacao],
    ["Causa / Solução", d.causa_solucao],
  ];
  autoTable(doc, {
    startY: 76,
    head: [["Campo", "Valor"]],
    body: meta,
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [11, 58, 130], textColor: 255 },
    columnStyles: { 0: { cellWidth: 140, fontStyle: "bold" } },
    margin: { left: 40, right: 40 },
  });
  type AutoTableDoc = jsPDF & { lastAutoTable?: { finalY?: number } };
  const afterMeta = ((doc as AutoTableDoc).lastAutoTable?.finalY ?? 200) + 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Status", 40, afterMeta);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const statusLines = doc.splitTextToSize(d.status_texto, w - 80);
  doc.text(statusLines, 40, afterMeta + 14);
  let cursor = afterMeta + 14 + statusLines.length * 11 + 8;
  if (d.observacoes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Observações", 40, cursor);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const obs = doc.splitTextToSize(d.observacoes, w - 80);
    doc.text(obs, 40, cursor + 14);
    cursor += 14 + obs.length * 11 + 8;
  }
  autoTable(doc, {
    startY: cursor,
    head: [["Designação", "IP Loopback", "Cidade/UF", "Data/Hora"]],
    body: d.circuitos.map((c) => [c.designacao, c.ip, `${c.cidade}/${c.uf}`, c.dataHora]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [11, 58, 130], textColor: 255 },
    margin: { left: 40, right: 40 },
  });
  doc.save(`mascara_${d.caso}.pdf`);
}
