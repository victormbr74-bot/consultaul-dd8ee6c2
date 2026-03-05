import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import Ping99Tab from "@/components/loterica/Ping99Tab";
import { useSidebarActions } from "@/contexts/SidebarActionsContext";

const Ping99 = () => {
  const [searchParams] = useSearchParams();
  const { consultaSearch } = useSidebarActions();

  const autoLookupTerm = useMemo(() => {
    const fromQuery = String(searchParams.get("q") || "").trim();
    if (fromQuery) return fromQuery;
    return String(consultaSearch || "").trim();
  }, [searchParams, consultaSearch]);

  return (
    <div className="container px-4 py-6 max-w-5xl">
      <Ping99Tab autoLookupTerm={autoLookupTerm} />
    </div>
  );
};

export default Ping99;
