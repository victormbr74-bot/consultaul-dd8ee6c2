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
            ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300"
            : p === "PRINCIPAL_OEMP"
              ? "border-orange-500/50 bg-orange-500/10 text-orange-600 dark:text-orange-300"
              : p === "SECUNDARIO_UF"
                ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300"
                : p === "SECUNDARIO_NACIONAL"
                  ? "border-purple-500/50 bg-purple-500/10 text-purple-700 dark:text-purple-300"
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
