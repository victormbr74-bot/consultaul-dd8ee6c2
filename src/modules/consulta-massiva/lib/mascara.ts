import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Massiva, ProcessedRow } from "./gis-types";

export interface MascaraInput {
  cliente?: string;
  inc_massiva: string;
  chamado_interno: string;
  caso_pai: string;
  tipo_label: "PRINCIPAL" | "SECUNDÁRIO";
  uf_label: string;
  qtd_total: number;
  qtd_isoladas: number;
  horario_falha: string;
  horario_normalizacao: string;
  causa_solucao: string;
  status_texto: string;
  lotericas_isoladas: Array<{ codigo: string; loterica: string }>;
}

export const STATUS_PADRAO =
  "A equipe de campo foi mobilizada para diagnosticar a causa raiz da interrupção no meio de transmissão.\n" +
  "Prazo estimado de 2 horas para diagnóstico da falha e deslocamento da equipe de campo.\n" +
  "Acompanhamento contínuo pelo NOC até a normalização total dos circuitos afetados.";

const clean = (value: unknown) => String(value ?? "").trim();

function firstAlarmRows(m: Massiva, rows: ProcessedRow[]): ProcessedRow[] {
  const set = new Set(m.rowIds);
  return rows
    .filter((r) => set.has(r.__rowId))
    .sort((a, b) => {
      const ats = Number.isFinite(a.__ts) ? a.__ts : Number.MAX_SAFE_INTEGER;
      const bts = Number.isFinite(b.__ts) ? b.__ts : Number.MAX_SAFE_INTEGER;
      return ats - bts;
    });
}

function resolveInc(participants: ProcessedRow[]): string {
  const firstChamado = clean(participants[0]?.["Chamado"]);
  if (firstChamado) return firstChamado;
  return participants.map((r) => clean(r["Chamado"])).find(Boolean) || "PENDENTE";
}

function resolveCasoPai(first?: ProcessedRow): string {
  return clean(first?.["Designação"] ?? first?.["DesignaÃ§Ã£o"]).replace(/^CEF/i, "") || "-";
}

export function buildMascaraFromMassiva(
  m: Massiva,
  rows: ProcessedRow[],
  overrides: Partial<MascaraInput> = {},
): MascaraInput {
  const participants = firstAlarmRows(m, rows);
  return {
    cliente: "CAIXA ECONOMICA",
    inc_massiva: resolveInc(participants),
    chamado_interno: "",
    caso_pai: resolveCasoPai(participants[0]),
    tipo_label: m.tipo_link === "SECUNDARIO" ? "SECUNDARIO" : "PRINCIPAL",
    uf_label: m.uf,
    qtd_total: m.qtd_circuitos,
    qtd_isoladas: m.qtd_lotericas_isoladas ?? 0,
    horario_falha: m.primeiro_alarme,
    horario_normalizacao: "PENDENTE",
    causa_solucao: "PENDENTE",
    status_texto: STATUS_PADRAO,
    lotericas_isoladas: m.lotericas_isoladas ?? [],
    ...overrides,
  };
}

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isolatedPlainRows(d: MascaraInput): string[] {
  if (!d.lotericas_isoladas.length) return ["Nenhuma loterica isolada identificada."];
  return d.lotericas_isoladas.map((l) => `${l.codigo}\t${l.loterica}`);
}

function isolatedHtmlRows(d: MascaraInput): string {
  if (!d.lotericas_isoladas.length) {
    return `<tr><td colspan="2" style="padding:6px 8px;border:1px solid #ccc">Nenhuma loterica isolada identificada.</td></tr>`;
  }
  return d.lotericas_isoladas
    .map(
      (l) =>
        `<tr><td style="padding:4px 8px;border:1px solid #ccc;font-family:monospace">${esc(l.codigo)}</td>` +
        `<td style="padding:4px 8px;border:1px solid #ccc">${esc(l.loterica)}</td></tr>`,
    )
    .join("");
}

export function buildMascaraHtml(d: MascaraInput): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Evento Massivo - ${esc(d.inc_massiva)}</title></head>
<body style="font-family:Arial,sans-serif;color:#222;max-width:820px;margin:24px auto;padding:16px">
  <h2 style="margin:0 0 4px 0;color:#0b3a82">CONSORCIO LOTERICAS</h2>
  <h3 style="margin:0 0 16px 0">Evento Massivo - Chamado Aberto</h3>
  <div style="font-family:monospace;margin-bottom:14px">===============================</div>
  <table style="border-collapse:collapse;width:100%;font-size:13px">
    <tbody>
      <tr><td style="padding:4px 8px;background:#f3f4f6;width:210px"><b>Cliente</b></td><td style="padding:4px 8px">${esc(d.cliente ?? "")}</td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>INC da Massiva</b></td><td style="padding:4px 8px">${esc(d.inc_massiva)}</td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>Chamado interno</b></td><td style="padding:4px 8px">${esc(d.chamado_interno)}</td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>Caso Pai</b></td><td style="padding:4px 8px"><b>${esc(d.caso_pai)}</b></td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>Tipo</b></td><td style="padding:4px 8px">${esc(d.tipo_label)}</td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>UF</b></td><td style="padding:4px 8px">${esc(d.uf_label)}</td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>Quantidade total</b></td><td style="padding:4px 8px">${d.qtd_total}</td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>Quantidade isoladas</b></td><td style="padding:4px 8px">${d.qtd_isoladas}</td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>Horario da falha</b></td><td style="padding:4px 8px">${esc(d.horario_falha)}</td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>Horario de normalizacao</b></td><td style="padding:4px 8px">${esc(d.horario_normalizacao)}</td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>Causa/Solucao</b></td><td style="padding:4px 8px">${esc(d.causa_solucao)}</td></tr>
    </tbody>
  </table>
  <p style="white-space:pre-line;margin:16px 0 0 0;font-size:13px"><b>Status:</b> ${esc(d.status_texto)}</p>
  <h4 style="margin:16px 0 4px 0">Lotericas isoladas (${d.qtd_isoladas})</h4>
  <table style="border-collapse:collapse;width:100%;font-size:12px">
    <thead><tr style="background:#0b3a82;color:#fff">
      <th style="padding:6px 8px;text-align:left">Codigo</th>
      <th style="padding:6px 8px;text-align:left">Loterica</th>
    </tr></thead>
    <tbody>${isolatedHtmlRows(d)}</tbody>
  </table>
</body></html>`;
}

export function downloadMascaraHtml(d: MascaraInput) {
  const blob = new Blob([buildMascaraHtml(d)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mascara_${d.inc_massiva}.html`;
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
  return [
    "CONSORCIO LOTERICAS",
    "",
    "Evento Massivo - Chamado Aberto",
    "",
    "===============================",
    "",
    `Cliente: ${d.cliente ?? ""}`,
    `INC da Massiva: ${d.inc_massiva}`,
    `Chamado interno: ${d.chamado_interno}`,
    `Caso Pai: ${d.caso_pai}`,
    `Tipo: ${d.tipo_label}`,
    `UF: ${d.uf_label}`,
    `Quantidade total: ${d.qtd_total}`,
    `Quantidade isoladas: ${d.qtd_isoladas}`,
    `Horario da falha: ${d.horario_falha}`,
    `Horario de normalizacao: ${d.horario_normalizacao}`,
    `Causa/Solucao: ${d.causa_solucao}`,
    "",
    `Status: ${d.status_texto}`,
    "",
    `Lotericas isoladas (${d.qtd_isoladas}):`,
    ...isolatedPlainRows(d),
  ].join("\n");
}

export function exportMascaraPdf(d: MascaraInput) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(11, 58, 130);
  doc.text("CONSORCIO LOTERICAS", 40, 40);
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text("Evento Massivo - Chamado Aberto", 40, 58);
  doc.setDrawColor(200);
  doc.line(40, 64, w - 40, 64);

  const meta: Array<[string, string]> = [
    ["Cliente", d.cliente ?? ""],
    ["INC da Massiva", d.inc_massiva],
    ["Chamado interno", d.chamado_interno],
    ["Caso Pai", d.caso_pai],
    ["Tipo", d.tipo_label],
    ["UF", d.uf_label],
    ["Quantidade total", String(d.qtd_total)],
    ["Quantidade isoladas", String(d.qtd_isoladas)],
    ["Horario da falha", d.horario_falha],
    ["Horario de normalizacao", d.horario_normalizacao],
    ["Causa/Solucao", d.causa_solucao],
  ];
  autoTable(doc, {
    startY: 76,
    head: [["Campo", "Valor"]],
    body: meta,
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [11, 58, 130], textColor: 255 },
    columnStyles: { 0: { cellWidth: 150, fontStyle: "bold" } },
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
  const cursor = afterMeta + 14 + statusLines.length * 11 + 8;
  autoTable(doc, {
    startY: cursor,
    head: [["Codigo", "Loterica"]],
    body: d.lotericas_isoladas.length
      ? d.lotericas_isoladas.map((l) => [l.codigo, l.loterica])
      : [["", "Nenhuma loterica isolada identificada."]],
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [11, 58, 130], textColor: 255 },
    margin: { left: 40, right: 40 },
  });
  doc.save(`mascara_${d.inc_massiva}.pdf`);
}
