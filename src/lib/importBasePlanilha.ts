import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

type ImportDataset = "lotericas" | "macro_base_alarmes" | "jira_abertos" | "falhas_gis";

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

interface ImportBasePlanilhaOptions {
  strictBase?: boolean;
  preserveLotericas?: boolean;
  macroTarget?: "lotericas" | "macro_base_alarmes";
}

function findSheetCaseInsensitive(sheetNames: string[], expectedName: string) {
  return sheetNames.find((sheet) => sheet.trim().toLowerCase() === expectedName.trim().toLowerCase());
}

async function invokeInChunks(
  dataset: ImportDataset,
  rows: Record<string, unknown>[],
  replace: boolean,
  accessToken: string,
) {
  if (!rows.length) return { inserted: 0, errors: 0, total: 0 };

  const chunkSize = 300;
  const totalChunks = Math.ceil(rows.length / chunkSize);
  let inserted = 0;
  let errors = 0;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const chunk = rows.slice(chunkIndex * chunkSize, (chunkIndex + 1) * chunkSize);
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

  const fileData = await file.arrayBuffer();
  const wb = XLSX.read(fileData, { type: "array", cellDates: true });
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new Error("Sessão inválida. Faça login novamente.");
  }

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
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true });
  };

  const macroSheetRows = toRows(macroSheetName);
  const macroRows =
    macroSheetRows.length > 0
      ? macroSheetRows
      : XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: true });
  const jiraRows = toRows(jiraSheetName);
  const falhasRows = toRows(falhasSheetName);

  const importedMacro = await invokeInChunks(macroTarget, macroRows, replaceMacro, accessToken);
  const importedJira = await invokeInChunks("jira_abertos", jiraRows, true, accessToken);
  const importedFalhas = await invokeInChunks("falhas_gis", falhasRows, true, accessToken);

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
    `MACRO/lotéricas: ${result.importedMacro.inserted} inseridos, ${result.importedMacro.errors} erros.`,
    `Jira Abertos: ${result.importedJira.inserted} inseridos, ${result.importedJira.errors} erros.`,
    `Falhas GIS: ${result.importedFalhas.inserted} inseridos, ${result.importedFalhas.errors} erros.`,
    result.missingSheets.length ? `Obs.: abas ausentes: ${result.missingSheets.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
