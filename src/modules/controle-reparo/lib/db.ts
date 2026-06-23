import { supabase } from "@/integrations/supabase/client";
import type { ControleRow, ImplantacaoRow } from "./processing";
import { processControle } from "./processing";
import type { Row } from "./parse";
import { PROCESSING_TIMEZONE, processingDate, processingTimestamp } from "./date";

const PAGE = 1000;
let controleVersaoSupported: boolean | null = null;
const PRESERVE_MANUAL_EDITS_FROM_HISTORY = false;

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

  if (!previousDate) return { prior: current, manualEditFieldsByChave };

  const previousVersion = await fetchLatestControleVersao(previousDate);
  const previous = previousVersion
    ? await fetchAllControle({ dataReferencia: previousDate, versao: previousVersion })
    : [];
  return { prior: [...previous, ...current], manualEditFieldsByChave };
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

type Tipo = "gis1" | "gis2" | "controle_d1" | "jira" | "grafana" | "planta";

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

  let query = supabase.from("staging_bases").select("linhas").eq("tipo", tipo);

  const latestImportacaoId = latest[0]?.importacao_id;
  if (latestImportacaoId) {
    query = query.eq("importacao_id", latestImportacaoId);
  } else {
    query = query.eq("criado_em", latest[0].criado_em);
  }

  const { data, error } = await query.order("criado_em", { ascending: true });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  const out: Row[] = [];
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
    getLatestStaging("gis1"),
    getLatestStaging("gis2"),
    getLatestStaging("controle_d1"),
    getLatestStaging("jira"),
    getLatestStaging("grafana"),
    getLatestStaging("planta"),
    fetchProfileNames(),
  ]);

  if (gis1.length === 0 && gis2.length === 0) {
    throw new Error("Importe ao menos uma base GIS antes de processar.");
  }

  await requireControleVersaoColumn();
  const { prior, manualEditFieldsByChave } = await fetchProcessingContext(dataExecucao);
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
