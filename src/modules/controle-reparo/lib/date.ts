export const PROCESSING_TIMEZONE = "America/Sao_Paulo";
export const CONTROL_DATE_SESSION_KEY = "controle-data-referencia-processada";
export const CONTROL_VERSION_SESSION_KEY = "controle-versao-processada";

export interface WallClockDateTime {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const zonedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return zonedAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Converts a spreadsheet wall-clock value in Sao Paulo to a deterministic ISO instant. */
export function zonedDateTimeToIso(
  value: WallClockDateTime,
  timeZone = PROCESSING_TIMEZONE,
): string | null {
  const hour = value.hour ?? 0;
  const minute = value.minute ?? 0;
  const second = value.second ?? 0;
  const wallClockUtc = Date.UTC(value.year, value.month - 1, value.day, hour, minute, second);
  const validation = new Date(wallClockUtc);
  if (
    validation.getUTCFullYear() !== value.year ||
    validation.getUTCMonth() !== value.month - 1 ||
    validation.getUTCDate() !== value.day ||
    validation.getUTCHours() !== hour ||
    validation.getUTCMinutes() !== minute ||
    validation.getUTCSeconds() !== second
  ) {
    return null;
  }

  let instant = new Date(wallClockUtc - timeZoneOffsetMs(validation, timeZone));
  const correctedOffset = timeZoneOffsetMs(instant, timeZone);
  instant = new Date(wallClockUtc - correctedOffset);
  return isNaN(instant.getTime()) ? null : instant.toISOString();
}

export function formatDateTimeBR(
  iso: string | null | undefined,
  timeZone = PROCESSING_TIMEZONE,
): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.day}/${values.month}/${values.year} ${values.hour}:${values.minute}:${values.second}`;
}

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
