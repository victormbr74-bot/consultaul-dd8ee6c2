// Geo utilities for 60km informational analysis.
// IMPORTANT: this module never changes massiva detection rules.

export type Sinalizacao60km =
  | "DENTRO_60KM"
  | "PARCIAL_60KM"
  | "FORA_60KM"
  | "SEM_GEO";

export interface CidadeCoord {
  cidade: string;
  uf: string;
  latitude: number;
  longitude: number;
}

export interface CidadesLookup {
  get(cidade: string, uf: string): CidadeCoord | undefined;
  size: number;
}

/** Normalize city name: trim, lowercase, strip accents. */
export function normalizeCidade(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeUf(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

export function buildCidadesLookup(rows: CidadeCoord[]): CidadesLookup {
  const map = new Map<string, CidadeCoord>();
  for (const r of rows) {
    const key = `${normalizeCidade(r.cidade)}|${normalizeUf(r.uf)}`;
    if (!map.has(key)) map.set(key, r);
  }
  return {
    size: map.size,
    get: (cidade: string, uf: string) =>
      map.get(`${normalizeCidade(cidade)}|${normalizeUf(uf)}`),
  };
}

/** Haversine distance in km, rounded to 1 decimal. */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function classifySinalizacao(
  totalComCoord: number,
  totalDentro: number,
  totalCircuitos: number,
): Sinalizacao60km {
  if (totalCircuitos === 0 || totalComCoord === 0) return "SEM_GEO";
  const pct = (totalDentro / totalCircuitos) * 100;
  if (totalDentro === totalComCoord && totalComCoord === totalCircuitos) return "DENTRO_60KM";
  if (pct >= 50) return "PARCIAL_60KM";
  return "FORA_60KM";
}

export const SINALIZACAO_LABEL: Record<Sinalizacao60km, string> = {
  DENTRO_60KM: "DENTRO DE 60 KM",
  PARCIAL_60KM: "PARCIALMENTE DENTRO DE 60 KM",
  FORA_60KM: "FORA DE 60 KM",
  SEM_GEO: "SEM GEOLOCALIZAÇÃO",
};

export const SINALIZACAO_MSG: Record<Sinalizacao60km, string> = {
  DENTRO_60KM:
    "Massiva com circuitos concentrados geograficamente. Possível evento regional.",
  PARCIAL_60KM:
    "Massiva parcialmente concentrada. Verificar se há evento regional com impactos adicionais.",
  FORA_60KM:
    "Massiva com circuitos dispersos geograficamente. Possível evento sistêmico, backbone, plataforma ou operadora.",
  SEM_GEO:
    "Não foi possível calcular o raio por falta de coordenadas na base de cidades.",
};
