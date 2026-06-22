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

const FALLBACK_CIDADES: CidadeCoord[] = [
  { cidade: "BELO HORIZONTE", uf: "MG", latitude: -19.9167, longitude: -43.9345 },
  { cidade: "RIO DE JANEIRO", uf: "RJ", latitude: -22.9068, longitude: -43.1729 },
  { cidade: "SAO PAULO", uf: "SP", latitude: -23.5505, longitude: -46.6333 },
  { cidade: "MONTE APRAZIVEL", uf: "SP", latitude: -20.7725, longitude: -49.7149 },
  { cidade: "BRASILIA", uf: "DF", latitude: -15.7939, longitude: -47.8828 },
  { cidade: "SALVADOR", uf: "BA", latitude: -12.9777, longitude: -38.5016 },
  { cidade: "FORTALEZA", uf: "CE", latitude: -3.7319, longitude: -38.5267 },
  { cidade: "RECIFE", uf: "PE", latitude: -8.0476, longitude: -34.8770 },
  { cidade: "CURITIBA", uf: "PR", latitude: -25.4284, longitude: -49.2733 },
  { cidade: "PORTO ALEGRE", uf: "RS", latitude: -30.0346, longitude: -51.2177 },
  { cidade: "MANAUS", uf: "AM", latitude: -3.1190, longitude: -60.0217 },
  { cidade: "BELEM", uf: "PA", latitude: -1.4558, longitude: -48.4902 },
  { cidade: "GOIANIA", uf: "GO", latitude: -16.6869, longitude: -49.2648 },
  { cidade: "GUARULHOS", uf: "SP", latitude: -23.4543, longitude: -46.5337 },
  { cidade: "CAMPINAS", uf: "SP", latitude: -22.9099, longitude: -47.0626 },
  { cidade: "SAO LUIS", uf: "MA", latitude: -2.5307, longitude: -44.3068 },
  { cidade: "MACEIO", uf: "AL", latitude: -9.6498, longitude: -35.7089 },
  { cidade: "NATAL", uf: "RN", latitude: -5.7793, longitude: -35.2009 },
  { cidade: "TERESINA", uf: "PI", latitude: -5.0892, longitude: -42.8019 },
  { cidade: "JOAO PESSOA", uf: "PB", latitude: -7.1195, longitude: -34.8450 },
  { cidade: "ARACAJU", uf: "SE", latitude: -10.9472, longitude: -37.0731 },
  { cidade: "CUIABA", uf: "MT", latitude: -15.6014, longitude: -56.0979 },
  { cidade: "CAMPO GRANDE", uf: "MS", latitude: -20.4697, longitude: -54.6201 },
  { cidade: "VITORIA", uf: "ES", latitude: -20.2976, longitude: -40.2958 },
  { cidade: "FLORIANOPOLIS", uf: "SC", latitude: -27.5949, longitude: -48.5482 },
  { cidade: "PALMAS", uf: "TO", latitude: -10.2491, longitude: -48.3243 },
  { cidade: "MACAPA", uf: "AP", latitude: 0.0349, longitude: -51.0694 },
  { cidade: "BOA VISTA", uf: "RR", latitude: 2.8235, longitude: -60.6758 },
  { cidade: "RIO BRANCO", uf: "AC", latitude: -9.9754, longitude: -67.8249 },
  { cidade: "PORTO VELHO", uf: "RO", latitude: -8.7612, longitude: -63.9004 },
];

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
  for (const r of [...rows, ...FALLBACK_CIDADES]) {
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
