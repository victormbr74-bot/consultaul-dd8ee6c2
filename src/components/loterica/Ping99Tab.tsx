import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Wifi } from "lucide-react";

interface Ping99TabProps {
  form: any;
}

type PingIp = {
  normal: string;
  padded: string;
};

const START_HOST = 241;
const END_HOST = 255;

const padOctet = (value: string) => value.padStart(3, "0");

const Ping99Tab = ({ form }: Ping99TabProps) => {
  const [copied, setCopied] = useState(false);
  const raw = form.raw_data || {};

  const redeLan = String(raw["REDE LAN"] || "");
  const codUl = String(form.cod_ul || "");
  const tfl = String(raw["TFL"] || form.tfl || "");

  const base = useMemo(() => {
    const parts = redeLan.split(".");
    if (parts.length < 3) return null;
    return {
      normal: `${parts[0]}.${parts[1]}.${parts[2]}`,
      padded: `${padOctet(parts[0])}.${padOctet(parts[1])}.${padOctet(parts[2])}`,
    };
  }, [redeLan]);

  const ips = useMemo<PingIp[]>(() => {
    if (!base) return [];
    const result: PingIp[] = [];
    for (let host = START_HOST; host <= END_HOST; host++) {
      result.push({
        normal: `${base.normal}.${host}`,
        padded: `${base.padded}.${String(host).padStart(3, "0")}`,
      });
    }
    return result;
  }, [base]);

  const tclScript = useMemo(() => {
    if (!ips.length) return "";
    const comandos = ips
      .map((ip) => `"${ip.padded} source gigabitEthernet0/0/1.1090 repeat 1"`)
      .join("\n");
    return `tclsh
foreach add {
${comandos}
} { ping $add }`;
  }, [ips]);

  const copy = () => {
    if (!tclScript) return;
    navigator.clipboard.writeText(tclScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wifi className="w-5 h-5" /> Teste de Ping pelo CTC/DTC
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-xs text-muted-foreground">Rede LAN</span>
              <div className="font-mono">{redeLan || "-"}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Codigo UL</span>
              <div className="font-mono">{codUl || "-"}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">TFL</span>
              <div className="font-mono">{tfl || "-"}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Subnet</span>
              <div className="font-mono">{base ? `${base.normal}.0/24` : "-"}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Script TCL - Ping 99</CardTitle>
          <Button variant="outline" size="sm" onClick={copy} disabled={!tclScript}>
            {copied ? <Check className="w-4 h-4 mr-1 text-green-500" /> : <Copy className="w-4 h-4 mr-1" />}
            {copied ? "Copiado!" : "Copiar"}
          </Button>
        </CardHeader>
        <CardContent>
          {tclScript ? (
            <pre className="text-xs font-mono bg-muted/50 p-4 rounded whitespace-pre-wrap overflow-x-auto max-h-[500px] overflow-y-auto">
              {tclScript}
            </pre>
          ) : (
            <div className="text-sm text-muted-foreground">Rede LAN nao disponivel para gerar o script.</div>
          )}
        </CardContent>
      </Card>

      {!!ips.length && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">IPs da Rede LAN (241-255)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {ips.map((ip) => (
                <div key={ip.normal} className="text-xs font-mono bg-muted/50 p-2 rounded text-center">
                  {ip.normal}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Ping99Tab;
