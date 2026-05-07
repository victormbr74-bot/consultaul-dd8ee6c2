import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import Ping99Tab from "@/components/loterica/Ping99Tab";
import NoConsultaWarning from "@/components/loterica/NoConsultaWarning";
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
    <div className="container px-4 py-6 max-w-5xl space-y-4">
      {!autoLookupTerm && <NoConsultaWarning />}
      <Ping99Tab autoLookupTerm={autoLookupTerm} />
    </div>
  );
};

export default Ping99;
