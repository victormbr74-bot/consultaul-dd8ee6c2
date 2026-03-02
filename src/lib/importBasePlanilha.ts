import { readExcel, sheetToJson } from "@/lib/excelCompat";
import { supabase } from "@/integrations/supabase/client";

type ImportDataset = "lotericas" | "macro_base_alarmes" | "jira_abertos" | "falhas_gis";
const IMPORT_CHUNK_SIZE = 300;

export interface ImportBaseDatasetResult {
  inserted: number;
  errors: number;
  total: number;
}

export interface ImportBasePlanilhaResult {
  importedMacro: ImportBaseDatasetResult;
  importedJira: ImportBaseDatasetResult;
  importedFalhas: ImportBaseDatasetResult;
  missingSheets: string[];
  workbookSheets: string[];
}

export interface ImportBasePlanilhaProgress {
  phase: "reading" | "validating" | "uploading" | "completed";
  percent: number;
  message: string;
  dataset?: ImportDataset;
  datasetLabel?: string;
  chunkIndex?: number;
  chunkCount?: number;
}

interface ImportBasePlanilhaOptions {
  strictBase?: boolean;
  preserveLotericas?: boolean;
  macroTarget?: "lotericas" | "macro_base_alarmes";
  onProgress?: (progress: ImportBasePlanilhaProgress) => void;
}

function getFileExtension(fileName: string) {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function findSheetCaseInsensitive(sheetNames: string[], expectedName: string) {
  return sheetNames.find((sheet) => sheet.trim().toLowerCase() === expectedName.trim().toLowerCase());
}

async function invokeInChunks(
  dataset: ImportDataset,
  rows: Record<string, unknown>[],
  replace: boolean,
  accessToken: string,
  onChunkDone?: (info: { dataset: ImportDataset; chunkIndex: number; chunkCount: number }) => void,
) {
  if (!rows.length) return { inserted: 0, errors: 0, total: 0 };

  const totalChunks = Math.ceil(rows.length / IMPORT_CHUNK_SIZE);
  let inserted = 0;
  let errors = 0;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const chunk = rows.slice(chunkIndex * IMPORT_CHUNK_SIZE, (chunkIndex + 1) * IMPORT_CHUNK_SIZE);
    const res = await supabase.functions.invoke("import-lotericas", {
      body: {
        dataset,
        rows: chunk,
        chunkIndex,
        chunkCount: totalChunks,
        replace,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.error) {
      throw new Error(`${dataset}: ${res.error.message}`);
    }

    inserted += Number(res.data?.inserted || 0);
    errors += Number(res.data?.errors || 0);
    onChunkDone?.({ dataset, chunkIndex: chunkIndex + 1, chunkCount: totalChunks });
  }

  return { inserted, errors, total: rows.length };
}

export async function importBasePlanilhaFile(
  file: File,
  options?: ImportBasePlanilhaOptions,
): Promise<ImportBasePlanilhaResult> {
  const strictBase = Boolean(options?.strictBase);
  const preserveLotericas = options?.preserveLotericas ?? true;
  const macroTarget = options?.macroTarget ?? "lotericas";
  const replaceMacro = macroTarget === "macro_base_alarmes" ? true : !preserveLotericas;
  const onProgress = options?.onProgress;
  const extension = getFileExtension(file.name);

  const emit = (progress: ImportBasePlanilhaProgress) => onProgress?.(progress);

  if (!["xlsx", "xlsm", "xls", "csv"].includes(extension)) {
    throw new Error(`Formato não suportado: .${extension || "desconhecido"}. Use xlsx, csv ou xlsm.`);
  }

  if (strictBase && extension === "csv") {
    throw new Error("CSV não é suportado em 'Subir Base' de alarmes. Use XLSX/XLSM com as abas MACRO, Jira Abertos e Falhas GIS.");
  }

  emit({ phase: "reading", percent: 5, message: "Lendo arquivo..." });
  const fileData = await file.arrayBuffer();
  const wb = await readExcel(fileData, { type: "array", cellDates: true });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new Error("Sessão inválida. Faça login novamente.");
  }

  emit({ phase: "validating", percent: 10, message: "Validando abas da planilha..." });
  const macroSheetName = findSheetCaseInsensitive(wb.SheetNames, "MACRO");
  const jiraSheetName = findSheetCaseInsensitive(wb.SheetNames, "Jira Abertos");
  const falhasSheetName = findSheetCaseInsensitive(wb.SheetNames, "Falhas GIS");

  const missingSheets = [
    !macroSheetName ? "MACRO" : "",
    !jiraSheetName ? "Jira Abertos" : "",
    !falhasSheetName ? "Falhas GIS" : "",
  ].filter(Boolean);

  if (strictBase && missingSheets.length > 0) {
    throw new Error(`Planilha inválida para alarmes. Abas obrigatórias ausentes: ${missingSheets.join(", ")}`);
  }

  const toRows = (sheetName?: string) => {
    if (!sheetName) return [] as Record<string, unknown>[];
    const ws = wb.Sheets[sheetName];
    if (!ws) return [] as Record<string, unknown>[];
    return sheetToJson<Record<string, unknown>>(ws, { defval: "", raw: true });
  };

  const macroSheetRows = toRows(macroSheetName);
  const macroRows =
    macroSheetRows.length > 0
      ? macroSheetRows
      : sheetToJson<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: true });
  const jiraRows = toRows(jiraSheetName);
  const falhasRows = toRows(falhasSheetName);

  const datasetsPlan = [
    { dataset: macroTarget as ImportDataset, label: "MACRO", rows: macroRows, replace: replaceMacro },
    { dataset: "jira_abertos" as ImportDataset, label: "Jira Abertos", rows: jiraRows, replace: true },
    { dataset: "falhas_gis" as ImportDataset, label: "Falhas GIS", rows: falhasRows, replace: true },
  ];

  const totalChunksAll = datasetsPlan.reduce(
    (sum, item) => sum + (item.rows.length ? Math.ceil(item.rows.length / IMPORT_CHUNK_SIZE) : 0),
    0,
  );
  let completedChunksAll = 0;

  if (totalChunksAll === 0) {
    emit({ phase: "completed", percent: 100, message: "Nenhum registro encontrado para importar." });
  } else {
    emit({ phase: "uploading", percent: 12, message: "Iniciando importação da base..." });
  }

  const importDatasetWithProgress = async (
    dataset: ImportDataset,
    label: string,
    rows: Record<string, unknown>[],
    replace: boolean,
  ) =>
    invokeInChunks(dataset, rows, replace, accessToken, ({ dataset: ds, chunkIndex, chunkCount }) => {
      completedChunksAll += 1;
      const percent = totalChunksAll > 0 ? Math.min(99, Math.round(12 + (completedChunksAll / totalChunksAll) * 87)) : 100;
      emit({
        phase: "uploading",
        percent,
        message: `Importando ${label} (${chunkIndex}/${chunkCount})...`,
        dataset: ds,
        datasetLabel: label,
        chunkIndex,
        chunkCount,
      });
    });

  const importedMacro = await importDatasetWithProgress(macroTarget, "MACRO", macroRows, replaceMacro);
  const importedJira = await importDatasetWithProgress("jira_abertos", "Jira Abertos", jiraRows, true);
  const importedFalhas = await importDatasetWithProgress("falhas_gis", "Falhas GIS", falhasRows, true);

  emit({ phase: "completed", percent: 100, message: "Importação concluída com sucesso." });

  return {
    importedMacro,
    importedJira,
    importedFalhas,
    missingSheets,
    workbookSheets: wb.SheetNames,
  };
}

export function formatImportBasePlanilhaSummary(result: ImportBasePlanilhaResult) {
  return [
    "Importação da base concluída.",
    `MACRO (base): ${result.importedMacro.inserted} inseridos, ${result.importedMacro.errors} erros.`,
    `Jira Abertos: ${result.importedJira.inserted} inseridos, ${result.importedJira.errors} erros.`,
    `Falhas GIS: ${result.importedFalhas.inserted} inseridos, ${result.importedFalhas.errors} erros.`,
    result.missingSheets.length ? `Obs.: abas ausentes: ${result.missingSheets.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
