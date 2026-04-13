import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Wifi, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import TacacsCredentialsDialog, { type TacacsCredentials } from "./TacacsCredentialsDialog";
import { executePing, getStatusColor, type PingExecutionResponse } from "@/services/pingExecutor";

interface PingExecutionPanelProps {
  ips: string[];
  tipoTeste: "pingao" | "ping99" | "pingao_nat";
  pageLabel?: string;
  packetCount?: number;
}

const PingExecutionPanel = ({
  ips,
  tipoTeste,
  pageLabel = "Ping",
  packetCount = 2,
}: PingExecutionPanelProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<(PingExecutionResponse & { ip: string })[]>([]);
  const [currentIpIdx, setCurrentIpIdx] = useState<number | null>(null);

  const validIps = ips.filter((ip) => /^\d{1,3}(\.\d{1,3}){3}$/.test(ip.trim()));

  const handleExecute = async (credentials: TacacsCredentials) => {
    if (!validIps.length) return;
    setLoading(true);
    setResults([]);

    const newResults: (PingExecutionResponse & { ip: string })[] = [];

    for (let i = 0; i < validIps.length; i++) {
      setCurrentIpIdx(i);
      try {
        const res = await executePing({
          tipo_teste: tipoTeste,
          host_alvo: validIps[i],
          tacacs_username: credentials.username,
          tacacs_password: credentials.password,
          packet_count: packetCount,
        });
        newResults.push({ ...res, ip: validIps[i] });
      } catch (err) {
        newResults.push({
          ip: validIps[i],
          success: false,
          provider: "internal",
          status_final: "ERRO DE EXECUCAO",
          resultado_bruto: String((err as Error)?.message || err),
          perda_percentual: null,
          tempo_medio: null,
          etapa_que_falhou: "request",
          packets_sent: null,
          packets_received: null,
        });
      }
      setResults([...newResults]);
    }

    setCurrentIpIdx(null);
    setLoading(false);
    setDialogOpen(false);
  };

  if (!validIps.length) return null;

  return (
    <>
      <TacacsCredentialsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleExecute}
        loading={loading}
        pageLabel={pageLabel}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wifi className="w-5 h-5" /> Executar {pageLabel} via Backend
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setDialogOpen(true)}
              disabled={loading}
            >
              {loading
                ? `Executando ${(currentIpIdx ?? 0) + 1}/${validIps.length}...`
                : `Executar Ping (${validIps.length} IP${validIps.length > 1 ? "s" : ""})`}
            </Button>
            {results.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setResults([])}
              >
                <RotateCcw className="w-4 h-4 mr-1" /> Limpar
              </Button>
            )}
          </div>
        </CardHeader>

        {results.length > 0 && (
          <CardContent className="space-y-4">
            <div className="rounded-lg border overflow-auto max-h-[300px]">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 sticky top-0">
                  <tr className="text-left">
                    <th className="p-2 font-medium">IP</th>
                    <th className="p-2 font-medium">Status</th>
                    <th className="p-2 font-medium">Perda</th>
                    <th className="p-2 font-medium">Tempo Medio</th>
                    <th className="p-2 font-medium">Etapa Falha</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, idx) => (
                    <tr key={`${r.ip}-${idx}`} className="border-t">
                      <td className="p-2 font-mono">{r.ip}</td>
                      <td className="p-2">
                        <Badge
                          variant="outline"
                          className={cn("font-semibold", getStatusColor(r.status_final))}
                        >
                          {r.status_final}
                        </Badge>
                      </td>
                      <td className="p-2 font-mono">
                        {r.perda_percentual !== null ? `${r.perda_percentual}%` : "-"}
                      </td>
                      <td className="p-2 font-mono">{r.tempo_medio ?? "-"}</td>
                      <td className="p-2">{r.etapa_que_falhou ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {results.length === 1 && results[0].resultado_bruto && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Log completo</Label>
                <Textarea
                  readOnly
                  value={results[0].resultado_bruto}
                  className="min-h-[120px] font-mono text-xs"
                />
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </>
  );
};

export default PingExecutionPanel;
