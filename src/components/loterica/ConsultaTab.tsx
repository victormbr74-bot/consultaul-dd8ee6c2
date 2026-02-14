import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELDS: Array<{ key: string; label: string; mono?: boolean }> = [
  { key: "nome_loterica", label: "Nome" },
  { key: "ccto_oi", label: "CCTO OI" },
  { key: "ccto_oemp", label: "CCTO OEMP" },
  { key: "designacao_nova", label: "Designa\u00E7\u00E3o Nova" },
  { key: "operadora", label: "Operadora" },
  { key: "ip_nat", label: "IP NAT", mono: true },
  { key: "ip_wan", label: "IP WAN", mono: true },
  { key: "loopback_wan", label: "Loopback Principal", mono: true },
  { key: "loopback_lan", label: "Loopback Secund\u00E1rio", mono: true },
  { key: "endereco", label: "Endere\u00E7o" },
  { key: "contato", label: "Contato" },
  { key: "status", label: "Status" },
  { key: "cidade", label: "Cidade" },
  { key: "uf", label: "UF" },
];

const EXTRA_FIELDS: Array<{ label: string; keys: string[]; mono?: boolean }> = [
  { label: "Rede LAN", keys: ["REDE LAN"], mono: true },
  { label: "IP Switch", keys: ["IP SWITCH", "LOOPBACK SWITCH"], mono: true },
  { label: "TFL", keys: ["TFL", "TFLs"], mono: true },
  { label: "Tipo UL", keys: ["TIPO LOTERICA", "TIPO UL"] },
  { label: "Per\u00EDmetro", keys: ["PERIMETRO", "PER\u00CDMETRO"] },
  { label: "Tecnologia", keys: ["TECNOLOGIA"] },
  { label: "Modelo Roteador", keys: ["MODELO ROTEADOR"] },
  { label: "SIM Card 4G", keys: ["SIM CARD 4G"], mono: true },
  { label: "Owner", keys: ["OWNER"] },
  { label: "Resp. Backup", keys: ["RESP BACKUP"] },
  { label: "Regi\u00E3o", keys: ["REGIAO", "REGI\u00C3O"] },
  { label: "CEP", keys: ["CEP"], mono: true },
  { label: "Migra\u00E7\u00E3o", keys: ["MIGRACAO", "MIGRA\u00C7\u00C3O"] },
  { label: "Homologado", keys: ["HOMOLOGADO"] },
];

interface ConsultaTabProps {
  form: any;
  setForm: (form: any) => void;
}

const ConsultaTab = ({ form, setForm }: ConsultaTabProps) => {
  const raw = (form?.raw_data && typeof form.raw_data === "object") ? form.raw_data : {};

  const getRawValue = (keys: string[]) => {
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(raw, k)) return raw[k];
    }
    return undefined;
  };

  const setRawValue = (keys: string[], value: string) => {
    const current = (form?.raw_data && typeof form.raw_data === "object") ? form.raw_data : {};
    const next: Record<string, unknown> = { ...current };
    const targetKey = keys.find((k) => Object.prototype.hasOwnProperty.call(current, k)) || keys[0];
    next[targetKey] = value;
    setForm({ ...form, raw_data: next });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados Edit\u00E1veis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                <Input
                  className={f.mono ? "font-mono text-xs" : ""}
                  value={form?.[f.key] || ""}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados Adicionais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {EXTRA_FIELDS.map((f) => (
              <div key={f.label} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                <Input
                  className={f.mono ? "font-mono text-xs" : ""}
                  value={String(getRawValue(f.keys) ?? "")}
                  placeholder="-"
                  onChange={(e) => setRawValue(f.keys, e.target.value)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConsultaTab;

