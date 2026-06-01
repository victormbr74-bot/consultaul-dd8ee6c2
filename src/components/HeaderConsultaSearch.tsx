import { Search } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { useSidebarActions } from "@/contexts/SidebarActionsContext";

const HeaderConsultaSearch = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { consultaSearch, setConsultaSearch, onSearchSubmit, setLotericaTab } = useSidebarActions();

  return (
    <div className="relative w-full max-w-xl">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Buscar por codigo, nome, CCTO ou cidade..."
        className="h-9 pl-9"
        value={consultaSearch}
        onChange={(e) => setConsultaSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;

          e.preventDefault();
          setLotericaTab("consulta");

          if (location.pathname !== "/") {
            navigate("/");
            return;
          }

          onSearchSubmit?.();
        }}
      />
    </div>
  );
};

export default HeaderConsultaSearch;
