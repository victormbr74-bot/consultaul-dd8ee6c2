import type { Row } from "./parse";
import { getVal } from "./parse";
import { normalizeIncidentValue } from "./processing";

const OFFICIAL_JIRA_ALARM_TERMS = [
  "LINK BACKUP INOPERANTE",
  "LINK PRINCIPAL INOPERANTE",
] as const;

function normalizeAlarmText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function getJiraIncident(row: Row): string {
  return normalizeIncidentValue(
    getVal(
      row,
      "Nº INC Snow",
      "N° INC Snow",
      "Numero INC Snow",
      "Número INC Snow",
      "n_inc_snow",
      "INC Snow",
      "Incidente Snow",
      "Nº INC",
      "N° INC",
      "Numero INC",
      "Número INC",
      "INC",
      "Incidente",
      "Chamado",
      "Chave",
      "Key",
    ),
  );
}

export function getJiraAlarmType(row: Row): string | null {
  const joined = normalizeAlarmText(
    [
      getVal(row, "Tipo de Falha", "tipo_falha", "Tipo Falha", "TIPO DE FALHA", "Tipo da falha"),
      getVal(row, "Resumo", "Summary", "Titulo", "Assunto", "Mensagem", "Tipo", "Chamado", "Chave", "Key"),
      getVal(row, "Descrição", "Descricao", "Descripcion", "Description", "Categoria e Sintoma", "categoria_sintoma"),
    ]
      .filter(Boolean)
      .join(" | "),
  );
  return OFFICIAL_JIRA_ALARM_TERMS.find((term) => joined.includes(term)) ?? null;
}

export function isJiraAlarmRow(row: Row): boolean {
  return getJiraAlarmType(row) !== null;
}

export function jiraRowsWithoutControleIncident(
  jiraRows: Row[],
  controleIncs: ReadonlySet<string>,
): Row[] {
  return jiraRows.filter((row) => {
    const inc = getJiraIncident(row);
    return !!inc && !controleIncs.has(inc);
  });
}
