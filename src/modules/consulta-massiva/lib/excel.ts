import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { GIS_COLUMNS, type GisRow, type Origem, type ProcessedRow } from "./gis-types";

export function parseDateBR(value: unknown): number {
  if (value == null || value === "") return NaN;
  if (typeof value === "number") {
    // Excel serial date: days since 1899-12-30. Treat as local wall-clock time
    // so values like 14:17 in the sheet stay 14:17 instead of being shifted
    // by the user's timezone offset.
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return new Date(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
    ).getTime();
  }
  const s = String(value).trim();
  const m = s.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})[ T]?(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?/,
  );
  if (m) {
    const [, d, mo, y, h = "0", mi = "0", se = "0"] = m;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    return new Date(year, Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se)).getTime();
  }
  const t = Date.parse(s);
  return isNaN(t) ? NaN : t;
}

export function formatDateBR(ts: number): string {
  if (!ts || isNaN(ts)) return "-";
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function readGisFile(file: File, origem: Origem): Promise<GisRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<GisRow>(sheet, { defval: "", raw: true });
  return rows.map((r) => ({ ...r, __origem: origem }));
}

export function exportToXlsx(rows: Record<string, unknown>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Massivas");
  XLSX.writeFile(wb, filename);
}

export function exportToCsv(rows: Record<string, unknown>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToPdf(
  rows: Record<string, unknown>[],
  filename: string,
  title = "Consulta Massiva GIS",
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text(title, 40, 36);
  doc.setFontSize(9);
  doc.text(new Date().toLocaleString("pt-BR"), 40, 52);
  if (rows.length) {
    const cols = Object.keys(rows[0]);
    autoTable(doc, {
      startY: 64,
      head: [cols],
      body: rows.map((r) => cols.map((c) => String(r[c] ?? ""))),
      styles: { fontSize: 7, cellPadding: 3 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });
  }
  doc.save(filename);
}

export function processedRowsForExport(rows: ProcessedRow[]) {
  const sitLabel: Record<string, string> = {
    MASSIVA: "MASSIVA",
    LOTERICA_ISOLADA: "LOTÉRICA ISOLADA",
    ISOLADO: "ISOLADO",
  };
  const dentroLabel: Record<string, string> = {
    SIM: "SIM",
    NAO: "NAO",
    SEM_GEO: "SEM GEO",
  };
  return rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const c of GIS_COLUMNS) out[c] = r[c] ?? "";
    out["Data e Hora Incial"] = r.__dataHora ?? "";
    out["Operadora Responsável"] = r.__operadora;
    out["Classificação"] = r.__classificacao;
    out["Tipo Emp."] = r.__tipoEmp;
    out["Parceira Responsável"] = r.__parceira;
    out["Situação"] = sitLabel[r.__situacao ?? "ISOLADO"] ?? "ISOLADO";
    out["ID Massiva"] = r["ID Massiva"] ?? "";
    out["Tipo Massiva"] = r["Tipo Massiva"] ?? "";
    out["Status Massiva"] = r["Status Massiva"];
    out["Quantidade Janela"] = r["Quantidade Janela"] ?? "";
    out["Primeiro Alarme"] = r["Primeiro Alarme"] ?? "";
    out["Último Alarme"] = r["Último Alarme"] ?? "";
    out["Distância até Epicentro (km)"] =
      r.__distanciaEpicentroKm == null ? "" : r.__distanciaEpicentroKm;
    out["Dentro de 60 KM"] = dentroLabel[r.__dentro60km ?? "SEM_GEO"] ?? "SEM GEO";
    return out;
  });
}
