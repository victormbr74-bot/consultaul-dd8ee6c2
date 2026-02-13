import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Terminal } from "lucide-react";

interface TestesTabProps {
  form: any;
}

const TestesTab = ({ form }: TestesTabProps) => {
  const [copied, setCopied] = useState<string | null>(null);
  const raw = form.raw_data || {};

  const loopbackPrimario = form.loopback_wan || "";
  const loopbackSecundario = form.loopback_lan || "";
  const ipNat = form.ip_nat || "";
  const ipSwitch = raw["IP SWITCH"] || "";

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
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

  const CommandRow = ({ label, command, id }: { label: string; command: string; id: string }) => (
    <div className="flex items-center justify-between gap-2 p-2 rounded bg-muted/50 hover:bg-muted transition-colors">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
        <code className="text-xs font-mono break-all">{command}</code>
      </div>
      <CopyBtn text={command} id={id} />
    </div>
  );

  const tclScript = `tclsh
foreach add {
"${loopbackPrimario} df-bit size 1472 source Gi0/0/1.1090 repeat 5"
"${loopbackSecundario} source Gi0/0/1.1090 repeat 5"
} { ping $add }`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Terminal className="w-5 h-5" /> Acesso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loopbackPrimario && (
            <CommandRow label="Acesso Primário" command={`ssh ${loopbackPrimario}`} id="ssh1" />
          )}
          {loopbackSecundario && (
            <CommandRow label="Acesso Secundário" command={`ssh ${loopbackSecundario}`} id="ssh2" />
          )}
          {ipNat && (
            <CommandRow label="Acesso NAT" command={`ssh ${ipNat}`} id="ssh3" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Testes de Ping</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loopbackPrimario && (
            <>
              <CommandRow
                label="Ping Primário"
                command={`ping ${loopbackPrimario} df-bit size 1472 source Gi0/0/1.1090 repeat 10`}
                id="ping1"
              />
              <CommandRow
                label="Roteamento Primário"
                command={`sh ip route | inc ${loopbackPrimario}/32`}
                id="route1"
              />
            </>
          )}
          {loopbackSecundario && (
            <>
              <CommandRow
                label="Ping Secundário"
                command={`ping ${loopbackSecundario} df-bit size 1300 source Gi0/0/1.1090 repeat 10`}
                id="ping2"
              />
              <CommandRow
                label="Roteamento Secundário"
                command={`sh ip route | inc ${loopbackSecundario}/32`}
                id="route2"
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Telnet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loopbackPrimario && (
            <CommandRow
              label="Telnet Primário"
              command={`telnet ${loopbackPrimario} /source-interface Gi0/0/1.1090`}
              id="telnet1"
            />
          )}
          {loopbackSecundario && (
            <CommandRow
              label="Telnet Secundário"
              command={`telnet ${loopbackSecundario} /source-interface Gi0/0/1.1090`}
              id="telnet2"
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Script TCL</CardTitle>
          <CopyBtn text={tclScript} id="tcl" />
        </CardHeader>
        <CardContent>
          <pre className="text-xs font-mono bg-muted/50 p-3 rounded whitespace-pre-wrap">{tclScript}</pre>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestesTab;
