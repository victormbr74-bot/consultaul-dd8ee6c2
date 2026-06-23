import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Dataset = "lotericas" | "macro_base_alarmes" | "jira_abertos" | "falhas_gis";

type ImportBody = {
  dataset?: Dataset;
  rows?: Record<string, unknown>[];
  chunkIndex?: number;
  chunkCount?: number;
  replace?: boolean;
};

const normalizedRowCache = new WeakMap<Record<string, unknown>, Map<string, unknown>>();

function isBlank(value: unknown) {
  return value === null || value === undefined || String(value).trim() === "";
}

function normalizeHeaderKey(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "");
}

function getNormalizedLookup(row: Record<string, unknown>) {
  const cached = normalizedRowCache.get(row);
  if (cached) return cached;

  const lookup = new Map<string, unknown>();
  for (const [key, value] of Object.entries(row)) {
    const normalized = normalizeHeaderKey(key);
    if (!normalized) continue;
    if (!lookup.has(normalized) || (isBlank(lookup.get(normalized)) && !isBlank(value))) {
      lookup.set(normalized, value);
    }
  }

  normalizedRowCache.set(row, lookup);
  return lookup;
}

function pick(row: Record<string, unknown>, keys: string[]) {
  const normalizedLookup = getNormalizedLookup(row);
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      return row[key];
    }
    const byNormalized = normalizedLookup.get(normalizeHeaderKey(key));
    if (byNormalized !== undefined) {
      return byNormalized;
    }
  }
  return undefined;
}

function asText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  const text = String(value).trim();
  return text === "" ? null : text;
}

function textIncludes(value: unknown, needle: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .includes(needle.toUpperCase());
}

function normalizeLotericaRawData(row: Record<string, unknown>) {
  const raw = { ...row };
  const simCard = asText(pick(raw, ["SIM CARD 4G"]));
  const operadora = asText(pick(raw, ["OPERADORA 4G", "operadora", "Operadora", "RESP BACKUP"]));
  if (!simCard || (!textIncludes(simCard, "BRISANET") && !textIncludes(operadora, "BRISANET"))) return raw;

  const currentBackup = asText(pick(raw, ["CIRCUITO BACKUP"]));
  raw["CIRCUITO BACKUP"] = currentBackup || simCard;

  for (const key of Object.keys(raw)) {
    if (normalizeHeaderKey(key) === normalizeHeaderKey("SIM CARD 4G")) {
      raw[key] = "";
    }
  }

  return raw;
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value).replace(/\./g, "").replace(/,/g, ".").trim();
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function excelSerialToIso(serial: number): string {
  // Excel epoch (1900-based with leap-year bug) compatible conversion.
  const millis = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(millis).toISOString();
}

function asIsoDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) {
    // Heuristic: Excel serials for current dates are around 45k.
    if (value > 20000 && value < 100000) return excelSerialToIso(value);
    const maybeMs = new Date(value);
    return Number.isNaN(maybeMs.getTime()) ? null : maybeMs.toISOString();
  }
  const text = String(value).trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toLoterica(row: Record<string, unknown>, userId: string) {
  const rawData = normalizeLotericaRawData(row);
  const codUl =
    asText(
      pick(rawData, [
        "cod_ul",
        "CODIGO DA LOTERICA_",
        "Codigo da Loterica_",
        "CODIGO UL",
        "Codigo UL",
      ]),
    ) || "";
  if (!codUl) return null;

  return {
    cod_ul: codUl,
    nome_loterica: asText(pick(rawData, ["NOME UL", "nome_loterica", "Nome Loterica"])),
    ccto_oi: asText(pick(rawData, ["CCTO OI", "ccto_oi"])),
    ccto_oemp: asText(pick(rawData, ["CCTO OEMP", "ccto_oemp"])),
    cpe_meraki: asText(pick(rawData, ["CPE MERAKI", "CIRCUITO MERAKI", "CIRCUITOS MERAKI", "MERAKI", "cpe_meraki"])),
    circuito_elsys: asText(pick(rawData, ["CIRCUITO ELSYS", "ELSYS", "circuito_elsys"])),
    operadora: asText(pick(rawData, ["OPERADORA 4G", "operadora", "Operadora"])),
    ip_nat: asText(pick(rawData, ["IP NAT", "ip_nat"])),
    ip_wan: asText(pick(rawData, ["IP WAN", "ip_wan"])),
    loopback_wan: asText(pick(rawData, ["LOOPBACK PRINCIPAL", "loopback_wan", "Loopback Principal"])),
    // BUGFIX mantido: mapear loopback secundario da coluna correta, nao REDE LAN.
    loopback_lan: asText(pick(rawData, ["LOOPBACK SECUNDARIO", "loopback_lan", "Loopback Secundario"])),
    endereco: asText(pick(rawData, ["ENDERECO", "endereco", "Endereco"])),
    contato: asText(pick(rawData, ["CONTATO", "contato", "Contato"])),
    status: asText(pick(rawData, ["STATUS UL", "status", "Status"])),
    cidade: asText(pick(rawData, ["MUNICIPIO", "cidade", "Cidade"])),
    uf: asText(pick(rawData, ["UF", "uf"])),
    designacao_nova: asText(pick(rawData, ["DESIGINACAO NOVA", "DESIGNACAO NOVA", "designacao_nova", "Designacao Nova"])),
    raw_data: rawData,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };
}


function toJira(row: Record<string, unknown>) {
  const chave = asText(pick(row, ["Chave", "chave"]));
  if (!chave) return null;

  return {
    chave,
    cod_ul: asText(pick(row, ["Código da Lotérica_", "CÃ³digo da LotÃ©rica_", "cod_ul"])),
    resumo: asText(pick(row, ["Resumo", "resumo"])),
    tipo_falha: asText(pick(row, ["Tipo da falha", "tipo_falha"])),
    status: asText(pick(row, ["Status", "status"])),
    criado: asIsoDate(pick(row, ["Criado", "criado"])),
    data_hora_normalizacao: asIsoDate(pick(row, ["Data/Hora de Normalização", "Data/Hora de NormalizaÃ§Ã£o", "data_hora_normalizacao"])),
    data_proxima_atualizacao: asIsoDate(pick(row, ["Data para próxima atualização", "Data para prÃ³xima atualizaÃ§Ã£o", "data_proxima_atualizacao"])),
    data_agendamento: asIsoDate(pick(row, ["Data Agendamento", "data_agendamento"])),
    n_inc_snow: asText(pick(row, ["Nº INC Snow", "NÂº INC Snow", "n_inc_snow"])),
    n_incidente_mam: asText(pick(row, ["Nº Incidente MAM", "NÂº Incidente MAM", "n_incidente_mam"])),
    n_req_caixa: asText(pick(row, ["Nº REQ Caixa", "NÂº REQ Caixa", "n_req_caixa"])),
    responsavel: asText(pick(row, ["Responsável", "ResponsÃ¡vel", "responsavel"])),
    site_owner: asText(pick(row, ["Site Owner", "site_owner"])),
    relator: asText(pick(row, ["Relator", "relator"])),
    descricao: asText(pick(row, ["Descrição", "DescriÃ§Ã£o", "descricao"])),
    categoria_sintoma: asText(pick(row, ["Categoria e Sintoma", "categoria_sintoma"])),
    raw_data: row,
  };
}

function toFalhaGis(row: Record<string, unknown>, index: number) {
  const codUl = asText(pick(row, ["Código da Lotérica_", "CÃ³digo da LotÃ©rica_", "cod_ul"]));
  const idAlarme = asText(pick(row, ["ID do Alarmes", "id_alarme"]));
  const dataHoraInicial = asIsoDate(pick(row, ["Data e Hora Incial", "data_hora_inicial"]));
  const chamado = asText(pick(row, ["Chamado", "chamado"]));
  const designacao = asText(pick(row, ["Designação", "DesignaÃ§Ã£o", "designacao"]));
  const recordKey = [idAlarme || "", codUl || "", dataHoraInicial || "", chamado || "", designacao || "", String(index)]
    .join("|")
    .replace(/\s+/g, " ");

  if (isBlank(codUl) && isBlank(idAlarme) && isBlank(chamado) && isBlank(designacao)) return null;

  return {
    record_key: recordKey,
    id_alarme: idAlarme,
    cod_ul: codUl,
    loterica: asText(pick(row, ["Lotérica", "LotÃ©rica", "loterica"])),
    tipo_link: asText(pick(row, ["Tipo de Link", "tipo_link"])),
    cidade: asText(pick(row, ["Cidade", "cidade"])),
    uf: asText(pick(row, ["UF", "uf"])),
    telefone: asText(pick(row, ["Telefone", "telefone"])),
    designacao,
    ip_loopback: asText(pick(row, ["IP Loopback", "ip_loopback"])),
    data_hora_inicial: dataHoraInicial,
    duracao_horas: asNumber(pick(row, ["Duração", "DuraÃ§Ã£o", "duracao_horas"])),
    empresa: asText(pick(row, ["Empresa", "empresa"])),
    categoria_gis: asText(pick(row, ["Categoria GIS", "categoria_gis"])),
    categoria_gis_secundaria: asText(pick(row, ["Categoria GIS_1", "categoria_gis_secundaria"])),
    chamado,
    previsao_atendimento: asIsoDate(pick(row, ["Previsão de Atendimento", "PrevisÃ£o de Atendimento", "previsao_atendimento"])),
    status: asText(pick(row, ["Status", "status"])),
    status_secundario: asText(pick(row, ["Status_1", "status_secundario"])),
    situacao: asText(pick(row, ["SITUAÇÃO", "SITUAÃÃO", "situacao"])),
    ultimo_comentario_em: asIsoDate(pick(row, ["Último Comentário", "Ãltimo ComentÃ¡rio", "ultimo_comentario_em"])),
    n_req_caixa: asText(pick(row, ["Nº REQ Caixa", "NÂº REQ Caixa", "n_req_caixa"])),
    regional: asText(pick(row, ["Regional", "regional"])),
    tecnologia: asText(pick(row, ["Tecnologia", "tecnologia"])),
    site_owner: asText(pick(row, ["Site Owner", "site_owner"])),
    pontuacao_ul: asNumber(pick(row, ["Pontuação UL", "PontuaÃ§Ã£o UL", "pontuacao_ul"])),
    m_duration: asNumber(pick(row, ["m_duration"])),
    raw_data: row,
  };
}

function buildRows(dataset: Dataset, rows: Record<string, unknown>[], userId: string) {
  if (dataset === "lotericas" || dataset === "macro_base_alarmes") {
    return rows.map((row) => toLoterica(row, userId)).filter(Boolean);
  }
  if (dataset === "jira_abertos") {
    return rows.map((row) => toJira(row)).filter(Boolean);
  }
  return rows.map((row, index) => toFalhaGis(row, index)).filter(Boolean);
}

function tableForDataset(dataset: Dataset) {
  if (dataset === "lotericas") return { table: "lotericas", conflict: "cod_ul", pk: "cod_ul" };
  if (dataset === "macro_base_alarmes") return { table: "macro_base_alarmes", conflict: "cod_ul", pk: "cod_ul" };
  if (dataset === "jira_abertos") return { table: "jira_abertos", conflict: "chave", pk: "chave" };
  return { table: "falhas_gis", conflict: "record_key", pk: "record_key" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const body = (await req.json()) as ImportBody;
  const rows = body.rows as Record<string, unknown>[];
  const dataset: Dataset = body.dataset ?? "lotericas";

  if (!["lotericas", "macro_base_alarmes", "jira_abertos", "falhas_gis"].includes(dataset)) {
    return new Response(JSON.stringify({ error: "Invalid dataset" }), { status: 400, headers: corsHeaders });
  }

  if (!rows || !Array.isArray(rows)) {
    return new Response(JSON.stringify({ error: "Invalid data" }), { status: 400, headers: corsHeaders });
  }

  const { table, conflict, pk } = tableForDataset(dataset);
  const replace = Boolean(body.replace);
  const chunkIndex = typeof body.chunkIndex === "number" && Number.isFinite(body.chunkIndex) ? body.chunkIndex : 0;
  const chunkCount = typeof body.chunkCount === "number" && Number.isFinite(body.chunkCount) ? body.chunkCount : 1;

  try {
    if (replace && chunkIndex === 0) {
      const { error: deleteError } = await supabase.from(table).delete().not(pk, "is", null);
      if (deleteError) {
        return new Response(JSON.stringify({ error: `Erro limpando ${table}: ${deleteError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const prepared = buildRows(dataset, rows, user.id) as Record<string, unknown>[];
    if (prepared.length === 0) {
      return new Response(JSON.stringify({ dataset, inserted: 0, errors: 0, total: rows.length, chunkIndex, chunkCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let inserted = 0;
    let errors = 0;
    const batchSize = 200;

    for (let i = 0; i < prepared.length; i += batchSize) {
      const batch = prepared.slice(i, i + batchSize);
      const { error } = await supabase.from(table).upsert(batch, { onConflict: conflict });
      if (error) {
        console.error(`Batch error (${dataset})`, error);
        errors += batch.length;
      } else {
        inserted += batch.length;
      }
    }

    return new Response(JSON.stringify({ dataset, inserted, errors, total: rows.length, chunkIndex, chunkCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
