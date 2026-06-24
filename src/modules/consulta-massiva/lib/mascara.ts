import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Massiva, ProcessedRow } from "./gis-types";

export interface MascaraInput {
  cliente?: string;
  inc_massiva: string;
  chamado_interno: string;
  caso: string;
  tipo_label: "PRINCIPAL" | "SECUNDÁRIO";
  uf_label: string;
  qtd_total: number;
  qtd_isoladas: number;
  horario_falha: string;
  horario_normalizacao: string;
  causa_solucao: string;
  status_texto: string;
  atualizacao?: string;
  lotericas_isoladas: Array<{ codigo_loterica: string; ip_loopback?: string; designacao?: string }>;
  links_envolvidos: Array<{ ip_loopback: string; designacao: string }>;
}

export const STATUS_PADRAO =
  "A equipe de campo foi mobilizada para diagnosticar a causa raiz da interrupção no meio de transmissão.\n" +
  "2 horas para equipe diagnosticar a causa da falha e deslocar a equipe de campo.";

export const PROXIMO_STATUS_INTERVAL_HOURS = 4;

export function proximoStatusLine(baseDate: Date = new Date()): string {
  const next = new Date(baseDate.getTime() + PROXIMO_STATUS_INTERVAL_HOURS * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `Próximo Status em ${p(next.getDate())}/${p(next.getMonth() + 1)}/${next.getFullYear()} às ${p(next.getHours())}:${p(next.getMinutes())}:${p(next.getSeconds())}`;
}

export const proxStatus = proximoStatusLine;


function valueFromMask(lines: string[], label: string): string {
  const found = lines.find((line) => line.trim().toLowerCase().startsWith(label.toLowerCase()));
  if (!found) return "";
  const idx = found.indexOf(":");
  return idx >= 0 ? found.slice(idx + 1).trim() : "";
}

function padMaskQty(value: string): string {
  const cleanValue = value.trim();
  const numeric = cleanValue.match(/\d+/)?.[0];
  return numeric ? numeric.padStart(2, "0") : cleanValue;
}

function formatIpList(items: Array<{ ip_loopback: string; designacao: string }>): string[] {
  const maxIp = items.reduce((acc, l) => Math.max(acc, (l.ip_loopback ?? "").length), 0);
  return items.map((l) => `${(l.ip_loopback ?? "").padEnd(maxIp + 3, " ")}${l.designacao ?? ""}`);
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function extractIsolatedCodesFromMask(lines: string[]): string[] {
  const titleIndex = lines.findIndex((line) => normalizeText(line).includes("LOTERICAS ISOLADAS"));
  const section = titleIndex >= 0 ? lines.slice(titleIndex + 1) : [];
  const codes = section.map((line) => line.trim()).filter((line) => line && /^\d{2}-\d{6}-\d$/.test(line));
  return codes.length ? codes : ["Nenhuma lotérica isolada identificada."];
}

export function applyAtualizacaoToMascara(
  mascaraTexto: string | null | undefined,
  atualizacao: string,
  baseDate: Date = new Date(),
): string {
  const updateText = String(atualizacao ?? "");
  const lines = String(mascaraTexto ?? "").split(/\r?\n/);
  const separator = "===============================";
  const separatorIndexes = lines
    .map((line, index) => (line.trim() === separator ? index : -1))
    .filter((index) => index >= 0);
  const lastSeparator = separatorIndexes.at(-1) ?? -1;
  const isolatedCodes = extractIsolatedCodesFromMask(lines);
  const oldCaso =
    valueFromMask(lines, "Caso:") ||
    lines.find((line) => /\|\s*Evento Massivo\s+/i.test(line) && !line.trim().startsWith("Caso:"))?.trim() ||
    "- | Evento Massivo Principal | | -";

  return [
    separator,
    "CONSÓRCIO LOTÉRICAS",
    "Evento Massivo - ATUALIZAÇÃO",
    separator,
    `Cliente: ${valueFromMask(lines, "Cliente:") || "CAIXA ECONÔMICA"}`,
    `Chamado interno: ${valueFromMask(lines, "Chamado interno") || "PENDENTE"}`,
    `Caso: ${oldCaso}`,
    `Tipo: ${valueFromMask(lines, "Tipo:") || "PRIMÁRIO"}`,
    `UF: ${valueFromMask(lines, "UF:") || "-"}`,
    `Quantidade Isoladas: ${padMaskQty(valueFromMask(lines, "Quantidade Isoladas:") || "0")}`,
    `Quantidade total: ${valueFromMask(lines, "Quantidade total:") || "0"}`,
    `Horário da falha: ${valueFromMask(lines, "Horário da falha:") || "PENDENTE"}`,
    `Horário de Normalização: ${valueFromMask(lines, "Horário de Normalização:") || "PENDENTE"}`,
    `Causa/Solução: ${valueFromMask(lines, "Causa/Solução:") || "PENDENTE"}`,
    `Status: ${updateText || STATUS_PADRAO}`,
    `Horas: ${proximoStatusLine(baseDate)}`,
    separator,
    "",
    "LOTÉRICAS ISOLADAS",
    "",
    ...isolatedCodes,
  ].join("\n");
}


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

function resolveDesignacao(first?: ProcessedRow): string {
  return clean(first?.["Designação"] ?? first?.["DesignaÃ§Ã£o"] ?? first?.["DesignaÃƒÂ§ÃƒÂ£o"]) || "-";
}

function resolveCasoCodigo(participants: ProcessedRow[]): string {
  return participants
    .map((r) => clean(r["Nº REQ Caixa"] ?? r["NÂº REQ Caixa"] ?? r["NÃ‚Âº REQ Caixa"] ?? r["REQ Caixa"]))
    .find(Boolean) || "PENDENTE";
}

function resolveCodigoPrimeiroAlarme(first?: ProcessedRow): string {
  return clean(
    first?.["Cód. da Lotérica"] ??
      first?.["CÃ³d. da LotÃ©rica"] ??
      first?.["CÃƒÂ³d. da LotÃƒÂ©rica"] ??
      first?.["Código da Lotérica"] ??
      first?.["CÃ³digo da LotÃ©rica"] ??
      first?.["Codigo da Loterica"] ??
      first?.["Codigo"],
  ) || "PENDENTE";
}

function resolveChamadoInterno(participants: ProcessedRow[]): string {
  return participants
    .map((r) => clean(r["Nº REQ Caixa"] ?? r["NÂº REQ Caixa"] ?? r["REQ Caixa"]))
    .find(Boolean) || "PENDENTE";
}

function padQty(value: number): string {
  return String(value).padStart(2, "0");
}

function formatCodigosIsoladas(items: Array<{ codigo_loterica: string }>): string[] {
  const codes = items.map((l) => clean(l.codigo_loterica)).filter(Boolean);
  return codes.length ? codes : ["Nenhuma lotérica isolada identificada."];
}

export function buildMascaraFromMassiva(
  m: Massiva,
  rows: ProcessedRow[],
  overrides: Partial<MascaraInput> = {},
): MascaraInput {
  const participants = firstAlarmRows(m, rows);
  const first = participants[0];
  const designacao = resolveDesignacao(first);
  const chamadoInterno = resolveInc(participants);
  const casoCodigo = resolveCodigoPrimeiroAlarme(first);
  const linksEnvolvidos = participants
    .map((r) => ({
      ip_loopback: clean(r["IP Loopback"]),
      designacao: clean(r["Designação"] ?? r["DesignaÃ§Ã£o"]),
    }))
    .filter((l) => l.ip_loopback || l.designacao);
  return {
    cliente: "CAIXA ECONOMICA",
    inc_massiva: resolveInc(participants),
    chamado_interno: chamadoInterno,
    caso: `${casoCodigo} | Evento Massivo ${m.tipo_link === "SECUNDARIO" ? "Secundário" : "Principal"} | | ${designacao} | NA`,
    tipo_label: m.tipo_link === "SECUNDARIO" ? "SECUNDÁRIO" : "PRINCIPAL",
    uf_label: m.uf,
    qtd_total: m.qtd_circuitos,
    qtd_isoladas: m.qtd_lotericas_isoladas ?? 0,
    horario_falha: m.primeiro_alarme,
    horario_normalizacao: "PENDENTE",
    causa_solucao: "PENDENTE",
    status_texto: overrides.status_texto ?? STATUS_PADRAO,
    atualizacao: overrides.atualizacao ?? "",
    lotericas_isoladas: m.lotericas_isoladas ?? [],
    links_envolvidos: linksEnvolvidos,
    ...overrides,
  };
}

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildMascaraTextoFromMassiva(
  m: Massiva,
  rows: ProcessedRow[],
  overrides: Partial<MascaraInput> = {},
): string {
  const base = buildMascaraFromMassiva(m, rows, {
    cliente: "CAIXA ECONÔMICA",
    ...overrides,
  });
  const tipoLabel = m.tipo_link === "SECUNDARIO" ? "SECUNDÁRIO" : "PRIMÁRIO";
  const tituloEvento = base.atualizacao ? "ATUALIZAÇÃO" : "ABERTURA";
  const parsedFalha = base.horario_falha ? new Date(base.horario_falha) : null;
  const horasBase = parsedFalha && !isNaN(parsedFalha.getTime()) ? parsedFalha : new Date();

  return [
    "===============================",
    "CONSÓRCIO LOTÉRICAS",
    `Evento Massivo - ${tituloEvento}`,
    "===============================",
    `Cliente: ${base.cliente ?? ""}`,
    `Chamado interno: ${base.chamado_interno}`,
    `Caso: ${base.caso}`,
    `Tipo: ${tipoLabel}`,
    `UF: ${base.uf_label}`,
    `Quantidade Isoladas: ${padQty(base.qtd_isoladas)}`,
    `Quantidade total: ${base.qtd_total}`,
    `Horário da falha: ${base.horario_falha}`,
    `Horário de Normalização: ${base.horario_normalizacao}`,
    `Causa/Solução: ${base.causa_solucao}`,
    `Status: ${base.atualizacao || base.status_texto || "PENDENTE"}`,
    `Horas: ${proximoStatusLine(horasBase)}`,
    "===============================",
    "",
    "LOTÉRICAS ISOLADAS",
    "",
    ...formatCodigosIsoladas(base.lotericas_isoladas),
  ].join("\n");
}



export function buildMascaraHtml(d: MascaraInput): string {
  const isoladasRows = d.lotericas_isoladas.length
    ? d.lotericas_isoladas
        .map(
          (l) =>
            `<tr><td style="padding:4px 8px;border:1px solid #ccc;font-family:monospace">${esc(l.codigo_loterica)}</td></tr>`,
        )
        .join("")
    : `<tr><td style="padding:6px 8px;border:1px solid #ccc">Nenhuma lotérica isolada identificada.</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Evento Massivo - ${esc(d.inc_massiva)}</title></head>
<body style="font-family:Arial,sans-serif;color:#222;max-width:820px;margin:24px auto;padding:16px">
  <h2 style="margin:0 0 4px 0;color:#0b3a82">CONSÓRCIO LOTÉRICAS</h2>
  <h3 style="margin:0 0 16px 0">Evento Massivo - Chamado Aberto</h3>
  <div style="font-family:monospace;margin-bottom:14px">===============================</div>
  <table style="border-collapse:collapse;width:100%;font-size:13px">
    <tbody>
      <tr><td style="padding:4px 8px;background:#f3f4f6;width:210px"><b>Cliente</b></td><td style="padding:4px 8px">${esc(d.cliente ?? "")}</td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>Chamado interno</b></td><td style="padding:4px 8px">${esc(d.chamado_interno)}</td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>Caso</b></td><td style="padding:4px 8px">${esc(d.caso)}</td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>Tipo</b></td><td style="padding:4px 8px">${esc(d.tipo_label)}</td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>UF</b></td><td style="padding:4px 8px">${esc(d.uf_label)}</td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>Quantidade Isoladas</b></td><td style="padding:4px 8px">${String(d.qtd_isoladas).padStart(2, "0")}</td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>Quantidade total</b></td><td style="padding:4px 8px">${String(d.qtd_total).padStart(2, "0")}</td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>Horário da falha</b></td><td style="padding:4px 8px">${esc(d.horario_falha)}</td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>Horário de normalização</b></td><td style="padding:4px 8px">${esc(d.horario_normalizacao)}</td></tr>
      <tr><td style="padding:4px 8px;background:#f3f4f6"><b>Causa/Solução</b></td><td style="padding:4px 8px">${esc(d.causa_solucao)}</td></tr>
    </tbody>
  </table>
  <p style="white-space:pre-line;margin:16px 0 0 0;font-size:13px"><b>Status:</b> ${esc(d.atualizacao || d.status_texto)}</p>
  <p style="white-space:pre-line;margin:8px 0 0 0;font-size:12px;color:#374151"><b>Horas:</b> ${esc(STATUS_PADRAO)}</p>
  <h4 style="margin:16px 0 4px 0">LOTÉRICAS ISOLADAS</h4>
  <table style="border-collapse:collapse;width:100%;font-size:12px">
    <thead><tr style="background:#0b3a82;color:#fff">
      <th style="padding:6px 8px;text-align:left">Código da UL isolada</th>
    </tr></thead>
    <tbody>${isoladasRows}</tbody>
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
    "CONSÓRCIO LOTÉRICAS",
    "",
    "Evento Massivo - Chamado Aberto",
    "",
    "===============================",
    "",
    `Cliente: ${d.cliente ?? ""}`,
    `Chamado interno : ${d.chamado_interno}`,
    `Caso: ${d.caso}`,
    `Tipo: ${d.tipo_label}`,
    `UF: ${d.uf_label}`,
    `Quantidade Isoladas: ${padQty(d.qtd_isoladas)}`,
    `Quantidade total: ${padQty(d.qtd_total)}`,
    `Horário da falha: ${d.horario_falha}`,
    `Horário de normalização: ${d.horario_normalizacao}`,
    `Causa/Solução: ${d.causa_solucao}`,
    "",
    `Status: ${d.atualizacao || d.status_texto}`,
    `Horas: ${STATUS_PADRAO}`,
    "",
    "LOTÉRICAS ISOLADAS",
    "",
    ...formatCodigosIsoladas(d.lotericas_isoladas),
  ].join("\n");
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
  doc.text("Evento Massivo - Chamado Aberto", 40, 58);
  doc.setDrawColor(200);
  doc.line(40, 64, w - 40, 64);

  const meta: Array<[string, string]> = [
    ["Cliente", d.cliente ?? ""],
    ["Chamado interno", d.chamado_interno],
    ["Caso", d.caso],
    ["Tipo", d.tipo_label],
    ["UF", d.uf_label],
    ["Quantidade Isoladas", String(d.qtd_isoladas).padStart(2, "0")],
    ["Quantidade total", String(d.qtd_total).padStart(2, "0")],
    ["Horário da falha", d.horario_falha],
    ["Horário de normalização", d.horario_normalizacao],
    ["Causa/Solução", d.causa_solucao],
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
  const statusLines = doc.splitTextToSize(d.atualizacao || d.status_texto, w - 80);
  doc.text(statusLines, 40, afterMeta + 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Horas", 40, afterMeta + 14 + statusLines.length * 11 + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const standardLines = STATUS_PADRAO.split("\n");
  const standardY = afterMeta + 14 + statusLines.length * 11 + 18;
  standardLines.forEach((line, idx) => {
    doc.text(line, 40, standardY + idx * 11);
  });
  const cursor = standardY + standardLines.length * 11 + 10;
  autoTable(doc, {
    startY: cursor,
    head: [["Código da UL isolada"]],
    body: d.lotericas_isoladas.length
      ? d.lotericas_isoladas.map((l) => [l.codigo_loterica])
      : [["Nenhuma lotérica isolada identificada."]],
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [11, 58, 130], textColor: 255 },
    margin: { left: 40, right: 40 },
  });
  doc.save(`mascara_${d.inc_massiva}.pdf`);
}
