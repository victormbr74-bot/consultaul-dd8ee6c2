import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { jsonToWorkbook, writeFile } from "@/lib/excelCompat";

type Row = {
  id: string;
  cod_ul: string;
  tipo: string;
  config_type: string;
  observacao: string;
  created_at: string;
  created_by: string;
  reminder_acknowledged_at: string | null;
};

type Profile = { id: string; name: string | null; user_code: string | null };

const RouterConfigsReport = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("loterica_router_configs" as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) {
      toast.error("Falha ao carregar relatório", { description: error.message });
      setLoading(false);
      return;
    }
    const list = (data as unknown as Row[]) || [];
    setRows(list);

    const ids = Array.from(new Set(list.map((r) => r.created_by)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, name, user_code")
        .in("id", ids);
      const map: Record<string, Profile> = {};
      ((profs as Profile[]) || []).forEach((p) => {
        map[p.id] = p;
      });
      setProfiles(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const exportXlsx = async () => {
    if (!rows.length) return;
    setExporting(true);
    try {
      const data = rows.map((r) => ({
        "Código UL": r.cod_ul,
        Tipo: r.tipo,
        Configuração: r.config_type,
        Observação: r.observacao,
        Responsável: profiles[r.created_by]?.name || "-",
        "Código Usuário": profiles[r.created_by]?.user_code || "-",
        "Data/Hora": new Date(r.created_at).toLocaleString("pt-BR"),
        Verificado: r.reminder_acknowledged_at
          ? new Date(r.reminder_acknowledged_at).toLocaleString("pt-BR")
          : "",
      }));
      const wb = jsonToWorkbook([{ name: "Configurações Roteador", data }]);
      await writeFile(wb, `configuracoes-roteador-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Relatório exportado");
    } catch (e) {
      toast.error("Falha ao exportar", { description: (e as Error).message });
    } finally {
      setExporting(false);
    }
  };

  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    rows.forEach((r) => {
      byType[r.config_type] = (byType[r.config_type] || 0) + 1;
    });
    return byType;
  }, [rows]);

  return (
    <div className="container px-4 py-6 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Relatório de Configurações no Roteador</CardTitle>
          <Button onClick={exportXlsx} disabled={exporting || rows.length === 0} size="sm">
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Exportar XLSX
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Total: {rows.length}</Badge>
            {Object.entries(stats).map(([k, v]) => (
              <Badge key={k} variant="secondary">
                {k}: {v}
              </Badge>
            ))}
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <div className="border rounded-md overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código UL</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Configuração</TableHead>
                    <TableHead>Observação</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.cod_ul}</TableCell>
                      <TableCell>{r.tipo}</TableCell>
                      <TableCell>{r.config_type}</TableCell>
                      <TableCell className="max-w-md whitespace-pre-wrap text-xs">
                        {r.observacao}
                      </TableCell>
                      <TableCell className="text-xs">
                        {profiles[r.created_by]?.name || "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nenhuma configuração registrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RouterConfigsReport;
