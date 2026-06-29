import { supabase } from "@/integrations/supabase/client";
import { fetchLotericasExportRows } from "@/lib/lotericasExport";
import type { ControleRow, ImplantacaoRow } from "./processing";
import { processControle } from "./processing";
import type { Row } from "./parse";
import { PROCESSING_TIMEZONE, processingDate, processingTimestamp } from "./date";

const PAGE = 1000;
const STAGING_CHUNK_PAGE = 25;
let controleVersaoSupported: boolean | null = null;
const PRESERVE_MANUAL_EDITS_FROM_HISTORY = true;

interface FetchControleOptions {
  dataReferencia?: string;
  versao?: number;
  responsavel?: string;
  allVersions?: boolean;
}

function isMissingVersaoColumnError(error: { code?: string; message?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    error?.code === "42703" ||
    message.includes("column controle_diario.versao does not exist") ||
    message.includes("could not find the 'versao' column") ||
    (message.includes("schema cache") && message.includes("versao"))
  );
}

function isMissingHistoricoSchemaError(error: { code?: string; message?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    message.includes("could not find") ||
    (message.includes("schema cache") &&
      (message.includes("historico_tratativas") || message.includes("campo")))
  );
}

export async function hasControleVersaoColumn(): Promise<boolean> {
  if (controleVersaoSupported !== null) return controleVersaoSupported;
  const { error } = await supabase.from("controle_diario").select("versao").limit(1);
  if (isMissingVersaoColumnError(error)) {
    controleVersaoSupported = false;
    return false;
  }
  if (error) throw error;
  controleVersaoSupported = true;
  return controleVersaoSupported;
}

/** Fetch all rows of a controle_diario query, paging past the 1000-row cap. */
export async function fetchAllControle(
  input?: string | FetchControleOptions,
): Promise<ControleRow[]> {
  const options: FetchControleOptions =
    typeof input === "string" ? { dataReferencia: input } : (input ?? {});
  const supportsVersao = await hasControleVersaoColumn();
  const shouldFilterVersao = supportsVersao && !options.allVersions;
  const resolvedVersao =
    shouldFilterVersao && options.dataReferencia && !options.versao
      ? await fetchLatestControleVersao(options.dataReferencia)
      : shouldFilterVersao
        ? options.versao
        : null;
  const out: ControleRow[] = [];
  let from = 0;
  while (true) {
    let q = supabase
      .from("controle_diario")
      .select("*")
      .order("data_referencia", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (options.dataReferencia) q = q.eq("data_referencia", options.dataReferencia);
    if (shouldFilterVersao && resolvedVersao) q = q.eq("versao", resolvedVersao);
    if (options.responsavel) q = q.eq("responsavel", options.responsavel);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...((data ?? []) as unknown as ControleRow[]));
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

export async function fetchLatestControleVersao(dataReferencia: string): Promise<number | null> {
  if (!(await hasControleVersaoColumn())) return null;
  const { data, error } = await supabase
    .from("controle_diario")
    .select("versao")
    .eq("data_referencia", dataReferencia)
    .order("versao", { ascending: false })
    .limit(1);
  if (isMissingVersaoColumnError(error)) {
    controleVersaoSupported = false;
    return null;
  }
  if (error) throw error;
  return data?.[0]?.versao ?? null;
}

export async function fetchControleVersoes(dataReferencia: string): Promise<number[]> {
  if (!(await hasControleVersaoColumn())) return [1];
  const seen = new Set<number>();
  const out: number[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("controle_diario")
      .select("versao")
      .eq("data_referencia", dataReferencia)
      .order("versao", { ascending: false })
      .range(from, from + PAGE - 1);
    if (isMissingVersaoColumnError(error)) {
      controleVersaoSupported = false;
      return [1];
    }
    if (error) throw error;
    for (const row of data ?? []) {
      const versao = row.versao ?? 1;
      if (seen.has(versao)) continue;
      seen.add(versao);
      out.push(versao);
    }
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

/** Fetch available control dates without being capped by Supabase's default page size. */
export async function fetchControleDatas(): Promise<string[]> {
  const seen = new Set<string>();
  const out: string[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("controle_diario")
      .select("data_referencia")
      .order("data_referencia", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    for (const row of data ?? []) {
      if (!row.data_referencia || seen.has(row.data_referencia)) continue;
      seen.add(row.data_referencia);
      out.push(row.data_referencia);
    }
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

async function fetchManualEditFieldsByChave(
  current: ControleRow[],
): Promise<Record<string, string[]>> {
  if (!PRESERVE_MANUAL_EDITS_FROM_HISTORY) return {};

  const idToChave = new Map<string, string>();
  for (const row of current) {
    if (row.id && row.chave) idToChave.set(row.id, row.chave);
  }
  const ids = Array.from(idToChave.keys());
  if (ids.length === 0) return {};

  const out: Record<string, Set<string>> = {};
  for (let i = 0; i < ids.length; i += PAGE) {
    const slice = ids.slice(i, i + PAGE);
    const { data, error } = await supabase
      .from("historico_tratativas")
      .select("controle_id, campo")
      .in("controle_id", slice);
    if (error) {
      console.warn(
        "Histórico de tratativas indisponível; processamento seguirá sem preservar edições manuais por histórico.",
        {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          optionalSchemaIssue: isMissingHistoricoSchemaError(error),
        },
      );
      return {};
    }
    for (const item of data ?? []) {
      if (!item.controle_id) continue;
      const chave = idToChave.get(item.controle_id);
      if (!chave) continue;
      (out[chave] ??= new Set()).add(item.campo);
    }
  }

  return Object.fromEntries(
    Object.entries(out).map(([chave, fields]) => [chave, Array.from(fields)]),
  );
}

async function fetchProfileNames(): Promise<string[]> {
  const { data, error } = await supabase.from("profiles").select("nome");
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((p) => p.nome).filter(Boolean))) as string[];
}

async function fetchProcessingContext(dataReferencia: string): Promise<{
  prior: ControleRow[];
  sameDayPrior: ControleRow[];
  manualEditFieldsByChave: Record<string, string[]>;
}> {
  const currentVersion = await fetchLatestControleVersao(dataReferencia);
  const current = currentVersion
    ? await fetchAllControle({ dataReferencia, allVersions: true })
    : [];
  const manualEditFieldsByChave = await fetchManualEditFieldsByChave(current);

  const { data: previousDates, error } = await supabase
    .from("controle_diario")
    .select("data_referencia")
    .lt("data_referencia", dataReferencia)
    .order("data_referencia", { ascending: false })
    .limit(1);

  if (error) throw error;
  const previousDate = previousDates?.[0]?.data_referencia;

  if (!previousDate) {
    return { prior: current, sameDayPrior: current, manualEditFieldsByChave };
  }

  const previousVersion = await fetchLatestControleVersao(previousDate);
  const previous = previousVersion
    ? await fetchAllControle({ dataReferencia: previousDate, versao: previousVersion })
    : [];
  return { prior: [...previous, ...current], sameDayPrior: current, manualEditFieldsByChave };
}

async function nextControleVersao(dataReferencia: string): Promise<number> {
  if (!(await hasControleVersaoColumn())) return 1;
  const latest = await fetchLatestControleVersao(dataReferencia);
  return (latest ?? 0) + 1;
}

async function requireControleVersaoColumn(): Promise<void> {
  if (await hasControleVersaoColumn()) return;
  throw new Error(
    "A coluna controle_diario.versao ainda não está disponível no Supabase. Aplique o SQL de versão/constraint e recarregue o cache do PostgREST antes de processar novamente.",
  );
}

type Tipo = "gis1" | "gis2" | "controle_d1" | "jira" | "grafana";

function toControleInsertPayload(row: ControleRow): Omit<ControleRow, "id"> {
  const payload = { ...(row as unknown as Record<string, unknown>) };
  delete payload.id;
  delete payload.created_at;
  delete payload.updated_at;
  return payload as unknown as Omit<ControleRow, "id">;
}

async function clearControleVersion(dataReferencia: string, versao: number): Promise<void> {
  const { error } = await supabase
    .from("controle_diario")
    .delete()
    .eq("data_referencia", dataReferencia)
    .eq("versao", versao);
  if (error) throw error;
}

export async function getLatestStaging(tipo: Tipo): Promise<Row[]> {
  const { data: latest, error: latestError } = await supabase
    .from("staging_bases")
    .select("importacao_id, criado_em")
    .eq("tipo", tipo)
    .order("criado_em", { ascending: false })
    .limit(1);

  if (latestError) throw latestError;
  if (!latest || latest.length === 0) return [];

  const latestImportacaoId = latest[0]?.importacao_id;
  const out: Row[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("staging_bases")
      .select("linhas")
      .eq("tipo", tipo)
      .order("id", { ascending: true })
      .range(from, from + STAGING_CHUNK_PAGE - 1);

    if (latestImportacaoId) {
      query = query.eq("importacao_id", latestImportacaoId);
    } else {
      query = query.eq("criado_em", latest[0].criado_em);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const r of data) {
      const rows = (r.linhas as Row[]) ?? [];
      if (rows.length <= 500) {
        out.push(...rows);
      } else {
        for (let i = 0; i < rows.length; i += 500) {
          out.push(...rows.slice(i, i + 500));
        }
      }
    }

    if (data.length < STAGING_CHUNK_PAGE) break;
    from += STAGING_CHUNK_PAGE;
  }

  return out;
}

async function fetchFalhasGisRows(): Promise<Row[]> {
  const out: Row[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("falhas_gis")
      .select("raw_data")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) {
      const row = r.raw_data as Row | null;
      if (row) out.push(row);
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

async function fetchJiraAbertosRows(): Promise<Row[]> {
  const out: Row[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("jira_abertos")
      .select("*")
      .range(from, from + PAGE - 1);
    if (error) {
      const message = String(error?.message ?? "").toLowerCase();
      if (message.includes("pgrst205") || message.includes("could not find the table 'public.jira_abertos'")) {
        console.warn("Tabela jira_abertos ainda não existe no banco. Usando staging_bases como fallback.");
        return [];
      }
      throw error;
    }
    if (!data || data.length === 0) break;
    for (const r of data) {
      const raw = (r.raw_data as Row | null) ?? {};
      out.push({
        ...raw,
        Chave: r.chave ?? raw.Chave ?? raw.chave ?? "",
        chave: r.chave ?? raw.Chave ?? raw.chave ?? "",
        Key: r.chave ?? raw.Key ?? raw.key ?? "",
        key: r.chave ?? raw.Key ?? raw.key ?? "",
        Chamado: r.chave ?? raw.Chamado ?? raw.chamado ?? "",
        "Código da Lotérica": r.cod_ul ?? raw["Código da Lotérica"] ?? raw.cod_ul ?? "",
        "Codigo da Loterica": r.cod_ul ?? raw["Codigo da Loterica"] ?? raw.cod_ul ?? "",
        cod_ul: r.cod_ul ?? raw.cod_ul ?? "",
        "Tipo de Falha": r.tipo_falha ?? raw["Tipo de Falha"] ?? raw.tipo_falha ?? "",
        "Tipo Falha": r.tipo_falha ?? raw["Tipo Falha"] ?? raw.tipo_falha ?? "",
        "TIPO DE FALHA": r.tipo_falha ?? raw["TIPO DE FALHA"] ?? raw.tipo_falha ?? "",
        tipo_falha: r.tipo_falha ?? raw.tipo_falha ?? "",
        "Nº INC Snow": r.n_inc_snow ?? raw["Nº INC Snow"] ?? raw["N° INC Snow"] ?? raw.n_inc_snow ?? "",
        "Numero INC Snow": r.n_inc_snow ?? raw["Numero INC Snow"] ?? raw["Número INC Snow"] ?? raw.n_inc_snow ?? "",
        n_inc_snow: r.n_inc_snow ?? raw.n_inc_snow ?? "",
        "Nº Incidente MAM": r.n_incidente_mam ?? raw["Nº Incidente MAM"] ?? raw.n_incidente_mam ?? "",
        "Nº REQ Caixa": r.n_req_caixa ?? raw["Nº REQ Caixa"] ?? raw.n_req_caixa ?? "",
        Status: r.status ?? raw.Status ?? raw.status ?? "",
        status: r.status ?? raw.status ?? "",
        Resumo: r.resumo ?? raw.Resumo ?? raw.resumo ?? "",
        resumo: r.resumo ?? raw.resumo ?? "",
        Summary: r.resumo ?? raw.Summary ?? raw.summary ?? "",
        summary: r.resumo ?? raw.summary ?? "",
        "Descrição": r.descricao ?? raw["Descrição"] ?? raw.Descricao ?? raw.descricao ?? "",
        Descricao: r.descricao ?? raw.Descricao ?? raw.descricao ?? "",
        descricao: r.descricao ?? raw.descricao ?? "",
        "Categoria e Sintoma": r.categoria_sintoma ?? raw["Categoria e Sintoma"] ?? raw.categoria_sintoma ?? "",
        categoria_sintoma: r.categoria_sintoma ?? raw.categoria_sintoma ?? "",
        Criado: r.criado ?? raw.Criado ?? raw.criado ?? "",
        criado: r.criado ?? raw.criado ?? "",
        "Fila Jira": raw["Fila Jira"] ?? raw.fila_jira ?? "",
        Fila: raw["Fila Jira"] ?? raw.fila_jira ?? "",
        "Último Comentário": raw["Último Comentário"] ?? raw.ultimo_comentario ?? "",
        "Ultimo Comentario": raw["Último Comentário"] ?? raw.ultimo_comentario ?? "",
        "Último Comentário Interno": raw["Último Comentário Interno"] ?? raw.ultimo_comentario_interno ?? "",
        "Ultimo Comentario Interno": raw["Último Comentário Interno"] ?? raw.ultimo_comentario_interno ?? "",
      });
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

export async function fetchJiraControleRows(): Promise<Row[]> {
  return getLatestStagingOrDb("jira", fetchJiraAbertosRows);
}

async function getPreviousControleDate(dataReferencia: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("controle_diario")
    .select("data_referencia")
    .lt("data_referencia", dataReferencia)
    .order("data_referencia", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.data_referencia ?? null;
}

async function fetchControleD1FromDb(): Promise<Row[]> {
  const processadoEm = new Date();
  const dataExecucao = processingDate(processadoEm);
  const previousDate = await getPreviousControleDate(dataExecucao);
  if (!previousDate) return [];

  const rows = await fetchAllControle({ dataReferencia: previousDate, allVersions: true });
  return rows.map((r) => ({
    "Cód. da Lotérica": r.codigo_loterica ?? "",
    "Codigo da Loterica": r.codigo_loterica ?? "",
    "Código da Lotérica": r.codigo_loterica ?? "",
    "Codigo UL": r.codigo_loterica ?? "",
    "Código UL": r.codigo_loterica ?? "",
    "Tipo de Link": r.tipo_link ?? "",
    "Tipo de link": r.tipo_link ?? "",
    "Tipo Link": r.tipo_link ?? "",
    "Tipo do Link": r.tipo_link ?? "",
    "Link": r.tipo_link ?? "",
    "Designacao": r.designacao ?? "",
    "Designação": r.designacao ?? "",
    "Designacao OEMP": r.designacao_parceiro ?? "",
    "Designação OEMP": r.designacao_parceiro ?? "",
    "Novo Circuito": r.novo_circuito ?? "",
    "NOVO CIRCUITO": r.novo_circuito ?? "",
    "IP Loopback": r.ip_loopback ?? "",
    "IP de loopback": r.ip_loopback ?? "",
    "Loopback": r.ip_loopback ?? "",
    "IP": r.ip_loopback ?? "",
    "Chamado": r.chamado ?? "",
    "Chave": r.chamado ?? "",
    "ORDEM": r.ordem ?? "",
    "SITUAÇÃO": r.situacao ?? "",
    "SITUACAO": r.situacao ?? "",
    "STATUS PLANILHA": r.status_planilha ?? "",
    "STATUS JIRA": r.status_jira ?? "",
    "OBS": r.obs ?? "",
    "COMENTÁRIO INTERNO": r.obs ?? "",
    "Comentário Interno": r.obs ?? "",
    "RESPONSÁVEL": r.responsavel ?? "",
    "RESPONSAVEL": r.responsavel ?? "",
    "STATUS ZABBIX": r.status_zabbix ?? "",
    "Duração (h)": r.duracao_h?.toString() ?? "",
    "Duracao (h)": r.duracao_h?.toString() ?? "",
    "Data e Hora Inicial": r.data_hora_inicial ?? "",
    "Data/Hora Inicial": r.data_hora_inicial ?? "",
    "Previsão de Atendimento": r.previsao_atendimento ?? "",
    "Previsao de Atendimento": r.previsao_atendimento ?? "",
    "Último Comentário": r.ultimo_comentario ?? "",
    "Ultimo Comentario": r.ultimo_comentario ?? "",
    "Lotérica": r.loterica ?? "",
    "Loterica": r.loterica ?? "",
    "UF": r.uf ?? "",
    "Cidade": r.cidade ?? "",
    "ID do Alarme": r.chamado ?? "",
    "ID do Alarmes": r.chamado ?? "",
    "Identificador do Alarme": r.chamado ?? "",
  } as Row));
}

async function getLatestStagingOrDb(tipo: Tipo, fetchDbRows: () => Promise<Row[]>): Promise<Row[]> {
  const stagingRows = await getLatestStaging(tipo);
  if (stagingRows.length > 0) return stagingRows;
  return fetchDbRows();
}

async function fetchGrafanaRows(): Promise<Row[]> {
  const out: Row[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("grafana")
      .select("*")
      .range(from, from + PAGE - 1);
    if (error) {
      const message = String(error?.message ?? "").toLowerCase();
      if (message.includes("pgrst205") || message.includes("could not find the table 'public.grafana'")) {
        console.warn("Tabela grafana ainda não existe no banco. Usando staging_bases como fallback.");
        return [];
      }
      throw error;
    }
    if (!data || data.length === 0) break;
    for (const r of data) {
      out.push({
        "Circuito": r.circuito ?? "",
        "circuito": r.circuito ?? "",
        "Posto": r.posto ?? "",
        "posto": r.posto ?? "",
        "POSTO": r.posto ?? "",
        "Postos": r.posto ?? "",
        "Nome do Posto": r.posto ?? "",
        "Unidade / Posto": r.posto ?? "",
      } as Row);
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

/** Loads all staging bases, runs processing and persists the daily control + implantações. */
export async function runDailyProcessing(): Promise<{
  inserted: number;
  dataReferencia: string;
  versao: number;
  stats: ReturnType<typeof processControle>["stats"];
}> {
  const processadoEm = new Date();
  const dataExecucao = processingDate(processadoEm);
  const [gis1, gis2, controleD1, jira, grafana, planta, profileNames] = await Promise.all([
    getLatestStagingOrDb("gis1", fetchFalhasGisRows),
    getLatestStaging("gis2"),
    getLatestStagingOrDb("controle_d1", fetchControleD1FromDb),
    getLatestStagingOrDb("jira", fetchJiraAbertosRows),
    getLatestStagingOrDb("grafana", fetchGrafanaRows),
    fetchLotericasExportRows(),
    fetchProfileNames(),
  ]);

  if (gis1.length === 0 && gis2.length === 0) {
    throw new Error("Importe ao menos uma base GIS antes de processar.");
  }
  if (planta.length === 0) {
    throw new Error(
      "Nao foi possivel localizar os dados automaticos do Consulta UL / lotericas_export para enriquecimento da Planta.",
    );
  }

  await requireControleVersaoColumn();
  const { prior, sameDayPrior, manualEditFieldsByChave } = await fetchProcessingContext(dataExecucao);
  const versao = await nextControleVersao(dataExecucao);

  const result = processControle({
    gis1,
    gis2,
    controleD1,
    jira,
    grafana,
    planta,
    profileNames,
    manualEditFieldsByChave,
    dataReferencia: dataExecucao,
    versao,
    processadoEm: processadoEm.toISOString(),
    processadoEmLocal: processingTimestamp(processadoEm),
    timezone: PROCESSING_TIMEZONE,
    prior,
    sameDayPrior,
  });

  // insert in chunks
  await clearControleVersion(dataExecucao, versao);
  let inserted = 0;
  for (let i = 0; i < result.controle.length; i += 500) {
    const chunk = result.controle.slice(i, i + 500).map(toControleInsertPayload);
    const { error } = await supabase.from("controle_diario").insert(chunk as never);
    if (error) {
      try {
        await clearControleVersion(dataExecucao, versao);
      } catch (cleanupError) {
        console.warn("Falha ao limpar versão parcial do controle_diario", cleanupError);
      }
      throw new Error(
        [
          "Falha ao gravar controle_diario",
          `versao=${versao}`,
          error.code,
          error.message,
          error.details,
          error.hint,
        ]
          .filter(Boolean)
          .join(" - "),
      );
    }
    inserted += chunk.length;
  }

  // upsert implantações
  if (result.implantacoes.length > 0) {
    for (let i = 0; i < result.implantacoes.length; i += 500) {
      const chunk = result.implantacoes.slice(i, i + 500) as ImplantacaoRow[];
      const { error } = await supabase
        .from("implantacoes")
        .upsert(chunk as never, { onConflict: "codigo_loterica" });
      if (error) {
        throw new Error(
          ["Falha ao gravar implantações", error.code, error.message, error.details, error.hint]
            .filter(Boolean)
            .join(" - "),
        );
      }
    }
  }

  return { inserted, dataReferencia: dataExecucao, versao, stats: result.stats };
}

export { fetchFalhasGisRows, fetchJiraAbertosRows, fetchGrafanaRows };
