import type { LucideIcon } from "lucide-react";
import { cn } from "@/modules/consulta-massiva/lib/utils";

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone: "red" | "yellow" | "blue" | "green" | "muted";
  sub?: string;
}

const toneMap = {
  red: "bg-noc-red/10 text-noc-red border-noc-red/30",
  yellow: "bg-noc-yellow/10 text-noc-yellow border-noc-yellow/30",
  blue: "bg-noc-blue/10 text-noc-blue border-noc-blue/30",
  green: "bg-noc-green/10 text-noc-green border-noc-green/30",
  muted: "bg-muted text-muted-foreground border-border",
};

export function StatCard({ label, value, icon: Icon, tone, sub }: Props) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-md border", toneMap[tone])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 font-mono text-3xl font-bold leading-none">{value}</div>
      {sub && <div className="mt-2 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
