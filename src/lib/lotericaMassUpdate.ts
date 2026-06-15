import ExcelJS from "exceljs";

import { readExcel, sheetToJson } from "@/lib/excelCompat";
import { normalizeCodUlTerm } from "@/lib/lotericaCodUl";

type ColumnFieldKey =
  | "ccto_oi"
  | "ccto_oemp"
  | "loopback_wan"
  | "loopback_lan"
  | "operadora"
  | "endereco"
  | "contato"
  | "designacao_nova"
  | "status"
  | "cidade"
  | "uf";

interface BaseFieldSpec {
  label: string;
  aliases: string[];
}

interface ColumnFieldSpec extends BaseFieldSpec {
  kind: "column";
  key: ColumnFieldKey;
}

interface RawFieldSpec extends BaseFieldSpec {
  kind: "raw";
  rawKey: string;
}

type MassUpdateFieldSpec = ColumnFieldSpec | RawFieldSpec;

export interface MassUpdateEntry {
  codUl: string;
  labels: string[];
  rowNumbers: number[];
  columnPatch: Partial<Record<ColumnFieldKey, string>>;
  rawPatch: Record<string, string>;
}

export interface MassUpdateParseResult {
  entries: MassUpdateEntry[];
  duplicateCodes: string[];
  headers: string[];
  ignoredRows: number[];
  missingCodeHeader: boolean;
  sheetName: string;
}

export interface MassUpdateExistingRow {
  cod_ul: string;
  ccto_oi?: string | null;
  ccto_oemp?: string | null;
  loopback_wan?: string | null;
  loopback_lan?: string | null;
  operadora?: string | null;
  endereco?: string | null;
  contato?: string | null;
  designacao_nova?: string | null;
  status?: string | null;
  cidade?: string | null;
  uf?: string | null;
  raw_data?: Record<string, unknown> | null;
}

export interface MassUpdateRowChange {
  changes: Record<string, unknown>;
  beforeChanges: Record<string, unknown>;
}

const TEMPLATE_SHEET_NAME = "Atualizacao UL";
export const MASS_UPDATE_TEMPLATE_FILENAME = "modelo_atualizacao_ul.xlsx";
export const MASS_UPDATE_ACCEPTED_EXTENSIONS = [".xlsx", ".xlsm"] as const;

const CODE_ALIASES = [
  "COD_UL",
  "COD UL",
  "COD. UL",
  "CODIGO UL",
  "CODIGO DA UL",
  "CODIGO LOTERICA",
  "CODIGO DA LOTERICA",
  "CÓDIGO UL",
  "CÓDIGO DA LOTÉRICA_",
  "CODIGO DA LOTERICA_",
  "UL",
  "cod_ul",
] as const;

const MASS_UPDATE_FIELDS: MassUpdateFieldSpec[] = [
  {
    kind: "column",
    key: "ccto_oi",
    label: "CCTO OI",
    aliases: ["CCTO OI", "CCTO", "ccto_oi"],
  },
  {
    kind: "column",
    key: "loopback_wan",
    label: "Loopback Principal",
    aliases: ["LOOPBACK PRINCIPAL", "LOOPBACK PRIMARIO", "LOOPBACK OI", "loopback_wan"],
  },
  {
    kind: "column",
    key: "loopback_lan",
    label: "Loopback Secundario",
    aliases: ["LOOPBACK SECUNDARIO", "LOOPBACK SECUNDÁRIO", "LOOPBACK OEMP", "LOOPBACK OEM", "loopback_lan"],
  },
  {
    kind: "column",
    key: "ccto_oemp",
    label: "CCTO OEMP",
    aliases: ["CCTO OEMP", "CCTO OEM", "ccto_oemp"],
  },
  {
    kind: "raw",
    rawKey: "EMPRESA OEMP",
    label: "Empresa OEMP",
    aliases: ["EMPRESA OEMP"],
  },
  {
    kind: "raw",
    rawKey: "CIRCUITO OEMP",
    label: "Circuito OEMP",
    aliases: ["CIRCUITO OEMP"],
  },
  {
    kind: "column",
    key: "operadora",
    label: "Operadora",
    aliases: ["OPERADORA", "OPERADORA 4G", "operadora"],
  },
  {
    kind: "column",
    key: "endereco",
    label: "Endereco",
    aliases: ["ENDERECO", "ENDEREÇO", "endereco"],
  },
  {
    kind: "column",
    key: "contato",
    label: "Contato",
    aliases: ["CONTATO", "contato"],
  },
  {
    kind: "column",
    key: "designacao_nova",
    label: "Designacao Nova",
    aliases: ["DESIGNACAO NOVA", "DESIGNAÇÃO NOVA", "DESIGINACAO NOVA", "designacao_nova"],
  },
  {
    kind: "column",
    key: "status",
    label: "Status",
    aliases: ["STATUS", "STATUS UL", "status"],
  },
  {
    kind: "column",
    key: "cidade",
    label: "Cidade",
    aliases: ["CIDADE", "MUNICIPIO", "MUNICÍPIO", "cidade"],
  },
  {
    kind: "column",
    key: "uf",
    label: "UF",
    aliases: ["UF", "uf"],
  },
  {
    kind: "raw",
    rawKey: "REDE LAN",
    label: "Rede LAN",
    aliases: ["REDE LAN", "REDE_LAN"],
  },
  {
    kind: "raw",
    rawKey: "IP SWITCH",
    label: "IP Switch",
    aliases: ["IP SWITCH", "LOOPBACK SWITCH"],
  },
  {
    kind: "raw",
    rawKey: "CIRCUITO BACKUP",
    label: "Circuito Backup",
    aliases: ["CIRCUITO BACKUP", "BACKUP BRISANET", "BRISANET"],
  },
  {
    kind: "raw",
    rawKey: "TECNOLOGIA",
    label: "Tecnologia",
    aliases: ["TECNOLOGIA"],
  },
] as const;

export const MASS_UPDATE_SUPPORTED_FIELDS = MASS_UPDATE_FIELDS.map((field) => field.label);

const normalizeHeader = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const asText = (value: unknown) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleString("pt-BR");
  }

  return String(value).trim();
};

const toRawObject = (value: unknown) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
};

const getValueByAliases = (row: Record<string, unknown>, aliases: readonly string[]) => {
  const normalizedRow = new Map<string, unknown>();

  for (const [key, value] of Object.entries(row)) {
    const normalized = normalizeHeader(key);
    if (normalized && !normalizedRow.has(normalized)) {
      normalizedRow.set(normalized, value);
    }
  }

  for (const alias of aliases) {
    const value = normalizedRow.get(normalizeHeader(alias));
    const text = asText(value);
    if (text) return text;
  }

  return "";
};

const pickMassUpdateSheet = (sheetNames: string[]) => {
  const preferred = ["Atualizacao UL", "Atualização UL", "Atualizacao", "Atualização"];

  for (const option of preferred) {
    const match = sheetNames.find((sheetName) => sheetName.trim().toLowerCase() === option.trim().toLowerCase());
    if (match) return match;
  }

  return sheetNames[0] || TEMPLATE_SHEET_NAME;
};

const getFileExtension = (fileName: string) => {
  const parts = String(fileName || "").toLowerCase().split(".");
  return parts.length > 1 ? `.${parts[parts.length - 1]}` : "";
};

export const parseMassUpdateRows = (
  rows: Record<string, unknown>[],
  options?: { sheetName?: string },
): MassUpdateParseResult => {
  const entriesByCode = new Map<string, MassUpdateEntry>();
  const duplicateCodes = new Set<string>();
  const ignoredRows: number[] = [];
  const headerSet = new Set<string>();

  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      const header = String(key || "").trim();
      if (header) headerSet.add(header);
    });
  });

  const normalizedHeaders = new Set(Array.from(headerSet).map((header) => normalizeHeader(header)).filter(Boolean));
  const missingCodeHeader = !CODE_ALIASES.some((alias) => normalizedHeaders.has(normalizeHeader(alias)));

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const rawCode = getValueByAliases(row, CODE_ALIASES);
    const codUl = normalizeCodUlTerm(rawCode);

    const nextColumnPatch: Partial<Record<ColumnFieldKey, string>> = {};
    const nextRawPatch: Record<string, string> = {};
    const labels: string[] = [];

    for (const field of MASS_UPDATE_FIELDS) {
      const value = getValueByAliases(row, field.aliases);
      if (!value) continue;

      if (field.kind === "column") {
        nextColumnPatch[field.key] = value;
      } else {
        nextRawPatch[field.rawKey] = value;
      }

      if (!labels.includes(field.label)) {
        labels.push(field.label);
      }
    }

    const hasAnyPatch = Object.keys(nextColumnPatch).length > 0 || Object.keys(nextRawPatch).length > 0;
    if (!codUl || !hasAnyPatch) {
      ignoredRows.push(rowNumber);
      return;
    }

    const existing = entriesByCode.get(codUl);
    if (!existing) {
      entriesByCode.set(codUl, {
        codUl,
        labels,
        rowNumbers: [rowNumber],
        columnPatch: nextColumnPatch,
        rawPatch: nextRawPatch,
      });
      return;
    }

    duplicateCodes.add(codUl);
    existing.rowNumbers.push(rowNumber);

    for (const [key, value] of Object.entries(nextColumnPatch)) {
      existing.columnPatch[key as ColumnFieldKey] = value;
    }

    for (const [key, value] of Object.entries(nextRawPatch)) {
      existing.rawPatch[key] = value;
    }

    for (const label of labels) {
      if (!existing.labels.includes(label)) existing.labels.push(label);
    }
  });

  return {
    entries: Array.from(entriesByCode.values()),
    duplicateCodes: Array.from(duplicateCodes).sort((a, b) => a.localeCompare(b, "pt-BR")),
    headers: Array.from(headerSet),
    ignoredRows,
    missingCodeHeader,
    sheetName: options?.sheetName || TEMPLATE_SHEET_NAME,
  };
};

export const buildMassUpdateRowChange = (
  row: MassUpdateExistingRow,
  entry: MassUpdateEntry,
): MassUpdateRowChange => {
  const changes: Record<string, unknown> = {};
  const beforeChanges: Record<string, unknown> = {};

  for (const [key, nextValue] of Object.entries(entry.columnPatch)) {
    const currentValue = asText(row[key as ColumnFieldKey]);
    if (currentValue === nextValue) continue;
    changes[key] = nextValue;
    beforeChanges[key] = row[key as ColumnFieldKey] ?? null;
  }

  const currentRaw = toRawObject(row.raw_data);
  const nextRaw = { ...currentRaw };
  let rawChanged = false;

  for (const [rawKey, nextValue] of Object.entries(entry.rawPatch)) {
    const currentValue = asText(currentRaw[rawKey]);
    if (currentValue === nextValue) continue;
    nextRaw[rawKey] = nextValue;
    rawChanged = true;
  }

  if (rawChanged) {
    changes.raw_data = nextRaw;
    beforeChanges.raw_data = currentRaw;
  }

  return { changes, beforeChanges };
};

export const parseMassUpdateFile = async (file: File): Promise<MassUpdateParseResult> => {
  const extension = getFileExtension(file.name);
  if (!MASS_UPDATE_ACCEPTED_EXTENSIONS.includes(extension as (typeof MASS_UPDATE_ACCEPTED_EXTENSIONS)[number])) {
    throw new Error(
      `Formato nao suportado: ${extension || "desconhecido"}. Use ${MASS_UPDATE_ACCEPTED_EXTENSIONS.join(" ou ")}.`,
    );
  }

  const fileData = await file.arrayBuffer();
  const workbook = await readExcel(fileData, { type: "array", cellDates: true });
  const sheetName = pickMassUpdateSheet(workbook.SheetNames);
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error("Nao foi possivel localizar a aba com os dados de atualizacao.");
  }

  const rows = sheetToJson<Record<string, unknown>>(worksheet, { defval: "", raw: true });
  return parseMassUpdateRows(rows, { sheetName });
};

export const createMassUpdateTemplateWorkbook = () => {
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet(TEMPLATE_SHEET_NAME);
  sheet.columns = [
    { header: "COD_UL", key: "cod_ul", width: 18, style: { numFmt: "@" } },
    { header: "CCTO OI", key: "ccto_oi", width: 20, style: { numFmt: "@" } },
    { header: "LOOPBACK PRINCIPAL", key: "loopback_wan", width: 20, style: { numFmt: "@" } },
    { header: "LOOPBACK SECUNDARIO", key: "loopback_lan", width: 22, style: { numFmt: "@" } },
    { header: "CCTO OEMP", key: "ccto_oemp", width: 20, style: { numFmt: "@" } },
    { header: "EMPRESA OEMP", key: "empresa_oemp", width: 20, style: { numFmt: "@" } },
    { header: "CIRCUITO OEMP", key: "circuito_oemp", width: 24, style: { numFmt: "@" } },
    { header: "CIRCUITO BACKUP", key: "circuito_backup", width: 24, style: { numFmt: "@" } },
    { header: "OPERADORA", key: "operadora", width: 18, style: { numFmt: "@" } },
    { header: "ENDERECO", key: "endereco", width: 36, style: { numFmt: "@" } },
    { header: "CONTATO", key: "contato", width: 26, style: { numFmt: "@" } },
  ];

  sheet.addRows([
    {
      cod_ul: "21-000111-1",
      ccto_oi: "219123456789",
      loopback_wan: "10.10.10.1",
      loopback_lan: "10.10.20.1",
      ccto_oemp: "",
      empresa_oemp: "",
      circuito_oemp: "",
      circuito_backup: "",
      operadora: "",
      endereco: "",
      contato: "",
    },
    {
      cod_ul: "21-000222-2",
      ccto_oi: "",
      loopback_wan: "",
      loopback_lan: "",
      ccto_oemp: "OEMP-123456",
      empresa_oemp: "CLARO",
      circuito_oemp: "CLARO-123456",
      circuito_backup: "",
      operadora: "VIVO",
      endereco: "",
      contato: "",
    },
    {
      cod_ul: "21-000333-3",
      ccto_oi: "",
      loopback_wan: "",
      loopback_lan: "",
      ccto_oemp: "",
      empresa_oemp: "",
      circuito_oemp: "",
      circuito_backup: "BRISANET-123456",
      operadora: "",
      endereco: "Rua Exemplo, 123 - Centro",
      contato: "(11) 99999-9999 / Maria",
    },
  ]);

  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length },
  };

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0B5EA8" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  const instructions = workbook.addWorksheet("Instrucoes");
  instructions.columns = [
    { header: "Item", key: "item", width: 28 },
    { header: "Descricao", key: "descricao", width: 95 },
  ];

  instructions.addRows([
    { item: "COD_UL", descricao: "Obrigatorio. A UL e localizada por este codigo." },
    { item: "Colunas vazias", descricao: "Sao ignoradas. Preencha somente o que precisa atualizar." },
    { item: "Duplicidade", descricao: "Se o mesmo COD_UL aparecer em mais de uma linha, o ultimo valor preenchido prevalece." },
    { item: "Campos comuns", descricao: "Use CCTO OI, LOOPBACK PRINCIPAL, LOOPBACK SECUNDARIO e CCTO OEMP para atualizacoes de circuito." },
    { item: "Campos extras", descricao: "Tambem sao aceitos EMPRESA OEMP, CIRCUITO OEMP, CIRCUITO BACKUP, OPERADORA, ENDERECO, CONTATO, STATUS, CIDADE, UF e TECNOLOGIA." },
  ]);

  instructions.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE5EEF8" },
    };
  });

  return workbook;
};
