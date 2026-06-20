import type { DbLoterica, DbOperadora, DbEscalonamento } from "./db-types";

const upper = (v: unknown) => String(v ?? "").trim().toUpperCase();
const norm = (v: unknown) => String(v ?? "").trim();

const rawValue = (row: DbLoterica, ...keys: string[]) => {
  const raw = row.raw_data;
  if (!raw || typeof raw !== "object") return "";
  const normalizeKey = (v: string) =>
    v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const entries = Object.entries(raw);
  for (const key of keys) {
    const target = normalizeKey(key);
    const found = entries.find(([k, v]) => normalizeKey(k) === target && norm(v));
    if (found) return norm(found[1]);
  }
  return "";
};

export interface OperadoraLookup {
  byCodigo: Map<string, DbOperadora>;
  byDesig: Map<string, DbOperadora>;
  byLoopP: Map<string, DbOperadora>;
  byLoopS: Map<string, DbOperadora>;
  all: DbOperadora[];
}

export function buildOperadoraLookup(rows: DbOperadora[]): OperadoraLookup {
  const byCodigo = new Map<string, DbOperadora>();
  const byDesig = new Map<string, DbOperadora>();
  const byLoopP = new Map<string, DbOperadora>();
  const byLoopS = new Map<string, DbOperadora>();
  for (const r of rows) {
    if (!r.ativo) continue;
    if (r.codigo_loterica) byCodigo.set(norm(r.codigo_loterica), r);
    if (r.designacao) byDesig.set(upper(r.designacao), r);
    if (r.ip_loopback) byLoopP.set(norm(r.ip_loopback), r);
    if (r.ip_loopback_secundario) byLoopS.set(norm(r.ip_loopback_secundario), r);
  }
  return { byCodigo, byDesig, byLoopP, byLoopS, all: rows };
}

export function operadoraFromLoterica(row: DbLoterica): DbOperadora {
  const empresaOemp = upper(rawValue(row, "EMPRESA OEMP", "EMPRESA PRINCIPAL", "OPERADORA PRINCIPAL"));
  const operadora4g = upper(row.operadora || rawValue(row, "OPERADORA 4G", "OPERADORA", "RESP BACKUP"));
  const operadoraPrincipal = empresaOemp || "VTAL";
  const designacao =
    upper(row.designacao_nova) ||
    upper(row.ccto_oi) ||
    upper(rawValue(row, "DESIGNACAO NOVA", "DESIGNACAO", "DESIGINACAO NOVA"));
  const ipLoopback = norm(row.loopback_wan || rawValue(row, "LOOPBACK PRINCIPAL"));
  const ipLoopbackSec = norm(row.loopback_lan || rawValue(row, "LOOPBACK SECUNDARIO"));
  const codigo = norm(row.cod_ul);

  return {
    id: codigo || designacao || ipLoopback || ipLoopbackSec,
    codigo_loterica: codigo,
    designacao,
    ip_loopback: ipLoopback,
    ip_loopback_secundario: ipLoopbackSec,
    operadora: operadoraPrincipal,
    operadora_4g: operadora4g,
    tipo_empresa: operadoraPrincipal === "VTAL" ? "VTAL" : "OEMP",
    ativo: true,
  };
}

export function operadorasFromLotericas(rows: DbLoterica[]): DbOperadora[] {
  return rows
    .map(operadoraFromLoterica)
    .filter((row) => row.codigo_loterica || row.designacao || row.ip_loopback || row.ip_loopback_secundario);
}

export function identifyOperadora(
  tipoLink: string,
  designacao: string,
  ipLoopback: string,
  codigoLoterica: string,
  lookup: OperadoraLookup,
): {
  operadora: string;
  tipoEmp: string;
  classificacao: "VTAL" | "OEMP" | "NAO_IDENTIFICADO";
  parceira: string;
} {
  const d = upper(designacao);
  const ip = norm(ipLoopback);
  const cod = norm(codigoLoterica);
  const isSecundario = upper(tipoLink) === "SECUNDARIO";
  const hit = isSecundario
    ? ((ip && lookup.byLoopS.get(ip)) || (cod && lookup.byCodigo.get(cod)) || (d && lookup.byDesig.get(d)))
    : ((d && lookup.byDesig.get(d)) || (ip && lookup.byLoopP.get(ip)) || (ip && lookup.byLoopS.get(ip)));
  if (!hit) return { operadora: "NAO_IDENTIFICADO", tipoEmp: "NAO_IDENTIFICADO", classificacao: "NAO_IDENTIFICADO", parceira: "" };
  if (isSecundario) {
    const operadora = upper(hit.operadora) || "NAO_IDENTIFICADO";
    const tipoEmp = upper(hit.operadora_4g) || operadora;
    return {
      operadora,
      tipoEmp,
      classificacao: operadora === "NAO_IDENTIFICADO" ? "NAO_IDENTIFICADO" : "OEMP",
      parceira: operadora === "NAO_IDENTIFICADO" ? "" : operadora,
    };
  }
  if (hit.tipo_empresa === "VTAL") return { operadora: "VTAL", tipoEmp: "VTAL", classificacao: "VTAL", parceira: "VTAL" };
  return { operadora: upper(hit.operadora), tipoEmp: hit.tipo_empresa, classificacao: "OEMP", parceira: upper(hit.operadora) };
}

export function buildEscalonamentoMap(rows: DbEscalonamento[]): Map<string, DbEscalonamento> {
  const m = new Map<string, DbEscalonamento>();
  for (const r of rows) if (r.ativo && !m.has(r.operadora.toUpperCase())) m.set(r.operadora.toUpperCase(), r);
  return m;
}
