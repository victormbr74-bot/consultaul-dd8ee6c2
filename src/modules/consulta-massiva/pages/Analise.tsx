import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  Activity, AlertOctagon, AlertTriangle, Building2, CheckCircle2, Download, FileText, Flame, Globe2,
  HelpCircle, MapPin, Network, Play, Radar, RadioTower, Shield, ShieldOff, Trash2, XCircle, SlidersHorizontal,
} from "lucide-react";
import { UploadCard } from "@/modules/consulta-massiva/components/UploadCard";
import { StatCard } from "@/modules/consulta-massiva/components/StatCard";
import { MassivaBadge } from "@/modules/consulta-massiva/components/MassivaBadge";
import { SituacaoBadge } from "@/modules/consulta-massiva/components/SituacaoBadge";
import { DrillDownModal } from "@/modules/consulta-massiva/components/DrillDownModal";
import { FiltersBar, emptyFilters, type Filters } from "@/modules/consulta-massiva/components/FiltersBar";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { processGis, type ProcessResult } from "@/modules/consulta-massiva/lib/massiva-processor";
import { exportToCsv, exportToPdf, exportToXlsx, processedRowsForExport, readGisFile } from "@/modules/consulta-massiva/lib/excel";
import { buildEscalonamentoMap, operadorasFromLotericas } from "@/modules/consulta-massiva/lib/operadoras";
import type { GisRow, Massiva, ProcessedRow } from "@/modules/consulta-massiva/lib/gis-types";
import type { DbLoterica, DbEscalonamento, DbOperadora } from "@/modules/consulta-massiva/lib/db-types";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/modules/consulta-massiva/lib/audit";
import { loadCidadesLookup } from "@/modules/consulta-massiva/lib/base-cidades";
import { SINALIZACAO_LABEL } from "@/modules/consulta-massiva/lib/geo";
import { Sinalizacao60kmBadge } from "@/modules/consulta-massiva/components/Sinalizacao60kmBadge";
import { buildMascaraTextoFromMassiva } from "@/modules/consulta-massiva/lib/mascara";
import { toast } from "sonner";

type LoadedFile = { name: string; count: number; rows: GisRow[] } | null;

const ANALISE_ALGORITHM_VERSION = 7;
const ANALISE_STORAGE_KEY = "consulta-massiva:analise-atual:v7";

type PersistedMassivaForDedupe = {
  id: string;
  tipo_massiva: string;
  operadora: string;
  uf: string;
  qtd_circuitos: number;
  primeiro_alarme: string | null;
  ultimo_alarme: string | null;
  data_hora_abertura: string | null;
  circuito_pai: string | null;
};

type OpenMassivaRecord = PersistedMassivaForDedupe & {
  status: string;
};

function getMassivaRows(m: Massiva, rows: ProcessedRow[]): ProcessedRow[] {
  const ids = new Set(m.rowIds);
  return rows
    .filter((r) => ids.has(r.__rowId))
    .sort((a, b) => {
      const ats = Number.isFinite(a.__ts) ? a.__ts : Number.MAX_SAFE_INTEGER;
      const bts = Number.isFinite(b.__ts) ? b.__ts : Number.MAX_SAFE_INTEGER;
      return ats - bts;
    });
}

function pickRowText(row: ProcessedRow | undefined, ...keys: string[]): string {
  if (!row) return "";
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function dayRangeFor(ts: number) {
  const d = new Date(ts);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
  return {
    start: start.toISOString(),
    end: new Date(end.getTime() - 1).toISOString(),
  };
}

function normalizeReferencePart(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function eventMinuteReference(value: string | number | null | undefined): string {
  if (value == null || value === "") return "";
  const timestamp = typeof value === "number" ? value : new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return normalizeReferencePart(value);
  return String(Math.floor(timestamp / 60_000));
}

function openMassivaReferenceFromRows(m: Massiva): string {
  return [
    normalizeReferencePart(m.tipo_massiva),
    normalizeReferencePart(m.uf),
    normalizeReferencePart(m.operadora),
    eventMinuteReference(m.primeiro_ts),
  ].join("|");
}

function openMassivaReferenceFromDb(row: PersistedMassivaForDedupe): string {
  return [
    normalizeReferencePart(row.tipo_massiva),
    normalizeReferencePart(row.uf),
    normalizeReferencePart(row.operadora),
    eventMinuteReference(row.primeiro_alarme ?? row.data_hora_abertura),
  ].join("|");
}

function massivaControlFields(m: Massiva, rows: ProcessedRow[]) {
  const first = getMassivaRows(m, rows)[0];
  return {
    circuito_pai: pickRowText(
      first,
      "Designação",
      "DesignaÃ§Ã£o",
      "DesignaÃƒÂ§ÃƒÂ£o",
      "Designacao",
      "DESIGNACAO",
      "Circuito",
      "Circuito OEMP",
    ),
    consorcio_ul: "CONSÓRCIO",
    tipo_link: m.tipo_link === "SECUNDARIO" ? "SECUNDÁRIO" : "PRIMÁRIO",
    chamado: pickRowText(first, "Chamado"),
    inc: pickRowText(first, "Nº REQ Caixa", "NÂº REQ Caixa", "REQ Caixa"),
    data_hora_abertura: new Date(m.primeiro_ts).toISOString(),
  };
}

function isolatedTone(count: number | null | undefined): "critical" | "muted" {
  return Number(count ?? 0) > 0 ? "critical" : "muted";
}

function radiusTone(radiusKm: number | null | undefined, sinalizacao?: string | null): "green" | "yellow" | "red" | "muted" {
  if (sinalizacao === "SEM_GEO" || radiusKm == null || !Number.isFinite(radiusKm)) return "muted";
  if (radiusKm <= 60) return "green";
  if (radiusKm <= 200) return "yellow";
  return "red";
}

function radiusBadgeClass(radiusKm: number | null | undefined, sinalizacao?: string | null): string {
  const tone = radiusTone(radiusKm, sinalizacao);
  if (tone === "green") return "border-emerald-400/50 bg-emerald-500/15 text-emerald-200 shadow-[0_0_14px_rgba(52,211,153,0.18)]";
  if (tone === "yellow") return "border-amber-300/50 bg-amber-400/15 text-amber-200 shadow-[0_0_14px_rgba(251,191,36,0.16)]";
  if (tone === "red") return "border-red-400/60 bg-red-500/15 text-red-200 shadow-[0_0_16px_rgba(248,113,113,0.22)]";
  return "border-border bg-muted text-muted-foreground";
}

function formatRadius(radiusKm: number | null | undefined, sinalizacao?: string | null): string {
  if (sinalizacao === "SEM_GEO" || radiusKm == null || !Number.isFinite(radiusKm)) return "-";
  return `${radiusKm} km`;
}

async function fetchEscalonamentos(): Promise<DbEscalonamento[]> {
  const { data, error } = await supabase.from("escalonamentos").select("*").eq("ativo", true);
  if (error) throw error;
  return (data ?? []) as DbEscalonamento[];
}

async function fetchAllLotericas(): Promise<DbLoterica[]> {
  const out: DbLoterica[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("lotericas")
      .select("cod_ul,nome_loterica,ccto_oi,ccto_oemp,operadora,loopback_wan,loopback_lan,cidade,uf,designacao_nova,raw_data")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...(data as DbLoterica[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

async function fetchAllOperadoras(): Promise<DbOperadora[]> {
  const out: DbOperadora[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("operadoras")
      .select("*")
      .eq("ativo", true)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...(data as DbOperadora[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

export default function Page() {
  const [file1, setFile1] = useState<LoadedFile>(null);
  const [file2, setFile2] = useState<LoadedFile>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [drill, setDrill] = useState<Massiva | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const { user } = useAuth();
  const [analiseUsuario, setAnaliseUsuario] = useState<string | null>(null);
  const [analiseId, setAnaliseId] = useState<string | null>(null);

  const lotQ = useQuery({ queryKey: ["lotericas-massiva-ref"], queryFn: fetchAllLotericas, staleTime: 5 * 60_000 });
  const operadorasQ = useQuery({ queryKey: ["operadoras-massiva-ref"], queryFn: fetchAllOperadoras, staleTime: 5 * 60_000 });
  const escQ = useQuery({ queryKey: ["escalonamentos"], queryFn: fetchEscalonamentos, staleTime: 60_000 });
  const cidadesQ = useQuery({ queryKey: ["base_cidades-lookup"], queryFn: loadCidadesLookup, staleTime: 5 * 60_000 });

  const massivasTabelaQ = useQuery({
    queryKey: ["massivas-tabela", analiseId],
    queryFn: async () => {
      if (!analiseId) return [];
      const out: Array<{
        id: string;
        id_massiva: string;
        chamado: string | null;
        atualizacao: string | null;
        mascara_texto: string | null;
        status: string;
        data_hora_normalizacao: string | null;
        inc: string | null;
        consorcio_ul: string;
        tipo_link: string | null;
        qtd_circuitos: number;
        qtd_lotericas_isoladas: number;
        operadora: string;
      }> = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("massivas")
          .select("id,id_massiva,chamado,atualizacao,mascara_texto,status,data_hora_normalizacao,inc,consorcio_ul,tipo_link,qtd_circuitos,qtd_lotericas_isoladas,operadora")
          .eq("analise_id", analiseId)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data?.length) break;
        out.push(...(data as typeof out));
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return out;
    },
    enabled: !!analiseId,
    staleTime: 30_000,
  });

  const openMassivasQ = useQuery({
    queryKey: ["massivas-abertas-status-v2", analiseId],
    queryFn: async (): Promise<OpenMassivaRecord[]> => {
      if (!result?.massivas.length) return [];
      const out: OpenMassivaRecord[] = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("massivas")
          .select("id,tipo_massiva,operadora,uf,qtd_circuitos,primeiro_alarme,ultimo_alarme,data_hora_abertura,circuito_pai,status")
          .neq("status", "NORMALIZADO")
          .order("primeiro_alarme", { ascending: false, nullsFirst: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data?.length) break;
        out.push(...(data as OpenMassivaRecord[]));
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return out;
    },
    enabled: !!result?.massivas.length,
    staleTime: 15_000,
  });

  const openMassivaKeys = useMemo(
    () => new Set((openMassivasQ.data ?? []).map(openMassivaReferenceFromDb)),
    [openMassivasQ.data],
  );

  const resultRef = useRef(result);
  resultRef.current = result;

  const massivasTabelaMap = useMemo(() => {
    const map = new Map<string, typeof massivasTabelaQ.data[number]>();
    for (const m of massivasTabelaQ.data ?? []) map.set(m.id_massiva, m);
    return map;
  }, [massivasTabelaQ]);

  useEffect(() => {
    if (!analiseId || !massivasTabelaQ.data) return;
    const current = resultRef.current;
    if (!current) return;

    const massivaMap = new Map(current.massivas.map(m => [m.id_massiva, m]));
    const rowMap = new Map(current.rows.map(r => [r.__rowId, r]));
    let anyChange = false;

    for (const t of massivasTabelaQ.data) {
      const m = massivaMap.get(t.id_massiva);
      if (!m) continue;

      const updatedMassiva = { ...m } as Massiva;
      const changedFields: string[] = [];
      const fields = ["chamado", "atualizacao", "status", "data_hora_normalizacao", "inc", "consorcio_ul", "tipo_link", "qtd_circuitos", "qtd_lotericas_isoladas", "operadora", "mascara_texto"] as const;
      for (const f of fields) {
        const tv = (t as Record<string, unknown>)[f];
        const mv = (m as Record<string, unknown>)[f];
        if (tv !== undefined && tv !== null && tv !== mv) {
          (updatedMassiva as Record<string, unknown>)[f] = tv;
          changedFields.push(f);
        }
      }
      if (changedFields.length > 0) {
        massivaMap.set(t.id_massiva, updatedMassiva);
        anyChange = true;
      }

      for (const rowId of m.rowIds) {
        const row = rowMap.get(rowId);
        if (!row) continue;
        const updatedRow = { ...row } as ProcessedRow;
        const rowChangedFields: string[] = [];
        if (changedFields.includes("chamado")) { updatedRow["Chamado"] = t.chamado; rowChangedFields.push("Chamado"); }
        if (changedFields.includes("inc")) { updatedRow["Nº REQ Caixa"] = t.inc; rowChangedFields.push("Nº REQ Caixa"); }
        if (changedFields.includes("status")) {
          updatedRow["Status Massiva"] = t.status === "MASSIVA" ? "MASSIVA" : "NAO_MASSIVA";
          updatedRow.__situacao = t.status === "MASSIVA" ? "MASSIVA" : (t.status === "NORMALIZADO" ? "ISOLADO" : updatedRow.__situacao);
          rowChangedFields.push("Status Massiva");
        }
        if (changedFields.includes("atualizacao")) { updatedRow["Atualização"] = t.atualizacao; rowChangedFields.push("Atualização"); }
        if (rowChangedFields.length > 0) {
          rowMap.set(rowId, updatedRow);
          anyChange = true;
        }
      }
    }

    if (anyChange) {
      setResult({
        ...current,
        massivas: Array.from(massivaMap.values()),
        rows: Array.from(rowMap.values()),
      });
    }
  }, [analiseId, massivasTabelaQ.data]);

  const operadorasConsultaUl = useMemo(() => {
    const derivadasDaBase = operadorasFromLotericas(lotQ.data ?? []);
    const cadastradas = operadorasQ.data ?? [];
    // A tabela operadoras é a fonte autoritativa do projeto original. Como
    // buildOperadoraLookup mantém a última ocorrência, ela deve vir por último.
    return [...derivadasDaBase, ...cadastradas];
  }, [lotQ.data, operadorasQ.data]);
  const escMap = useMemo(() => buildEscalonamentoMap(escQ.data ?? []), [escQ.data]);

  useEffect(() => {
    let cancelled = false;
    const applySaved = (payload: unknown): boolean => {
      if (cancelled || !payload) return false;
      const parsed = payload as {
        version?: number;
        file1?: LoadedFile;
        file2?: LoadedFile;
        result?: ProcessResult | null;
        filters?: Filters;
        analiseId?: string | null;
      };
      if (parsed.version !== ANALISE_ALGORITHM_VERSION) return false;
      setFile1(parsed.file1 ?? null);
      setFile2(parsed.file2 ?? null);
      setResult(parsed.result ?? null);
      setAnaliseId(parsed.analiseId ?? null);
      setFilters(parsed.filters ?? emptyFilters);
      return true;
    };

    const loadSaved = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("analise_resultado_atual")
          .select("payload")
          .eq("id", "current")
          .maybeSingle();
        if (!error && data?.payload && applySaved(data.payload)) return;
      } catch (e) {
        console.warn("failed to restore massiva analysis from database", e);
      }

      try {
        const saved = localStorage.getItem(ANALISE_STORAGE_KEY);
        if (saved) applySaved(JSON.parse(saved));
      } catch (e) {
        console.warn("failed to restore saved massiva analysis", e);
      }
    };

    void loadSaved();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!file1 && !file2 && !result) return;
    try {
      localStorage.setItem(ANALISE_STORAGE_KEY, JSON.stringify({ version: ANALISE_ALGORITHM_VERSION, file1, file2, result, filters }));
    } catch (e) {
      console.warn("failed to save massiva analysis", e);
    }
  }, [file1, file2, result, filters]);

  const onUploadGis = async (origem: "1_LINK" | "2_LINKS", file: File) => {
    try {
      const rows = await readGisFile(file, origem);
      const loaded = { name: file.name, count: rows.length, rows };
      if (origem === "1_LINK") setFile1(loaded); else setFile2(loaded);
      await logAudit("UPLOAD_GIS", origem, { arquivo: file.name, linhas: rows.length });
      toast.success(`${file.name}: ${rows.length} linhas`);
    } catch (e) {
      toast.error("Falha ao ler GIS: " + (e as Error).message);
    }
  };

  const runAnalysis = async () => {
    if (!file1 && !file2) { toast.error("Carregue pelo menos um arquivo GIS."); return; }
    if (!lotQ.data) { toast.error("Base de lotéricas ainda carregando."); return; }
    if (!operadorasQ.data) { toast.error("Base de operadoras ainda carregando."); return; }
    setProcessing(true);
    setTimeout(async () => {
      const all: GisRow[] = [...(file1?.rows ?? []), ...(file2?.rows ?? [])];
      const t0 = performance.now();
      const r = processGis(all, operadorasConsultaUl, lotQ.data ?? [], cidadesQ.data);
      for (const m of r.massivas) {
        m.mascara_texto = buildMascaraTextoFromMassiva(m, r.rows, { atualizacao: m.atualizacao || "" });
      }
      const dt = Math.round(performance.now() - t0);
      setResult(r);
      setProcessing(false);

      const validTsRows = r.rows.filter((row) => Number.isFinite(row.__ts));
      const timestamps = validTsRows.map((row) => row.__ts);
      const menorData = timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : null;
      const maiorData = timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
      const registrosPorData: Record<string, number> = {};
      for (const row of validTsRows) {
        const d = new Date(row.__ts);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
        registrosPorData[key] = (registrosPorData[key] ?? 0) + 1;
      }
      const qtdPrincipal = validTsRows.filter((row) => row.__tipoLink === "PRINCIPAL").length;
      const qtdSecundario = validTsRows.filter((row) => row.__tipoLink === "SECUNDARIO").length;
      const auditDetails: Record<string, unknown> = {
        total_registros_gs: all.length,
        total_registros_valida_data: validTsRows.length,
        menor_data_hora: menorData,
        maior_data_hora: maiorData,
        registros_por_data: registrosPorData,
        qtd_principal: qtdPrincipal,
        qtd_secundario: qtdSecundario,
        qtd_principal_vtal: r.stats.principalVtal,
        qtd_principal_oemp: r.stats.principalOemp,
        qtd_secundario_uf: r.stats.secundarioUf,
        qtd_secundario_nacional: r.stats.secundarioNacional,
        massivas_detectadas: r.massivas.length,
        circuitos_impactados: r.stats.circuitosImpactados,
        ufs_impactadas: r.stats.ufsImpactadas,
      };
      console.info("[consulta-massiva] auditoria analise", auditDetails);
      void logAudit("EXECUTAR_ANALISE", "analises", auditDetails);

      // Persist analise + massivas (best-effort)
      try {
        const { data: userData } = await supabase.auth.getUser();
        setAnaliseUsuario(userData.user?.user_metadata?.name ?? userData.user?.email ?? null);
        const { data: analise } = await supabase.from("analises").insert({
          executado_por: userData.user?.id ?? null,
          total_registros: r.stats.totalRegistros,
          qtd_principal_vtal: r.stats.principalVtal,
          qtd_principal_oemp: r.stats.principalOemp,
          qtd_secundario_uf: r.stats.secundarioUf,
          qtd_secundario_nacional: r.stats.secundarioNacional,
          circuitos_impactados: r.stats.circuitosImpactados,
          ufs_impactadas: r.stats.ufsImpactadas,
          arquivo_1link: file1?.name ?? null,
          arquivo_2links: file2?.name ?? null,
        }).select("id").single();
        setAnaliseId(analise?.id ?? null);
        const currentPayload = { version: ANALISE_ALGORITHM_VERSION, file1, file2, result: r, filters, analiseId: analise?.id ?? null };
        localStorage.setItem(ANALISE_STORAGE_KEY, JSON.stringify(currentPayload));
        await (supabase as any).from("analise_resultado_atual").upsert({
          id: "current",
          payload: currentPayload,
          updated_by: userData.user?.id ?? null,
          updated_at: new Date().toISOString(),
        });
        let persistedMassivas: { id: string; id_massiva: string }[] | null = null;
        let massivasParaInserir: Massiva[] = r.massivas;
        if (analise && r.massivas.length) {
          const minTs = Math.min(...r.massivas.map((m) => m.primeiro_ts));
          const maxTs = Math.max(...r.massivas.map((m) => m.primeiro_ts));
          const startRange = dayRangeFor(minTs).start;
          const endRange = dayRangeFor(maxTs).end;
          const allExisting: PersistedMassivaForDedupe[] = [];
          let from = 0;
          const pageSize = 1000;
          while (true) {
            const { data, error } = await supabase
              .from("massivas")
              .select("id,tipo_massiva,operadora,uf,qtd_circuitos,primeiro_alarme,ultimo_alarme,data_hora_abertura,circuito_pai")
              .gte("primeiro_alarme", startRange)
              .lte("primeiro_alarme", endRange)
              .range(from, from + pageSize - 1);
            if (error) throw error;
            if (!data?.length) break;
            allExisting.push(...(data as PersistedMassivaForDedupe[]));
            if (data.length < pageSize) break;
            from += pageSize;
          }
          const existingRows = allExisting;
          const existingKeys = new Set(existingRows.map(openMassivaReferenceFromDb));
          const batchKeys = new Set<string>();
          massivasParaInserir = r.massivas.filter((m) => {
            const key = openMassivaReferenceFromRows(m);
            if (
              existingKeys.has(key) ||
              batchKeys.has(key)
            ) return false;
            batchKeys.add(key);
            return true;
          });

          console.info("[consulta-massiva] deduplicacao", {
            detectadas: r.massivas.length,
            existentes_encontradas: existingRows.length,
            para_inserir: massivasParaInserir.length,
            duplicatas: r.massivas.length - massivasParaInserir.length,
          });

          if (massivasParaInserir.length === 0) {
            toast.info(`${r.massivas.length} massiva(s) duplicada(s) ignorada(s) no controle.`);
          } else {
            const { data: persistedData, error: massivasError } = await supabase.from("massivas").insert(massivasParaInserir.map((m) => {
            const control = massivaControlFields(m, r.rows);
            return {
              analise_id: analise.id,
              id_massiva: m.id_massiva,
              tipo_massiva: m.tipo_massiva,
              operadora: m.operadora,
              uf: m.uf,
              qtd_circuitos: m.qtd_circuitos,
              primeiro_alarme: new Date(m.primeiro_ts).toISOString(),
              ultimo_alarme: new Date(m.ultimo_ts).toISOString(),
              qtd_lotericas_isoladas: m.qtd_lotericas_isoladas ?? 0,
              cidade_epicentro: m.cidade_epicentro ?? null,
              uf_epicentro: m.uf_epicentro ?? null,
              sinalizacao_60km: m.sinalizacao_60km ?? null,
              raio_maximo_km: m.raio_maximo_km ?? null,
              mascara_texto: m.mascara_texto ?? null,
              circuito_pai: control.circuito_pai,
              consorcio_ul: control.consorcio_ul,
              tipo_link: control.tipo_link,
              chamado: control.chamado || null,
              inc: control.inc || null,
              data_hora_abertura: control.data_hora_abertura,
            };
          })).select("id,id_massiva");
          if (massivasError) throw massivasError;
          persistedMassivas = persistedData;

          const massivaDbIdByPublicId = new Map((persistedMassivas ?? []).map((m) => [m.id_massiva, m.id]));
          const circuitos = massivasParaInserir.flatMap((m) => {
            const massivaId = massivaDbIdByPublicId.get(m.id_massiva);
            if (!massivaId) return [];
            return getMassivaRows(m, r.rows).map((row) => ({
              massiva_id: massivaId,
              codigo_loterica: pickRowText(row, "Cód. da Lotérica", "CÃ³d. da LotÃ©rica", "Codigo da Loterica", "Código da Lotérica"),
              loterica: pickRowText(row, "Lotérica", "LotÃ©rica", "Loterica"),
              tipo_link: row.__tipoLink,
              cidade: pickRowText(row, "Cidade"),
              uf: row.__uf,
              telefone: pickRowText(row, "Telefone"),
              designacao: pickRowText(row, "Designação", "DesignaÃ§Ã£o", "Designacao"),
              ip_loopback: pickRowText(row, "IP Loopback"),
              data_hora: Number.isFinite(row.__ts) ? new Date(row.__ts).toISOString() : null,
              empresa: pickRowText(row, "Empresa", "Site Owner"),
              mensagem: pickRowText(row, "Mensagem"),
              alarme_id: pickRowText(row, "ID do Alarmes", "ID do Alarme"),
              regional: pickRowText(row, "Regional"),
              tecnologia: pickRowText(row, "Tecnologia"),
              operadora: row.__operadora,
              tipo_empresa: row.__tipoEmp || row.__classificacao,
              status: row.__situacao,
            }));
          });
          for (let i = 0; i < circuitos.length; i += 500) {
            const { error } = await supabase.from("massiva_circuitos").insert(circuitos.slice(i, i + 500));
            if (error) throw error;
          }
          if (massivasParaInserir.length < r.massivas.length) {
            toast.info(`${r.massivas.length - massivasParaInserir.length} massiva(s) duplicada(s) ignorada(s) no controle.`);
          }
          }
        }
        await logAudit("EXECUTAR_ANALISE", "analises", {
          massivas: r.massivas.length,
          massivas_salvas: (persistedMassivas ?? []).length,
          massivas_duplicadas: r.massivas.length - massivasParaInserir.length,
          registros: r.stats.totalRegistros,
          lotericas_isoladas: r.stats.lotericasIsoladas,
          geo: r.stats.geo,
        });
        for (const det of r.lotericasIsoladasDetalhe) {
          await logAudit("LOTERICA_ISOLADA_DETECTADA", "massivas", det);
        }
      } catch (e) {
        console.error("persist failed", e);
      }

      toast.success(`Análise em ${dt}ms — ${r.massivas.length} massivas detectadas`);
    }, 30);
  };

  const filterOptions = useMemo(() => {
    const rows = result?.rows ?? [];
    const uniq = (fn: (r: (typeof rows)[number]) => string) =>
      [...new Set(rows.map(fn).filter(Boolean))].sort();
    return {
      ufs: uniq((r) => r.__uf),
      operadoras: uniq((r) => r.__operadora),
      parceiras: uniq((r) => r.__parceira),
      empresas: uniq((r) => String(r["Empresa"] ?? "")),
      tecnologias: uniq((r) => String(r["Tecnologia"] ?? "")),
      siteOwners: uniq((r) => String(r["Site Owner"] ?? "")),
    };
  }, [result]);

  const filteredRows = useMemo(() => {
    if (!result) return [];
    const di = filters.dataInicial ? new Date(filters.dataInicial).getTime() : null;
    const df = filters.dataFinal ? new Date(filters.dataFinal).getTime() : null;
    const cidadeQ = filters.cidade.toLowerCase().trim();
    return result.rows.filter((r) => {
      if (filters.uf && r.__uf !== filters.uf) return false;
      if (cidadeQ && !String(r["Cidade"] ?? "").toLowerCase().includes(cidadeQ)) return false;
      if (filters.tipoLink && r.__tipoLink !== filters.tipoLink) return false;
      if (filters.tipoMassiva) {
        if (filters.tipoMassiva === "__nao") {
          if (r["Status Massiva"] !== "NAO_MASSIVA") return false;
        } else if (!String(r["Tipo Massiva"] ?? "").includes(filters.tipoMassiva)) return false;
      }
      if (filters.operadora && r.__operadora !== filters.operadora) return false;
      if (filters.parceira && r.__parceira !== filters.parceira) return false;
      if (filters.empresa && String(r["Empresa"] ?? "") !== filters.empresa) return false;
      if (filters.tecnologia && String(r["Tecnologia"] ?? "") !== filters.tecnologia) return false;
      if (filters.siteOwner && String(r["Site Owner"] ?? "") !== filters.siteOwner) return false;
      if (di != null && r.__ts < di) return false;
      if (df != null && r.__ts > df) return false;
      return true;
    });
  }, [result, filters]);

  const filteredMassivas = useMemo(() => {
    if (!result) return [];
    const ids = new Set(filteredRows.map((r) => r.__rowId));
    return result.massivas.filter((m) => m.rowIds.some((id) => ids.has(id)));
  }, [result, filteredRows]);

  // Extended dashboard stats (V13)
  const extStats = useMemo(() => {
    if (!result) {
      return {
        vtal: 0, oemp: 0, semChamado: 0, comChamado: 0,
        operadorasAfetadas: 0, parceirasAfetadas: 0,
        escDisponiveis: 0, escAusentes: 0,
      };
    }
    const impactRows = result.rows.filter((r) => r["Status Massiva"] === "MASSIVA");
    let sem = 0, com = 0;
    for (const r of impactRows) {
      const c = String(r["Chamado"] ?? "").trim();
      if (c) com++; else sem++;
    }
    const ops = new Set(impactRows.map((r) => r.__operadora).filter((v) => v && v !== "NAO_IDENTIFICADO"));
    const parc = new Set(result.massivas.map((m) => m.parceira).filter((v) => v && v !== "-" && v !== "VTAL"));
    let escDisp = 0;
    for (const m of result.massivas) {
      if (m.parceira && m.parceira !== "-" && escMap.get(m.parceira.toUpperCase())) escDisp++;
    }
    return {
      vtal: result.stats.principalVtal,
      oemp: result.stats.principalOemp,
      semChamado: sem,
      comChamado: com,
      operadorasAfetadas: ops.size,
      parceirasAfetadas: parc.size,
      escDisponiveis: escDisp,
      escAusentes: result.massivas.length - escDisp,
    };
  }, [result, escMap]);

  const massivasExport = useMemo(
    () => filteredMassivas.map((m) => {
      const esc = m.parceira ? escMap.get(m.parceira.toUpperCase()) : null;
      return {
        "ID Massiva": m.id_massiva, "Tipo Massiva": m.tipo_massiva,
        UF: m.uf, Operadora: m.operadora, Parceira: m.parceira,
        "Qtde Links Fora": m.qtd_circuitos,
        "Qtde Lotéricas Isoladas": m.qtd_lotericas_isoladas ?? 0,
        "Primeiro Alarme": m.primeiro_alarme, "Último Alarme": m.ultimo_alarme,
        "Janela (min)": m.janela_minutos,
        "Possui Escalonamento": esc ? "Sim" : "Não",
        "Responsável N1": esc?.n1_nome ?? "",
        "Sinalização 60 KM": m.sinalizacao_60km ? SINALIZACAO_LABEL[m.sinalizacao_60km] : "",
        "Cidade Epicentro": m.cidade_epicentro ?? "",
        "UF Epicentro": m.uf_epicentro ?? "",
        "Raio Máximo (km)": m.raio_maximo_km ?? 0,
        "Percentual Dentro 60 KM": (m.percentual_dentro_60km ?? 0) + "%",
        "Qtd Circuitos Dentro 60 KM": m.qtd_circuitos_dentro_60km ?? 0,
        "Qtd Circuitos Fora 60 KM": m.qtd_circuitos_fora_60km ?? 0,
        "Qtd Cidades Afetadas": m.qtd_cidades_afetadas ?? 0,
        "Cidades Afetadas": (m.cidades_afetadas ?? []).map((c) => `${c.cidade}/${c.uf} (${c.qtd})`).join(" | "),
        Status: openMassivasQ.isLoading
          ? "VERIFICANDO"
          : openMassivasQ.isError
            ? "NÃO VERIFICADO"
            : openMassivaKeys.has(openMassivaReferenceFromRows(m)) ? "EM TRATATIVA" : "NOVA",
      };
    }), [filteredMassivas, escMap, openMassivaKeys, openMassivasQ.isError, openMassivasQ.isLoading]);

  const reset = () => {
    setFile1(null);
    setFile2(null);
    setResult(null);
    setAnaliseId(null);
    setFilters(emptyFilters);
    localStorage.removeItem(ANALISE_STORAGE_KEY);
    void (supabase as any).from("analise_resultado_atual").delete().eq("id", "current");
  };

  const opsCount = operadorasConsultaUl.length;
  const lotCount = lotQ.data?.length ?? 0;
  const escCount = escQ.data?.length ?? 0;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 px-6 py-6">
      <h1 className="sr-only">Análise de Eventos de Alarme GIS — Correlação VTAL e OEMP</h1>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Activity className="h-3 w-3 text-noc-blue" />
        <span>Painel</span>
        <span aria-hidden>›</span>
        <span className="text-foreground">Análises</span>
        {result && (
          <>
            <span aria-hidden>›</span>
            <span className="font-mono">{result.stats.ultimaAtualizacao}</span>
            {analiseUsuario && (
              <>
                <span aria-hidden>›</span>
                <span className="font-mono truncate max-w-[200px]">{analiseUsuario}</span>
              </>
            )}
          </>
        )}
      </nav>

      {/* Base status strip */}
      <div className="flex flex-wrap items-center gap-3 text-[11px]">
        <span className="rounded-md border border-border bg-card px-2 py-1">
          <Network className="mr-1 inline h-3 w-3 text-noc-blue" />
          Operadoras Consulta UL: <span className="font-mono font-semibold">{lotQ.isLoading ? "…" : opsCount}</span>
        </span>
        <span className="rounded-md border border-border bg-card px-2 py-1">
          <Building2 className="mr-1 inline h-3 w-3 text-noc-blue" />
          Lotéricas: <span className="font-mono font-semibold">{lotQ.isLoading ? "…" : lotCount}</span>
        </span>
        <span className="rounded-md border border-border bg-card px-2 py-1">
          <Shield className="mr-1 inline h-3 w-3 text-noc-green" />
          Escalonamentos: <span className="font-mono font-semibold">{escQ.isLoading ? "…" : escCount}</span>
        </span>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => setHelpOpen(true)}>
          <HelpCircle className="h-3.5 w-3.5" /> Regras de detecção
        </Button>
        {(file1 || file2 || result) && (
          <Button variant="outline" size="sm" className="ml-auto" onClick={reset}>
            <Trash2 className="h-4 w-4" /> Nova análise
          </Button>
        )}
      </div>

      {/* Uploads + processar */}
      <section className="grid gap-4 md:grid-cols-3">
        <UploadCard
          label="GIS 1 LINK" sublabel="Alarmes 1 link fora"
          loaded={file1 && { name: file1.name, count: file1.count }}
          accent="red" onFile={(f) => onUploadGis("1_LINK", f)}
        />
        <UploadCard
          label="GIS 2 LINKS" sublabel="Alarmes 2 links fora"
          loaded={file2 && { name: file2.name, count: file2.count }}
          accent="yellow" onFile={(f) => onUploadGis("2_LINKS", f)}
        />
        <div className="flex flex-col gap-3 rounded-xl border border-noc-blue/40 bg-card p-5 shadow-[0_0_24px_-12px_var(--noc-blue)]">
          <div className="text-sm font-semibold uppercase tracking-wide">Processar</div>
          <div className="text-xs text-muted-foreground">
            PRINCIPAL VTAL ≥5/UF · PRINCIPAL OEMP ≥5/UF/operadora · SECUNDARIO ≥15/UF · ≥50/Nacional · Janela 15 min
          </div>
          <Button onClick={runAnalysis} disabled={processing || (!file1 && !file2) || lotQ.isLoading} className="mt-auto">
            <Play className="h-4 w-4" />
            {processing ? "Processando..." : "Executar análise"}
          </Button>
        </div>
      </section>

      {result && (
        <>
          <Accordion type="multiple" defaultValue={["massivas", "circuitos", "geo"]} className="space-y-2">
            <AccordionItem value="massivas" className="rounded-xl border border-border bg-card px-4">
              <AccordionTrigger className="text-xs font-semibold uppercase tracking-wider hover:no-underline">
                <span className="flex items-center gap-2"><Flame className="h-4 w-4 text-noc-red" /> Massivas</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-3 pb-2 md:grid-cols-2 lg:grid-cols-4">
                  <StatCard label="Principal VTAL" value={extStats.vtal} icon={Flame} tone="blue" />
                  <StatCard label="Principal OEMP" value={extStats.oemp} icon={AlertTriangle} tone="red" />
                  <StatCard label="Sec. UF" value={result.stats.secundarioUf} icon={Network} tone="yellow" />
                  <StatCard label="Sec. Nacional" value={result.stats.secundarioNacional} icon={Globe2} tone="blue" />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="circuitos" className="rounded-xl border border-border bg-card px-4">
              <AccordionTrigger className="text-xs font-semibold uppercase tracking-wider hover:no-underline">
                <span className="flex items-center gap-2"><RadioTower className="h-4 w-4 text-noc-blue" /> Circuitos</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-3 pb-2 md:grid-cols-2 lg:grid-cols-4">
                  <StatCard label="Circuitos Impactados" value={result.stats.circuitosImpactados} icon={RadioTower} tone="muted" sub={`de ${result.stats.totalRegistros} registros`} />
                  <StatCard label="UFs Impactadas" value={result.stats.ufsImpactadas} icon={MapPin} tone="muted" />
                  <StatCard label="Não Identificados" value={result.stats.naoIdentificados} icon={HelpCircle} tone="muted" sub="circuitos sem operadora" />
                  <StatCard label="Sem Chamado" value={extStats.semChamado} icon={XCircle} tone="red" sub="circuitos impactados" />
                  <StatCard label="Com Chamado" value={extStats.comChamado} icon={CheckCircle2} tone="blue" sub="circuitos impactados" />
                  <StatCard label="Lotéricas Isoladas" value={result.stats.lotericasIsoladas} icon={AlertOctagon} tone={result.stats.lotericasIsoladas > 0 ? "critical" : "yellow"} sub="dentro de massivas" />
                  <StatCard label="Circuitos Isolados" value={result.stats.circuitosIsolados} icon={RadioTower} tone={result.stats.circuitosIsolados > 0 ? "critical" : "muted"} sub="fora de massivas" />
                  <StatCard label="Operadoras Afetadas" value={extStats.operadorasAfetadas} icon={Building2} tone="muted" />
                  <StatCard label="Parceiras Afetadas" value={extStats.parceirasAfetadas} icon={Network} tone="muted" />
                  <StatCard label="Escalon. Disponíveis" value={extStats.escDisponiveis} icon={Shield} tone="blue" sub="massivas com matriz" />
                  <StatCard label="Escalon. Ausentes" value={extStats.escAusentes} icon={ShieldOff} tone="yellow" sub="massivas sem matriz" />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="geo" className="rounded-xl border border-border bg-card px-4">
              <AccordionTrigger className="text-xs font-semibold uppercase tracking-wider hover:no-underline">
                <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-noc-green" /> Geolocalização (raio de 60 km)</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-3 pb-2 md:grid-cols-2 lg:grid-cols-4">
                  <StatCard label="Dentro 60 KM" value={result.stats.geo.dentro60km} icon={MapPin} tone="blue" sub="concentração geográfica" />
                  <StatCard label="Parcialmente" value={result.stats.geo.parcial60km} icon={MapPin} tone="yellow" sub="50% a 79% no raio" />
                  <StatCard label="Fora 60 KM" value={result.stats.geo.fora60km} icon={MapPin} tone="red" sub="circuitos dispersos" />
                  <StatCard label="Sem Geo" value={result.stats.geo.semGeo} icon={MapPin} tone="muted" sub={result.stats.geo.baseUsada ? `${result.stats.geo.cidadesNaoEncontradas} cidades sem coord.` : "Base de cidades não carregada"} />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <SlidersHorizontal className="h-4 w-4" />
                {filtersOpen ? "Ocultar filtros" : "Mostrar filtros"}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <FiltersBar filters={filters} setFilters={setFilters} options={filterOptions} />
            </CollapsibleContent>
          </Collapsible>

          <section className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-5 rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between gap-2 border-b border-border p-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-noc-blue" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide">Massivas ({filteredMassivas.length})</h2>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => exportToCsv(massivasExport, "massivas.csv")}>CSV</Button>
                  <Button size="sm" variant="outline" onClick={() => exportToXlsx(massivasExport, "massivas.xlsx")}><Download className="h-3.5 w-3.5" /> XLSX</Button>
                  <Button size="sm" variant="outline" onClick={() => exportToPdf(massivasExport, "massivas.pdf", "Massivas Detectadas")}><FileText className="h-3.5 w-3.5" /> PDF</Button>
                </div>
              </div>
              <div className="max-h-[560px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border text-left">
                      <th className="px-3 py-2 font-semibold">ID</th>
                      <th className="px-3 py-2 font-semibold">Tipo</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold">UF</th>
                      <th className="px-3 py-2 font-semibold">Operadora</th>
                      <th className="px-3 py-2 font-semibold text-right">Links</th>
                      <th className="px-3 py-2 font-semibold text-right">Isoladas</th>
                      <th className="px-3 py-2 font-semibold">Sinalização 60 KM</th>
                      <th className="px-3 py-2 font-semibold">Epicentro</th>
                      <th className="px-3 py-2 font-semibold text-right">Raio</th>
                      <th className="px-3 py-2 font-semibold text-right">% 60 KM</th>
                      <th className="px-3 py-2 font-semibold">Primeiro</th>
                      <th className="px-3 py-2 font-semibold">Último</th>
                      <th className="px-3 py-2 font-semibold text-right">Janela</th>
                      <th className="px-3 py-2 font-semibold text-right">Máscara</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMassivas.length === 0 && (
                      <tr><td colSpan={15} className="px-3 py-10 text-center text-muted-foreground">Nenhuma massiva detectada.</td></tr>
                    )}
                    {filteredMassivas.map((m) => (
                      <tr key={m.id_massiva} onClick={() => setDrill(m)} className="cursor-pointer border-b border-border/50 hover:bg-accent/40">
                        <td className="px-3 py-2 font-mono">{m.id_massiva}</td>
                        <td className="px-3 py-2"><MassivaBadge tipo={m.tipo_massiva} /></td>
                        <td className="px-3 py-2">
                          {openMassivasQ.isLoading ? (
                            <span className="inline-flex rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              VERIFICANDO
                            </span>
                          ) : openMassivasQ.isError ? (
                            <span className="inline-flex rounded-md border border-red-400/50 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-300">
                              NÃO VERIFICADO
                            </span>
                          ) : openMassivaKeys.has(openMassivaReferenceFromRows(m)) ? (
                            <span className="inline-flex rounded-md border border-amber-400/50 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-200">
                              EM TRATATIVA
                            </span>
                          ) : (
                            <span className="inline-flex rounded-md border border-cyan-400/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-700 dark:text-cyan-300">
                              NOVA
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono font-semibold">{m.uf}</td>
                        <td className="px-3 py-2 font-mono">{m.operadora}</td>
                        <td className="px-3 py-2 text-right font-mono">{m.qtd_circuitos}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {m.qtd_lotericas_isoladas ? (
                            <span className="inline-flex items-center justify-end gap-1 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-200 border border-red-400/60 shadow-[0_0_16px_rgba(248,113,113,0.22)]">
                              <AlertOctagon className="h-3 w-3" />{String(m.qtd_lotericas_isoladas).padStart(2, "0")}
                            </span>
                          ) : "00"}
                        </td>
                        <td className="px-3 py-2"><Sinalizacao60kmBadge sinalizacao={m.sinalizacao_60km} raioKm={m.raio_maximo_km} /></td>
                        <td className="px-3 py-2 font-mono text-[11px]">{m.cidade_epicentro ? `${m.cidade_epicentro}/${m.uf_epicentro}` : "-"}</td>
                        <td className="px-3 py-2 text-right font-mono">{m.sinalizacao_60km === "SEM_GEO" ? "-" : `${m.raio_maximo_km ?? 0} km`}</td>
                        <td className="px-3 py-2 text-right font-mono">{m.sinalizacao_60km === "SEM_GEO" ? "-" : `${m.percentual_dentro_60km ?? 0}%`}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{m.primeiro_alarme}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{m.ultimo_alarme}</td>
                        <td className="px-3 py-2 text-right font-mono">{m.janela_minutos}m</td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(m.mascara_texto ?? "");
                              toast.success("Mascara copiada");
                            }}
                          >
                            Copiar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </section>
        </>
      )}

      {!result && (
        <section className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
          <Radar className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">Aguardando dados de entrada</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Carregue os arquivos GIS e execute a análise. Bases de Operadoras e Escalonamentos já estão carregadas do banco.
          </p>
        </section>
      )}

      <DrillDownModal
        open={!!drill} onClose={() => setDrill(null)} massiva={drill}
        rows={result?.rows ?? []}
        escalonamento={drill?.parceira ? escMap.get(drill.parceira.toUpperCase()) ?? null : null}
      />


      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Regras de detecção de massiva</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p><b>Janela de correlação:</b> 15 minutos (deslizante).</p>
            <ul className="list-disc space-y-1 pl-5 text-xs">
              <li><b>PRINCIPAL VTAL</b> — ≥ 5 alarmes PRINCIPAL na mesma UF e operadora VTAL.</li>
              <li><b>PRINCIPAL OEMP</b> — ≥ 5 alarmes PRINCIPAL na mesma UF e mesma parceira (≠ VTAL).</li>
              <li><b>SECUNDÁRIO UF</b> — ≥ 15 alarmes SECUNDARIO na mesma UF.</li>
              <li><b>SECUNDÁRIO NACIONAL</b> — ≥ 50 alarmes SECUNDARIO em qualquer UF.</li>
            </ul>
            <p className="text-xs text-muted-foreground">
              O raio de 60 km é sinalização <b>informativa</b> e nunca altera o status MASSIVA/NÃO_MASSIVA.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
