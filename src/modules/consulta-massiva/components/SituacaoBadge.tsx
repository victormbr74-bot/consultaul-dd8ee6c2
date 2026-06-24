import type { Situacao } from "@/modules/consulta-massiva/lib/gis-types";

interface Props {
  situacao?: Situacao | null;
}

const map: Record<Situacao, { label: string; cls: string }> = {
  MASSIVA: {
    label: "MASSIVA",
    cls: "bg-noc-blue/15 text-noc-blue border-noc-blue/40",
  },
  LOTERICA_ISOLADA: {
    label: "LOTÉRICA ISOLADA",
    cls: "bg-orange-500/15 text-orange-600 border-orange-500/50 dark:text-orange-300",
  },
  ISOLADO: {
    label: "ISOLADO",
    cls: "bg-muted text-muted-foreground border-border",
  },
};

export function SituacaoBadge({ situacao }: Props) {
  if (!situacao) return null;
  const cfg = map[situacao];
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

export function situacaoLabel(s?: Situacao | null): string {
  if (!s) return "";
  return map[s].label;
}
