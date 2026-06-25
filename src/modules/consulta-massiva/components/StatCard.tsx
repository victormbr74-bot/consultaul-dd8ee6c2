import type { LucideIcon } from "lucide-react";
import { cn } from "@/modules/consulta-massiva/lib/utils";

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone: "red" | "yellow" | "blue" | "green" | "muted" | "critical";
  sub?: string;
  glow?: boolean;
  active?: boolean;
}

const toneMap = {
  red: {
    card: "border-rose-500/35 bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.18),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.82),rgba(2,6,23,0.38))]",
    icon: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/20",
    bar: "bg-rose-400",
    value: "text-rose-100",
  },
  critical: {
    card: "border-red-500/70 bg-[radial-gradient(circle_at_top_right,rgba(255,0,64,0.30),transparent_44%),linear-gradient(180deg,rgba(60,0,18,0.50),rgba(2,6,23,0.42))] shadow-[0_0_26px_rgba(255,0,64,0.28)]",
    icon: "bg-red-500/20 text-red-200 ring-1 ring-red-300/45",
    bar: "bg-red-400",
    value: "text-red-100",
  },
  yellow: {
    card: "border-amber-500/35 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.18),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.82),rgba(2,6,23,0.38))]",
    icon: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/20",
    bar: "bg-amber-300",
    value: "text-amber-100",
  },
  blue: {
    card: "border-sky-500/35 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.18),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.82),rgba(2,6,23,0.38))]",
    icon: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/20",
    bar: "bg-sky-400",
    value: "text-sky-100",
  },
  green: {
    card: "border-emerald-500/35 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.17),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.82),rgba(2,6,23,0.38))]",
    icon: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/20",
    bar: "bg-emerald-300",
    value: "text-emerald-100",
  },
  muted: {
    card: "border-slate-700/70 bg-[radial-gradient(circle_at_top_right,rgba(100,116,139,0.12),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.78),rgba(2,6,23,0.34))]",
    icon: "bg-slate-500/15 text-slate-300 ring-1 ring-slate-400/20",
    bar: "bg-slate-500",
    value: "text-slate-100",
  },
};

export function StatCard({ label, value, icon: Icon, tone, sub, glow, active }: Props) {
  const toneStyle = toneMap[tone];
  return (
    <div
      className={cn(
        "relative flex min-h-[118px] flex-col justify-between overflow-hidden rounded-md border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all hover:brightness-110",
        toneStyle.card,
        glow ? "ring-1 ring-red-300/40" : "",
      )}
    >
      <div className={cn("absolute inset-x-0 top-0 h-px opacity-90", toneStyle.bar)} />
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-medium text-foreground/80">
          {label}
        </div>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", toneStyle.icon)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className={cn("mt-3 font-mono text-3xl font-bold leading-none tabular-nums", toneStyle.value)}>{value}</div>
      {sub && <div className="mt-2 text-xs text-slate-400">{sub}</div>}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-700/70">
        <div className={cn("h-full rounded-full", active || glow ? "w-full" : "w-[78%] opacity-75", toneStyle.bar)} />
      </div>
    </div>
  );
}
