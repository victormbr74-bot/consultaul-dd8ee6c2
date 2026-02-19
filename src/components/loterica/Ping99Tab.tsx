import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Wifi } from "lucide-react";

interface Ping99TabProps {
  form: {
    cod_ul?: unknown;
    tfl?: unknown;
    raw_data?: Record<string, unknown> | null;
  };
}

type PingIp = {
  normal: string;
  padded: string;
};

const SEQUENCE_SIZE = 16;
const REDE_LAN_KEYS = ["REDE LAN", "REDE_LAN", "rede lan", "rede_lan", "REDELAN", "LAN"] as const;

const padOctet = (value: string) => value.padStart(3, "0");
const normalizeText = (value: unknown) => String(value ?? "").trim();

const getRawString = (raw: Record<string, unknown>, keys: readonly string[]) => {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    const value = normalizeText(raw[key]);
    if (value) return value;
  }
  return "";
};

const parseLanIp = (value: string) => {
  const fullMatch = value.match(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})/);
  if (!fullMatch) return null;

  const octets = fullMatch.slice(1, 5).map((part) => Number.parseInt(part, 10));
  if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) return null;

  return {
    octets,
    subnet: `${octets[0]}.${octets[1]}.${octets[2]}.0/24`,
  };
};

const incrementIp = (octets: number[]) => {
  const next = [...octets];
  for (let i = 3; i >= 0; i--) {
    if (next[i] < 255) {
      next[i] += 1;
      for (let j = i + 1; j <= 3; j++) next[j] = 0;
      return next;
    }
  }
  return null;
};

const Ping99Tab = ({ form }: Ping99TabProps) => {
  const [copied, setCopied] = useState(false);
  const raw = useMemo(
    () => ((form?.raw_data && typeof form.raw_data === "object") ? form.raw_data as Record<string, unknown> : {}),
    [form?.raw_data],
  );

  const redeLan = getRawString(raw, REDE_LAN_KEYS);
  const codUl = normalizeText(form?.cod_ul);
  const tfl = normalizeText(raw["TFL"] ?? raw["TFLs"] ?? form?.tfl);

  const base = useMemo(() => {
    if (!redeLan) return null;
    return parseLanIp(redeLan);
  }, [redeLan]);

  const ips = useMemo<PingIp[]>(() => {
    if (!base) return [];
    const result: PingIp[] = [];
    let current = base.octets;
    for (let i = 0; i < SEQUENCE_SIZE; i++) {
      const next = incrementIp(current);
      if (!next) break;
      current = next;
      result.push({
        normal: next.join("."),
        padded: next.map((octet) => padOctet(String(octet))).join("."),
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
              <div className="font-mono">{base ? base.subnet : "-"}</div>
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
            <CardTitle className="text-lg">IPs da Rede LAN (+1 ate 16 IPs)</CardTitle>
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
