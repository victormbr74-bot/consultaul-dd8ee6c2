import { Layers, RotateCcw } from "lucide-react";
import type { ComponentType } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getProjectModule, getProjectModuleItem } from "@/lib/projectModules";

import MassivaAnalise from "@/modules/consulta-massiva/pages/Analise";
import MassivaAuditoria from "@/modules/consulta-massiva/pages/Auditoria";
import MassivaCidades from "@/modules/consulta-massiva/pages/Cidades";
import MassivaEscalonamentos from "@/modules/consulta-massiva/pages/Escalonamentos";
import MascaraMassiva from "@/modules/consulta-massiva/pages/MascaraMassiva";
import MassivasAbertas from "@/modules/consulta-massiva/pages/MassivasAbertas";
import MassivaOperadoras from "@/modules/consulta-massiva/pages/Operadoras";
import Passagem from "@/modules/consulta-massiva/pages/Passagem";
import MassivaUsuarios from "@/modules/consulta-massiva/pages/Usuarios";

import ControleDashboard from "@/modules/controle-reparo/pages/Dashboard";
import ControleImplantacao from "@/modules/controle-reparo/pages/Implantacao";
import ControleImportacoes from "@/modules/controle-reparo/pages/Importacoes";
import ControleOperacional from "@/modules/controle-reparo/pages/Controle";
import ControleMeusCasos from "@/modules/controle-reparo/pages/MeusCasos";

const nativePages: Record<string, Record<string, ComponentType>> = {
  "consulta-massiva": {
    analise: MassivaAnalise,
    operadoras: MassivaOperadoras,
    escalonamentos: MassivaEscalonamentos,
    cidades: MassivaCidades,
    usuarios: MassivaUsuarios,
    auditoria: MassivaAuditoria,
  },
  "controle-reparo": {
    dashboard: ControleDashboard,
    importacoes: ControleImportacoes,
    controle: ControleOperacional,
    "meus-casos": ControleMeusCasos,
    implantacao: ControleImplantacao,
  },
  "passagem-turno": {
    "mascara-massiva": MascaraMassiva,
    passagem: Passagem,
    "massivas-abertas": MassivasAbertas,
  },
};

export default function ProjectModuleFrame() {
  const { projectId, itemId } = useParams();
  const navigate = useNavigate();
  const project = getProjectModule(projectId);
  const item = getProjectModuleItem(project, itemId);

  if (!project || !item || !projectId || !itemId) {
    return <Navigate to="/" replace />;
  }

  const Page = nativePages[projectId]?.[itemId];
  if (!Page) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="z-30 flex min-h-14 shrink-0 items-center gap-3 border-b bg-card px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Layers className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-foreground">{project.label}</h1>
          <p className="truncate text-xs text-muted-foreground">{item.label}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/")}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <Page />
      </div>
    </div>
  );
}
