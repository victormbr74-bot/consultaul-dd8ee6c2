import { MapPin } from "lucide-react";
import { SINALIZACAO_LABEL, type Sinalizacao60km } from "@/modules/consulta-massiva/lib/geo";

interface Props {
  sinalizacao?: Sinalizacao60km | null;
  className?: string;
}

const cls: Record<Sinalizacao60km, string> = {
  DENTRO_60KM: "bg-noc-green/15 text-noc-green border-noc-green/40",
  PARCIAL_60KM: "bg-noc-yellow/15 text-noc-yellow border-noc-yellow/50",
  FORA_60KM: "bg-noc-red/15 text-noc-red border-noc-red/40",
  SEM_GEO: "bg-muted text-muted-foreground border-border",
};

export function Sinalizacao60kmBadge({ sinalizacao, className = "" }: Props) {
  if (!sinalizacao) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls[sinalizacao]} ${className}`}
      title={SINALIZACAO_LABEL[sinalizacao]}
    >
      <MapPin className="h-3 w-3" />
      {SINALIZACAO_LABEL[sinalizacao]}
    </span>
  );
}
