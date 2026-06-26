import type { ReactNode } from "react";
import { useCallback, useRef, useLayoutEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import TestesTab from "@/components/loterica/TestesTab";

type MainField = {
  label: string;
  mono?: boolean;
  key?: string;
  rawKeys?: string[];
  multiline?: boolean;
  rows?: number;
  wide?: boolean;
  compactExpandable?: boolean;
  noWrap?: boolean;
};

const LOTERICA_FIELDS: MainField[] = [
  { key: "nome_loterica", label: "Nome", multiline: true, rows: 1, compactExpandable: true, noWrap: true },
  { key: "endereco", label: "Endereço", multiline: true, rows: 1, compactExpandable: true, noWrap: true },
  { key: "contato", label: "Contato", multiline: true, rows: 1, compactExpandable: true, noWrap: true },
  { key: "status", label: "Status" },
  { key: "cidade", label: "Cidade" },
  { key: "uf", label: "UF" },
  { label: "TFL", rawKeys: ["TFL", "TFLs"], mono: true },
  { label: "Owner", rawKeys: ["OWNER"] },
  { label: "Tipo UL", rawKeys: ["TIPO LOTERICA", "TIPO UL"] },
  { label: "Região", rawKeys: ["REGIAO", "REGIÃO"] },
  { label: "CEP", rawKeys: ["CEP"], mono: true },
  { label: "Migração", rawKeys: ["MIGRACAO", "MIGRAÇÃO"] },
  { label: "Homologado", rawKeys: ["HOMOLOGADO"] },
];

const PRINCIPAL_FIELDS: MainField[] = [
  { key: "ccto_oi", label: "CCTO OI" },
  { label: "CPE OI", rawKeys: ["CPE OI", "CPE_OI"], mono: true },
  { key: "designacao_nova", label: "Designação Nova" },
  { key: "circuito_meraki", label: "Circuito Meraki" },
  { key: "cpe_meraki", label: "CPE Meraki" },
  { key: "ccto_oemp", label: "CCTO OEMP" },
  { label: "Empresa OEMP", rawKeys: ["EMPRESA OEMP"] },
  { key: "ip_nat", label: "IP NAT", mono: true },
  { key: "ip_wan", label: "IP WAN", mono: true },
  { key: "loopback_wan", label: "Loopback Principal", mono: true },
  { label: "Rede LAN", rawKeys: ["REDE LAN"], mono: true },
  { label: "Perímetro", rawKeys: ["PERIMETRO", "PERÍMETRO"] },
];

const BACKUP_FIELDS: MainField[] = [
  { label: "Circuito Backup", rawKeys: ["CIRCUITO BACKUP"], mono: true },
  { key: "circuito_elsys", label: "Circuito Elsys" },
  { key: "loopback_lan", label: "Loopback Secundário", mono: true },
  { label: "Tecnologia", rawKeys: ["TECNOLOGIA"] },
  { key: "operadora", label: "Operadora" },
  { label: "SIM Card 4G", rawKeys: ["SIM CARD 4G"], mono: true },
  { label: "Resp. Backup", rawKeys: ["RESP BACKUP"] },
  { label: "IP Switch", rawKeys: ["IP SWITCH", "LOOPBACK SWITCH"], mono: true },
  { label: "Modelo Roteador", rawKeys: ["MODELO ROTEADOR"] },
];

interface ConsultaTabProps {
  form: any;
  setForm: (form: any) => void;
  saveButton?: ReactNode;
}

const ConsultaTab = ({ form, setForm, saveButton }: ConsultaTabProps) => {
  const draftRef = useRef<Record<string, string>>({});
  const formIdRef = useRef<string>("");
  const formRef = useRef<any>(form);

  useLayoutEffect(() => {
    formRef.current = form;
    const newId = form?.cod_ul || "";
    if (newId !== formIdRef.current) {
      formIdRef.current = newId;
      for (const key of Object.keys(draftRef.current)) {
        delete draftRef.current[key];
      }
    }
  }, [form]);

  const getRawValue = useCallback((form: any, keys: string[]) => {
    const raw = form?.raw_data && typeof form.raw_data === "object" ? form.raw_data : {};
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(raw, k)) return raw[k];
    }
    return undefined;
  }, []);

  const getFieldValue = useCallback((f: MainField) => {
    if (draftRef.current[f.label] !== undefined) {
      return draftRef.current[f.label];
    }
    if (f.key) {
      return formRef.current?.[f.key] ?? "";
    }
    if (f.rawKeys) {
      const rawValue = getRawValue(formRef.current, f.rawKeys);
      return rawValue != null ? String(rawValue) : "";
    }
    return "";
  }, [getRawValue]);

  const commitField = useCallback(
    (f: MainField) => {
      const value = draftRef.current[f.label];
      if (value === undefined) return;

      if (f.key) {
        setForm((prev: any) => ({ ...prev, [f.key]: value }));
      } else if (f.rawKeys) {
        setForm((prev: any) => {
          const current = prev?.raw_data && typeof prev.raw_data === "object" ? prev.raw_data : {};
          const targetKey = f.rawKeys.find((k) => Object.prototype.hasOwnProperty.call(current, k)) || f.rawKeys[0];
          const next: Record<string, unknown> = { ...current, [targetKey]: value };
          return { ...prev, raw_data: next };
        });
      }
      delete draftRef.current[f.label];
    },
    [setForm],
  );

  const handleInputChange = useCallback((f: MainField, value: string) => {
    draftRef.current[f.label] = value;
  }, []);

  const renderField = useCallback(
    (f: MainField) => {
      const value = getFieldValue(f);

      return (
        <div
          key={f.key || f.label}
          className={cn("space-y-1.5", f.wide ? "md:col-span-2 2xl:col-span-3" : "")}
        >
          <Label className="text-xs text-muted-foreground">{f.label}</Label>
          {f.multiline ? (
            <Textarea
              rows={f.rows || 3}
              wrap={f.noWrap ? "off" : undefined}
              className={cn(
                f.compactExpandable ? "h-10 min-h-10 resize overflow-auto" : "resize-y",
                f.mono ? "font-mono text-xs" : "",
              )}
              value={value}
              onChange={(e) => handleInputChange(f, e.target.value)}
              onBlur={() => commitField(f)}
            />
          ) : (
            <Input
              className={f.mono ? "font-mono text-xs" : ""}
              value={value}
              placeholder={f.key ? undefined : "-"}
              onChange={(e) => handleInputChange(f, e.target.value)}
              onBlur={() => commitField(f)}
            />
          )}
        </div>
      );
    },
    [getFieldValue, handleInputChange, commitField],
  );

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="min-w-0 xl:sticky xl:top-16 xl:self-start">
        <TestesTab form={form} />
      </aside>

      <div className="min-w-0 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-lg">Dados Principal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {PRINCIPAL_FIELDS.map(renderField)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-lg">Dados Backup</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {BACKUP_FIELDS.map(renderField)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-lg">Dados da Lotérica</CardTitle>
            {saveButton}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {LOTERICA_FIELDS.map(renderField)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConsultaTab;