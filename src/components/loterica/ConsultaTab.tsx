import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FIELDS: Array<{ key: string; label: string; mono?: boolean }> = [
  { key: "nome_loterica", label: "Nome" },
  { key: "ccto_oi", label: "CCTO OI" },
  { key: "ccto_oemp", label: "CCTO OEMP" },
  { key: "designacao_nova", label: "Designação Nova" },
  { key: "operadora", label: "Operadora" },
  { key: "ip_nat", label: "IP NAT", mono: true },
  { key: "ip_wan", label: "IP WAN", mono: true },
  { key: "loopback_wan", label: "Loopback Principal", mono: true },
  { key: "loopback_lan", label: "Loopback Secundário", mono: true },
  { key: "endereco", label: "Endereço" },
  { key: "contato", label: "Contato" },
  { key: "status", label: "Status" },
  { key: "cidade", label: "Cidade" },
  { key: "uf", label: "UF" },
];

interface ConsultaTabProps {
  form: any;
  setForm: (form: any) => void;
}

const ConsultaTab = ({ form, setForm }: ConsultaTabProps) => {
  const raw = form.raw_data || {};

  const extraFields = [
    { label: "Rede LAN", value: raw["REDE LAN"], mono: true },
    { label: "IP Switch", value: raw["IP SWITCH"], mono: true },
    { label: "TFL", value: raw["TFL"] },
    { label: "Tipo UL", value: raw["TIPO LOTERICA"] },
    { label: "Perímetro", value: raw["PERIMETRO"] },
    { label: "Tecnologia", value: raw["TECNOLOGIA"] },
    { label: "Modelo Roteador", value: raw["MODELO ROTEADOR"] },
    { label: "SIM Card 4G", value: raw["SIM CARD 4G"], mono: true },
    { label: "Owner", value: raw["OWNER"] },
    { label: "Resp. Backup", value: raw["RESP BACKUP"] },
    { label: "Região", value: raw["REGIÃO"] },
    { label: "CEP", value: raw["CEP"] },
    { label: "Migração", value: raw["MIGRAÇÃO"] },
    { label: "Homologado", value: raw["HOMOLOGADO"] },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados Editáveis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FIELDS.map(f => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                <Input
                  className={f.mono ? "font-mono text-xs" : ""}
                  value={form[f.key] || ""}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados Adicionais (somente leitura)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {extraFields.map(f => (
              <div key={f.label} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                <div className={`text-sm p-2 rounded bg-muted/50 min-h-[36px] ${f.mono ? "font-mono text-xs" : ""}`}>
                  {f.value || "—"}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConsultaTab;
