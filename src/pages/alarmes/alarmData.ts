import { supabase } from "@/integrations/supabase/client";

export type AlarmSource = "jira" | "gis";
export type AlarmPreset =
  | "all"
  | "principal"
  | "principal_oemp"
  | "principal_oi"
  | "backup"
  | "backup_4g"
  | "backup_sencinet"
  | "desempenho";

export type TimeBucketKey = "all" | "ate_100" | "acima_100" | "acima_300" | "acima_500" | "acima_1000";

export interface AlarmRecord {
  key: string;
  source: AlarmSource;
  sourceId: string;
  codUl: string;
  nomeLoterica: string;
  tipoFalha: string;
  status: string;
  statusAux: string;
  createdAt: string | null;
  tempoHoras: number;
  linkCategory: "principal" | "backup" | "outros";
  resumo: string;
  linkOfensor: string;
  siteOwner: string;
  empresa: string;
  empresaOemp: string;
  operadora4g: string;
  respBackup: string;
  cctoOi: string;
  cctoOemp: string;
  designacao: string;
  tecnologia: string;
  nIncidenteMam: string;
  chamado: string;
  jiraChave: string;
  gisAlarmeId: string;
  raw: any;
}

export interface AlarmDatasets {
  lotericas: any[];
  jira: any[];
  falhas: any[];
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = toText(value);
  if (!text) return 0;
  const normalized = text.replace(/\./g, "").replace(/,/g, ".");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

function normalizeText(value: unknown): string {
  return toText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function hoursSince(value: unknown): number {
  const d = parseDate(value);
  if (!d) return 0;
  const diff = Date.now() - d.getTime();
  if (!Number.isFinite(diff)) return 0;
  return Math.max(0, Math.floor(diff / 36e5));
}

function pickRaw(raw: any, keys: string[]): string {
  if (!raw || typeof raw !== "object") return "";
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) return toText((raw as any)[key]);
  }
  return "";
}

async function fetchAllRows(table: string, selectList = "*") {
  const rows: any[] = [];
  let from = 0;
  const size = 1000;

  while (true) {
    const { data, error } = await (supabase as any)
      .from(table)
      .select(selectList)
      .range(from, from + size - 1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < size) break;
    from += size;
  }

  return rows;
}

export async function fetchAlarmDatasets(): Promise<AlarmDatasets> {
  const [lotericas, jira, falhas] = await Promise.all([
    fetchAllRows(
      "macro_base_alarmes",
      "cod_ul,nome_loterica,ccto_oi,ccto_oemp,designacao_nova,operadora,raw_data,status,cidade,uf",
    ),
    fetchAllRows(
      "jira_abertos",
      "chave,cod_ul,resumo,tipo_falha,status,criado,n_incidente_mam,n_req_caixa,site_owner,descricao",
    ),
    fetchAllRows(
      "falhas_gis",
      "record_key,id_alarme,cod_ul,loterica,tipo_link,cidade,uf,designacao,data_hora_inicial,duracao_horas,empresa,categoria_gis,categoria_gis_secundaria,chamado,status,status_secundario,situacao,tecnologia,site_owner,previsao_atendimento",
    ),
  ]);

  return { lotericas, jira, falhas };
}

function inferJiraLinkCategory(jira: any, loterica: any): AlarmRecord["linkCategory"] {
  const text = normalizeText([
    jira.tipo_falha,
    jira.resumo,
    jira.descricao,
    jira.status,
    jira.site_owner,
    pickRaw(loterica?.raw_data, ["RESP BACKUP", "OWNER", "PERIMETRO", "PER\u00CDMETRO"]),
  ].filter(Boolean).join(" | "));

  if (
    text.includes("BACKUP") ||
    text.includes("4G") ||
    text.includes("SIM CARD") ||
    text.includes("VSAT") ||
    text.includes("SENCINET") ||
    text.includes("TIM")
  ) {
    return "backup";
  }
  if (text.includes("PRINCIPAL") || text.includes("OEMP") || text.includes("OI")) {
    return "principal";
  }
  return "outros";
}

function inferTipoFalhaJira(jira: any): string {
  const tipo = toText(jira.tipo_falha);
  if (tipo) return tipo;
  const resumo = normalizeText(jira.resumo);
  if (resumo.includes("PRINCIPAL")) return "LINK PRINCIPAL";
  if (resumo.includes("BACKUP")) return "LINK BACKUP";
  if (resumo.includes("INTERMITENCIA")) return "INTERMITENCIA";
  return "SEM TIPO INFORMADO";
}

function buildLinkOfensor(record: Partial<AlarmRecord>) {
  return (
    record.designacao ||
    record.cctoOi ||
    record.cctoOemp ||
    record.linkOfensor ||
    record.codUl ||
    record.jiraChave ||
    record.gisAlarmeId ||
    record.resumo ||
    "-"
  );
}

export function buildAlarmRecords(data: AlarmDatasets): AlarmRecord[] {
  const byCodUl = new Map<string, any>();
  for (const lot of data.lotericas || []) {
    const key = toText(lot.cod_ul);
    if (key) byCodUl.set(key, lot);
  }

  const jiraRecords: AlarmRecord[] = (data.jira || []).map((jira: any) => {
    const codUl = toText(jira.cod_ul);
    const lot = byCodUl.get(codUl);
    const raw = lot?.raw_data || {};
    const cctoOi = toText(lot?.ccto_oi);
    const cctoOemp = toText(lot?.ccto_oemp);
    const designacao = toText(lot?.designacao_nova);

    const base: AlarmRecord = {
      key: `jira:${toText(jira.chave)}`,
      source: "jira",
      sourceId: toText(jira.chave),
      codUl,
      nomeLoterica: toText(lot?.nome_loterica),
      tipoFalha: inferTipoFalhaJira(jira),
      status: toText(jira.status),
      statusAux: "",
      createdAt: jira.criado ? String(jira.criado) : null,
      tempoHoras: hoursSince(jira.criado),
      linkCategory: inferJiraLinkCategory(jira, lot),
      resumo: toText(jira.resumo),
      linkOfensor: "",
      siteOwner: toText(jira.site_owner),
      empresa: "",
      empresaOemp: pickRaw(raw, ["EMPRESA OEMP"]),
      operadora4g: toText(lot?.operadora) || pickRaw(raw, ["OPERADORA 4G"]),
      respBackup: pickRaw(raw, ["RESP BACKUP"]),
      cctoOi,
      cctoOemp,
      designacao,
      tecnologia: pickRaw(raw, ["TECNOLOGIA"]),
      nIncidenteMam: toText(jira.n_incidente_mam),
      chamado: "",
      jiraChave: toText(jira.chave),
      gisAlarmeId: "",
      raw: jira,
    };

    base.linkOfensor = buildLinkOfensor(base);
    return base;
  });

  const gisRecords: AlarmRecord[] = (data.falhas || []).map((gis: any) => {
    const codUl = toText(gis.cod_ul);
    const lot = byCodUl.get(codUl);
    const raw = lot?.raw_data || {};
    const tipoLinkNorm = normalizeText(gis.tipo_link);
    const linkCategory: AlarmRecord["linkCategory"] = tipoLinkNorm.includes("BACKUP")
      ? "backup"
      : tipoLinkNorm.includes("PRINCIPAL")
        ? "principal"
        : "outros";

    const base: AlarmRecord = {
      key: `gis:${toText(gis.record_key) || toText(gis.id_alarme)}`,
      source: "gis",
      sourceId: toText(gis.id_alarme) || toText(gis.record_key),
      codUl,
      nomeLoterica: toText(gis.loterica) || toText(lot?.nome_loterica),
      tipoFalha: toText(gis.categoria_gis) || toText(gis.categoria_gis_secundaria) || "ALARME GIS",
      status: toText(gis.status),
      statusAux: [toText(gis.status_secundario), toText(gis.situacao)].filter(Boolean).join(" | "),
      createdAt: gis.data_hora_inicial ? String(gis.data_hora_inicial) : null,
      tempoHoras: Math.max(0, Math.floor(toNumber(gis.duracao_horas))),
      linkCategory,
      resumo: toText(gis.chamado),
      linkOfensor: "",
      siteOwner: toText(gis.site_owner),
      empresa: toText(gis.empresa),
      empresaOemp: pickRaw(raw, ["EMPRESA OEMP"]),
      operadora4g: toText(lot?.operadora) || pickRaw(raw, ["OPERADORA 4G"]),
      respBackup: pickRaw(raw, ["RESP BACKUP"]),
      cctoOi: toText(lot?.ccto_oi),
      cctoOemp: toText(lot?.ccto_oemp),
      designacao: toText(gis.designacao) || toText(lot?.designacao_nova),
      tecnologia: toText(gis.tecnologia) || pickRaw(raw, ["TECNOLOGIA"]),
      nIncidenteMam: "",
      chamado: toText(gis.chamado),
      jiraChave: "",
      gisAlarmeId: toText(gis.id_alarme),
      raw: gis,
    };

    base.linkOfensor = buildLinkOfensor(base);
    return base;
  });

  return [...jiraRecords, ...gisRecords].sort((a, b) => b.tempoHoras - a.tempoHoras);
}

export function matchesTimeBucket(hours: number, bucket: TimeBucketKey) {
  if (bucket === "all") return true;
  if (bucket === "ate_100") return hours <= 100;
  if (bucket === "acima_100") return hours > 100;
  if (bucket === "acima_300") return hours > 300;
  if (bucket === "acima_500") return hours > 500;
  if (bucket === "acima_1000") return hours > 1000;
  return true;
}

function containsAny(text: string, terms: string[]) {
  const n = normalizeText(text);
  return terms.some((term) => n.includes(normalizeText(term)));
}

function is4GTarget(record: AlarmRecord) {
  const op = normalizeText(record.operadora4g);
  return op.includes("VIVO") || op.includes("ARQIA") || op.includes("BRISANET");
}

function isSencinetTarget(record: AlarmRecord) {
  const joined = [record.respBackup, record.operadora4g, record.tecnologia, record.siteOwner, record.resumo].join(" | ");
  return containsAny(joined, ["VSAT", "TIM"]);
}

export function matchesPreset(record: AlarmRecord, preset: AlarmPreset) {
  const statusJoined = [record.status, record.statusAux].join(" | ");

  switch (preset) {
    case "all":
      return true;
    case "principal":
      return record.linkCategory === "principal";
    case "principal_oemp":
      return containsAny(statusJoined, ["OEMP"]);
    case "principal_oi":
      return containsAny(statusJoined, ["OI LEGADO", "AGUARDANDO OI"]);
    case "backup":
      return record.linkCategory === "backup";
    case "backup_4g":
      return record.linkCategory === "backup" && is4GTarget(record);
    case "backup_sencinet":
      return record.linkCategory === "backup" && isSencinetTarget(record);
    case "desempenho":
      return record.source === "gis" && containsAny(record.tipoFalha, ["DESEMPENHO"]);
    default:
      return true;
  }
}

export function formatDateTime(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR");
}

export function summarizeOffenders(records: AlarmRecord[]) {
  const offenders = records.filter((r) => r.tempoHoras > 200);
  const byKey = new Map<string, AlarmRecord>();

  offenders.forEach((r) => {
    const key = `${r.codUl}|${r.linkOfensor}|${r.source}`;
    const existing = byKey.get(key);
    if (!existing || r.tempoHoras > existing.tempoHoras) {
      byKey.set(key, r);
    }
  });

  return Array.from(byKey.values()).sort((a, b) => b.tempoHoras - a.tempoHoras);
}

export function timeBucketCounts(records: AlarmRecord[]) {
  return {
    total: records.length,
    ate_100: records.filter((r) => r.tempoHoras <= 100).length,
    acima_100: records.filter((r) => r.tempoHoras > 100).length,
    acima_300: records.filter((r) => r.tempoHoras > 300).length,
    acima_500: records.filter((r) => r.tempoHoras > 500).length,
    acima_1000: records.filter((r) => r.tempoHoras > 1000).length,
    jira: records.filter((r) => r.source === "jira").length,
    gis: records.filter((r) => r.source === "gis").length,
  };
}

export function searchAlarmRecord(record: AlarmRecord, search: string) {
  if (!search.trim()) return true;
  const term = normalizeText(search);
  const haystack = normalizeText([
    record.codUl,
    record.nomeLoterica,
    record.tipoFalha,
    record.status,
    record.statusAux,
    record.linkOfensor,
    record.jiraChave,
    record.gisAlarmeId,
    record.cctoOi,
    record.cctoOemp,
    record.operadora4g,
    record.respBackup,
    record.empresaOemp,
  ].join(" | "));
  return haystack.includes(term);
}
