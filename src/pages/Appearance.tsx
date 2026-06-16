import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  WORLD_CUP_2026_TEAMS,
  WORLD_CUP_2026_TEAM_BY_ID,
  type WorldCupTeam,
} from "@/data/worldCup2026Teams";
import {
  BRASILEIRAO_SERIE_A_TEAMS,
  BRASILEIRAO_SERIE_A_TEAM_BY_ID,
  type BrasileiraoSerieATeam,
} from "@/data/brasileiraoSerieATeams";
import { useTheme, type ThemeColor } from "@/contexts/ThemeContext";
import { Moon, Sun } from "lucide-react";

const TEAM_OPTIONS = [...WORLD_CUP_2026_TEAMS].sort((a, b) => a.label.localeCompare(b.label));
const BRASILEIRAO_TEAM_OPTIONS = [...BRASILEIRAO_SERIE_A_TEAMS].sort((a, b) => a.label.localeCompare(b.label));

const PALETTES: Array<{ id: ThemeColor; label: string; preview: string }> = [
  { id: "blue", label: "Azul", preview: "215 80% 45%" },
  { id: "red", label: "Vermelho", preview: "0 75% 50%" },
  { id: "green", label: "Verde", preview: "142 55% 42%" },
  { id: "purple", label: "Roxo", preview: "270 75% 55%" },
  { id: "pink", label: "Rosa", preview: "330 80% 58%" },
  { id: "sky", label: "Azul Claro", preview: "198 90% 50%" },
  { id: "orange", label: "Laranja", preview: "24 95% 52%" },
  { id: "gray", label: "Cinza", preview: "220 10% 55%" },
  { id: "brazil", label: "Brasileiro", preview: "142 72% 30%" },
  { id: "world-cup", label: "Copa Campeas", preview: "142 72% 34%" },
  { id: "brasileirao", label: "Brasileirao Serie A", preview: "0 76% 42%" },
];

const Appearance = () => {
  const {
    mode,
    setMode,
    color,
    setColor,
    worldCupTeam,
    setWorldCupTeam,
    brasileiraoTeam,
    setBrasileiraoTeam,
  } = useTheme();

  const palettesWithDynamicWorldCupColor = PALETTES.map((palette) => {
    if (palette.id === "world-cup") {
      return {
        ...palette,
        preview: WORLD_CUP_2026_TEAM_BY_ID[worldCupTeam].primary,
      };
    }
    if (palette.id === "brasileirao") {
      return {
        ...palette,
        preview: BRASILEIRAO_SERIE_A_TEAM_BY_ID[brasileiraoTeam].primary,
      };
    }
    return {
      ...palette,
    };
  });

  return (
    <div className="bg-background">
      <main className="container px-4 py-6 max-w-3xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Temas e Cores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Tema</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={mode === "light" ? "default" : "outline"}
                  onClick={() => setMode("light")}
                >
                  <Sun className="w-4 h-4 mr-2" /> Claro
                </Button>
                <Button
                  type="button"
                  variant={mode === "dark" ? "default" : "outline"}
                  onClick={() => setMode("dark")}
                >
                  <Moon className="w-4 h-4 mr-2" /> Escuro
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Paleta de Cores</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {palettesWithDynamicWorldCupColor.map((palette) => (
                  <Button
                    key={palette.id}
                    type="button"
                    variant={color === palette.id ? "default" : "outline"}
                    className="justify-start"
                    onClick={() => setColor(palette.id)}
                  >
                    <span
                      className="inline-block w-3 h-3 rounded-full mr-2 border border-black/10 dark:border-white/10"
                      style={{ backgroundColor: `hsl(${palette.preview})` }}
                    />
                    {palette.label}
                  </Button>
                ))}
              </div>
            </div>

            {color === "world-cup" && (
              <div className="space-y-2">
                <Label htmlFor="world-cup-team">Tema Copa 2026</Label>
                <Select value={worldCupTeam} onValueChange={(value) => setWorldCupTeam(value as WorldCupTeam)}>
                  <SelectTrigger id="world-cup-team" className="w-full sm:w-[320px]">
                    <SelectValue placeholder="Selecione uma selecao" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAM_OPTIONS.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        <img src={team.flagImg} alt={team.label} className="inline-block w-5 h-3.5 object-cover rounded-sm mr-1.5 align-middle" /> {team.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground">
                  As cores sao aplicadas conforme a selecao escolhida entre as 6 maiores campeas mundiais.
                </div>
              </div>
            )}

            {color === "brasileirao" && (
              <div className="space-y-2">
                <Label htmlFor="brasileirao-team">Tema Brasileirao Serie A</Label>
                <Select value={brasileiraoTeam} onValueChange={(value) => setBrasileiraoTeam(value as BrasileiraoSerieATeam)}>
                  <SelectTrigger id="brasileirao-team" className="w-full sm:w-[320px]">
                    <SelectValue placeholder="Selecione um time" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRASILEIRAO_TEAM_OPTIONS.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        <img src={team.imageUrl} alt={team.label} className="inline-block w-5 h-5 object-contain mr-1.5 align-middle" />{" "}
                        {team.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground">
                  As cores e a imagem real do time sao aplicadas conforme o time selecionado da Serie A 2026.
                </div>
              </div>
            )}

            {color === "brazil" && (
              <div className="text-xs text-muted-foreground">
                O tema Brasileiro aplica as cores e a bandeira da selecao brasileira ao fundo do sistema.
              </div>
            )}

            <div className="text-xs text-muted-foreground">Suas preferencias ficam salvas neste navegador.</div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Appearance;
