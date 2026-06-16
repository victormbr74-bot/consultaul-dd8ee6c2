export const BRASILEIRAO_SERIE_A_TEAMS = [
  { id: "athletico-pr", label: "Athletico-PR", shortName: "CAP", primary: "0 78% 38%", accent: "0 0% 10%", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/4/43/Athletico_Paranaense_%28Logo_2019%29.svg" },
  { id: "atletico-mg", label: "Atletico-MG", shortName: "CAM", primary: "0 0% 8%", accent: "0 0% 92%", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/2/27/Clube_Atl%C3%A9tico_Mineiro_logo.svg" },
  { id: "bahia", label: "Bahia", shortName: "BAH", primary: "214 82% 38%", accent: "0 76% 50%", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/2/2c/Esporte_Clube_Bahia_logo.svg" },
  { id: "botafogo", label: "Botafogo", shortName: "BOT", primary: "0 0% 8%", accent: "0 0% 95%", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/52/Botafogo_de_Futebol_e_Regatas_logo.svg" },
  { id: "chapecoense", label: "Chapecoense", shortName: "CHA", primary: "142 62% 28%", accent: "0 0% 95%", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4e/Logo_Associa%C3%A7%C3%A3o_Chapecoense_de_Futebol.svg" },
  { id: "corinthians", label: "Corinthians", shortName: "COR", primary: "0 0% 8%", accent: "0 0% 95%", imageUrl: "https://upload.wikimedia.org/wikipedia/pt/b/b4/Corinthians_simbolo.png" },
  { id: "coritiba", label: "Coritiba", shortName: "CFC", primary: "150 72% 25%", accent: "0 0% 95%", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/b/bd/Coritiba_Foot_Ball_Club_logo.svg" },
  { id: "cruzeiro", label: "Cruzeiro", shortName: "CRU", primary: "220 82% 38%", accent: "0 0% 95%", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg" },
  { id: "flamengo", label: "Flamengo", shortName: "FLA", primary: "0 78% 42%", accent: "0 0% 8%", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/9/96/Clube_de_Regatas_do_Flamengo_logo.svg" },
  { id: "fluminense", label: "Fluminense", shortName: "FLU", primary: "350 60% 30%", accent: "145 62% 25%", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/1/12/Fluminense_Football_Club.svg" },
  { id: "gremio", label: "Gremio", shortName: "GRE", primary: "201 80% 43%", accent: "0 0% 8%", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/0/08/Gremio_logo.svg" },
  { id: "internacional", label: "Internacional", shortName: "INT", primary: "0 76% 42%", accent: "0 0% 95%", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c5/Sport_Club_Internacional_logo.svg" },
  { id: "mirassol", label: "Mirassol", shortName: "MIR", primary: "48 96% 52%", accent: "142 70% 25%", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/2/2c/Mirassol_Futebol_Clube_logo.svg" },
  { id: "palmeiras", label: "Palmeiras", shortName: "PAL", primary: "144 72% 27%", accent: "0 0% 95%", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/6/60/SE_Palmeiras_2025_crest.png" },
  { id: "red-bull-bragantino", label: "Red Bull Bragantino", shortName: "RBB", primary: "0 76% 48%", accent: "0 0% 95%", imageUrl: "https://upload.wikimedia.org/wikipedia/pt/9/9e/RedBullBragantino.png" },
  { id: "remo", label: "Remo", shortName: "REM", primary: "216 80% 30%", accent: "0 0% 95%", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/7/70/Clube_do_Remo.svg" },
  { id: "santos", label: "Santos", shortName: "SAN", primary: "0 0% 8%", accent: "0 0% 96%", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/0/0e/Santos_Futebol_Clube_logo_%28with_stars_and_crown%29.png" },
  { id: "sao-paulo", label: "Sao Paulo", shortName: "SPFC", primary: "0 76% 46%", accent: "0 0% 8%", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f4/S%C3%A3o_Paulo_Futebol_Clube_logo_%282022%29.svg" },
  { id: "vasco", label: "Vasco", shortName: "VAS", primary: "0 0% 8%", accent: "0 0% 96%", imageUrl: "https://upload.wikimedia.org/wikipedia/pt/8/8b/EscudoDoVascoDaGama.svg" },
  { id: "vitoria", label: "Vitoria", shortName: "VIT", primary: "0 76% 42%", accent: "0 0% 8%", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/1/15/Esporte_Clube_Vit%C3%B3ria_%282024%29.svg" },
] as const;

export type BrasileiraoSerieATeam = (typeof BRASILEIRAO_SERIE_A_TEAMS)[number]["id"];
export type BrasileiraoSerieATeamInfo = (typeof BRASILEIRAO_SERIE_A_TEAMS)[number];

const BRASILEIRAO_SERIE_A_TEAM_IDS = new Set<string>(BRASILEIRAO_SERIE_A_TEAMS.map((team) => team.id));

export const isBrasileiraoSerieATeam = (value: unknown): value is BrasileiraoSerieATeam =>
  typeof value === "string" && BRASILEIRAO_SERIE_A_TEAM_IDS.has(value);

export const DEFAULT_BRASILEIRAO_SERIE_A_TEAM: BrasileiraoSerieATeam = "flamengo";

export const BRASILEIRAO_SERIE_A_TEAM_BY_ID = Object.fromEntries(
  BRASILEIRAO_SERIE_A_TEAMS.map((team) => [team.id, team]),
) as Record<BrasileiraoSerieATeam, BrasileiraoSerieATeamInfo>;
