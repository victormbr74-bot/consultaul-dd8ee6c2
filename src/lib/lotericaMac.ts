const normalizeText = (value: unknown) => String(value ?? "").trim();

const MAC_CANDIDATE_REGEX =
  /(?:[0-9A-Fa-f]{2}(?:[:-]?)){5}[0-9A-Fa-f]{2}|(?:[0-9A-Fa-f]{4}\.){2}[0-9A-Fa-f]{4}|[0-9A-Fa-f]{12}/g;

const CONTEXT_STOP_TOKENS = new Set([
  "MAC",
  "ENDERECO",
  "ADDRESS",
  "ADDR",
  "ETHERNET",
  "ETH",
  "PORTA",
  "PORT",
  "REDE",
  "LAN",
  "WAN",
  "WIFI",
  "WIRELESS",
  "IP",
  "DO",
  "DA",
  "DE",
  "DOS",
  "DAS",
  "NO",
  "NA",
  "NUMERO",
  "N",
]);

const GENERIC_INFO_TOKENS = new Set([
  "MODELO",
  "MODEL",
  "SERIAL",
  "SERIE",
  "SN",
  "HOST",
  "HOSTNAME",
  "NOME",
  "NAME",
  "DESCRICAO",
  "DESC",
  "EQUIPAMENTO",
  "DEVICE",
  "PATRIMONIO",
  "ATIVO",
  "PLAQUETA",
  "TAG",
  "CODIGO",
  "ID",
]);

const EQUIPMENT_TYPES = [
  { label: "Roteador", tokens: ["ROTEADOR", "ROUTER", "RTR", "RT"] },
  { label: "Switch", tokens: ["SWITCH", "SW"] },
  { label: "Modem", tokens: ["MODEM"] },
  { label: "CPE", tokens: ["CPE"] },
  { label: "Access Point", tokens: ["AP", "ACCESS", "POINT", "ACCESSPOINT"] },
  { label: "Pinpad", tokens: ["PINPAD"] },
  { label: "Impressora", tokens: ["IMPRESSORA", "PRINTER"] },
  { label: "PDV", tokens: ["PDV", "POS", "CAIXA"] },
] as const;

const LABEL_TOKENS = ["EQUIPAMENTO", "DEVICE", "NOME", "NAME", "DESCRICAO", "DESC"] as const;
const MODEL_TOKENS = ["MODELO", "MODEL"] as const;
const SERIAL_TOKENS = ["SERIAL", "SERIE", "SN"] as const;
const PATRIMONY_TOKENS = ["PATRIMONIO", "ATIVO", "PLAQUETA", "TAG"] as const;
const HOSTNAME_TOKENS = ["HOSTNAME", "HOST"] as const;

interface RawEntry {
  key: string;
  value: string;
  normalizedKey: string;
  tokens: string[];
}

export interface MacEquipmentInfo {
  matchedMac: string;
  matchedFieldLabel: string;
  equipmentLabel: string;
  equipmentType: string;
  model: string;
  serial: string;
  patrimony: string;
  hostname: string;
  details: string;
}

const normalizeKey = (value: unknown) =>
  normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

const tokenizeKey = (value: unknown) =>
  normalizeKey(value)
    .split(/[^A-Z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const humanizeKey = (value: string) => {
  const normalized = normalizeKey(value).replace(/_/g, " ");
  return titleCase(normalized);
};

const hasAnyToken = (tokens: string[], allowed: readonly string[]) => allowed.some((token) => tokens.includes(token));

const normalizeMacCandidate = (value: unknown) => normalizeText(value).toLowerCase().replace(/[^0-9a-f]/g, "");

const uniq = <T,>(items: T[]) => [...new Set(items)];

const toEntries = (rawData: Record<string, unknown> | null | undefined) => {
  const raw = rawData && typeof rawData === "object" ? rawData : {};

  return Object.entries(raw)
    .map(([key, rawValue]) => {
      const value = normalizeText(rawValue);
      if (!value) return null;

      return {
        key,
        value,
        normalizedKey: normalizeKey(key),
        tokens: tokenizeKey(key),
      } satisfies RawEntry;
    })
    .filter(Boolean) as RawEntry[];
};

const extractContextTokens = (value: string) =>
  tokenizeKey(value).filter((token) => !CONTEXT_STOP_TOKENS.has(token) && !GENERIC_INFO_TOKENS.has(token));

const findEquipmentType = (...values: string[]) => {
  for (const value of values) {
    const tokens = tokenizeKey(value);

    for (const type of EQUIPMENT_TYPES) {
      if (type.tokens.some((token) => tokens.includes(token))) {
        return type.label;
      }
    }
  }

  return "Equipamento";
};

const getEquipmentTypeTokens = (equipmentType: string) => {
  const found = EQUIPMENT_TYPES.find((item) => item.label === equipmentType);
  return found?.tokens ?? [];
};

const scoreEntry = (
  entry: RawEntry,
  contextTokens: string[],
  equipmentTypeTokens: readonly string[],
  infoTokens: readonly string[],
) => {
  let score = 0;

  if (!hasAnyToken(entry.tokens, infoTokens)) return -1;

  score += 3;

  if (contextTokens.length > 0) {
    const sharedContext = contextTokens.filter((token) => entry.tokens.includes(token));
    score += sharedContext.length * 6;
  }

  if (equipmentTypeTokens.length > 0) {
    const sharedTypeTokens = equipmentTypeTokens.filter((token) => entry.tokens.includes(token));
    score += sharedTypeTokens.length * 4;
  }

  if (!entry.tokens.includes("MAC")) {
    score += 2;
  }

  if (entry.tokens.length <= 4) {
    score += 1;
  }

  return score;
};

const findScopedValue = (
  entries: RawEntry[],
  contextTokens: string[],
  equipmentTypeTokens: readonly string[],
  infoTokens: readonly string[],
) => {
  const ranked = entries
    .map((entry) => ({ entry, score: scoreEntry(entry, contextTokens, equipmentTypeTokens, infoTokens) }))
    .filter((item) => item.score >= 0)
    .sort((left, right) => right.score - left.score || left.entry.key.localeCompare(right.entry.key));

  return ranked[0]?.entry.value || "";
};

export const normalizeMacSearchTerm = (value: unknown) => normalizeMacCandidate(value);

export const isViableMacSearchTerm = (value: unknown) => {
  const normalized = normalizeMacSearchTerm(value);
  return normalized.length >= 6 && normalized.length <= 12 && normalized.length % 2 === 0;
};

export const formatMacDisplay = (value: unknown) => {
  const normalized = normalizeMacCandidate(value);
  if (!normalized) return "";

  const pairs = normalized.match(/.{1,2}/g);
  return (pairs || [normalized]).join(":").toUpperCase();
};

export const extractMacCandidates = (value: unknown) => {
  const source = normalizeText(value);
  const matches = source.match(MAC_CANDIDATE_REGEX) || [];
  const normalizedMatches = matches.map((item) => normalizeMacCandidate(item)).filter((item) => item.length >= 6);

  if (normalizedMatches.length > 0) {
    return uniq(normalizedMatches);
  }

  const normalized = normalizeMacCandidate(source);
  return normalized.length >= 6 ? [normalized] : [];
};

const pickMatchedMac = (matchedValue: unknown, searchTerm?: unknown) => {
  const search = normalizeMacSearchTerm(searchTerm);
  const candidates = extractMacCandidates(matchedValue);

  if (search) {
    const exact = candidates.find((candidate) => candidate === search);
    if (exact) return exact;

    const containing = candidates.find((candidate) => candidate.includes(search) || search.includes(candidate));
    if (containing) return containing;
  }

  return candidates[0] || search;
};

export const extractMacEquipmentInfo = (
  rawData: Record<string, unknown> | null | undefined,
  matchedField: string,
  matchedValue: unknown,
  searchTerm?: unknown,
): MacEquipmentInfo => {
  const entries = toEntries(rawData);
  const matchedFieldLabel = humanizeKey(matchedField || "MAC");
  const contextTokens = extractContextTokens(matchedField);
  const fieldEquipmentType = findEquipmentType(matchedField);
  const fallbackEquipmentType = findEquipmentType(...entries.map((entry) => entry.key));
  const equipmentType = fieldEquipmentType !== "Equipamento" ? fieldEquipmentType : fallbackEquipmentType;
  const equipmentTypeTokens = getEquipmentTypeTokens(equipmentType);

  const equipmentLabel =
    findScopedValue(entries, contextTokens, equipmentTypeTokens, LABEL_TOKENS) ||
    findScopedValue(entries, contextTokens, equipmentTypeTokens, HOSTNAME_TOKENS) ||
    equipmentType ||
    matchedFieldLabel;

  const model = findScopedValue(entries, contextTokens, equipmentTypeTokens, MODEL_TOKENS);
  const serial = findScopedValue(entries, contextTokens, equipmentTypeTokens, SERIAL_TOKENS);
  const patrimony = findScopedValue(entries, contextTokens, equipmentTypeTokens, PATRIMONY_TOKENS);
  const hostname = findScopedValue(entries, contextTokens, equipmentTypeTokens, HOSTNAME_TOKENS);

  const details = [
    model ? `Modelo: ${model}` : "",
    serial ? `Serial: ${serial}` : "",
    patrimony ? `Patrimonio: ${patrimony}` : "",
    hostname && hostname !== equipmentLabel ? `Hostname: ${hostname}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    matchedMac: formatMacDisplay(pickMatchedMac(matchedValue, searchTerm)),
    matchedFieldLabel,
    equipmentLabel,
    equipmentType,
    model,
    serial,
    patrimony,
    hostname,
    details,
  };
};
