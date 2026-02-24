import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Moon, Sun, Palette } from "lucide-react";

const ThemeHeaderActions = () => {
  const { mode, toggleMode } = useTheme();
  const { user } = useAuth();

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={toggleMode}
        title={mode === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
      >
        {mode === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </Button>
      {user && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          asChild
          title="Escolher paleta de cores"
        >
          <Link to="/temas" aria-label="Temas e cores">
            <Palette className="w-4 h-4" />
          </Link>
        </Button>
      )}
    </div>
  );
};

export default ThemeHeaderActions;
