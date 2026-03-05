import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, Wifi, Terminal } from "lucide-react";
import { executeSecureCrtCommands, type SecureCrtExecuteResult } from "@/lib/secureCrtBridge";
import { fetchLookupRows, resolveMatches, type MatchField } from "@/components/loterica/lotericaLookup";

interface Ping99TabProps {
  form?: {
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
const SOURCE_INTERFACE = "gigabitEthernet0/0/1.1090";
const PING99_REPEAT = 1;
const REDE_LAN_KEYS = ["REDE LAN", "REDE_LAN", "rede lan", "rede_lan", "REDELAN", "LAN"] as const;
const TFL_KEYS = ["TFL", "TFLs"] as const;
const MATCH_FIELD_LABELS: Record<MatchField, string> = {
  cod_ul: "Codigo UL",
  ccto_oi: "CCTO OI",
  ccto_oemp: "CCTO OEMP",
  designacao_nova: "Designacao",
};

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
  const [secureCrtLoading, setSecureCrtLoading] = useState(false);
  const [secureCrtResult, setSecureCrtResult] = useState<SecureCrtExecuteResult | null>(null);
  const [manualRedeLan, setManualRedeLan] = useState("");
  const [manualCodUl, setManualCodUl] = useState("");
  const [manualTfl, setManualTfl] = useState("");
  const [lookupTerm, setLookupTerm] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<"idle" | "ok" | "error">("idle");
  const [lookupMessage, setLookupMessage] = useState("");

  const raw = useMemo(
    () => ((form?.raw_data && typeof form.raw_data === "object") ? form.raw_data as Record<string, unknown> : {}),
    [form?.raw_data],
  );

  const isStandalone = !form;
  const formRedeLan = getRawString(raw, REDE_LAN_KEYS);
  const formCodUl = normalizeText(form?.cod_ul);
  const formTfl = normalizeText(getRawString(raw, TFL_KEYS) || form?.tfl);

  const redeLan = isStandalone ? manualRedeLan : formRedeLan;
  const codUl = isStandalone ? normalizeText(manualCodUl) : formCodUl;
  const tfl = isStandalone ? normalizeText(manualTfl) : formTfl;

  const base = useMemo(() => {
    if (!redeLan) return null;
    return parseLanIp(redeLan);
  }, [redeLan]);

  const ips = useMemo<PingIp[]>(() => {
    if (!base) return [];
    const result: PingIp[] = [];

    result.push({
      normal: base.octets.join("."),
      padded: base.octets.map((octet) => padOctet(String(octet))).join("."),
    });

    let current = base.octets;
    for (let i = 0; i < SEQUENCE_SIZE - 1; i++) {
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
    const commands = ips
      .map((ip) => `"${ip.padded} source ${SOURCE_INTERFACE} repeat ${PING99_REPEAT}"`)
      .join("\n");

    return `tclsh\nforeach add {\n${commands}\n} { ping $add }`;
  }, [ips]);

  const copy = () => {
    if (!tclScript) return;
    navigator.clipboard.writeText(tclScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const loadFromConsulta = async () => {
    const query = normalizeText(lookupTerm);
    if (!query) {
      setLookupStatus("error");
      setLookupMessage("Informe um Codigo UL, CCTO OI/OEMP ou Designacao.");
      return;
    }

    setLookupLoading(true);
    setLookupStatus("idle");
    setLookupMessage("");
    try {
      const rows = await fetchLookupRows([query]);
      const [match] = resolveMatches([query], rows);
      if (!match?.row) {
        setLookupStatus("error");
        setLookupMessage("Consulta nao encontrou dados para o termo informado.");
        return;
      }

      const row = match.row;
      const rowRaw =
        row.raw_data && typeof row.raw_data === "object" ? (row.raw_data as Record<string, unknown>) : {};

      setManualCodUl(normalizeText(row.cod_ul));
      setManualRedeLan(getRawString(rowRaw, REDE_LAN_KEYS));
      setManualTfl(getRawString(rowRaw, TFL_KEYS));
      setLookupStatus("ok");
      setLookupMessage(
        match.matchField
          ? `Dados carregados da consulta para ${normalizeText(row.cod_ul)} (encontrado por ${MATCH_FIELD_LABELS[match.matchField]}).`
          : `Dados carregados da consulta para ${normalizeText(row.cod_ul)}.`,
      );
    } catch (error) {
      setLookupStatus("error");
      setLookupMessage(String((error as Error)?.message || error || "Falha ao consultar dados da loterica."));
    } finally {
      setLookupLoading(false);
    }
  };

  const sendToSecureCrt = async () => {
    if (!tclScript.trim()) return;
    setSecureCrtLoading(true);
    setSecureCrtResult(null);
    try {
      const result = await executeSecureCrtCommands({
        commands: tclScript,
        source: "ping99",
        captureOutput: true,
        captureWaitMs: 9000,
        delayMs: 100,
      });
      setSecureCrtResult(result);
    } finally {
      setSecureCrtLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wifi className="w-5 h-5" /> Ping 99 - Teste pelo CTC/DTC
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isStandalone && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end">
                <div className="space-y-1">
                  <Label htmlFor="ping99-consulta">Consulta (UL/CCTO/Designacao)</Label>
                  <Input
                    id="ping99-consulta"
                    placeholder="21-000666-8"
                    value={lookupTerm}
                    onChange={(event) => setLookupTerm(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void loadFromConsulta();
                      }
                    }}
                  />
                </div>
                <Button type="button" onClick={() => void loadFromConsulta()} disabled={lookupLoading}>
                  {lookupLoading ? "Buscando..." : "Buscar dados"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setManualRedeLan("");
                    setManualCodUl("");
                    setManualTfl("");
                    setLookupTerm("");
                    setLookupStatus("idle");
                    setLookupMessage("");
                  }}
                >
                  Limpar
                </Button>
              </div>
              {lookupMessage ? (
                <p className={`text-sm ${lookupStatus === "error" ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
                  {lookupMessage}
                </p>
              ) : null}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="ping99-rede-lan">Rede LAN</Label>
                  <Input
                    id="ping99-rede-lan"
                    placeholder="10.123.45.67"
                    value={manualRedeLan}
                    onChange={(event) => setManualRedeLan(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ping99-cod-ul">Codigo UL (opcional)</Label>
                  <Input
                    id="ping99-cod-ul"
                    placeholder="21-000666-8"
                    value={manualCodUl}
                    onChange={(event) => setManualCodUl(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ping99-tfl">TFL (opcional)</Label>
                  <Input
                    id="ping99-tfl"
                    placeholder="1234"
                    value={manualTfl}
                    onChange={(event) => setManualTfl(event.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
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
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void sendToSecureCrt()} disabled={!tclScript || secureCrtLoading}>
              <Terminal className="w-4 h-4 mr-1" />
              {secureCrtLoading ? "Enviando..." : "Executar e Capturar"}
            </Button>
            <Button variant="outline" size="sm" onClick={copy} disabled={!tclScript}>
              {copied ? <Check className="w-4 h-4 mr-1 text-green-500" /> : <Copy className="w-4 h-4 mr-1" />}
              {copied ? "Copiado!" : "Copiar"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {secureCrtResult ? (
            <p className={`text-sm ${secureCrtResult.ok ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
              {secureCrtResult.message}
            </p>
          ) : null}
          {tclScript ? (
            <pre className="text-xs font-mono bg-muted/50 p-4 rounded whitespace-pre-wrap overflow-x-auto max-h-[500px] overflow-y-auto">
              {tclScript}
            </pre>
          ) : (
            <div className="text-sm text-muted-foreground">
              {isStandalone ? "Informe a Rede LAN para gerar o script." : "Rede LAN nao disponivel para gerar o script."}
            </div>
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
