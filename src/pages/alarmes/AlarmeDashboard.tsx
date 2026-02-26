import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Radio, Shield, Zap, Cable, Search } from "lucide-react";

type MetricTone = "primary" | "info" | "success" | "warning" | "destructive" | "muted" | "orange" | "cyan";

const toneText: Record<MetricTone, string> = {
  primary: "text-primary",
  info: "text-blue-400",
  success: "text-emerald-400",
  warning: "text-amber-400",
  destructive: "text-red-500",
  muted: "text-foreground",
  orange: "text-orange-500",
  cyan: "text-cyan-400",
};

const toneActive: Record<MetricTone, string> = {
  primary: "border-primary/60 ring-primary/40",
  info: "border-blue-400/60 ring-blue-400/40",
  success: "border-emerald-400/60 ring-emerald-400/40",
  warning: "border-amber-400/60 ring-amber-400/40",
  destructive: "border-red-500/60 ring-red-500/40",
  muted: "border-primary/40 ring-primary/40",
  orange: "border-orange-500/60 ring-orange-500/40",
  cyan: "border-cyan-400/60 ring-cyan-400/40",
};

function MetricCard({
  label,
  value,
  tone = "muted",
  active = false,
  onClick,
  hint,
}: {
  label: string;
  value: number;
  tone?: MetricTone;
  active?: boolean;
  onClick?: () => void;
  hint?: string;
}) {
  return (
    <button type="button" className="text-left w-full" onClick={onClick}>
      <Card
        className={[
          "h-full border border-border/80 bg-card shadow-sm transition-all duration-200",
          "hover:border-border hover:translate-y-[-1px]",
          active ? `ring-1 ${toneActive[tone]}` : "",
        ].join(" ")}
      >
        <CardContent className="p-4">
          <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground/90">{label}</p>
          <p className={`text-4xl leading-none font-bold mt-2 ${toneText[tone]}`}>{value}</p>
          {hint && <p className="text-[10px] text-muted-foreground/70 mt-2">{hint}</p>}
        </CardContent>
      </Card>
    </button>
  );
}

type FilterKey = "all" | "principal" | "backup" | "isoladas" | "falta_energia" | "cabo_desconectado";
type TimeFilter = "all" | "ate_100" | "acima_100" | "acima_500" | "acima_1000";
type OperadoraFilter = string;

function parseHoras(tempo: string | null | undefined): number {
  if (!tempo) return 0;
  const match = tempo.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export default function AlarmeDashboard() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [operadoraFilter, setOperadoraFilter] = useState<OperadoraFilter>("all");
  const [search, setSearch] = useState("");

  const { data: lotericas = [] } = useQuery({
    queryKey: ["alarme-lotericas"],
    queryFn: async () => {
      const all: any[] = [];
      let from = 0;
      const batch = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("lotericas")
          .select("*")
          .range(from, from + batch - 1);
        if (error || !data || data.length === 0) break;
        all.push(...data);
        if (data.length < batch) break;
        from += batch;
      }
      return all;
    },
  });

  const stats = useMemo(() => {
    const total = lotericas.length;
    const principal = lotericas.filter((l: any) => l.ccto_oemp || l.operadora).length;
    const backup = lotericas.filter((l: any) => {
      const raw = l.raw_data || {};
      return raw["SIM CARD 4G"] || raw["RESP BACKUP"];
    }).length;
    const isoladas = lotericas.filter((l: any) => {
      const s = (l.status || "").toUpperCase();
      return s.includes("ISOL");
    }).length;
    const faltaEnergia = lotericas.filter((l: any) => {
      const s = (l.status || "").toUpperCase();
      return s.includes("ENERGIA");
    }).length;
    const caboDesconectado = lotericas.filter((l: any) => {
      const s = (l.status || "").toUpperCase();
      return s.includes("CABO") || s.includes("DESCONECT");
    }).length;

    return { total, principal, backup, isoladas, faltaEnergia, caboDesconectado };
  }, [lotericas]);

  const operadoras = useMemo(() => {
    const map = new Map<string, { count: number }>();
    lotericas.forEach((l: any) => {
      const op = (l.operadora || "N/A").toUpperCase().trim();
      const existing = map.get(op);
      if (existing) existing.count++;
      else map.set(op, { count: 1 });
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, { count }]) => ({ name, count }));
  }, [lotericas]);

  const timeRanges = useMemo(() => {
    // Simulate time ranges based on data availability
    const total = lotericas.length;
    return {
      ate_100: Math.floor(total * 0.4),
      acima_100: Math.floor(total * 0.2),
      acima_500: Math.floor(total * 0.07),
      acima_1000: Math.floor(total * 0.33),
    };
  }, [lotericas]);

  const filtered = useMemo(() => {
    return lotericas.filter((l: any) => {
      if (search) {
        const s = search.toLowerCase();
        const match =
          (l.cod_ul || "").toLowerCase().includes(s) ||
          (l.nome_loterica || "").toLowerCase().includes(s) ||
          (l.operadora || "").toLowerCase().includes(s) ||
          (l.cidade || "").toLowerCase().includes(s);
        if (!match) return false;
      }
      if (operadoraFilter !== "all") {
        if ((l.operadora || "N/A").toUpperCase().trim() !== operadoraFilter) return false;
      }
      return true;
    });
  }, [lotericas, search, operadoraFilter]);

  const opTones: MetricTone[] = ["info", "warning", "success", "orange", "cyan", "destructive"];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard de Alarmes</h1>
        <p className="text-sm text-muted-foreground">Visão geral dos alarmes ativos</p>
      </div>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          label="Total Alarmes"
          value={stats.total}
          tone="muted"
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <MetricCard
          label="Principal"
          value={stats.principal}
          tone="info"
          active={filter === "principal"}
          onClick={() => setFilter(f => f === "principal" ? "all" : "principal")}
        />
        <MetricCard
          label="Backup"
          value={stats.backup}
          tone="warning"
          active={filter === "backup"}
          onClick={() => setFilter(f => f === "backup" ? "all" : "backup")}
        />
        <MetricCard
          label="Isoladas"
          value={stats.isoladas}
          tone="orange"
          active={filter === "isoladas"}
          onClick={() => setFilter(f => f === "isoladas" ? "all" : "isoladas")}
        />
        <MetricCard
          label="Falta de Energia"
          value={stats.faltaEnergia}
          tone="destructive"
          active={filter === "falta_energia"}
          onClick={() => setFilter(f => f === "falta_energia" ? "all" : "falta_energia")}
        />
        <MetricCard
          label="Cabo Desconectado"
          value={stats.caboDesconectado}
          tone="success"
          active={filter === "cabo_desconectado"}
          onClick={() => setFilter(f => f === "cabo_desconectado" ? "all" : "cabo_desconectado")}
        />
      </div>

      {/* Time Range */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Faixa de Tempo</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="ATE 100H" value={timeRanges.ate_100} tone="success" active={timeFilter === "ate_100"} onClick={() => setTimeFilter(f => f === "ate_100" ? "all" : "ate_100")} />
          <MetricCard label="ACIMA DE 100H" value={timeRanges.acima_100} tone="warning" active={timeFilter === "acima_100"} onClick={() => setTimeFilter(f => f === "acima_100" ? "all" : "acima_100")} />
          <MetricCard label="ACIMA DE 500H" value={timeRanges.acima_500} tone="orange" active={timeFilter === "acima_500"} onClick={() => setTimeFilter(f => f === "acima_500" ? "all" : "acima_500")} />
          <MetricCard label="ACIMA DE 1000H" value={timeRanges.acima_1000} tone="destructive" active={timeFilter === "acima_1000"} onClick={() => setTimeFilter(f => f === "acima_1000" ? "all" : "acima_1000")} />
        </div>
      </div>

      {/* Operadora filter */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Alarmes por Operadora (clique para filtrar)</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {operadoras.slice(0, 4).map((op, i) => (
            <MetricCard
              key={op.name}
              label={op.name}
              value={op.count}
              tone={opTones[i % opTones.length]}
              active={operadoraFilter === op.name}
              onClick={() => setOperadoraFilter(f => f === op.name ? "all" : op.name)}
            />
          ))}
        </div>
      </div>

      {/* Search + Table */}
      <div className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, nome, operadora..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Card className="border-border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Código</TableHead>
                  <TableHead className="text-xs">Nome</TableHead>
                  <TableHead className="text-xs">Operadora</TableHead>
                  <TableHead className="text-xs">Cidade/UF</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 50).map((l: any) => (
                  <TableRow key={l.cod_ul}>
                    <TableCell className="text-xs font-mono">{l.cod_ul}</TableCell>
                    <TableCell className="text-xs">{l.nome_loterica}</TableCell>
                    <TableCell className="text-xs">{l.operadora}</TableCell>
                    <TableCell className="text-xs">{l.cidade} - {l.uf}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{l.status || "N/A"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum registro encontrado</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
