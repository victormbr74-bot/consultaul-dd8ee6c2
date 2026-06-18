import { cn } from "@/modules/consulta-massiva/lib/utils";
import type { TipoMassiva } from "@/modules/consulta-massiva/lib/gis-types";

export function MassivaBadge({ tipo }: { tipo: TipoMassiva | string | null | undefined }) {
  if (!tipo) {
    return (
      <span className="inline-flex items-center rounded-md border border-noc-green/40 bg-noc-green/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-noc-green">
        Sem massiva
      </span>
    );
  }
  const parts = String(tipo).split(" | ");
  return (
    <div className="flex flex-wrap gap-1">
      {parts.map((p, i) => {
        const cls =
          p === "PRINCIPAL_VTAL"
            ? "border-noc-red/40 bg-noc-red/10 text-noc-red"
            : p === "PRINCIPAL_OEMP"
              ? "border-orange-500/40 bg-orange-500/10 text-orange-500"
              : p === "SECUNDARIO_UF"
                ? "border-noc-yellow/40 bg-noc-yellow/10 text-noc-yellow"
                : p === "SECUNDARIO_NACIONAL"
                  ? "border-noc-blue/40 bg-noc-blue/10 text-noc-blue"
                  : "border-border bg-muted text-muted-foreground";
        return (
          <span
            key={i}
            className={cn(
              "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              cls,
            )}
          >
            {p.replace(/_/g, " ")}
          </span>
        );
      })}
    </div>
  );
}
