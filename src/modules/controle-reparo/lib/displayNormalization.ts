const CANONICAL_NAMES = new Map<string, string>([
  ["ATIVA", "ATIVA"],
  ["CONSULTAR RESPONSAVEL", "CONSULTAR RESPONSÁVEL"],
  ["MAMTECH", "MAMTECH"],
  ["NAO OEMP", "NÃO OEMP"],
  ["OI", "OI"],
  ["SENCINET", "SENCINET"],
  ["SITELBRA", "SITELBRA"],
  ["VIVO", "VIVO"],
  ["VTAL", "VTAL"],
]);

const normalizeLookupKey = (value: string) =>
  value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase()
    .replace(/\bMAM\s+TECH\b/g, "MAMTECH")
    .replace(/\bV\s+TAL\b/g, "VTAL");

export function normalizeControleDisplayName(value: string): string {
  const compact = value.trim().replace(/\s+/g, " ");
  if (!compact) return "";
  return CANONICAL_NAMES.get(normalizeLookupKey(compact)) ?? compact;
}

export function normalizeControleFilterText(value: string): string {
  return normalizeControleDisplayName(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
