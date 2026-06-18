export const PROCESSING_TIMEZONE = "America/Sao_Paulo";
export const CONTROL_DATE_SESSION_KEY = "controle-data-referencia-processada";
export const CONTROL_VERSION_SESSION_KEY = "controle-versao-processada";

export function processingDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PROCESSING_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

export function processingTimestamp(date = new Date()): string {
  return date.toLocaleString("pt-BR", {
    timeZone: PROCESSING_TIMEZONE,
    hour12: false,
  });
}

export function formatDateBR(dateRef: string | null | undefined): string {
  if (!dateRef) return "";
  const match = String(dateRef).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(dateRef);
  return `${match[3]}/${match[2]}/${match[1]}`;
}
