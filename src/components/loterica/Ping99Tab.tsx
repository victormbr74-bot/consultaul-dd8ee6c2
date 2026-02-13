import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Wifi } from "lucide-react";

interface Ping99TabProps {
  form: any;
}

const Ping99Tab = ({ form }: Ping99TabProps) => {
  const [copied, setCopied] = useState(false);
  const raw = form.raw_data || {};

  const redeLan = String(raw["REDE LAN"] || "");
  const tfl = Number(raw["TFL"] || 0);
  const codUl = form.cod_ul || "";

  // Parse the base subnet from rede_lan (e.g., 99.245.190.241 -> 99.245.190)
  const parts = redeLan.split(".");
  const baseSubnet = parts.length >= 3 ? `${parts[0]}.${parts[1]}.${parts[2]}` : "";

  // Pad IP octets to 3 digits for the ping command (e.g., 99 -> 099)
  const padOctet = (n: string) => n.padStart(3, "0");
  const paddedBase = parts.length >= 3
    ? `${padOctet(parts[0])}.${padOctet(parts[1])}.${padOctet(parts[2])}`
    : "";

  // Generate IPs from .241 to .255
  const generateIps = () => {
    if (!baseSubnet) return [];
    const ips = [];
    for (let i = 241; i <= 255; i++) {
      ips.push({
        padded: `${paddedBase}.${String(i).padStart(3, "0")}`,
        normal: `${baseSubnet}.${i}`,
      });
    }
    return ips;
  };

  const ips = generateIps();

  const tclScript = baseSubnet
    ? `tclsh
foreach add {
${ips.map(ip => `"${ip.padded} source gigabitEthernet0/0/1.1090 repeat 1"`).join("\n")}
} { ping $add }`
    : "Rede LAN não disponível para esta lotérica.";

  const copy = () => {
    navigator.clipboard.writeText(tclScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wifi className="w-5 h-5" /> Ping 99 — Teste pelo CTC/DTC
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-xs text-muted-foreground">Rede LAN</span>
              <div className="font-mono">{redeLan || "—"}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Cod. UL</span>
              <div className="font-mono">{codUl}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">TFL</span>
              <div>{tfl || "—"}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Subnet</span>
              <div className="font-mono">{baseSubnet ? `${baseSubnet}.0/24` : "—"}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Script TCL — Ping 99</CardTitle>
          <Button variant="outline" size="sm" onClick={copy} disabled={!baseSubnet}>
            {copied ? <Check className="w-4 h-4 mr-1 text-green-500" /> : <Copy className="w-4 h-4 mr-1" />}
            {copied ? "Copiado!" : "Copiar"}
          </Button>
        </CardHeader>
        <CardContent>
          <pre className="text-xs font-mono bg-muted/50 p-4 rounded whitespace-pre-wrap overflow-x-auto max-h-[500px] overflow-y-auto">
            {tclScript}
          </pre>
        </CardContent>
      </Card>

      {baseSubnet && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">IPs da Rede LAN</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {ips.map(ip => (
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
