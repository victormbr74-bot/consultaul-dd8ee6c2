/**
 * Compatibility wrapper around ExcelJS providing an API similar to the old `xlsx` (SheetJS) package.
 * This replaces the vulnerable `xlsx` package with `exceljs`.
 */
import ExcelJS from "exceljs";

// ── Types ──────────────────────────────────────────────────────────

export interface CompatWorkbook {
  SheetNames: string[];
  Sheets: Record<string, ExcelJS.Worksheet>;
  /** The underlying ExcelJS workbook (useful for write operations). */
  _wb: ExcelJS.Workbook;
}

interface SheetToJsonOptions {
  /** Default value for empty cells */
  defval?: unknown;
  /** If 1, return arrays with header row as first element. If "A", use column letters as keys. */
  header?: 1 | "A";
  /** Number of header rows to skip (0-based). Only used with header option. */
  range?: number;
  /** Keep raw values (ignored – always returns parsed values) */
  raw?: boolean;
}

// ── Read ───────────────────────────────────────────────────────────

export async function readExcel(
  data: ArrayBuffer,
  _options?: { type?: string; cellDates?: boolean },
): Promise<CompatWorkbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);

  const SheetNames = wb.worksheets.map((ws) => ws.name);
  const Sheets: Record<string, ExcelJS.Worksheet> = {};
  for (const ws of wb.worksheets) {
    Sheets[ws.name] = ws;
  }

  return { SheetNames, Sheets, _wb: wb };
}

// ── sheet_to_json ──────────────────────────────────────────────────

function cellValue(cell: ExcelJS.Cell | undefined, defval: unknown): unknown {
  if (!cell || cell.value === null || cell.value === undefined) return defval;
  const v = cell.value;
  // ExcelJS wraps rich text, hyperlinks, formulas etc.
  if (typeof v === "object") {
    if ("result" in v) return (v as ExcelJS.CellFormulaValue).result ?? defval;
    if ("richText" in v)
      return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("");
    if ("text" in v) return (v as ExcelJS.CellHyperlinkValue).text;
    if (v instanceof Date) return v;
  }
  return v;
}

export function sheetToJson<T = Record<string, unknown>>(
  ws: ExcelJS.Worksheet,
  opts?: SheetToJsonOptions,
): T[] {
  const defval = opts?.defval ?? undefined;
  const rows: T[] = [];

  if (!ws || ws.rowCount === 0) return rows;

  if (opts?.header === 1) {
    // Return arrays of arrays
    const startRow = (opts?.range ?? 0) + 1;
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber < startRow) return;
      const arr: unknown[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        while (arr.length < colNumber - 1) arr.push(defval);
        arr.push(cellValue(cell, defval));
      });
      rows.push(arr as unknown as T);
    });
    return rows;
  }

  if (opts?.header === "A") {
    // Use column letters as keys, skip `range` header rows
    const startRow = (opts?.range ?? 0) + 1 + 1; // +1 for 1-based, +1 to skip header
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber < startRow) return;
      const obj: Record<string, unknown> = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const letter = columnLetter(colNumber);
        obj[letter] = cellValue(cell, defval);
      });
      rows.push(obj as unknown as T);
    });
    return rows;
  }

  // Default: use first row as header keys
  const headerRow = ws.getRow(1);
  if (!headerRow) return rows;

  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    while (headers.length < colNumber - 1) headers.push(`__col${headers.length}`);
    const v = cellValue(cell, "");
    headers.push(String(v ?? "").trim());
  });

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, unknown> = {};
    let hasValue = false;

    for (let i = 0; i < headers.length; i++) {
      const key = headers[i];
      if (!key || key.startsWith("__col")) {
        obj[key || `col${i}`] = defval;
        continue;
      }
      const cell = row.getCell(i + 1);
      const v = cellValue(cell, defval);
      obj[key] = v;
      if (v !== defval && v !== "" && v !== null && v !== undefined) hasValue = true;
    }

    // Also fill missing headers with defval
    if (hasValue) rows.push(obj as unknown as T);
  });

  return rows;
}

function columnLetter(col: number): string {
  let result = "";
  let c = col;
  while (c > 0) {
    c -= 1;
    result = String.fromCharCode(65 + (c % 26)) + result;
    c = Math.floor(c / 26);
  }
  return result;
}

// ── Write helpers ──────────────────────────────────────────────────

export function jsonToWorkbook(
  sheets: { name: string; data: Record<string, unknown>[] }[],
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  for (const { name, data } of sheets) {
    const ws = wb.addWorksheet(name);
    if (data.length === 0) continue;

    const keys = Object.keys(data[0]);
    ws.columns = keys.map((key) => ({ header: key, key, width: 18 }));

    for (const row of data) {
      ws.addRow(row);
    }
  }
  return wb;
}

export async function writeFile(wb: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
