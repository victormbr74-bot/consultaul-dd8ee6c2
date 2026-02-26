import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp, Activity, Gauge } from "lucide-react";

export default function Desempenho() {
  const { data: lotericas = [] } = useQuery({
    queryKey: ["desempenho-lotericas"],
    queryFn: async () => {
      const all: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase.from("lotericas").select("*").range(from, from + 999);
        if (error || !data || data.length === 0) break;
        all.push(...data);
        if (data.length < 1000) break;
        from += 1000;
      }
      return all;
    },
  });

  const stats = useMemo(() => {
    const total = lotericas.length;
    const ativas = lotericas.filter((l: any) => (l.status || "").toUpperCase().includes("ATIV")).length;
    const comBackup = lotericas.filter((l: any) => {
      const raw = l.raw_data || {};
      return raw["SIM CARD 4G"] || raw["RESP BACKUP"];
    }).length;
    const operadoras = new Map<string, number>();
    const ufs = new Map<string, number>();
    lotericas.forEach((l: any) => {
      const op = (l.operadora || "N/A").trim();
      operadoras.set(op, (operadoras.get(op) || 0) + 1);
      const uf = (l.uf || "N/A").trim();
      ufs.set(uf, (ufs.get(uf) || 0) + 1);
    });

    return {
      total,
      ativas,
      comBackup,
      taxaBackup: total ? Math.round((comBackup / total) * 100) : 0,
      operadoras: Array.from(operadoras.entries()).sort((a, b) => b[1] - a[1]),
      ufs: Array.from(ufs.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [lotericas]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Desempenho</h1>
          <p className="text-sm text-muted-foreground">Indicadores de desempenho geral da rede</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/80">
          <CardContent className="p-4 flex items-start gap-3">
            <Activity className="w-5 h-5 text-primary mt-1" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Unidades</p>
              <p className="text-4xl font-bold text-primary mt-1">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80">
          <CardContent className="p-4 flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-emerald-400 mt-1" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ativas</p>
              <p className="text-4xl font-bold text-emerald-400 mt-1">{stats.ativas}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80">
          <CardContent className="p-4 flex items-start gap-3">
            <Gauge className="w-5 h-5 text-amber-400 mt-1" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Com Backup</p>
              <p className="text-4xl font-bold text-amber-400 mt-1">{stats.comBackup}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80">
          <CardContent className="p-4 flex items-start gap-3">
            <BarChart3 className="w-5 h-5 text-blue-400 mt-1" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Taxa Backup</p>
              <p className="text-4xl font-bold text-blue-400 mt-1">{stats.taxaBackup}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Operadoras breakdown */}
      <Card className="border-border/80">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Distribuição por Operadora</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="space-y-3">
            {stats.operadoras.map(([op, count]) => {
              const pct = stats.total ? Math.round((count / stats.total) * 100) : 0;
              return (
                <div key={op} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-24 truncate">{op}</span>
                  <div className="flex-1 bg-secondary rounded-full h-2">
                    <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-mono text-foreground w-16 text-right">{count} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* UFs breakdown */}
      <Card className="border-border/80">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Distribuição por UF</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {stats.ufs.map(([uf, count]) => (
              <div key={uf} className="bg-secondary/50 rounded-lg p-3 text-center">
                <p className="text-xs font-bold text-foreground">{uf}</p>
                <p className="text-lg font-bold text-primary">{count}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
