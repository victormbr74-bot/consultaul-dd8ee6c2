import { MapPin } from "lucide-react";
import { SINALIZACAO_LABEL, type Sinalizacao60km } from "@/modules/consulta-massiva/lib/geo";

interface Props {
  sinalizacao?: Sinalizacao60km | null;
  className?: string;
  raioKm?: number | null;
}

function badgeClassFor(raioKm: number | null | undefined, sinalizacao?: Sinalizacao60km | null): string {
  if (sinalizacao === "SEM_GEO" || raioKm == null || !Number.isFinite(raioKm)) {
    return "bg-muted text-muted-foreground border-border";
  }
  if (raioKm <= 60) return "border-emerald-400/50 bg-emerald-500/15 text-emerald-200 shadow-[0_0_14px_rgba(52,211,153,0.18)]";
  if (raioKm <= 200) return "border-amber-300/50 bg-amber-400/15 text-amber-200 shadow-[0_0_14px_rgba(251,191,36,0.16)]";
  return "border-red-400/60 bg-red-500/15 text-red-200 shadow-[0_0_16px_rgba(248,113,113,0.22)]";
}

export function Sinalizacao60kmBadge({ sinalizacao, className = "", raioKm }: Props) {
  const cls = badgeClassFor(raioKm, sinalizacao);
  if (!sinalizacao && raioKm == null) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls} ${className}`}>
      <MapPin className="h-3 w-3" />
      {sinalizacao ? SINALIZACAO_LABEL[sinalizacao] : `${raioKm ?? 0} km`}
    </span>
  );
}
