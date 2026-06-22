import { parseDateBR, formatDateBR } from "./excel";
import {
  buildOperadoraLookup,
  identifyOperadora,
  type OperadoraLookup,
} from "./operadoras";
import type { DbLoterica, DbOperadora } from "./db-types";
import {
  classifySinalizacao,
  haversineKm,
  type CidadesLookup,
  type Sinalizacao60km,
} from "./geo";
import type {
  GisRow,
  Massiva,
  Origem,
  ProcessedRow,
  TipoMassiva,
} from "./gis-types";

const WINDOW_MS = 15 * 60 * 1000;

interface InputRow extends GisRow {
  __origem?: Origem;
}

interface LotericasLookup {
  byCodigo: Map<string, DbLoterica>;
  byCircuito: Map<string, DbLoterica>;
  byLoopback: Map<string, DbLoterica>;
}

function getCell(row: GisRow, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim() !== "") return String(value);
  }
  const entries = Object.entries(row);
  const targets = new Set(keys.flatMap(headerVariants));
  for (const [key, value] of entries) {
    if (value == null || String(value).trim() === "") continue;
    const variants = headerVariants(key);
    if (variants.some((variant) => targets.has(variant))) return String(value);
  }
  return "";
}

function headerVariants(value: string): string[] {
  const raw = String(value ?? "");
  const variants = new Set<string>([normalizeHeader(raw)]);
  const fixed = fixMojibake(raw);
  if (fixed !== raw) variants.add(normalizeHeader(fixed));
  return Array.from(variants).filter(Boolean);
}

function normalizeHeader(value: string): string {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function fixMojibake(value: string): string {
  if (!/[ÃÂ]/.test(value) || typeof TextDecoder === "undefined") return value;
  try {
    const bytes = Uint8Array.from(Array.from(value, (ch) => ch.charCodeAt(0) & 0xff));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return value;
  }
}

function normalizeLookup(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeCircuito(value: unknown): string {
  return normalizeLookup(value).replace(/[^A-Z0-9]/g, "");
}

function rawValue(row: DbLoterica | undefined, ...keys: string[]): string {
  const raw = row?.raw_data;
  if (!raw || typeof raw !== "object") return "";
  const entries = Object.entries(raw);
  for (const key of keys) {
    const target = normalizeCircuito(key);
    const found = entries.find(([k, v]) => normalizeCircuito(k) === target && String(v ?? "").trim() !== "");
    if (found) return String(found[1]).trim();
  }
  return "";
}

function buildLotericasLookup(rows: DbLoterica[] = []): LotericasLookup {
  const byCodigo = new Map<string, DbLoterica>();
  const byCircuito = new Map<string, DbLoterica>();
  const byLoopback = new Map<string, DbLoterica>();
  const addCircuito = (value: unknown, row: DbLoterica) => {
    const key = normalizeCircuito(value);
    if (key && !byCircuito.has(key)) byCircuito.set(key, row);
  };
  const addLoopback = (value: unknown, row: DbLoterica) => {
    const key = String(value ?? "").trim();
    if (key && !byLoopback.has(key)) byLoopback.set(key, row);
  };
  for (const row of rows) {
    const cod = normalizeLookup(row.cod_ul);
    if (cod && !byCodigo.has(cod)) byCodigo.set(cod, row);
    addCircuito(row.designacao_nova, row);
    addCircuito(row.ccto_oi, row);
    addCircuito(row.ccto_oemp, row);
    addCircuito(rawValue(row, "CIRCUITO OEMP", "CIRCUITO BACKUP", "CIRCUITO SECUNDARIO", "CIRCUITO SECUNDÁRIO"), row);
    addCircuito(rawValue(row, "DESIGNACAO NOVA", "DESIGNAÇÃO NOVA", "DESIGINACAO NOVA"), row);
    addLoopback(row.loopback_wan, row);
    addLoopback(row.loopback_lan, row);
    addLoopback(rawValue(row, "LOOPBACK PRINCIPAL"), row);
    addLoopback(rawValue(row, "LOOPBACK SECUNDARIO", "LOOPBACK SECUNDÁRIO"), row);
  }
  return { byCodigo, byCircuito, byLoopback };
}

function findLoterica(
  codigo: string,
  circuito: string,
  ipLoopback: string,
  lookup: LotericasLookup,
): DbLoterica | undefined {
  return (
    lookup.byCircuito.get(normalizeCircuito(circuito)) ||
    lookup.byCodigo.get(normalizeLookup(codigo)) ||
    lookup.byLoopback.get(String(ipLoopback ?? "").trim())
  );
}

function identifyFromLotericas(
  tipoLink: string,
  codigo: string,
  circuito: string,
  ipLoopback: string,
  lookup: LotericasLookup,
) {
  const hit = findLoterica(codigo, circuito, ipLoopback, lookup);
  if (!hit) return null;

  const isSecundario = normalizeLookup(tipoLink) === "SECUNDARIO";
  if (isSecundario) {
    // Regra item 9: Secundário usa Operadora (col E) como Operadora
    // e OPERADORA 4G (col AJ) como Tipo Emp.
    const operadora = normalizeLookup(
      hit.operadora || rawValue(hit, "OPERADORA"),
    );
    const operadora4g = normalizeLookup(
      rawValue(hit, "OPERADORA 4G") || hit.operadora,
    );
    if (!operadora && !operadora4g) return null;
    const op = operadora || operadora4g;
    return {
      operadora: op,
      tipoEmp: operadora4g || op,
      classificacao: "OEMP" as const,
      parceira: op,
    } as const;
  }
  const empresaOemp = normalizeLookup(rawValue(hit, "EMPRESA OEMP", "EMPRESA", "SITE OWNER"));
  const operadoraPri = normalizeLookup(
    hit.operadora || rawValue(hit, "OPERADORA", "RESP BACKUP", "OWNER"),
  );
  const operadora = empresaOemp || operadoraPri;
  if (!operadora) return null;
  const classificacao = operadora === "VTAL" ? "VTAL" : "OEMP";
  return {
    operadora,
    tipoEmp: classificacao === "VTAL" ? "VTAL" : "OEMP",
    classificacao,
    parceira: operadora,
  } as const;
}

function fallbackOperadoraFromGis(row: GisRow, tipoLink: string) {
  const operadora = (getCell(row, "Empresa") || getCell(row, "Site Owner")).trim().toUpperCase();
  if (!operadora) return null;
  const classificacao = tipoLink === "PRINCIPAL" && operadora === "VTAL" ? "VTAL" : "OEMP";
  return {
    operadora,
    tipoEmp: operadora,
    classificacao,
    parceira: operadora,
  } as const;
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function codigoLotericaFromRow(row: GisRow): string {
  return firstText(
    getCell(row, "Cód. da Lotérica", "CÃ³d. da LotÃ©rica", "CÃƒÂ³d. da LotÃƒÂ©rica", "CÃƒÆ’Ã‚Â³d. da LotÃƒÆ’Ã‚Â©rica", "Cod. da Loterica", "Código da Lotérica", "CÃ³digo da LotÃ©rica", "Codigo da Loterica", "Codigo"),
  ).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function nomeLotericaFromRow(row: GisRow): string {
  return firstText(
    getCell(row, "Lotérica", "LotÃ©rica", "LotÃƒÂ©rica", "Loterica", "Nome Lotérica", "Nome Loterica"),
  );
}

function isPrincipalOut(row: ProcessedRow): boolean {
  return row.__tipoLink === "PRINCIPAL" || (row.__origem === "1_LINK" && row.__tipoLink !== "SECUNDARIO");
}

function isBackupOut(row: ProcessedRow): boolean {
  return row.__tipoLink === "SECUNDARIO" || row.__origem === "2_LINKS";
}

function enrichRowFromLoterica(row: GisRow, loterica: DbLoterica | undefined, tipoLink: string) {
  const isSecundario = normalizeLookup(tipoLink) === "SECUNDARIO";
  const codigo = firstText(
    getCell(row, "Cód. da Lotérica", "CÃ³d. da LotÃ©rica", "CÃƒÂ³d. da LotÃƒÂ©rica", "Cod. da Loterica", "Código da Lotérica", "Codigo da Loterica", "Codigo"),
    loterica?.cod_ul,
  );
  const nome = firstText(
    getCell(row, "Lotérica", "LotÃ©rica", "Loterica", "Nome Lotérica", "Nome Loterica"),
    loterica?.nome_loterica,
    rawValue(loterica, "NOME UL", "LOTERICA", "NOME LOTERICA"),
  );
  const cidade = firstText(
    getCell(row, "Cidade", "CIDADE"),
    loterica?.cidade,
    rawValue(loterica, "CIDADE"),
  );
  const uf = firstText(
    getCell(row, "UF", "Uf", "ESTADO", "Estado"),
    loterica?.uf,
    rawValue(loterica, "UF"),
  ).toUpperCase();
  const designacao = firstText(
    getCell(row, "Designação", "DesignaÃ§Ã£o", "DesignaÃƒÂ§ÃƒÂ£o", "Designacao", "DESIGNACAO"),
    isSecundario ? loterica?.ccto_oemp : loterica?.designacao_nova,
    loterica?.ccto_oi,
    loterica?.ccto_oemp,
    rawValue(loterica, "DESIGNACAO NOVA", "DESIGNACAO", "CIRCUITO OEMP", "CIRCUITO BACKUP", "CIRCUITO SECUNDARIO"),
  ).toUpperCase();
  const ipLoopback = firstText(
    getCell(row, "IP Loopback", "IP LOOPBACK", "IP_LOOPBACK", "Loopback"),
    isSecundario ? loterica?.loopback_lan : loterica?.loopback_wan,
    loterica?.loopback_wan,
    loterica?.loopback_lan,
    rawValue(loterica, "LOOPBACK PRINCIPAL", "LOOPBACK SECUNDARIO"),
  );

  return {
    codigo,
    nome,
    cidade,
    uf,
    designacao,
    ipLoopback,
  };
}

function detectWindows(
  sortedIdx: number[],
  ts: number[],
  threshold: number,
): Array<{ idxs: number[]; firstTs: number; lastTs: number }> {
  const events: Array<{ idxs: number[]; firstTs: number; lastTs: number }> = [];
  const n = sortedIdx.length;
  let left = 0;
  let right = 0;
  while (right < n) {
    while (right < n && ts[sortedIdx[right]] - ts[sortedIdx[left]] <= WINDOW_MS) right++;
    const count = right - left;
    if (count >= threshold) {
      const idxs = sortedIdx.slice(left, right);
      events.push({ idxs, firstTs: ts[idxs[0]], lastTs: ts[idxs[idxs.length - 1]] });
      left = right;
    } else {
      left++;
      if (left > right) right = left;
    }
  }
  return events;
}

export interface ProcessResult {
  rows: ProcessedRow[];
  massivas: Massiva[];
  stats: {
    totalRegistros: number;
    principalVtal: number;
    principalOemp: number;
    secundarioUf: number;
    secundarioNacional: number;
    circuitosImpactados: number;
    ufsImpactadas: number;
    naoIdentificados: number;
    lotericasIsoladas: number;
    circuitosIsolados: number;
    ultimaAtualizacao: string;
    geo: {
      baseUsada: boolean;
      cidadesEncontradas: number;
      cidadesNaoEncontradas: number;
      dentro60km: number;
      parcial60km: number;
      fora60km: number;
      semGeo: number;
    };
  };
  lotericasIsoladasDetalhe: Array<{ massiva: string; codigo: string; loterica: string }>;
}

export function processGis(
  input: InputRow[],
  operadorasRows: DbOperadora[] = [],
  lotericasRows: DbLoterica[] = [],
  cidadesLookup?: CidadesLookup,
): ProcessResult {
  const lookup: OperadoraLookup = buildOperadoraLookup(operadorasRows);
  const lotericasLookup = buildLotericasLookup(lotericasRows);

  const rows: ProcessedRow[] = input.map((r, i) => {
    const tipoRawOrig = getCell(r, "Tipo de Link", "Tipo do Link", "TIPO DE LINK", "Tipo Link", "Tipo");
    const tipoUpper = tipoRawOrig.toUpperCase().trim();
    // Normaliza variações: PRINCIPAL/PRI/MAIN, SECUNDARIO/SEC/BACKUP/BKP
    let tipoRaw = tipoUpper;
    if (/^(PRINC|PRI|MAIN|PRIMARIO|PRIMÁRIO)/.test(tipoUpper)) tipoRaw = "PRINCIPAL";
    else if (/^(SEC|BACKUP|BKP|BKO|BK\b)/.test(tipoUpper)) tipoRaw = "SECUNDARIO";
    const uf = getCell(r, "UF", "Uf", "ESTADO", "Estado").toUpperCase().trim();
    const desig = getCell(r, "Designação", "DesignaÃ§Ã£o", "Designacao", "DESIGNACAO");
    const ip = getCell(r, "IP Loopback", "IP LOOPBACK", "IP_LOOPBACK", "Loopback");
    const dataHoraRaw = getCell(r, "Data e Hora Incial", "Data e Hora Inicial", "Data e Hora", "Data/Hora", "DataHora");
    const correctedTs = parseDateBR(dataHoraRaw);
    const correctedCodigo = getCell(r, "Cód. da Lotérica", "CÃ³d. da LotÃ©rica", "CÃƒÂ³d. da LotÃƒÂ©rica", "Cod. da Loterica", "Código da Lotérica", "Codigo da Loterica", "Codigo");
    const lotericaRef = findLoterica(correctedCodigo, desig, ip, lotericasLookup);
    const enriched = enrichRowFromLoterica(r, lotericaRef, tipoRaw);
    const lookupCodigo = enriched.codigo || correctedCodigo;
    const lookupDesig = enriched.designacao || desig;
    const lookupIp = enriched.ipLoopback || ip;
    const lookupUf = enriched.uf || uf;
    const fromLotericas = identifyFromLotericas(tipoRaw, lookupCodigo, lookupDesig, lookupIp, lotericasLookup);
    const identified = identifyOperadora(tipoRaw, lookupDesig, lookupIp, lookupCodigo, lookup);
    const id = fromLotericas ?? (
      identified.classificacao === "NAO_IDENTIFICADO"
        ? (fallbackOperadoraFromGis(r, tipoRaw) ?? identified)
        : identified
    );
    return {
      ...r,
      "Cód. da Lotérica": lookupCodigo,
      "CÃ³d. da LotÃ©rica": lookupCodigo,
      "Código da Lotérica": lookupCodigo,
      "Codigo da Loterica": lookupCodigo,
      "Lotérica": enriched.nome,
      "LotÃ©rica": enriched.nome,
      "Loterica": enriched.nome,
      "Cidade": enriched.cidade,
      "UF": lookupUf,
      "Designação": lookupDesig,
      "DesignaÃ§Ã£o": lookupDesig,
      "Designacao": lookupDesig,
      "IP Loopback": lookupIp,
      __rowId: `r${i}`,
      __origem: (r.__origem as Origem) ?? "1_LINK",
      __tipoLink: tipoRaw,
      __uf: lookupUf,
      __ts: correctedTs,
      __dataHora: isNaN(correctedTs) ? dataHoraRaw : formatDateBR(correctedTs),
      __operadora: id.operadora,
      __classificacao: id.classificacao,
      __parceira: id.parceira,
      __tipoEmp: id.tipoEmp,
      __situacao: "ISOLADO",
      "Status Massiva": "NAO_MASSIVA",
    } as ProcessedRow;
  });

  // Diagnóstico para investigar dashboards zerados
  if (typeof console !== "undefined" && rows.length) {
    const tipoCounts: Record<string, number> = {};
    let invalidTs = 0;
    let semUf = 0;
    for (const r of rows) {
      const k = r.__tipoLink || "(vazio)";
      tipoCounts[k] = (tipoCounts[k] ?? 0) + 1;
      if (isNaN(r.__ts)) invalidTs++;
      if (!r.__uf) semUf++;
    }
    console.info("[massiva] colunas:", Object.keys(input[0] ?? {}));
    console.info("[massiva] tipoLink:", tipoCounts, "| ts inválidos:", invalidTs, "| sem UF:", semUf, "| total:", rows.length);
  }

  const ts = rows.map((r) => r.__ts);
  const valid = (i: number) => !isNaN(rows[i].__ts);

  const principalVtalByUf = new Map<string, number[]>();
  const principalOempByOpUf = new Map<string, number[]>();
  const secByUf = new Map<string, number[]>();
  const secAll: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    if (!valid(i)) continue;
    const r = rows[i];
    if (r.__tipoLink === "PRINCIPAL" && r.__uf) {
      if (r.__classificacao === "VTAL") push(principalVtalByUf, r.__uf, i);
      else if (r.__classificacao === "OEMP" && r.__operadora)
        push(principalOempByOpUf, `${r.__operadora}|${r.__uf}`, i);
    } else if (r.__tipoLink === "SECUNDARIO" && r.__uf) {
      push(secByUf, r.__uf, i);
      secAll.push(i);
    }
  }

  const sortByTs = (arr: number[]) => arr.sort((a, b) => ts[a] - ts[b]);
  const massivas: Massiva[] = [];
  let counter = 1;
  const newId = (prefix: string) => `${prefix}-${String(counter++).padStart(4, "0")}`;

  const apply = (
    events: Array<{ idxs: number[]; firstTs: number; lastTs: number }>,
    tipo: TipoMassiva,
    tipoLink: "PRINCIPAL" | "SECUNDARIO",
    uf: string,
    operadora: string,
    parceira: string,
    idPrefix: string,
  ) => {
    for (const ev of events) {
      const id = newId(idPrefix);
      const janelaMin = Math.round((ev.lastTs - ev.firstTs) / 60000);
      massivas.push({
        id_massiva: id,
        tipo_massiva: tipo,
        tipo_link: tipoLink,
        uf,
        operadora,
        parceira,
        qtd_circuitos: ev.idxs.length,
        primeiro_alarme: formatDateBR(ev.firstTs),
        ultimo_alarme: formatDateBR(ev.lastTs),
        primeiro_ts: ev.firstTs,
        ultimo_ts: ev.lastTs,
        janela_minutos: janelaMin,
        rowIds: ev.idxs.map((i) => rows[i].__rowId),
      });
      for (const i of ev.idxs) {
        const r = rows[i];
        const prev = r["ID Massiva"];
        r["ID Massiva"] = prev ? `${prev} | ${id}` : id;
        const prevT = r["Tipo Massiva"];
        r["Tipo Massiva"] = prev ? `${prevT} | ${tipo}` : tipo;
        r["Status Massiva"] = "MASSIVA";
        r["Quantidade Janela"] = ev.idxs.length;
        r["Primeiro Alarme"] = formatDateBR(ev.firstTs);
        r["Último Alarme"] = formatDateBR(ev.lastTs);
      }
    }
  };

  for (const [uf, idxs] of principalVtalByUf) {
    sortByTs(idxs);
    apply(detectWindows(idxs, ts, 5), "PRINCIPAL_VTAL", "PRINCIPAL", uf, "VTAL", "VTAL", "PV");
  }
  for (const [key, idxs] of principalOempByOpUf) {
    const [op, uf] = key.split("|");
    sortByTs(idxs);
    apply(detectWindows(idxs, ts, 5), "PRINCIPAL_OEMP", "PRINCIPAL", uf, op, op, "PO");
  }
  for (const [uf, idxs] of secByUf) {
    sortByTs(idxs);
    apply(detectWindows(idxs, ts, 15), "SECUNDARIO_UF", "SECUNDARIO", uf, "-", "-", "SU");
  }
  sortByTs(secAll);
  apply(detectWindows(secAll, ts, 50), "SECUNDARIO_NACIONAL", "SECUNDARIO", "NACIONAL", "-", "-", "SN");

  // ---- Deteccao de LOTERICA ISOLADA ----
  // Regra: mesma loterica com PRINCIPAL e BACKUP/SECUNDARIO fora,
  // considerando o tipo_link de cada massiva para vincular isoladas.
  const lotericaLinks = new Map<string, { principal: Set<number>; backup: Set<number> }>();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const cod = codigoLotericaFromRow(r);
    if (!cod) continue;
    const entry = lotericaLinks.get(cod) ?? { principal: new Set(), backup: new Set() };
    if (isPrincipalOut(r)) entry.principal.add(i);
    if (isBackupOut(r)) entry.backup.add(i);
    lotericaLinks.set(cod, entry);
  }
  const codigosIsolados = new Set(
    Array.from(lotericaLinks.entries())
      .filter(([, links]) => links.principal.size > 0 && links.backup.size > 0)
      .map(([codigo]) => codigo),
  );

  const rowById = new Map(rows.map((r) => [r.__rowId, r]));
  const lotericasIsoladasDetalhe: Array<{ massiva: string; codigo: string; loterica: string }> = [];
  const lotByMassiva = new Map<string, Map<string, string>>();

  for (const m of massivas) {
    const isolatedInMassiva = new Map<string, string>();
    const rowIds = new Set(m.rowIds);
    for (const rowId of m.rowIds) {
      const r = rowById.get(rowId);
      if (!r) continue;
      const cod = codigoLotericaFromRow(r);
      if (!cod) continue;
      if (!codigosIsolados.has(cod)) continue;
      if ((m.tipo_link === "PRINCIPAL" && isPrincipalOut(r)) || (m.tipo_link === "SECUNDARIO" && isBackupOut(r))) {
        const lot = nomeLotericaFromRow(r);
        if (lot && !isolatedInMassiva.has(cod)) isolatedInMassiva.set(cod, lot);
      }
    }
    for (const [cod, links] of lotericaLinks) {
      if (!codigosIsolados.has(cod) || isolatedInMassiva.has(cod)) continue;
      const candidateIdxs = m.tipo_link === "PRINCIPAL" ? links.principal : links.backup;
      const matchIdx = Array.from(candidateIdxs).find((idx) => {
        const r = rows[idx];
        if (!r || r.__uf !== m.uf) return false;
        if (rowIds.has(r.__rowId)) return true;
        return Number.isFinite(r.__ts) && r.__ts >= m.primeiro_ts && r.__ts <= m.ultimo_ts;
      });
      if (matchIdx != null) {
        isolatedInMassiva.set(cod, nomeLotericaFromRow(rows[matchIdx]));
      }
    }
    lotByMassiva.set(m.id_massiva, isolatedInMassiva);
    m.qtd_lotericas_isoladas = isolatedInMassiva.size;
    m.lotericas_isoladas = Array.from(isolatedInMassiva, ([codigo, loterica]) => ({ codigo, loterica }));
    for (const [codigo, loterica] of isolatedInMassiva) {
      lotericasIsoladasDetalhe.push({ massiva: m.id_massiva, codigo, loterica });
    }
  }

  // Aplica __situacao em cada row.
  for (const r of rows) {
    const cod = codigoLotericaFromRow(r);
    if (cod && codigosIsolados.has(cod)) r.__situacao = "LOTERICA_ISOLADA";
    else if (r["Status Massiva"] === "MASSIVA") r.__situacao = "MASSIVA";
    else r.__situacao = "ISOLADO";
  }

  // ---- Análise geográfica (sinalização informativa de 60 km) ----
  const geoStats = applyGeoAnalysis(rows, massivas, cidadesLookup);

  const stats = {
    totalRegistros: rows.length,
    principalVtal: massivas.filter((m) => m.tipo_massiva === "PRINCIPAL_VTAL").length,
    principalOemp: massivas.filter((m) => m.tipo_massiva === "PRINCIPAL_OEMP").length,
    secundarioUf: massivas.filter((m) => m.tipo_massiva === "SECUNDARIO_UF").length,
    secundarioNacional: massivas.filter((m) => m.tipo_massiva === "SECUNDARIO_NACIONAL").length,
    circuitosImpactados: rows.filter((r) => r["Status Massiva"] === "MASSIVA").length,
    ufsImpactadas: new Set(
      rows.filter((r) => r["Status Massiva"] === "MASSIVA").map((r) => r.__uf),
    ).size,
    naoIdentificados: rows.filter((r) => r.__classificacao === "NAO_IDENTIFICADO").length,
    lotericasIsoladas: codigosIsolados.size,
    circuitosIsolados: rows.filter((r) => r.__situacao === "ISOLADO").length,
    ultimaAtualizacao: formatDateBR(Date.now()),
    geo: geoStats,
  };

  return { rows, massivas, stats, lotericasIsoladasDetalhe };
}

/**
 * Computes informational 60 km radius analysis for each detected massiva.
 * NEVER changes Status Massiva or any detection rule.
 */
function applyGeoAnalysis(
  rows: ProcessedRow[],
  massivas: Massiva[],
  cidadesLookup?: CidadesLookup,
): ProcessResult["stats"]["geo"] {
  const baseUsada = !!cidadesLookup && cidadesLookup.size > 0;
  let cidadesEncontradas = 0;
  let cidadesNaoEncontradas = 0;
  const cidadesProbed = new Set<string>();
  const tally: Record<Sinalizacao60km, number> = {
    DENTRO_60KM: 0,
    PARCIAL_60KM: 0,
    FORA_60KM: 0,
    SEM_GEO: 0,
  };

  for (const m of massivas) {
    const rowSet = new Set(m.rowIds);
    const partRows = rows.filter((r) => rowSet.has(r.__rowId));

    // Count circuits per (cidade,uf)
    const cityCount = new Map<string, { cidade: string; uf: string; qtd: number }>();
    for (const r of partRows) {
      const cidade = String(r["Cidade"] ?? "").trim();
      const uf = r.__uf;
      if (!cidade || !uf) continue;
      const key = `${cidade.toLowerCase()}|${uf}`;
      const cur = cityCount.get(key);
      if (cur) cur.qtd += 1;
      else cityCount.set(key, { cidade, uf, qtd: 1 });
    }
    const cidades_afetadas = Array.from(cityCount.values()).sort(
      (a, b) => b.qtd - a.qtd,
    );
    m.cidades_afetadas = cidades_afetadas;
    m.qtd_cidades_afetadas = cidades_afetadas.length;

    if (!baseUsada || cidades_afetadas.length === 0) {
      m.sinalizacao_60km = "SEM_GEO";
      m.cidade_epicentro = cidades_afetadas[0]?.cidade ?? "";
      m.uf_epicentro = cidades_afetadas[0]?.uf ?? "";
      m.raio_maximo_km = 0;
      m.percentual_dentro_60km = 0;
      m.qtd_circuitos_dentro_60km = 0;
      m.qtd_circuitos_fora_60km = 0;
      for (const r of partRows) {
        r.__distanciaEpicentroKm = null;
        r.__dentro60km = "SEM_GEO";
      }
      tally.SEM_GEO++;
      continue;
    }

    // Epicenter = city with most circuits from GIS. Coordinates only enrich the result.
    const epicentroCidade = cidades_afetadas[0];
    for (const c of cidades_afetadas) {
      const probeKey = `${c.cidade.toLowerCase()}|${c.uf}`;
      const coord = cidadesLookup!.get(c.cidade, c.uf);
      if (!cidadesProbed.has(probeKey)) {
        cidadesProbed.add(probeKey);
        if (coord) cidadesEncontradas++;
        else cidadesNaoEncontradas++;
      }
    }
    const epicentroCoord = epicentroCidade ? cidadesLookup!.get(epicentroCidade.cidade, epicentroCidade.uf) : undefined;

    if (!epicentroCidade || !epicentroCoord) {
      m.sinalizacao_60km = "SEM_GEO";
      m.cidade_epicentro = cidades_afetadas[0]?.cidade ?? "";
      m.uf_epicentro = cidades_afetadas[0]?.uf ?? "";
      m.raio_maximo_km = 0;
      m.percentual_dentro_60km = 0;
      m.qtd_circuitos_dentro_60km = 0;
      m.qtd_circuitos_fora_60km = 0;
      for (const r of partRows) {
        r.__distanciaEpicentroKm = null;
        r.__dentro60km = "SEM_GEO";
      }
      tally.SEM_GEO++;
      continue;
    }

    let dentro = 0;
    let fora = 0;
    let comCoord = 0;
    let raioMax = 0;
    for (const r of partRows) {
      const cidade = String(r["Cidade"] ?? "").trim();
      const uf = r.__uf;
      const coord = cidade && uf ? cidadesLookup!.get(cidade, uf) : undefined;
      if (!coord) {
        r.__distanciaEpicentroKm = null;
        r.__dentro60km = "SEM_GEO";
        continue;
      }
      const d = haversineKm(epicentroCoord.latitude, epicentroCoord.longitude, coord.latitude, coord.longitude);
      r.__distanciaEpicentroKm = d;
      comCoord++;
      if (d > raioMax) raioMax = d;
      if (d <= 60) { dentro++; r.__dentro60km = "SIM"; }
      else { fora++; r.__dentro60km = "NAO"; }
    }

    const totalComCoord = comCoord;
    const sin = classifySinalizacao(comCoord, dentro, totalComCoord);
    m.sinalizacao_60km = sin;
    m.cidade_epicentro = epicentroCidade.cidade;
    m.uf_epicentro = epicentroCidade.uf;
    m.raio_maximo_km = Math.round(raioMax * 10) / 10;
    m.percentual_dentro_60km = totalComCoord > 0 ? Math.round((dentro / totalComCoord) * 100) : 0;
    m.qtd_circuitos_dentro_60km = dentro;
    m.qtd_circuitos_fora_60km = fora;
    tally[sin]++;
  }

  return {
    baseUsada,
    cidadesEncontradas,
    cidadesNaoEncontradas,
    dentro60km: tally.DENTRO_60KM,
    parcial60km: tally.PARCIAL_60KM,
    fora60km: tally.FORA_60KM,
    semGeo: tally.SEM_GEO,
  };
}

function push<K>(m: Map<K, number[]>, k: K, v: number) {
  const arr = m.get(k);
  if (arr) arr.push(v);
  else m.set(k, [v]);
}
