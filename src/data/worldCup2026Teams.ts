// Temas das 6 maiores selecoes campeas da Copa do Mundo (por titulos).
export const WORLD_CUP_2026_TEAMS = [
  { id: "argentina", label: "Argentina", primary: "204 86% 42%", accent: "48 94% 56%" },
  { id: "brazil", label: "Brasil", primary: "142 72% 30%", accent: "48 98% 50%" },
  { id: "france", label: "Franca", primary: "222 78% 33%", accent: "0 76% 44%" },
  { id: "germany", label: "Alemanha", primary: "0 0% 12%", accent: "47 98% 52%" },
  { id: "italy", label: "Italia", primary: "214 82% 34%", accent: "0 0% 96%" },
  { id: "uruguay", label: "Uruguai", primary: "204 86% 42%", accent: "0 0% 95%" },
] as const;

export type WorldCupTeam = (typeof WORLD_CUP_2026_TEAMS)[number]["id"];

const WORLD_CUP_2026_TEAM_IDS = new Set<string>(WORLD_CUP_2026_TEAMS.map((team) => team.id));

export const isWorldCupTeam = (value: unknown): value is WorldCupTeam =>
  typeof value === "string" && WORLD_CUP_2026_TEAM_IDS.has(value);

export const DEFAULT_WORLD_CUP_TEAM: WorldCupTeam = "brazil";

export const WORLD_CUP_2026_TEAM_BY_ID = Object.fromEntries(
  WORLD_CUP_2026_TEAMS.map((team) => [team.id, team]),
) as Record<WorldCupTeam, (typeof WORLD_CUP_2026_TEAMS)[number]>;
