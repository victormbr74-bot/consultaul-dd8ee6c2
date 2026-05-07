import { AlertTriangle } from "lucide-react";

interface NoConsultaWarningProps {
  message?: string;
}

const NoConsultaWarning = ({ message }: NoConsultaWarningProps) => (
  <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
    <div>
      <p className="font-medium">Nenhuma consulta carregada</p>
      <p className="mt-0.5 text-xs">
        {message ||
          "Para utilizar esta opção, vá ao menu Consulta UL e realize uma consulta primeiro."}
      </p>
    </div>
  </div>
);

export default NoConsultaWarning;
