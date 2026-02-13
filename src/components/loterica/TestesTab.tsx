import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, Terminal } from "lucide-react";

interface TestesTabProps {
  form: any;
}

const SOURCE_INTERFACE = "Gi0/0/1.1090";

const TestesTab = ({ form }: TestesTabProps) => {
  const [copied, setCopied] = useState<string | null>(null);
  const [usuarioNat, setUsuarioNat] = useState("manoel.barros");

  const raw = form.raw_data || {};
  const loopbackPrimario = String(form.loopback_wan || raw["LOOPBACK PRINCIPAL"] || "");
  const loopbackSecundario = String(form.loopback_lan || raw["LOOPBACK SECUNDARIO"] || "");
  const ipNat = String(form.ip_nat || raw["IP NAT"] || "");

  const acessoNat = useMemo(() => {
    if (!ipNat) return "";
    if (!usuarioNat.trim()) return `ssh ${ipNat}`;
    return `ssh ${usuarioNat.trim()}@${ipNat}`;
  }, [ipNat, usuarioNat]);

  const tclScript = useMemo(() => {
    if (!loopbackPrimario && !loopbackSecundario) return "";
    const linhas: string[] = [];
    if (loopbackPrimario) {
      linhas.push(`"${loopbackPrimario} df-bit size 1472 source ${SOURCE_INTERFACE} repeat 5"`);
    }
    if (loopbackSecundario) {
      linhas.push(`"${loopbackSecundario} source ${SOURCE_INTERFACE} repeat 5"`);
    }
    return `tclsh
foreach add {
${linhas.join("\n")}
} { ping $add }`;
  }, [loopbackPrimario, loopbackSecundario]);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1600);
  };

  const CopyBtn = ({ text, id }: { text: string; id: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 shrink-0"
      onClick={() => copy(text, id)}
    >
      {copied === id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  );

  const CommandRow = ({ label, command, id }: { label: string; command: string; id: string }) => {
    if (!command) return null;
    return (
      <div className="flex items-center justify-between gap-2 p-2 rounded bg-muted/50 hover:bg-muted transition-colors">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
          <code className="text-xs font-mono break-all">{command}</code>
        </div>
        <CopyBtn text={command} id={id} />
      </div>
    );
  };

  const pingPrimario = loopbackPrimario
    ? `ping ${loopbackPrimario} df-bit size 1472 source ${SOURCE_INTERFACE} repeat 10`
    : "";
  const tempoPrimario = loopbackPrimario ? `sh ip route | inc ${loopbackPrimario}/32` : "";
  const pingSecundario = loopbackSecundario
    ? `ping ${loopbackSecundario} df-bit size 1300 source ${SOURCE_INTERFACE} repeat 10`
    : "";
  const tempoSecundario = loopbackSecundario ? `sh ip route | inc ${loopbackSecundario}/32` : "";
  const telnetPrimario = loopbackPrimario ? `telnet ${loopbackPrimario} /source-interface ${SOURCE_INTERFACE}` : "";
  const telnetSecundario = loopbackSecundario ? `telnet ${loopbackSecundario} /source-interface ${SOURCE_INTERFACE}` : "";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Terminal className="w-5 h-5" /> Teste Ping e Acesso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <CommandRow label="Acesso Primario" command={loopbackPrimario ? `ssh ${loopbackPrimario}` : ""} id="acesso-primario" />
          <CommandRow label="Acesso Secundario" command={loopbackSecundario ? `ssh ${loopbackSecundario}` : ""} id="acesso-secundario" />
          {ipNat && (
            <div className="space-y-2 p-2 rounded bg-muted/50">
              <Label className="text-xs text-muted-foreground">Usuario para acesso NAT</Label>
              <Input value={usuarioNat} onChange={(e) => setUsuarioNat(e.target.value)} />
              <CommandRow label="Acesso NAT" command={acessoNat} id="acesso-nat" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Comandos de Teste</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <CommandRow label="Ping Primario" command={pingPrimario} id="ping-primario" />
          <CommandRow label="Tempo Roteamento Primario" command={tempoPrimario} id="tempo-primario" />
          <CommandRow label="Ping Secundario" command={pingSecundario} id="ping-secundario" />
          <CommandRow label="Tempo Roteamento Secundario" command={tempoSecundario} id="tempo-secundario" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Telnet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <CommandRow label="Telnet Primario" command={telnetPrimario} id="telnet-primario" />
          <CommandRow label="Telnet Secundario" command={telnetSecundario} id="telnet-secundario" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Script TCL</CardTitle>
          {tclScript && <CopyBtn text={tclScript} id="script-tcl" />}
        </CardHeader>
        <CardContent>
          {tclScript ? (
            <pre className="text-xs font-mono bg-muted/50 p-3 rounded whitespace-pre-wrap">{tclScript}</pre>
          ) : (
            <div className="text-sm text-muted-foreground">Sem dados de loopback para gerar script.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TestesTab;
