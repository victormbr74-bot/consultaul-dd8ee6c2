import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { GIS_COLUMNS, type GisRow, type Origem, type ProcessedRow } from "./gis-types";

// ---------------------------------------------------------------------------
// Helpers de parsing de cabeçalho / mojibake
// ---------------------------------------------------------------------------

function fixMojibake(value: string): string {
  if (!/[ÃÂ]/.test(value) || typeof TextDecoder === "undefined") return value;
  try {
    const bytes = Uint8Array.from(Array.from(value, (ch) => ch.charCodeAt(0) & 0xff));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return value;
  }
}

function normalizeHeader(value: string): string {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function headerVariants(value: string): string[] {
  const raw = String(value ?? "");
  const variants = new Set<string>([normalizeHeader(raw)]);
  const fixed = fixMojibake(raw);
  if (fixed !== raw) variants.add(normalizeHeader(fixed));
  return Array.from(variants).filter(Boolean);
}

function getCell(row: GisRow, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim() !== "") return String(value);
  }
  const targets = new Set(keys.flatMap(headerVariants));
  for (const [key, value] of Object.entries(row)) {
    if (value == null || String(value).trim() === "") continue;
    if (headerVariants(key).some((variant) => targets.has(variant))) return String(value);
  }
  return "";
}

function backupOrigemFromTipoLink(value: string): Origem | null {
  const tipo = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
  if (/^(SEC|SECUNDARIO|BACKUP|BKP|BKO|BK\b)/.test(tipo)) return "2_LINKS";
  return null;
}

// ---------------------------------------------------------------------------
// Detecção de separador de CSV (; ou ,)
// ---------------------------------------------------------------------------

function detectDelimiter(text: string): "," | ";" {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "" && !/^sep=/i.test(l.trim()));
  if (lines.length < 2) return ",";
  const header = lines[0];
  const candidates = [",", ";"];
  const totals = candidates.map((sep) => header.split(sep).length - 1);
  const best = candidates[totals.indexOf(Math.max(...totals))];
  return best as "," | ";";
}

// ---------------------------------------------------------------------------
// Parser de CSV "casa de qualidade" para aceitar sep=..., qualquer delimitador
// ---------------------------------------------------------------------------

function parseCsvRaw(text: string): GisRow[] {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const start = lines.length > 0 && /^\uFEFF?sep=/i.test(lines[0].trim()) ? 1 : 0;
  const content = lines.slice(start).join("\n");
  const sep = detectDelimiter(content);
  const records = splitCsvRecords(content);
  if (records.length < 2) return [];
  const headers = splitCsvLine(records[0], sep);
  const rows: GisRow[] = [];
  for (let i = 1; i < records.length; i++) {
    const record = records[i];
    if (!record.trim()) continue;
    const values = splitCsvLine(record, sep);
    if (values.length === 0) continue;
    const row: GisRow = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function splitCsvRecords(text: string): string[] {
  const records: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      current += ch;
      if (inQuotes && text[i + 1] === '"') {
        current += text[i + 1];
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "\n" && !inQuotes) {
      records.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim() || text.endsWith("\n")) records.push(current);
  return records;
}

function splitCsvLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === sep && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ---------------------------------------------------------------------------
// Atualização do parser de data: também aceita ISO YYYY-MM-DD HH:mm:ss
//   (o parser antigo já aceita ISO via Date.parse, mas garantimos aqui)
// ---------------------------------------------------------------------------

export function parseDateBR(value: unknown): number {
  if (value == null || value === "") return NaN;
  const excelSerialToTimestamp = (serial: number): number => {
    const ms = Math.round((serial - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return new Date(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
    ).getTime();
  };
  if (typeof value === "number") {
    return excelSerialToTimestamp(value);
  }
  const s = String(value).trim();
  if (/^\d{4,6}(?:\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (serial >= 20000 && serial <= 80000) return excelSerialToTimestamp(serial);
  }
  const m = s.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})[ T]?(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?/,
  );
  if (m) {
    const [, d, mo, y, h = "0", mi = "0", se = "0"] = m;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    return new Date(year, Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se)).getTime();
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (iso) {
    const [, y, mo, d, h, mi, se = "0"] = iso;
    return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se)).getTime();
  }
  const t = Date.parse(s);
  return isNaN(t) ? NaN : t;
}

export function formatDateBR(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return "";
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// ---------------------------------------------------------------------------
// readGisFile - aceita CSV (antigo ; e novo , com sep=) e XLSX/XLS
// ---------------------------------------------------------------------------

export async function readGisFile(file: File, origem: Origem): Promise<GisRow[]> {
  const filename = file.name.toLowerCase();
  const isCsv = filename.endsWith(".csv");
  const isExcel = filename.endsWith(".xlsx") || filename.endsWith(".xls");

  if (!isCsv && !isExcel) {
    throw new Error(`Formato não suportado: ${file.name}. Use CSV, XLSX ou XLS.`);
  }

  let rawRows: GisRow[];

  if (isCsv) {
    const text = await file.text();
    rawRows = parseCsvRaw(text);
  } else {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rawRows = XLSX.utils.sheet_to_json<GisRow>(sheet, { defval: "", raw: true });
  }

  if (!rawRows.length) {
    throw new Error("Arquivo não contém linhas de dados válidas após o cabeçalho.");
  }

  // Normaliza nomes de coluna e garante colunas opcionais m_duration / s_duration
  const normalized = rawRows.map((r) => {
    const out: GisRow = { ...r };
    for (const c of GIS_COLUMNS) {
      if (!(c in out) || out[c] === undefined || out[c] === null) out[c] = "";
    }
    if (!("m_duration" in out)) out["m_duration"] = null;
    if (!("s_duration" in out)) out["s_duration"] = null;
    return out;
  });

  console.info(
    "[excel] importado:",
    file.name,
    "| linhas:",
    normalized.length,
    "| colunas:",
    Object.keys(normalized[0] ?? {}).join(", "),
  );

  return normalized.map((r) => ({
    ...r,
    __origem:
      backupOrigemFromTipoLink(
        getCell(r, "Tipo de Link", "Tipo do Link", "TIPO DE LINK", "Tipo Link", "Tipo"),
      ) ?? origem,
  }));
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
