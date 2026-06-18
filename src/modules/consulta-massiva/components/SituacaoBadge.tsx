import type { Situacao } from "@/modules/consulta-massiva/lib/gis-types";

interface Props {
  situacao?: Situacao | null;
}

const map: Record<Situacao, { label: string; cls: string; icon: string }> = {
  MASSIVA: {
    label: "MASSIVA",
    cls: "bg-noc-blue/15 text-noc-blue border-noc-blue/40",
    icon: "🟦",
  },
  LOTERICA_ISOLADA: {
    label: "LOTÉRICA ISOLADA",
    cls: "bg-noc-yellow/15 text-noc-yellow border-noc-yellow/50",
    icon: "🟧",
  },
  ISOLADO: {
    label: "ISOLADO",
    cls: "bg-muted text-muted-foreground border-border",
    icon: "⬜",
  },
};

export function SituacaoBadge({ situacao }: Props) {
  if (!situacao) return null;
  const cfg = map[situacao];
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cfg.cls}`}>
      <span>{cfg.icon}</span>
      <span>{cfg.label}</span>
    </span>
  );
}

export function situacaoLabel(s?: Situacao | null): string {
  if (!s) return "";
  return map[s].label;
}
