import type { DbOperadora, DbEscalonamento } from "./db-types";

const upper = (v: unknown) => String(v ?? "").trim().toUpperCase();
const norm = (v: unknown) => String(v ?? "").trim();

export interface OperadoraLookup {
  byDesig: Map<string, DbOperadora>;
  byLoopP: Map<string, DbOperadora>;
  byLoopS: Map<string, DbOperadora>;
  all: DbOperadora[];
}

export function buildOperadoraLookup(rows: DbOperadora[]): OperadoraLookup {
  const byDesig = new Map<string, DbOperadora>();
  const byLoopP = new Map<string, DbOperadora>();
  const byLoopS = new Map<string, DbOperadora>();
  for (const r of rows) {
    if (!r.ativo) continue;
    if (r.designacao) byDesig.set(r.designacao.toUpperCase(), r);
    if (r.ip_loopback) byLoopP.set(r.ip_loopback, r);
    if (r.ip_loopback_secundario) byLoopS.set(r.ip_loopback_secundario, r);
  }
  return { byDesig, byLoopP, byLoopS, all: rows };
}

export function identifyOperadora(
  designacao: string,
  ipLoopback: string,
  lookup: OperadoraLookup,
): {
  operadora: string;
  classificacao: "VTAL" | "OEMP" | "NAO_IDENTIFICADO";
  parceira: string;
} {
  const d = upper(designacao);
  const ip = norm(ipLoopback);
  const hit =
    (d && lookup.byDesig.get(d)) ||
    (ip && lookup.byLoopP.get(ip)) ||
    (ip && lookup.byLoopS.get(ip));
  if (!hit) return { operadora: "NAO_IDENTIFICADO", classificacao: "NAO_IDENTIFICADO", parceira: "" };
  if (hit.tipo_empresa === "VTAL") return { operadora: "VTAL", classificacao: "VTAL", parceira: "VTAL" };
  return { operadora: hit.operadora, classificacao: "OEMP", parceira: hit.operadora };
}

export function buildEscalonamentoMap(rows: DbEscalonamento[]): Map<string, DbEscalonamento> {
  const m = new Map<string, DbEscalonamento>();
  for (const r of rows) if (r.ativo && !m.has(r.operadora.toUpperCase())) m.set(r.operadora.toUpperCase(), r);
  return m;
}
