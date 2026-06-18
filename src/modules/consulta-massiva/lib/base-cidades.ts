import { supabase } from "@/integrations/supabase/client";
import {
  buildCidadesLookup,
  normalizeCidade,
  normalizeUf,
  type CidadeCoord,
  type CidadesLookup,
} from "./geo";

export interface DbBaseCidade {
  id: string;
  cidade: string;
  uf: string;
  latitude: number;
  longitude: number;
  cidade_normalizada: string;
  created_at?: string;
  updated_at?: string;
}

export async function fetchAllCidades(): Promise<CidadeCoord[]> {
  const out: CidadeCoord[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("base_cidades" as never)
      .select("cidade, uf, latitude, longitude")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as CidadeCoord[];
    if (!rows.length) break;
    out.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

export async function loadCidadesLookup(): Promise<CidadesLookup> {
  try {
    const rows = await fetchAllCidades();
    return buildCidadesLookup(rows);
  } catch (e) {
    console.warn("base_cidades load failed:", (e as Error).message);
    return buildCidadesLookup([]);
  }
}

export interface ParsedCidadeRow {
  cidade: string;
  uf: string;
  latitude: number;
  longitude: number;
  cidade_normalizada: string;
}

export interface ParseResult {
  valid: ParsedCidadeRow[];
  errors: Array<{ row: number; reason: string }>;
}

function toNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseCidadesRows(
  rows: Array<Record<string, unknown>>,
): ParseResult {
  const valid: ParsedCidadeRow[] = [];
  const errors: Array<{ row: number; reason: string }> = [];
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const cidade = String(
      r["Cidade"] ?? r["cidade"] ?? r["CIDADE"] ?? "",
    ).trim();
    const ufRaw = String(r["UF"] ?? r["uf"] ?? "").trim();
    const lat = toNumber(r["Latitude"] ?? r["latitude"] ?? r["LAT"]);
    const lon = toNumber(r["Longitude"] ?? r["longitude"] ?? r["LON"] ?? r["LNG"]);
    const line = i + 2; // header at line 1
    if (!cidade) return errors.push({ row: line, reason: "Cidade vazia" });
    const uf = normalizeUf(ufRaw);
    if (uf.length !== 2) return errors.push({ row: line, reason: "UF inválida" });
    if (lat == null || lat < -90 || lat > 90)
      return errors.push({ row: line, reason: "Latitude inválida" });
    if (lon == null || lon < -180 || lon > 180)
      return errors.push({ row: line, reason: "Longitude inválida" });
    const cidade_normalizada = normalizeCidade(cidade);
    const key = `${cidade_normalizada}|${uf}`;
    if (seen.has(key)) return; // de-duplicate within file silently
    seen.add(key);
    valid.push({ cidade, uf, latitude: lat, longitude: lon, cidade_normalizada });
  });
  return { valid, errors };
}

export async function upsertCidades(
  rows: ParsedCidadeRow[],
): Promise<{ inserted: number }> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase
      .from("base_cidades" as never)
      .upsert(batch as never, { onConflict: "cidade_normalizada,uf" });
    if (error) throw error;
    inserted += batch.length;
  }
  return { inserted };
}
