import { supabase } from "@/integrations/supabase/client";

export type LinkTarget = "primario" | "secundario";
export type MatchField = "cod_ul" | "ccto_oi" | "ccto_oemp" | "designacao_nova";

export interface LotericaLookupRow {
  cod_ul: string;
  nome_loterica: string | null;
  ccto_oi: string | null;
  ccto_oemp: string | null;
  designacao_nova: string | null;
  operadora: string | null;
  ip_nat: string | null;
  ip_wan: string | null;
  loopback_wan: string | null;
  loopback_lan: string | null;
  endereco: string | null;
  contato: string | null;
  cidade: string | null;
  uf: string | null;
  status: string | null;
  updated_at: string | null;
  raw_data: Record<string, unknown> | null;
}

export interface TermMatch {
  query: string;
  row: LotericaLookupRow | null;
  matchField?: MatchField;
}

export interface LookupDisplayRow {
  query: string;
  statusType: "ok" | "missing_ip" | "not_found";
  statusText: string;
  codUl: string;
  nome: string;
  circuito: string;
  statusUl: string;
  ip: string;
  matchedBy: string;
}

const LOOKUP_BATCH_SIZE = 120;
const MATCH_FIELDS: MatchField[] = ["cod_ul", "ccto_oi", "ccto_oemp", "designacao_nova"];

const REDE_LAN_KEYS = ["REDE LAN", "REDE_LAN", "rede lan", "rede_lan", "REDELAN", "LAN"] as const;
const LOOPBACK_PRIMARIO_KEYS = ["LOOPBACK PRINCIPAL", "LOOPBACK PRIMARIO", "LOOTPBACK PRIMARIO"] as const;
const LOOPBACK_SECUNDARIO_KEYS = [
  "LOOPBACK SECUNDARIO",
  "LOOPBACK SECUNDÁRIO",
  "LOOPBACK SECUNDÃRIO",
  "LOOPBACK SECUND?RIO",
] as const;

export const normalizeText = (value: unknown) => String(value ?? "").trim();

const normalizeKey = (value: unknown) => normalizeText(value).toUpperCase();
const normalizeLooseKey = (value: unknown) => normalizeKey(value).replace(/[^A-Z0-9]/g, "");

const toRawObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const getRawString = (raw: Record<string, unknown>, keys: readonly string[]) => {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    const value = normalizeText(raw[key]);
    if (value) return value;
  }
  return "";
};

const normalizeIp = (value: unknown) => {
  const text = normalizeText(value);
  const match = text.match(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})/);
  if (!match) return "";
  const octets = match.slice(1, 5).map((part) => Number.parseInt(part, 10));
  if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) return "";
  return octets.join(".");
};

export const getPrimaryLoopbackValue = (row: LotericaLookupRow) => {
  const raw = toRawObject(row.raw_data);
  return normalizeText(row.loopback_wan || getRawString(raw, LOOPBACK_PRIMARIO_KEYS));
};

export const getSecondaryLoopbackValue = (row: LotericaLookupRow) => {
  const raw = toRawObject(row.raw_data);
  const rawSec = getRawString(raw, LOOPBACK_SECUNDARIO_KEYS);
  const rowSecondary = normalizeText(row.loopback_lan);
  const rawRedeLan = getRawString(raw, REDE_LAN_KEYS);

  // Preserve existing fix where loopback_lan was imported as REDE LAN by mistake.
  if (rawSec && rowSecondary && rowSecondary === rawRedeLan && rawSec !== rawRedeLan) {
    return rawSec;
  }

  return normalizeText(rowSecondary || rawSec);
};

export const getRedeLanValue = (row: LotericaLookupRow) => {
  const raw = toRawObject(row.raw_data);
  return normalizeText(getRawString(raw, REDE_LAN_KEYS));
};

export const getLookupIp = (row: LotericaLookupRow, target: LinkTarget) => {
  const candidate = target === "primario" ? getPrimaryLoopbackValue(row) : getSecondaryLoopbackValue(row);
  return normalizeIp(candidate);
};

export const parseTerms = (value: string) => {
  return value
    .split(/[\n,;\t]+/)
    .map((term) => normalizeText(term))
    .filter(Boolean);
};

export const dedupeTerms = (terms: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const term of terms) {
    const key = normalizeKey(term);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(term);
  }

  return result;
};

const fetchByColumn = async (column: MatchField, terms: string[]) => {
  const rows: LotericaLookupRow[] = [];

  for (let i = 0; i < terms.length; i += LOOKUP_BATCH_SIZE) {
    const chunk = terms.slice(i, i + LOOKUP_BATCH_SIZE);
    if (!chunk.length) continue;

    const queryTerms = Array.from(new Set(
      chunk
        .map((term) => [normalizeText(term), normalizeKey(term)])
        .flat()
        .filter(Boolean),
    ));

    const { data, error } = await (supabase as any)
      .from("lotericas")
      .select(
        "cod_ul,nome_loterica,ccto_oi,ccto_oemp,designacao_nova,operadora,ip_nat,ip_wan,loopback_wan,loopback_lan,endereco,contato,cidade,uf,status,updated_at,raw_data",
      )
      .in(column, queryTerms);

    if (error) {
      throw new Error(error.message || "Falha ao buscar dados de loterica.");
    }

    const batch = (data || []).map((item: any) => ({
      ...item,
      raw_data: toRawObject(item.raw_data),
    })) as LotericaLookupRow[];

    rows.push(...batch);
  }

  return rows;
};

export const fetchLookupRows = async (terms: string[]) => {
  const [byCode, byOi, byOemp, byDesignacao] = await Promise.all([
    fetchByColumn("cod_ul", terms),
    fetchByColumn("ccto_oi", terms),
    fetchByColumn("ccto_oemp", terms),
    fetchByColumn("designacao_nova", terms),
  ]);

  const unique = new Map<string, LotericaLookupRow>();
  for (const row of [...byCode, ...byOi, ...byOemp, ...byDesignacao]) {
    const key = normalizeKey(row.cod_ul);
    if (!key) continue;
    if (!unique.has(key)) unique.set(key, row);
  }

  return [...unique.values()];
};

export const resolveMatches = (terms: string[], rows: LotericaLookupRow[]): TermMatch[] => {
  const strict = new Map<string, { row: LotericaLookupRow; field: MatchField }>();
  const loose = new Map<string, { row: LotericaLookupRow; field: MatchField }>();

  for (const row of rows) {
    for (const field of MATCH_FIELDS) {
      const value = normalizeText(row[field]);
      if (!value) continue;

      const strictKey = normalizeKey(value);
      if (strictKey && !strict.has(strictKey)) {
        strict.set(strictKey, { row, field });
      }

      const looseKey = normalizeLooseKey(value);
      if (looseKey && !loose.has(looseKey)) {
        loose.set(looseKey, { row, field });
      }
    }
  }

  return terms.map((query) => {
    const strictKey = normalizeKey(query);
    const looseKey = normalizeLooseKey(query);
    const found = strict.get(strictKey) || (looseKey ? loose.get(looseKey) : undefined);
    return { query, row: found?.row || null, matchField: found?.field };
  });
};

const MATCH_FIELD_LABEL: Record<MatchField, string> = {
  cod_ul: "codigo UL",
  ccto_oi: "CCTO OI",
  ccto_oemp: "CCTO OEMP",
  designacao_nova: "designacao",
};

export const buildLookupDisplay = (match: TermMatch, target: LinkTarget): LookupDisplayRow => {
  if (!match.row) {
    return {
      query: match.query,
      statusType: "not_found",
      statusText: "Nao encontrado",
      codUl: "-",
      nome: "-",
      circuito: "-",
      statusUl: "-",
      ip: "",
      matchedBy: "-",
    };
  }

  const row = match.row;
  const ip = getLookupIp(row, target);
  const circuito = normalizeText(row.ccto_oi || row.designacao_nova || row.ccto_oemp);

  if (!ip) {
    return {
      query: match.query,
      statusType: "missing_ip",
      statusText: target === "primario" ? "Sem loopback primario" : "Sem loopback secundario",
      codUl: normalizeText(row.cod_ul) || "-",
      nome: normalizeText(row.nome_loterica) || "-",
      circuito: circuito || "-",
      statusUl: normalizeText(row.status) || "-",
      ip: "",
      matchedBy: match.matchField ? MATCH_FIELD_LABEL[match.matchField] : "-",
    };
  }

  return {
    query: match.query,
    statusType: "ok",
    statusText: "Pronto",
    codUl: normalizeText(row.cod_ul) || "-",
    nome: normalizeText(row.nome_loterica) || "-",
    circuito: circuito || "-",
    statusUl: normalizeText(row.status) || "-",
    ip,
    matchedBy: match.matchField ? MATCH_FIELD_LABEL[match.matchField] : "-",
  };
};
