import * as XLSX from "xlsx";

export type Row = Record<string, unknown>;

/** Repairs double-encoded (mojibake) text like "LotÃ©rica" -> "Lotérica". Safe for valid UTF-8. */
export function fixMojibake(s: string): string {
  if (!/[\u00C2-\u00C3\u00E2]/.test(s)) return s;
  try {
    return decodeURIComponent(escape(s));
  } catch {
    return s;
  }
}

/** Normalize a header/key for fuzzy matching: fix mojibake, strip accents, lowercase, keep alnum. */
export function normKey(s: string): string {
  return fixMojibake(String(s))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Find a value in a row by trying multiple header keywords (fuzzy, accent/case insensitive). */
export function getVal(row: Row, ...candidates: string[]): string {
  const keys = Object.keys(row);
  const normMap = new Map(keys.map((k) => [normKey(k), k]));
  for (const c of candidates) {
    const nc = normKey(c);
    // exact normalized
    if (normMap.has(nc)) {
      const v = row[normMap.get(nc)!];
      return cleanVal(v);
    }
  }
  // contains fallback
  for (const c of candidates) {
    const nc = normKey(c);
    for (const [nk, orig] of normMap) {
      if (nk.includes(nc) || nc.includes(nk)) {
        const v = row[orig];
        if (v !== undefined && v !== null && String(v).trim() !== "") return cleanVal(v);
      }
    }
  }
  return "";
}

export function cleanVal(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (v instanceof Date) return isNaN(v.getTime()) ? "" : v.toISOString();
  let s = typeof v === "string" ? fixMojibake(v) : String(v);
  s = s.trim();
  if (s.toLowerCase() === "null" || s.toLowerCase() === "nan") return "";
  return s;
}

/** Collapse multiple spaces and trim. */
export function cleanText(s: string): string {
  return cleanVal(s).replace(/\s+/g, " ").trim();
}

/** Remove the "CEF" prefix from a designation. CEF123456789 -> 123456789 */
export function removeCef(s: string): string {
  return cleanText(s).replace(/^cef/i, "").trim();
}

/** Normalize a lottery code for joining (keep digits and dashes). */
export function normCodigo(s: string): string {
  return cleanVal(s).replace(/\s+/g, "").toUpperCase();
}

interface ParseResult {
  rows: Row[];
  sheet?: string;
}

const SHEET_HINTS: Record<string, string[]> = {
  jira: ["your jira issues", "issues"],
  os_reparo: ["base", "1000", "final"],
  planta: ["lotericas", "loterica"],
  controle_d1: ["data", "controle"],
};

export async function parseFile(file: File, tipo: string): Promise<ParseResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const text = await file.text();
    return { rows: parseCsvText(text) };
  }
  const buf = await file.arrayBuffer();
  // GIS datetimes must remain as raw Excel serials. cellDates:true creates
  // Date objects using the runtime timezone, which can shift the wall-clock
  // hour before processing. raw:true preserves the fractional time component
  // so processing can convert it once, explicitly in America/Sao_Paulo.
  const isGis = tipo === "gis1" || tipo === "gis2";
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const hints = SHEET_HINTS[tipo] ?? [];
  let target = wb.SheetNames[0];
  // pick sheet by hint
  for (const sn of wb.SheetNames) {
    const n = normKey(sn);
    if (hints.some((h) => n.includes(normKey(h)))) {
      target = sn;
      break;
    }
  }
  // if first sheet has very few columns, choose the widest
  const evalSheet = (sn: string) => {
    const arr = XLSX.utils.sheet_to_json<Row>(wb.Sheets[sn], {
      defval: "",
      raw: isGis ? true : false,
    });
    return arr;
  };
  let rows = evalSheet(target);
  if (rows.length === 0 || Object.keys(rows[0] ?? {}).length < 3) {
    let best = target;
    let bestCols = 0;
    for (const sn of wb.SheetNames) {
      const arr = evalSheet(sn);
      const cols = Object.keys(arr[0] ?? {}).length;
      if (cols > bestCols) {
        bestCols = cols;
        best = sn;
        rows = arr;
      }
    }
    target = best;
  }
  return { rows, sheet: target };
}

/** CSV from these systems start with a "sep=," line and use comma separation. */
export function parseCsvText(text: string): Row[] {
  let t = text.replace(/^\uFEFF/, "");
  // strip a leading "sep=," directive line
  const firstLine = t.slice(0, t.indexOf("\n")).trim().toLowerCase();
  if (firstLine.startsWith("sep=")) {
    t = t.slice(t.indexOf("\n") + 1);
  }
  // Keep CSV fields exactly as supplied. With raw:false, SheetJS infers ISO-like
  // datetimes (for example "2024-05-08 04:17:20") and formats them using a
  // date-only mask ("5/8/24"), irreversibly discarding the time component.
  const wb = XLSX.read(t, { type: "string", raw: true });
  const sn = wb.SheetNames[0];
  return XLSX.utils.sheet_to_json<Row>(wb.Sheets[sn], { defval: "", raw: true });
}
