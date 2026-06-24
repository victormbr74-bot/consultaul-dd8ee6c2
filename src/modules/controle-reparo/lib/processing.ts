import { type Row, getVal, cleanVal, cleanText, removeCef, normCodigo, normKey } from "./parse";

export type Situacao = string;

function sanitizeSituacao(v: string): Situacao | null {
  const s = cleanText(v);
  return isInvalidTechnicalValue(s) ? null : s;
}

const STATUS_PLANILHA_PADRAO = "CEC ANALISANDO";

/** Lista oficial controlada de STATUS PLANILHA. */
export const STATUS_PLANILHA_OPCOES = [
  STATUS_PLANILHA_PADRAO,
  "EQUIPAMENTO DESLIGADO / PORTA DESCONECTADA",
  "FIBRA",
  "FONTE DO ROTEADOR QUEIMADA",
  "LINK 4G ARQIA - NECESSÁRIO VISITA TÉCNICA",
  "LINK 4G TIM - NECESSÁRIO VISITA TÉCNICA",
  "LINK 4G TIM - TRATATIVA SENCINET",
  "LINK 4G VIVO - NECESSÁRIO VISITA TÉCNICA",
  "LINK FIBRA - TRATATIVA BRISANET",
  "LINK SATÉLITE - NECESSÁRIO VISITA TÉCNICA",
  "LINK SATÉLITE - TRATATIVA SENCINET",
  "MIGRAÇÃO DE COBRE PARA FIBRA",
  "ROTEADOR",
  "SEM MIKROTIK, RETIRADA INDEVIDA",
  "TROCA DE CHIP",
  "TROCA DE MODEM",
  "RETIRAR DA BLINDAGEM",
  "PENDENCIA INFRA CLIENTE",
  "NORMALIZADO",
  "MASSIVA",
  "TROCA DO KIT ELSYS",
  "CABO DE REDE",
  "MUDANÇA DE ENDEREÇO",
  "NÃO É REPARO",
] as const;

const STATUS_PLANILHA_CANONICO = new Map(
  STATUS_PLANILHA_OPCOES.map((status) => [normKey(status), status]),
);

function normalizeStatusPlanilha(value: string | null | undefined): string {
  const key = normKey(cleanText(value ?? ""));
  return (key && STATUS_PLANILHA_CANONICO.get(key)) || STATUS_PLANILHA_PADRAO;
}

/** Backup/secundário quando o tipo de link indica isso (item 2/12). */
export function normalizeTipoLink(tipoLink: string | null | undefined): string {
  const raw = cleanText(tipoLink ?? "");
  const key = normKey(raw);
  if (!key) return "";
  if (/backup|secund|secundario|redund|contingencia/.test(key)) return "SECUNDÁRIO";
  if (/principal|primario|primar|main/.test(key)) return "PRINCIPAL";
  return raw.toUpperCase();
}

export function isLinkBackup(tipoLink: string | null | undefined): boolean {
  return normalizeTipoLink(tipoLink) === "SECUNDÁRIO";
}

export interface ControleRow {
  id?: string;
  data_referencia: string;
  versao: number;
  chave: string;
  codigo_loterica: string;
  loterica: string | null;
  tipo_link: string | null;
  uf: string | null;
  cidade: string | null;
  designacao: string | null;
  ip_loopback: string | null;
  data_hora_inicial: string | null;
  duracao_h: number | null;
  chamado: string | null;
  previsao_atendimento: string | null;
  ultimo_comentario: string | null;
  grafana: string | null;
  empresa: string | null;
  designacao_parceiro: string | null;
  fila_jira: string | null;
  inc_snow: string | null;
  incidente_mam: string | null;
  ordem: string | null;
  novo_circuito: string | null;
  situacao: Situacao | null;
  status_planilha: string | null;
  status_jira: string | null;
  obs: string | null;
  responsavel: string | null;
  responsavel_backup: string | null;
  status_zabbix: string | null;
  status_normalizacao: "ATIVO" | "NORMALIZADO";
  normalizado_em: string | null;
  pendente_enriquecimento: boolean;
  tem_os_reparo: boolean;
}

export interface ImplantacaoRow {
  codigo_loterica: string;
  loterica: string | null;
  status_censitec: string | null;
  analise_tipo: string | null;
  parceira: string | null;
  fase: string | null;
  evento: string | null;
  data_atualizacao: string | null;
  novo_circuito: string | null;
  nova_designacao: string | null;
}

export interface ProcessInput {
  gis1: Row[];
  gis2: Row[];
  controleD1: Row[];
  jira: Row[];
  grafana: Row[];
  planta: Row[];
  profileNames: string[];
  versao?: number;
  manualEditFieldsByChave?: Record<string, string[]>;
  dataReferencia: string;
  processadoEm?: string;
  processadoEmLocal?: string;
  timezone?: string;
  /** existing controle rows from previous days + same day (for inheritance & normalization) */
  prior: ControleRow[];
}

export interface ProcessResult {
  controle: ControleRow[];
  implantacoes: ImplantacaoRow[];
  stats: {
    consolidado: number;
    normalizados: number;
    comJira: number;
    comGrafana: number;
    comOs: number;
    report: ProcessReport;
  };
}

export interface ProcessReport {
  processamento: {
    dataReferencia: string;
    processadoEm: string;
    processadoEmLocal: string;
    timezone: string;
  };
  gis: {
    gis1: number;
    gis2: number;
    bruto: number;
    finalAtivos: number;
    diferenca: number;
    duplicadosReaisRemovidos: number;
    colisoesEvitadas: number;
  };
  d1: {
    total: number;
    situacaoReparo: number;
    ordemReparo: number;
    cruzados: number;
    herdouSituacaoReparo: number;
    situacaoHerdada: number;
    situacaoFallbackReparo: number;
  };
  jira: {
    total: number;
    cruzados: number;
    incValidos: number;
    semInc: number;
    colunasDetectadas: string[];
    incSnowColunaOrigem: string | null;
    incSnowColunaNaoLocalizada: boolean;
    filaJiraPreenchida: number;
    filaJiraVazia: number;
    filaJiraSemInc: number;
    filaJiraVaziaExemplos: Array<{
      codigo_loterica: string;
      chamado: string | null;
      motivo: string;
    }>;
    semIncAte24h: {
      total: number;
      obsSemInc: number;
      responsavelSemInc: number;
      filaJiraSemInc: number;
      statusPlanilhaCecAnalisando: number;
      exemplos: Array<{
        chave: string;
        codigo_loterica: string;
        chamado: string | null;
        data_hora_inicial: string | null;
        duracao_h: number | null;
      }>;
    };
    incSnowPreenchido: number;
    incSnowVazio: number;
    incSnowIgnoradoInvalido: number;
    incSnowUsandoChave: number;
  };
  grafana: {
    cruzados: number;
    comPostos: number;
    colunaPosto: string | null;
    exemplosPosto: string[];
  };
  responsaveis: {
    secundarioTotal: number;
    secundario: Record<string, number>;
    secundarioPreservadoD1: number;
    oiTotal: number;
    oi: Record<string, number>;
    oiPreservadoD1: number;
    oempTotal: number;
    oempDistribuidos: number;
    oemp: Record<string, number>;
    semInc: number;
  };
  resultado: {
    totalControle: number;
    situacaoDistribuicao: Record<string, number>;
    ordemDistribuicao: Record<string, number>;
    situacaoReparo: number;
    ordemReparo: number;
    ordemConvertidaReparo: number;
    statusPlanilhaCecAnalisando: number;
    oemp: number;
    comOs: number;
    principal: number;
    secundario: number;
    normalizados: number;
  };
}

const EDITAVEIS = [
  "ordem",
  "novo_circuito",
  "situacao",
  "status_planilha",
  "status_jira",
  "obs",
  "responsavel",
  "status_zabbix",
] as const;

const EDITAVEIS_ADMIN = [
  "codigo_loterica",
  "loterica",
  "tipo_link",
  "uf",
  "designacao",
  "ip_loopback",
  "data_hora_inicial",
  "duracao_h",
  "chamado",
  "previsao_atendimento",
  "ultimo_comentario",
  "ordem",
  "novo_circuito",
  "grafana",
  "empresa",
  "designacao_parceiro",
  "responsavel_backup",
  "situacao",
  "status_planilha",
  "status_jira",
  "obs",
  "responsavel",
  "fila_jira",
  "inc_snow",
  "incidente_mam",
  "status_zabbix",
] as const;

const MANUAIS_PRESERVAVEIS = Array.from(new Set([...EDITAVEIS, ...EDITAVEIS_ADMIN]));

const HERDAVEIS_OPERACIONAIS = [...EDITAVEIS] as const;

const STATUS_PLANILHA_FIELD = "status_planilha";

function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 60000) return null;
  const wholeDays = Math.floor(serial);
  const fraction = serial - wholeDays;
  const utcMs = Math.round((wholeDays - 25569 + fraction) * 86400 * 1000);
  const d = new Date(utcMs);
  return isNaN(d.getTime()) ? null : d;
}

function toIso(v: string): string | null {
  const s = cleanText(v);
  if (!s) return null;
  const serial = Number(s.replace(",", "."));
  if (Number.isFinite(serial) && serial > 20000 && serial < 60000) {
    const d = excelSerialToDate(serial);
    return d ? d.toISOString() : null;
  }
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? "00"}`);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{2,4})[ ,]+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
    const d = new Date(`${yr}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6] ?? "00"}`);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${s}T00:00:00.000Z`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function cleanJiraInternalComment(v: string): string | null {
  const cleaned = cleanVal(v)
    .replace(/\*Coment[aá]rio Interno\*/gi, " ")
    .replace(/!image-[^!]*!/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

function cleanJiraObs(v: string): string | null {
  const cleaned = cleanVal(v)
    .replace(/\*Coment[aá]rio Interno\*/gi, " ")
    .replace(/!image-[^!]*!/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

function cleanSpreadsheetDisplayValue(v: string): string | null {
  const s = cleanVal(v);
  if (!s) return null;
  const serial = Number(s.replace(",", "."));
  const looksLikeExcelDate =
    /^\d{5}[,.]\d+$/.test(s) || (/^\d{5}$/.test(s) && serial >= 35000 && serial <= 60000);
  if (looksLikeExcelDate) {
    const d = excelSerialToDate(serial);
    if (d) return d.toLocaleString("pt-BR");
  }
  return s;
}

function toNum(v: string): number | null {
  const s = cleanText(v)
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  if (!s) return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

const INVALID_TECHNICAL_KEYS = new Set([
  "na",
  "nd",
  "nulo",
  "null",
  "nan",
  "vazio",
  "naoinformado",
  "seminformacao",
  "semvalor",
  "semregistro",
  "indisponivel",
]);

function isInvalidTechnicalValue(v: string | null | undefined): boolean {
  const s = cleanText(v ?? "");
  if (!s) return true;
  if (/^[-_.\s]+$/.test(s)) return true;
  return INVALID_TECHNICAL_KEYS.has(normKey(s));
}

function cleanTechnicalValue(v: string | null | undefined): string {
  const s = cleanText(v ?? "");
  return isInvalidTechnicalValue(s) ? "" : s;
}

function normalizeKeyPart(v: string | null | undefined): string {
  return cleanTechnicalValue(v).replace(/\s+/g, "").toUpperCase();
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase();
}

function hashRow(row: Row, salt = ""): string {
  const payload = Object.keys(row)
    .sort((a, b) => normKey(a).localeCompare(normKey(b)))
    .map((key) => `${normKey(key)}=${cleanText(String(row[key] ?? ""))}`)
    .join("|");
  return `GISROW${stableHash(`${salt}|${payload}`)}`;
}

function uniqueTechnicalParts(parts: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const value = cleanTechnicalValue(part);
    const key = normalizeKeyPart(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function addDistribution(map: Record<string, number>, raw: string | null | undefined): void {
  const key = cleanText(raw ?? "") || "(vazio)";
  map[key] = (map[key] ?? 0) + 1;
}

function isReparoValue(v: string): boolean {
  return cleanText(v).toUpperCase() === "REPARO";
}

const NORDESTE_UF = new Set(["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"]);
function oempResponsavel(
  uf: string | null | undefined,
  responsaveis: ResolvedResponsaveis,
): string {
  const u = cleanText(uf ?? "").toUpperCase();
  if (u === "SP") return responsaveis.oempSp;
  if (NORDESTE_UF.has(u)) return responsaveis.oempNordeste;
  return responsaveis.oempDemais;
}
const SEM_INC = "SEM INC";

// Aliases devem corresponder EXATAMENTE ao nome completo cadastrado em profiles.nome.
// Nunca usar apelidos/primeiros nomes para evitar ambiguidade (ex.: "Rodrigo" colidia
// entre "Rodrigo Nunes da Silva" e "Rodrigo Pereira dos Santos de Oliveira").
const RESPONSAVEL_ALIASES = {
  secundario: [
    ["Rodrigo Nunes da Silva"],
    ["Ronivon Nunes Figueiredo"],
    ["Pedro Gabriel Cardoso dos Santos"],
  ],
  oi: [
    ["Wesley Fernandes da Fonseca Rodrigues"],
    ["Sidney Silva Neiva"],
    ["Antonio Estanislau"],
  ],
  oemp: {
    sp: ["Caroline Victoria Marques de Oliveira"],
    nordeste: ["Anabelly Cris Silva"],
    demais: ["Samara De Paiva Pontes"],
  },
} as const;

interface ResolvedResponsaveis {
  secundario: string[];
  oi: string[];
  oempSp: string;
  oempNordeste: string;
  oempDemais: string;
  oemp: string[];
}

function uniqueProfileMatch(
  profileNames: string[],
  label: string,
  aliases: readonly string[],
): string {
  const matches = new Map<string, string>();
  for (const alias of aliases) {
    const aliasKey = normKey(alias);
    for (const name of profileNames) {
      const nameClean = cleanText(name);
      const nameKey = normKey(nameClean);
      if (!nameKey || !aliasKey) continue;
      if (nameKey === aliasKey || nameKey.includes(aliasKey)) {
        matches.set(nameKey, nameClean);
      }
    }
  }

  const found = Array.from(matches.values());
  if (found.length === 1) return found[0];
  if (found.length === 0) {
    throw new Error(`Responsavel obrigatorio nao encontrado em profiles.nome: ${label}.`);
  }
  throw new Error(
    `Responsavel obrigatorio ambiguo em profiles.nome: ${label} (${found.join(", ")}).`,
  );
}

function resolveResponsaveis(profileNames: string[]): ResolvedResponsaveis {
  const cleanProfiles = Array.from(new Set(profileNames.map((n) => cleanText(n)).filter(Boolean)));
  if (cleanProfiles.length === 0) {
    throw new Error("Nenhum profiles.nome disponivel para resolver responsaveis.");
  }

  const secundario = RESPONSAVEL_ALIASES.secundario.map((aliases) =>
    uniqueProfileMatch(cleanProfiles, aliases[0], aliases),
  );
  const oi = RESPONSAVEL_ALIASES.oi.map((aliases) =>
    uniqueProfileMatch(cleanProfiles, aliases[0], aliases),
  );
  const oempSp = uniqueProfileMatch(
    cleanProfiles,
    "Caroline Victoria Marques de Oliveira",
    RESPONSAVEL_ALIASES.oemp.sp,
  );
  const oempNordeste = uniqueProfileMatch(
    cleanProfiles,
    "Anabelly Cris Silva",
    RESPONSAVEL_ALIASES.oemp.nordeste,
  );
  const oempDemais = uniqueProfileMatch(
    cleanProfiles,
    "Samara De Paiva Pontes",
    RESPONSAVEL_ALIASES.oemp.demais,
  );
  return {
    secundario,
    oi,
    oempSp,
    oempNordeste,
    oempDemais,
    oemp: [oempSp, oempNordeste, oempDemais],
  };
}

function canonicalProfileName(
  value: string | null | undefined,
  profileNames: string[],
): string | null {
  const raw = cleanText(value ?? "");
  if (!raw) return null;
  if (raw.toUpperCase() === SEM_INC) return SEM_INC;

  const rawKey = normKey(raw);
  const matches = new Map<string, string>();
  for (const name of profileNames) {
    const nameClean = cleanText(name);
    const nameKey = normKey(nameClean);
    if (!nameKey) continue;
    if (nameKey === rawKey || nameKey.includes(rawKey) || rawKey.includes(nameKey)) {
      matches.set(nameKey, nameClean);
    }
  }

  const found = Array.from(matches.values());
  return found.length === 1 ? found[0] : null;
}

/** Considera Ordem inválida (vazia/ND/NA/null/etc.) que deve virar REPARO (item 8). */
function isOrdemInvalida(v: string | null | undefined): boolean {
  return isInvalidTechnicalValue(v);
}

/** Identifica casos Aguardando OI / OI Legado a partir dos campos operacionais (item 12). */
function isOiCase(row: ControleRow): boolean {
  const campos = [
    row.fila_jira,
    row.status_planilha,
    row.status_jira,
    row.ordem,
    row.obs,
    row.designacao_parceiro,
  ];
  return campos.some((f) => {
    const k = normKey(f ?? "");
    return /(aguardandooi|oilegado|aguardandotratativaoi)/.test(k);
  });
}

/**
 * Identifica casos OEMP (item 17) por Fila Jira, Empresa, Desig. Parceiro ou Obs.
 * Não altera nenhum campo: serve apenas para definir o responsável por região.
 */
function isOempCase(row: ControleRow): boolean {
  const campos = [row.fila_jira, row.empresa, row.designacao_parceiro, row.obs];
  return campos.some((f) => /oemp/.test(normKey(f ?? "")));
}

function getCodigo(row: Row, ...extra: string[]): string {
  return cleanText(
    getVal(
      row,
      ...extra,
      "Cód. da Lotérica",
      "Código da Lotérica",
      "Codigo da Loterica",
      "codigo_loterica",
      "Cód da Lotérica",
      "Codigo UL",
      "Código UL",
    ),
  );
}

function getTipoLink(row: Row, ...extra: string[]): string {
  return cleanText(
    getVal(row, ...extra, "Tipo de Link", "Tipo de link", "Tipo Link", "Tipo do Link", "Link"),
  );
}

function getIpLoopback(row: Row): string {
  return cleanTechnicalValue(getVal(row, "IP Loopback", "IP de loopback", "Loopback", "IP"));
}

function getCircuito(row: Row, ...extra: string[]): string {
  return cleanTechnicalValue(
    removeCef(
      getVal(
        row,
        ...extra,
        "Designação",
        "Designacao",
        "Designação OEMP",
        "Designacao OEMP",
        "Circuito",
        "Novo Circuito",
        "NOVA DESIGNAÇÃO",
        "Designação Nova",
        "Designacao Nova",
      ),
    ),
  );
}

function getDesignacao(row: Row): string {
  return cleanTechnicalValue(removeCef(getVal(row, "Designacao", "Designacao OEMP")));
}

function getCircuitoTecnico(row: Row, ...extra: string[]): string {
  return cleanTechnicalValue(
    removeCef(getVal(row, ...extra, "Circuito", "Circuito OEMP", "Circuito Parceiro")),
  );
}

function getNovoCircuitoTecnico(row: Row): string {
  return cleanTechnicalValue(
    removeCef(getVal(row, "Novo Circuito", "NOVO CIRCUITO", "Designacao Nova", "NOVA DESIGNACAO")),
  );
}

function getChamadoTecnico(row: Row): string {
  return cleanTechnicalValue(
    getVal(row, "Chamado", "Chave", "Numero INC Snow", "INC Snow", "INC ServiceNow", "REQ Caixa"),
  );
}

function getAlarmeTecnico(row: Row): string {
  return cleanTechnicalValue(
    getVal(
      row,
      "ID do Alarme",
      "ID do Alarmes",
      "Id do Alarme",
      "Id do Alarmes",
      "Identificador do Alarme",
    ),
  );
}

function buildCodeKey(codigo: string): string {
  return normCodigo(codigo);
}

function buildCodeTypeKey(codigo: string, tipoLink: string): string {
  const cod = buildCodeKey(codigo);
  const tipo = normalizeTipoLink(tipoLink);
  return cod && tipo ? `${cod}|${tipo}` : "";
}

function buildKey(codigo: string, tipoLink: string, technicalParts: string[] | string): string {
  const parts = Array.isArray(technicalParts) ? technicalParts : [technicalParts];
  const technical = uniqueTechnicalParts(parts).map(normalizeKeyPart).join("+");
  return [buildCodeKey(codigo), normalizeTipoLink(tipoLink), technical].filter(Boolean).join("|");
}

function buildCircuitKey(codigo: string, tipoLink: string, circuito: string): string {
  const codeType = buildCodeTypeKey(codigo, tipoLink);
  const circ = normalizeKeyPart(circuito);
  return codeType && circ ? `${codeType}|${circ}` : "";
}

interface OperationalIdOptions {
  allowRowHashFallback?: boolean;
  forceRowHashSuffix?: boolean;
  rowSalt?: string;
}

interface OperationalId {
  codigo: string;
  tipo: string;
  ip: string;
  circuito: string;
  technicalParts: string[];
  key: string;
  codeTypeKey: string;
  codeKey: string;
  circuitKey: string;
}

function operationalId(
  row: Row,
  codigoExtra: string[] = [],
  tipoExtra: string[] = [],
  circuitoExtra: string[] = [],
  options: OperationalIdOptions = {},
): OperationalId {
  const codigo = getCodigo(row, ...codigoExtra);
  const tipo = normalizeTipoLink(getTipoLink(row, ...tipoExtra));
  const ip = getIpLoopback(row);
  const circuito = getCircuito(row, ...circuitoExtra);
  const technicalParts = uniqueTechnicalParts([
    ip,
    getDesignacao(row),
    getCircuitoTecnico(row, ...circuitoExtra),
    getNovoCircuitoTecnico(row),
    getChamadoTecnico(row),
    getAlarmeTecnico(row),
  ]);
  if ((options.allowRowHashFallback && technicalParts.length === 0) || options.forceRowHashSuffix) {
    technicalParts.push(hashRow(row, options.rowSalt));
  }
  return {
    codigo,
    tipo,
    ip,
    circuito,
    technicalParts,
    key: buildKey(codigo, tipo, technicalParts),
    codeTypeKey: buildCodeTypeKey(codigo, tipo),
    codeKey: buildCodeKey(codigo),
    circuitKey: buildCircuitKey(codigo, tipo, circuito),
  };
}

function countByKey<T>(rows: T[], getKey: (row: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = getKey(row);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

interface Lookup<T> {
  byKey: Map<string, T>;
  byCodeType: Map<string, T>;
  byCode: Map<string, T>;
  byCircuit: Map<string, T>;
  keyCounts: Map<string, number>;
  codeTypeCounts: Map<string, number>;
  codeCounts: Map<string, number>;
  circuitCounts: Map<string, number>;
}

function createLookup<T>(): Lookup<T> {
  return {
    byKey: new Map(),
    byCodeType: new Map(),
    byCode: new Map(),
    byCircuit: new Map(),
    keyCounts: new Map(),
    codeTypeCounts: new Map(),
    codeCounts: new Map(),
    circuitCounts: new Map(),
  };
}

function addCount(map: Map<string, number>, key: string): void {
  if (key) map.set(key, (map.get(key) ?? 0) + 1);
}

function addLookup<T>(
  lookup: Lookup<T>,
  id: OperationalId,
  value: T,
  extraKeys: string[] = [],
): void {
  for (const key of Array.from(new Set([id.key, ...extraKeys]))) {
    if (!key) continue;
    lookup.byKey.set(key, value);
    addCount(lookup.keyCounts, key);
  }
  if (id.codeTypeKey) {
    lookup.byCodeType.set(id.codeTypeKey, value);
    addCount(lookup.codeTypeCounts, id.codeTypeKey);
  }
  if (id.codeKey) {
    lookup.byCode.set(id.codeKey, value);
    addCount(lookup.codeCounts, id.codeKey);
  }
  if (id.circuitKey) {
    lookup.byCircuit.set(id.circuitKey, value);
    addCount(lookup.circuitCounts, id.circuitKey);
  }
}

function findByOperationalId<T>(
  lookup: Lookup<T>,
  id: OperationalId,
  gisCodeTypeCounts: Map<string, number>,
  gisCodeCounts: Map<string, number>,
): T | undefined {
  if (id.key && lookup.keyCounts.get(id.key) === 1) {
    const found = lookup.byKey.get(id.key);
    if (found) return found;
  }
  if (id.circuitKey && lookup.circuitCounts.get(id.circuitKey) === 1) {
    const found = lookup.byCircuit.get(id.circuitKey);
    if (found) return found;
  }
  if (
    id.codeTypeKey &&
    lookup.codeTypeCounts.get(id.codeTypeKey) === 1 &&
    (gisCodeTypeCounts.get(id.codeTypeKey) ?? 0) <= 1
  ) {
    const found = lookup.byCodeType.get(id.codeTypeKey);
    if (found) return found;
  }
  if (
    id.codeKey &&
    lookup.codeCounts.get(id.codeKey) === 1 &&
    (gisCodeCounts.get(id.codeKey) ?? 0) <= 1
  ) {
    return lookup.byCode.get(id.codeKey);
  }
  return undefined;
}

interface IncidentPick {
  value: string | null;
  sourceColumn: string | null;
  invalidIgnored: number;
}

export function normalizeIncidentValue(v: string | null | undefined): string | null {
  const s = cleanTechnicalValue(v);
  if (!s) return null;
  const normalized = s.replace(/\s+/g, "").toUpperCase();
  return /^INC[-_]?\d+/.test(normalized) ? normalized : null;
}

function caseAgeHours(row: ControleRow, referenceIso: string | undefined): number | null {
  if (row.duracao_h != null && Number.isFinite(row.duracao_h)) return row.duracao_h;
  if (!row.data_hora_inicial) return null;
  const start = new Date(row.data_hora_inicial).getTime();
  if (isNaN(start)) return null;
  const reference = referenceIso ? new Date(referenceIso).getTime() : Date.now();
  if (isNaN(reference)) return null;
  return Math.max(0, (reference - start) / 3600000);
}

function isSemIncAte24h(row: ControleRow, referenceIso: string | undefined): boolean {
  if (normalizeIncidentValue(row.chamado)) return false;
  const hours = caseAgeHours(row, referenceIso);
  return hours != null && hours <= 24;
}

const INC_SNOW_COLUMN_CANDIDATES = [
  "Nº INC Snow",
  "Nº Inc Snow",
  "N° INC Snow",
  "INC Snow",
  "Nº INC SNOW",
  "Numero INC Snow",
  "Número INC Snow",
  "Incidente Snow",
  "Nº Incidente Snow",
  "N° Incidente Snow",
  "Nº INC",
  "N° INC",
  "Numero INC",
  "Número INC",
  "INC SNOW",
];

const BLOCKED_INC_SNOW_COLUMNS = new Set(["chave", "key", "chamado", "issuekey", "jira"]);

const INVALID_INC_SNOW_VALUES = new Set([
  ...INVALID_TECHNICAL_KEYS,
  "n",
  "na",
  "n/a",
  "nao",
  "metalico",
  "metálico",
  "fibra",
  "estacaodesativada",
  "estacaodesativada",
  "migracaoestacao",
  "migraçãoestação",
  "migracaodeestacao",
  "migraçãodeestação",
]);

function isBlockedIncSnowColumn(key: string): boolean {
  return BLOCKED_INC_SNOW_COLUMNS.has(normKey(key));
}

function jiraColumns(jira: Row[]): string[] {
  return Array.from(new Set(jira.flatMap((row) => Object.keys(row)))).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}

function findIncSnowColumn(row: Row): string | null {
  const keys = Object.keys(row).filter((key) => !isBlockedIncSnowColumn(key));
  const normalized = keys.map((key) => ({ key, norm: normKey(key) }));
  for (const candidate of INC_SNOW_COLUMN_CANDIDATES) {
    const target = normKey(candidate);
    const exact = normalized.find((item) => item.norm === target);
    if (exact) return exact.key;
  }
  for (const candidate of INC_SNOW_COLUMN_CANDIDATES) {
    const target = normKey(candidate);
    if (!target.includes("snow") && !target.includes("servicenow")) continue;
    const partial = normalized.find((item) => item.norm.includes(target));
    if (partial) return partial.key;
  }
  return null;
}

function detectIncSnowColumns(jira: Row[]): string[] {
  return Array.from(
    new Set(jira.map(findIncSnowColumn).filter((key): key is string => !!key)),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function normalizeIncSnowValue(v: string | null | undefined): string | null {
  const s = cleanTechnicalValue(v);
  if (!s) return null;
  const key = normKey(s);
  if (INVALID_INC_SNOW_VALUES.has(key)) return null;
  return s;
}

function pickIncSnowFromJira(row: Row): IncidentPick {
  const sourceColumn = findIncSnowColumn(row);
  if (!sourceColumn) return { value: null, sourceColumn: null, invalidIgnored: 0 };
  const raw = cleanText(String(row[sourceColumn] ?? ""));
  if (!raw) return { value: null, sourceColumn, invalidIgnored: 0 };
  const value = normalizeIncSnowValue(raw);
  return {
    value,
    sourceColumn,
    invalidIgnored: value ? 0 : 1,
  };
}

function findColumn(row: Row, candidates: readonly string[]): string | null {
  const keys = Object.keys(row);
  const normalized = keys.map((key) => ({ key, norm: normKey(key) }));
  for (const candidate of candidates) {
    const target = normKey(candidate);
    const exact = normalized.find((item) => item.norm === target);
    if (exact) return exact.key;
  }
  for (const candidate of candidates) {
    const target = normKey(candidate);
    const partial = normalized.find(
      (item) => item.norm.includes(target) || target.includes(item.norm),
    );
    if (partial) return partial.key;
  }
  return null;
}

export function processControle(input: ProcessInput): ProcessResult {
  const {
    gis1,
    gis2,
    controleD1,
    jira,
    grafana,
    planta,
    profileNames,
    manualEditFieldsByChave = {},
    dataReferencia,
    processadoEm,
    processadoEmLocal,
    timezone,
    prior,
    versao = 1,
  } = input;

  const gisAll = [...gis1, ...gis2];
  const plantaAll = [...planta];
  const responsaveis = resolveResponsaveis(profileNames);
  const normalizedProfileNames = Array.from(
    new Set(profileNames.map((n) => cleanText(n)).filter(Boolean)),
  );

  // ---- Lookups ----
  // Jira by INC (chave) and by codigo
  const gisBaseIds = gisAll.map((r) =>
    operationalId(r, [], [], [], { allowRowHashFallback: true }),
  );
  const gisBaseKeyCounts = countByKey(gisBaseIds, (id) => id.key);
  let colisoesEvitadas = 0;
  for (const total of gisBaseKeyCounts.values()) {
    if (total > 1) colisoesEvitadas += total - 1;
  }
  const gisIds = gisAll.map((r, index) => {
    const base = gisBaseIds[index];
    if (base.key && (gisBaseKeyCounts.get(base.key) ?? 0) > 1) {
      return operationalId(r, [], [], [], {
        allowRowHashFallback: true,
        forceRowHashSuffix: true,
        rowSalt: String(index),
      });
    }
    return base;
  });
  const gisCodeTypeCountsByKey = countByKey(gisIds, (id) => id.codeTypeKey);
  const gisCodeCountsByKey = countByKey(gisIds, (id) => id.codeKey);

  const jiraByInc = new Map<string, Row>();
  const jiraIncCounts = new Map<string, number>();
  const jiraDetectedColumns = jiraColumns(jira);
  const jiraDetectedIncSnowColumns = detectIncSnowColumns(jira);
  const jiraIncSnowColumnUsage: Record<string, number> = {};
  for (const r of jira) {
    const inc = normalizeIncidentValue(
      getVal(r, "Chave", "Key", "Chamado", "INC", "Incidente", "Numero INC", "Numero Inc"),
    );
    if (!inc) continue;
    addCount(jiraIncCounts, inc);
    jiraByInc.set(inc, r);
  }
  const duplicateJiraIncs = new Set(
    Array.from(jiraIncCounts.entries())
      .filter(([, total]) => total > 1)
      .map(([inc]) => inc),
  );
  for (const inc of duplicateJiraIncs) jiraByInc.delete(inc);

  const grafanaCirc = new Map<string, string>();
  const plantaLookup = createLookup<Map<string, string>>();
  for (const r of plantaAll) {
    const id = operationalId(
      r,
      ["Código UL", "Codigo UL"],
      [],
      ["Circuito OEMP", "Designação Nova"],
    );
    if (!id.codeKey) continue;
    const entry = new Map<string, string>();
    for (const [rawKey, rawVal] of Object.entries(r)) {
      const val = cleanText(String(rawVal ?? ""));
      if (!val) continue;
      entry.set(normKey(rawKey), val);
    }
    addLookup(plantaLookup, id, entry);
  }

  const grafanaCircCounts = new Map<string, number>();
  const grafanaPostoColumns: Record<string, number> = {};
  const grafanaPostoExamples: string[] = [];
  const addGrafanaCircuit = (key: string, value: string, sourceColumn: string) => {
    const k = normalizeKeyPart(removeCef(key));
    if (!k) return;
    grafanaCirc.set(k, value);
    addCount(grafanaCircCounts, k);
    addDistribution(grafanaPostoColumns, sourceColumn);
    if (grafanaPostoExamples.length < 5 && !grafanaPostoExamples.includes(value)) {
      grafanaPostoExamples.push(value);
    }
  };
  for (const r of grafana) {
    const postoColumn = findColumn(r, ["Posto", "Postos", "Nome do Posto", "Unidade / Posto"]);
    if (!postoColumn) continue;
    const posto = cleanText(String(r[postoColumn] ?? ""));
    if (!posto) continue;
    addGrafanaCircuit(getVal(r, "Circuito"), posto, postoColumn);
  }

  const d1ByCodeType = new Map<string, Partial<ControleRow>>();
  const d1CodeTypeCounts = new Map<string, number>();
  for (const r of controleD1) {
    const id = operationalId(r);
    if (!id.codeTypeKey) continue;
    const rawSit = cleanText(getVal(r, "SITUAÇÃO", "SITUACAO"));
    const validSit = sanitizeSituacao(rawSit);
    const inherited = {
      ordem: isOrdemInvalida(getVal(r, "ORDEM")) ? null : cleanText(getVal(r, "ORDEM")),
      novo_circuito: cleanText(getVal(r, "NOVO CIRCUITO")) || null,
      situacao: validSit,
      status_planilha: normalizeStatusPlanilha(getVal(r, "STATUS PLANILHA")),
      status_jira: cleanText(getVal(r, "STATUS JIRA")) || null,
      obs: cleanText(getVal(r, "OBS", "COMENTÁRIO INTERNO")) || null,
      responsavel: canonicalProfileName(
        getVal(r, "RESPONSÁVEL", "RESPONSAVEL"),
        normalizedProfileNames,
      ),
      status_zabbix: cleanText(getVal(r, "STATUS ZABBIX")) || null,
    };
    d1ByCodeType.set(id.codeTypeKey, inherited);
    addCount(d1CodeTypeCounts, id.codeTypeKey);
  }

  const priorSorted = [...prior].sort((a, b) => {
    const byDate = a.data_referencia.localeCompare(b.data_referencia);
    if (byDate !== 0) return byDate;
    return (a.versao ?? 1) - (b.versao ?? 1);
  });
  const currentByChave = new Map<string, ControleRow>();
  for (const p of priorSorted) {
    if (p.data_referencia === dataReferencia && p.chave) currentByChave.set(p.chave, p);
  }

  const controle: ControleRow[] = [];
  const seenKeys = new Set<string>();
  let comJira = 0;
  let comGrafana = 0;
  const comOs = 0;
  let d1Cruzados = 0;
  let d1HerdouSituacaoReparo = 0;
  let d1SituacaoHerdada = 0;
  let d1SituacaoFallbackReparo = 0;
  let incValidosTotal = 0;
  let filaJiraVazia = 0;
  let jiraIncSnowPreenchido = 0;
  let jiraIncSnowVazio = 0;
  let jiraIncSnowIgnoradoInvalido = 0;
  const jiraIncSnowUsandoChave = 0;
  let semIncTotal = 0;
  let ordemConvertidaReparo = 0;
  let statusPlanilhaCec = 0;
  let oempTotal = 0;
  const semIncAte24hKeys = new Set<string>();
  const filaJiraVaziaExemplos: ProcessReport["jira"]["filaJiraVaziaExemplos"] = [];

  const getGrafanaCircuit = (...keys: Array<string | null | undefined>) => {
    for (const key of keys) {
      const k = normalizeKeyPart(removeCef(key ?? ""));
      if (k && grafanaCircCounts.get(k) === 1) return grafanaCirc.get(k);
    }
    return undefined;
  };

  for (let gisIndex = 0; gisIndex < gisAll.length; gisIndex++) {
    const r = gisAll[gisIndex];
    const gid = gisIds[gisIndex];
    const codigo = gid.codigo;
    if (!codigo) continue;
    const key = gid.key || gid.codeTypeKey || gid.codeKey;
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);

    const designacao = gid.circuito;
    const row: ControleRow = {
      data_referencia: dataReferencia,
      versao,
      chave: key,
      codigo_loterica: codigo,
      loterica: cleanText(getVal(r, "Lotérica", "Loterica")) || null,
      tipo_link: gid.tipo || null,
      uf: cleanText(getVal(r, "UF")) || null,
      cidade: cleanText(getVal(r, "Cidade")) || null,
      designacao: designacao || null,
      ip_loopback: gid.ip || null,
      data_hora_inicial: toIso(
        getVal(r, "Data e Hora Incial", "Data e Hora Inicial", "Data/Hora Inicial"),
      ),
      duracao_h: toNum(getVal(r, "Duração (h)", "Duracao (h)")),
      chamado: cleanText(getVal(r, "Chamado")) || null,
      previsao_atendimento: toIso(
        getVal(
          r,
          "Previsão de Atendimento",
          "Previsao de Atendimento",
          "Previsão Atendimento",
          "Previsao Atendimento",
        ),
      ),
      ultimo_comentario: cleanSpreadsheetDisplayValue(
        getVal(r, "Último Comentário", "Ultimo Comentario"),
      ),
      grafana: null,
      empresa: cleanText(getVal(r, "Empresa")) || null,
      designacao_parceiro: null,
      fila_jira: null,
      inc_snow: null,
      incidente_mam: null,
      ordem: null,
      novo_circuito: null,
      situacao: null,
      status_planilha: null,
      status_jira: null,
      obs: null,
      responsavel: null,
      responsavel_backup: null,
      status_zabbix: null,
      status_normalizacao: "ATIVO",
      normalizado_em: null,
      pendente_enriquecimento: false,
      tem_os_reparo: false,
    };

    // Item 2: OS/Reparo removida do fluxo — não enriquece mais o Controle Operacional.
    const foundInOs = false;

    // Etapa 3: edicoes manuais do dia atual + Controle D-1 por Codigo + Tipo.
    const inheritedCurrent = currentByChave.get(key);
    const manualFields = new Set(
      manualEditFieldsByChave[key]?.length
        ? manualEditFieldsByChave[key]
        : inheritedCurrent
          ? MANUAIS_PRESERVAVEIS
          : [],
    );
    const inheritedD1 =
      gid.codeTypeKey && d1CodeTypeCounts.get(gid.codeTypeKey) === 1
        ? d1ByCodeType.get(gid.codeTypeKey)
        : undefined;
    if (inheritedD1) {
      d1Cruzados++;
    }
    let appliedD1Situacao = false;
    for (const f of MANUAIS_PRESERVAVEIS) {
      if (f === STATUS_PLANILHA_FIELD) continue;
      if (!inheritedCurrent || !manualFields.has(f)) continue;
      const currentValue = inheritedCurrent[f] as unknown;
      (row as unknown as Record<string, unknown>)[f] =
        f === "responsavel"
          ? canonicalProfileName(String(currentValue ?? ""), normalizedProfileNames)
          : currentValue;
    }
    for (const f of HERDAVEIS_OPERACIONAIS) {
      if (f === STATUS_PLANILHA_FIELD) continue;
      if (f === "ordem" && row.ordem) continue;
      if (manualFields.has(f)) continue;
      const dv = inheritedD1 ? (inheritedD1[f] as unknown) : null;
      if (dv !== null && dv !== undefined && dv !== "") {
        (row as unknown as Record<string, unknown>)[f] = dv;
        if (f === "situacao") appliedD1Situacao = true;
      }
    }

    // Etapa 4: Jira — cruzamento exclusivamente por INC (itens 6 e 7)
    if (appliedD1Situacao) {
      d1SituacaoHerdada++;
      if (row.situacao === "REPARO") d1HerdouSituacaoReparo++;
    }

    const inc = normalizeIncidentValue(row.chamado);
    const jr = inc ? jiraByInc.get(inc) : undefined;
    let jiraFound = false;
    if (!inc) {
      // Item 7: Chamado sem INC válida — não cruzar com Jira
      semIncTotal++;
      row.fila_jira = SEM_INC;
      row.inc_snow = null;
      row.obs = SEM_INC;
      row.responsavel = SEM_INC;
      if (isSemIncAte24h(row, processadoEm)) {
        semIncAte24hKeys.add(row.chave);
      }
    } else if (jr) {
      incValidosTotal++;
      jiraFound = true;
      comJira++;
      row.fila_jira = cleanText(getVal(jr, "Status")) || null;
      if (!row.fila_jira) {
        filaJiraVazia++;
        if (filaJiraVaziaExemplos.length < 10) {
          filaJiraVaziaExemplos.push({
            codigo_loterica: row.codigo_loterica,
            chamado: row.chamado,
            motivo: "INC encontrada no Jira, mas coluna Status vazia.",
          });
        }
      }
      row.incidente_mam = cleanText(getVal(jr, "Nº Incidente MAM", "Incidente MAM")) || null;
      const incSnow = pickIncSnowFromJira(jr);
      row.inc_snow = incSnow.value;
      jiraIncSnowIgnoradoInvalido += incSnow.invalidIgnored;
      if (incSnow.value) {
        jiraIncSnowPreenchido++;
        if (incSnow.sourceColumn) addDistribution(jiraIncSnowColumnUsage, incSnow.sourceColumn);
      } else {
        jiraIncSnowVazio++;
      }
      const jiraStatusJira =
        cleanVal(getVal(jr, "Último comentário Cliente", "Ultimo comentario Cliente")) || null;
      const jiraObs = cleanJiraObs(
        getVal(jr, "Último comentário Interno", "Ultimo comentario Interno"),
      );
      if (jiraStatusJira) row.status_jira = jiraStatusJira;
      if (jiraObs) row.obs = jiraObs;
    } else {
      incValidosTotal++;
      filaJiraVazia++;
      if (filaJiraVaziaExemplos.length < 10) {
        filaJiraVaziaExemplos.push({
          codigo_loterica: row.codigo_loterica,
          chamado: row.chamado,
          motivo: duplicateJiraIncs.has(inc)
            ? "INC duplicada na base Jira."
            : "INC nao encontrada na base Jira.",
        });
      }
    }

    // Etapa 5: Grafana — cruzamento por Circuito (item 3)
    const circuitoFinal = cleanText(row.novo_circuito ?? designacao);
    const grafanaId = {
      ...gid,
      circuito: circuitoFinal,
      circuitKey: buildCircuitKey(codigo, gid.tipo, circuitoFinal),
    };
    const gval = getGrafanaCircuit(circuitoFinal, row.novo_circuito, designacao);
    if (gval) {
      row.grafana = gval;
      comGrafana++;
    }

    // Etapa 6: Extração Planta
    const plCols = findByOperationalId(
      plantaLookup,
      grafanaId,
      gisCodeTypeCountsByKey,
      gisCodeCountsByKey,
    );
    if (plCols) {
      row.empresa =
        plCols.get("empresacef") ||
        plCols.get("empresaoemp") ||
        plCols.get("operadora") ||
        row.empresa;
      row.designacao_parceiro = plCols.get("circuitooemp") || row.designacao_parceiro;
      const plantaNovoCircuito =
        plCols.get("designação nova") ||
        plCols.get("designacao nova") ||
        plCols.get("designacaonova") ||
        null;
      if (!row.novo_circuito && plantaNovoCircuito) row.novo_circuito = plantaNovoCircuito;
      if (isLinkBackup(row.tipo_link)) {
        row.responsavel_backup = plCols.get("operadora4g") || row.responsavel_backup;
      }
    }

    // Item 9: Situacao vem do D-1 quando valida; REPARO e apenas fallback.
    if (!sanitizeSituacao(row.situacao ?? "")) {
      row.situacao = "REPARO";
      d1SituacaoFallbackReparo++;
    }

    // Item 8: Ordem — vazia/ND/NA/null => REPARO
    if (isOrdemInvalida(row.ordem)) {
      row.ordem = "REPARO";
      ordemConvertidaReparo++;
    }

    // Status Planilha vem exclusivamente do D-1; ausente ou inválido vira CEC ANALISANDO.
    row.status_planilha = inheritedD1?.status_planilha ?? STATUS_PLANILHA_PADRAO;
    if (semIncAte24hKeys.has(row.chave)) {
      row.status_planilha = STATUS_PLANILHA_PADRAO;
    }
    if (row.status_planilha === STATUS_PLANILHA_PADRAO) {
      statusPlanilhaCec++;
    }

    // Item 17: OEMP — apenas contagem; o responsável é definido na fase de distribuição.
    // Nenhuma mensagem é adicionada na Obs (sem "VER NO TEAMS").
    if (isOempCase(row)) {
      oempTotal++;
    }

    row.pendente_enriquecimento = !jiraFound && !plCols && !gval && !foundInOs;

    controle.push(row);
  }

  // ---- Distribuição de responsáveis (itens 10 e 12) ----
  // Estável: ordena por chave para resultado determinístico entre processamentos.
  const isDistribuivel = (v: string | null | undefined) =>
    !cleanText(v ?? "") || cleanText(v ?? "").toUpperCase() === SEM_INC;
  const activeRows = controle
    .filter((r) => r.status_normalizacao === "ATIVO")
    .sort((a, b) => (a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0));

  // Item 12: Aguardando OI / OI Legado -> Wesley / Sidney / Estanislau
  const oiRows = activeRows.filter(isOiCase);
  const oiTotal = oiRows.length;
  const oiPreservadoD1 = oiRows.filter((r) => !isDistribuivel(r.responsavel)).length;
  let oiIdx = 0;
  for (const r of oiRows) {
    if (isDistribuivel(r.responsavel) && !semIncAte24hKeys.has(r.chave)) {
      r.responsavel = responsaveis.oi[oiIdx % responsaveis.oi.length];
      oiIdx++;
    }
  }

  // Item 17: Link Principal OEMP -> Carol (SP) / Anabelly (Nordeste) / Samara (demais)
  const oempRows = activeRows.filter(
    (r) => !isLinkBackup(r.tipo_link) && !isOiCase(r) && isOempCase(r),
  );
  const oempDistribuidos = oempRows.filter((r) => isDistribuivel(r.responsavel)).length;
  for (const r of oempRows) {
    if (isDistribuivel(r.responsavel) && !semIncAte24hKeys.has(r.chave)) {
      r.responsavel = oempResponsavel(r.uf, responsaveis);
    }
  }

  // Item 16: Links Secundários -> Rodrigo / Ronivon / Pedro (exceto casos OI/OEMP já tratados)
  const secRows = activeRows.filter((r) => isLinkBackup(r.tipo_link));
  const secTotal = secRows.length;
  const secPreservadoD1 = secRows.filter(
    (r) => !isDistribuivel(r.responsavel) && !responsaveis.oi.includes(r.responsavel ?? ""),
  ).length;
  let secIdx = 0;
  for (const r of secRows) {
    if (isDistribuivel(r.responsavel) && !isOiCase(r) && !semIncAte24hKeys.has(r.chave)) {
      r.responsavel = responsaveis.secundario[secIdx % responsaveis.secundario.length];
      secIdx++;
    }
  }

  // Item 7: fallback final SEM INC para responsáveis ainda vazios sem INC válida
  for (const r of activeRows) {
    if (!cleanText(r.responsavel ?? "") && !normalizeIncidentValue(r.chamado)) {
      r.responsavel = SEM_INC;
    }
  }

  const contarResponsaveis = (nomes: readonly string[]): Record<string, number> =>
    Object.fromEntries(nomes.map((n) => [n, activeRows.filter((r) => r.responsavel === n).length]));
  const distSecundario = contarResponsaveis(responsaveis.secundario);
  const distOi = contarResponsaveis(responsaveis.oi);
  const distOemp = contarResponsaveis(responsaveis.oemp);

  // ULs que estavam ativas no prior e não aparecem mais hoje
  let normalizados = 0;
  const latestActivePrior = new Map<string, ControleRow>();
  for (const p of priorSorted) {
    const id = operationalId(p as unknown as Row);
    const priorKey = p.chave || id.key || id.codeTypeKey || id.codeKey;
    if (p.status_normalizacao === "ATIVO" && priorKey) latestActivePrior.set(priorKey, p);
  }
  const nowIso = new Date().toISOString();
  const outputKeys = new Set(controle.map((row) => row.chave).filter(Boolean));
  for (const [pkey, p] of latestActivePrior) {
    const priorId = operationalId(p as unknown as Row);
    const equivalentKeys = [p.chave, pkey, priorId.key, priorId.codeTypeKey, priorId.codeKey].filter(
      Boolean,
    ) as string[];
    const alreadyActive = equivalentKeys.some((key) => seenKeys.has(key) || outputKeys.has(key));
    if (!alreadyActive) {
      const statusPlanilha = "NORMALIZADO";
      normalizados++;
      controle.push({
        ...p,
        data_referencia: dataReferencia,
        versao,
        chave: p.chave || pkey,
        status_normalizacao: "NORMALIZADO",
        status_planilha: statusPlanilha,
        normalizado_em: nowIso,
        tem_os_reparo: p.tem_os_reparo ?? false,
      });
      outputKeys.add(p.chave || pkey);
    }
  }

  const uniqueByChave = new Map<string, ControleRow>();
  for (const row of controle) {
    const existing = uniqueByChave.get(row.chave);
    if (!existing) {
      uniqueByChave.set(row.chave, row);
      continue;
    }
    if (
      existing.status_normalizacao === "NORMALIZADO" &&
      row.status_normalizacao === "ATIVO"
    ) {
      uniqueByChave.set(row.chave, row);
    }
  }
  if (uniqueByChave.size !== controle.length) {
    controle.splice(0, controle.length, ...uniqueByChave.values());
    normalizados = controle.filter((row) => row.status_normalizacao === "NORMALIZADO").length;
  }

  // OS/Reparo foi removida do fluxo ativo; implantacoes ficam legadas.
  const implantacoes: ImplantacaoRow[] = [];

  const situacaoDistribuicao: Record<string, number> = {};
  const ordemDistribuicao: Record<string, number> = {};
  let principal = 0;
  let secundario = 0;
  let situacaoReparoTotal = 0;
  let ordemReparoTotal = 0;
  let filaJiraPreenchida = 0;
  for (const row of controle) {
    addDistribution(situacaoDistribuicao, row.situacao);
    addDistribution(ordemDistribuicao, row.ordem);
    if (isLinkBackup(row.tipo_link)) secundario++;
    else principal++;
    if (cleanText(row.situacao ?? "").toUpperCase() === "REPARO") situacaoReparoTotal++;
    if (cleanText(row.ordem ?? "").toUpperCase() === "REPARO") ordemReparoTotal++;
    const fila = cleanText(row.fila_jira ?? "");
    if (fila && fila.toUpperCase() !== SEM_INC) filaJiraPreenchida++;
  }

  const d1SituacaoReparo = controleD1.filter((r) => isReparoValue(getVal(r, "SITUACAO"))).length;
  const d1OrdemReparo = controleD1.filter((r) => isReparoValue(getVal(r, "ORDEM"))).length;
  const semIncAte24hRows = controle.filter(
    (r) => r.status_normalizacao === "ATIVO" && semIncAte24hKeys.has(r.chave),
  );
  const semIncAte24hReport: ProcessReport["jira"]["semIncAte24h"] = {
    total: semIncAte24hRows.length,
    obsSemInc: semIncAte24hRows.filter((r) => r.obs === SEM_INC).length,
    responsavelSemInc: semIncAte24hRows.filter((r) => r.responsavel === SEM_INC).length,
    filaJiraSemInc: semIncAte24hRows.filter((r) => r.fila_jira === SEM_INC).length,
    statusPlanilhaCecAnalisando: semIncAte24hRows.filter(
      (r) => r.status_planilha === STATUS_PLANILHA_PADRAO,
    ).length,
    exemplos: semIncAte24hRows.slice(0, 10).map((r) => ({
      chave: r.chave,
      codigo_loterica: r.codigo_loterica,
      chamado: r.chamado,
      data_hora_inicial: r.data_hora_inicial,
      duracao_h: r.duracao_h,
    })),
  };
  const finalAtivos = seenKeys.size;
  const report: ProcessReport = {
    processamento: {
      dataReferencia,
      processadoEm: processadoEm ?? new Date().toISOString(),
      processadoEmLocal: processadoEmLocal ?? "",
      timezone: timezone ?? "America/Sao_Paulo",
    },
    gis: {
      gis1: gis1.length,
      gis2: gis2.length,
      bruto: gisAll.length,
      finalAtivos,
      diferenca: gisAll.length - finalAtivos,
      duplicadosReaisRemovidos: gisAll.length - finalAtivos,
      colisoesEvitadas,
    },
    d1: {
      total: controleD1.length,
      situacaoReparo: d1SituacaoReparo,
      ordemReparo: d1OrdemReparo,
      cruzados: d1Cruzados,
      herdouSituacaoReparo: d1HerdouSituacaoReparo,
      situacaoHerdada: d1SituacaoHerdada,
      situacaoFallbackReparo: d1SituacaoFallbackReparo,
    },
    jira: {
      total: jira.length,
      cruzados: comJira,
      incValidos: incValidosTotal,
      semInc: semIncTotal,
      colunasDetectadas: jiraDetectedColumns,
      incSnowColunaOrigem:
        Object.entries(jiraIncSnowColumnUsage).sort((a, b) => b[1] - a[1])[0]?.[0] ??
        jiraDetectedIncSnowColumns[0] ??
        null,
      incSnowColunaNaoLocalizada: jiraDetectedIncSnowColumns.length === 0,
      filaJiraPreenchida,
      filaJiraVazia,
      filaJiraSemInc: semIncTotal,
      filaJiraVaziaExemplos,
      semIncAte24h: semIncAte24hReport,
      incSnowPreenchido: jiraIncSnowPreenchido,
      incSnowVazio: jiraIncSnowVazio,
      incSnowIgnoradoInvalido: jiraIncSnowIgnoradoInvalido,
      incSnowUsandoChave: jiraIncSnowUsandoChave,
    },
    grafana: {
      cruzados: comGrafana,
      comPostos: comGrafana,
      colunaPosto: Object.entries(grafanaPostoColumns).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      exemplosPosto: grafanaPostoExamples,
    },
    responsaveis: {
      secundarioTotal: secTotal,
      secundario: distSecundario,
      secundarioPreservadoD1: secPreservadoD1,
      oiTotal,
      oi: distOi,
      oiPreservadoD1,
      oempTotal,
      oempDistribuidos,
      oemp: distOemp,
      semInc: activeRows.filter((r) => r.responsavel === SEM_INC).length,
    },
    resultado: {
      totalControle: controle.length,
      situacaoDistribuicao,
      ordemDistribuicao,
      situacaoReparo: situacaoReparoTotal,
      ordemReparo: ordemReparoTotal,
      ordemConvertidaReparo,
      statusPlanilhaCecAnalisando: statusPlanilhaCec,
      oemp: oempTotal,
      comOs,
      principal,
      secundario,
      normalizados,
    },
  };

  return {
    controle,
    implantacoes,
    stats: {
      consolidado: seenKeys.size,
      normalizados,
      comJira,
      comGrafana,
      comOs,
      report,
    },
  };
}

export const TIPOS_BASE = [
  { tipo: "gis1", label: "GIS 1 Link Fora", obrigatorio: true },
  { tipo: "gis2", label: "GIS 2 Links Fora", obrigatorio: false },
  { tipo: "controle_d1", label: "Controle D-1", obrigatorio: false },
  { tipo: "jira", label: "Jira", obrigatorio: false },
  { tipo: "grafana", label: "Grafana", obrigatorio: false },
  { tipo: "planta", label: "Extração Planta", obrigatorio: false },
] as const;

export type TipoBase = (typeof TIPOS_BASE)[number]["tipo"];
