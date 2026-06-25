import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

const EXPORT_BATCH_SIZE = 1000;
const PROFILE_EXPORT_BATCH_SIZE = 200;

const isFilled = (value: unknown) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return String(value).trim().length > 0;
};

const firstFilled = (...values: unknown[]) => {
  for (const value of values) {
    if (isFilled(value)) return value;
  }
  return "";
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const asString = (value: unknown) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

export const LOTERICAS_EXPORT_COLUMNS = [
  "cod_ul",
  "DESIGINACAO NOVA",
  "CCTO OI",
  "BASE UN",
  "CCTO OEMP",
  "Ponto Logico / Designacao",
  "NOME UL",
  "CONTATO",
  "ENDERECO",
  "UF",
  "HOMOLOGADO",
  "MIGRACAO",
  "OWNER",
  "RESP BACKUP",
  "OPERADORA 4G",
  "TIPO LOTERICA",
  "TFL",
  "EMPRESA OEMP",
  "CIRCUITO OEMP",
  "LOOPBACK PRINCIPAL",
  "LOOPBACK SECUNDARIO",
  "REDE LAN",
  "STATUS UL",
  "SIM CARD 4G",
  "TECNOLOGIA",
  "Ponto Logico / Designacao",
  "MERAKI",
  "IP NAT",
  "IP WAN",
  "IP SWITCH",
  "REGIAO",
  "CEP",
  "MODELO ROTEADOR",
  "MUNICIPIO",
  "PERIMETRO",
] as const;

export function normalizeLotericasExportHeader(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "");
}

export function mapLotericaToExportRow(
  row: Tables<"lotericas">,
  profileById = new Map<string, { name: string | null; user_code: string | null }>(),
): Record<string, unknown> {
  const raw = asRecord(row.raw_data);
  const rawByNormalized = new Map<string, unknown>();
  Object.entries(raw).forEach(([key, value]) => {
    const normalized = normalizeLotericasExportHeader(key);
    if (normalized && !rawByNormalized.has(normalized)) {
      rawByNormalized.set(normalized, value);
    }
  });

  const pickRaw = (...aliases: string[]) => {
    for (const alias of aliases) {
      const value = rawByNormalized.get(normalizeLotericasExportHeader(alias));
      if (isFilled(value)) return value;
    }
    return "";
  };

  const codUl = firstFilled(row.cod_ul, pickRaw("CODIGO DA LOTERICA_", "CODIGO DA LOTERICA", "CODIGO UL", "cod_ul"));
  const nomeLoterica = firstFilled(row.nome_loterica, pickRaw("NOME UL", "nome_loterica"));
  const cctoOi = firstFilled(row.ccto_oi, pickRaw("CCTO OI", "ccto_oi"));
  const cctoOemp = firstFilled(row.ccto_oemp, pickRaw("CCTO OEMP", "ccto_oemp"));
  const cpeMeraki = firstFilled(row.cpe_meraki, pickRaw("CPE MERAKI", "cpe_meraki"));
  const circuitoMeraki = firstFilled(row.circuito_meraki, pickRaw("CIRCUITO MERAKI", "CIRCUITOS MERAKI", "MERAKI", "circuito_meraki"));
  const designacaoNova = firstFilled(row.designacao_nova, pickRaw("DESIGINACAO NOVA", "DESIGNACAO NOVA", "designacao_nova"));
  const operadora = firstFilled(row.operadora, pickRaw("OPERADORA 4G", "operadora"));
  const ipNat = firstFilled(row.ip_nat, pickRaw("IP NAT", "ip_nat"));
  const ipWan = firstFilled(row.ip_wan, pickRaw("IP WAN", "ip_wan"));
  const loopbackPrincipal = firstFilled(row.loopback_wan, pickRaw("LOOPBACK PRINCIPAL", "loopback_wan"));
  const loopbackSecundario = firstFilled(row.loopback_lan, pickRaw("LOOPBACK SECUNDARIO", "loopback_lan"));
  const endereco = firstFilled(row.endereco, pickRaw("ENDERECO", "endereco"));
  const contato = firstFilled(row.contato, pickRaw("CONTATO", "contato"));
  const status = firstFilled(row.status, pickRaw("STATUS UL", "status"));
  const cidade = firstFilled(row.cidade, pickRaw("MUNICIPIO", "CIDADE", "cidade"));
  const updatedAtRaw = firstFilled(row.updated_at, pickRaw("ATUALIZADO EM", "updated_at"));
  const updatedBy = asString(row.updated_by);
  const updaterProfile = updatedBy ? profileById.get(updatedBy) : undefined;
  const updatedByDisplay = [updaterProfile?.user_code, updaterProfile?.name].filter(Boolean).join(" - ");

  return {
    cod_ul: codUl,
    "Codigo da Loterica": codUl,
    "Codigo UL": codUl,
    "DESIGINACAO NOVA": designacaoNova,
    "Designacao Nova": designacaoNova,
    "CCTO OI": cctoOi,
    "BASE UN": pickRaw("BASE UN"),
    "CCTO OEMP": cctoOemp,
    "Ponto Logico / Designacao": firstFilled(
      pickRaw("Ponto Logico / Designacao", "PONTO LOGICO DESIGNACAO", "PONTO LOGICO"),
      designacaoNova,
      codUl,
    ),
    "NOME UL": nomeLoterica,
    CONTATO: contato,
    ENDERECO: endereco,
    UF: firstFilled(row.uf, pickRaw("UF", "uf")),
    HOMOLOGADO: pickRaw("HOMOLOGADO"),
    MIGRACAO: pickRaw("MIGRACAO"),
    OWNER: pickRaw("OWNER"),
    "RESP BACKUP": pickRaw("RESP BACKUP"),
    "OPERADORA 4G": firstFilled(pickRaw("OPERADORA 4G"), operadora),
    Operadora: operadora,
    "TIPO LOTERICA": pickRaw("TIPO LOTERICA", "TIPO UL"),
    TFL: pickRaw("TFL", "TFLs", "TFLS"),
    "EMPRESA OEMP": pickRaw("EMPRESA OEMP"),
    "Empresa CEF": firstFilled(pickRaw("EMPRESA CEF"), pickRaw("EMPRESA OEMP"), operadora),
    "CIRCUITO OEMP": pickRaw("CIRCUITO OEMP"),
    "Circuito OEMP": pickRaw("CIRCUITO OEMP"),
    "LOOPBACK PRINCIPAL": loopbackPrincipal,
    "LOOPBACK SECUNDARIO": loopbackSecundario,
    "REDE LAN": firstFilled(pickRaw("REDE LAN", "REDE_LAN"), row.loopback_lan),
    "STATUS UL": status,
    "SIM CARD 4G": pickRaw("SIM CARD 4G"),
    TECNOLOGIA: pickRaw("TECNOLOGIA"),
    "CPE MERAKI": cpeMeraki,
    "CIRCUITO MERAKI": circuitoMeraki,
    MERAKI: circuitoMeraki,
    "IP NAT": ipNat,
    "IP WAN": ipWan,
    "IP SWITCH": pickRaw("IP SWITCH", "LOOPBACK SWITCH"),
    REGIAO: pickRaw("REGIAO"),
    CEP: pickRaw("CEP"),
    "MODELO ROTEADOR": pickRaw("MODELO ROTEADOR"),
    MUNICIPIO: cidade,
    PERIMETRO: pickRaw("PERIMETRO"),
    "Atualizado em": updatedAtRaw,
    "Usuario que alterou": updatedByDisplay,
    "Codigo usuario que alterou": updaterProfile?.user_code ?? "",
    "Nome usuario que alterou": updaterProfile?.name ?? "",
  };
}

export async function fetchLotericasExportRows(): Promise<Record<string, unknown>[]> {
  const allRows: Tables<"lotericas">[] = [];
  let from = 0;

  while (true) {
    const to = from + EXPORT_BATCH_SIZE - 1;
    const { data, error } = await supabase
      .from("lotericas")
      .select("*")
      .order("cod_ul")
      .range(from, to);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...(data as Tables<"lotericas">[]));
    if (data.length < EXPORT_BATCH_SIZE) break;
    from += EXPORT_BATCH_SIZE;
  }

  const updatedByIds = Array.from(new Set(allRows.map((row) => asString(row.updated_by)).filter(Boolean)));
  const profileById = new Map<string, { name: string | null; user_code: string | null }>();

  for (let index = 0; index < updatedByIds.length; index += PROFILE_EXPORT_BATCH_SIZE) {
    const batch = updatedByIds.slice(index, index + PROFILE_EXPORT_BATCH_SIZE);
    const { data, error } = await supabase
      .from("profiles")
      .select("id,name,user_code")
      .in("id", batch);
    if (error) throw error;
    (data || []).forEach((profile) => {
      profileById.set(profile.id, {
        name: profile.name ?? null,
        user_code: profile.user_code ?? null,
      });
    });
  }

  return allRows.map((row) => mapLotericaToExportRow(row, profileById));
}
