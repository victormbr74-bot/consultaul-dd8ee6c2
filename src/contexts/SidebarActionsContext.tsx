import { createContext, useContext, useState, ReactNode, useRef } from "react";

export type ConsultaSearchMode = "loterica" | "mac";

interface SidebarActionsContextType {
  onExport: (() => void) | undefined;
  setOnExport: (fn: (() => void) | undefined) => void;
  onImportClick: (() => void) | undefined;
  setOnImportClick: (fn: (() => void) | undefined) => void;
  onSearchSubmit: (() => void) | undefined;
  setOnSearchSubmit: (fn: (() => void) | undefined) => void;
  lotericaTab: string;
  setLotericaTab: (tab: string) => void;
  consultaSearch: string;
  setConsultaSearch: (value: string) => void;
  consultaSearchMode: ConsultaSearchMode;
  setConsultaSearchMode: (mode: ConsultaSearchMode) => void;
  showLotericaTabs: boolean;
  setShowLotericaTabs: (show: boolean) => void;
  importInputRef: React.RefObject<HTMLInputElement | null>;
}

const SidebarActionsContext = createContext<SidebarActionsContextType | undefined>(undefined);

export const SidebarActionsProvider = ({ children }: { children: ReactNode }) => {
  const [onExport, setOnExport] = useState<(() => void) | undefined>();
  const [onImportClick, setOnImportClick] = useState<(() => void) | undefined>();
  const [onSearchSubmit, setOnSearchSubmit] = useState<(() => void) | undefined>();
  const [lotericaTab, setLotericaTab] = useState("consulta");
  const [consultaSearch, setConsultaSearch] = useState("");
  const [consultaSearchMode, setConsultaSearchMode] = useState<ConsultaSearchMode>("loterica");
  const [showLotericaTabs, setShowLotericaTabs] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <SidebarActionsContext.Provider value={{
      onExport, setOnExport,
      onImportClick, setOnImportClick,
      onSearchSubmit, setOnSearchSubmit,
      lotericaTab, setLotericaTab,
      consultaSearch, setConsultaSearch,
      consultaSearchMode, setConsultaSearchMode,
      showLotericaTabs, setShowLotericaTabs,
      importInputRef,
    }}>
      {children}
    </SidebarActionsContext.Provider>
  );
};

export const useSidebarActions = () => {
  const ctx = useContext(SidebarActionsContext);
  if (!ctx) throw new Error("useSidebarActions must be used within SidebarActionsProvider");
  return ctx;
};
