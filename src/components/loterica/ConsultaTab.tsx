import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
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
  const allFields = useMemo(() => [...PRINCIPAL_FIELDS, ...BACKUP_FIELDS, ...LOTERICA_FIELDS], []);

  const buildDraft = useCallback((formData: any) => {
    const rawData = formData?.raw_data && typeof formData.raw_data === "object" ? formData.raw_data : {};
    const next: Record<string, string> = {};
    for (const f of allFields) {
      if (f.key) {
        next[f.label] = formData?.[f.key] || "";
      } else if (f.rawKeys) {
        let found = false;
        for (const k of f.rawKeys) {
          if (Object.prototype.hasOwnProperty.call(rawData, k)) {
            next[f.label] = String(rawData[k] || "");
            found = true;
            break;
          }
        }
        if (!found) {
          next[f.label] = "";
        }
      }
    }
    return next;
  }, [allFields]);

  const [draft, setDraft] = useState<Record<string, string>>(() => buildDraft(form));
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    const expected = buildDraft(form);
    const current = draftRef.current;
    const hasUncommitted = Object.keys(expected).some((label) => current[label] !== expected[label]);
    if (!hasUncommitted) {
      const isSame =
        Object.keys(expected).length === Object.keys(current).length &&
        Object.keys(expected).every((label) => current[label] === expected[label]);
      if (!isSame) {
        setDraft(expected);
      }
    }
  }, [form, buildDraft]);

  const commitField = (f: MainField) => {
    const value = draftRef.current[f.label] || "";
    if (f.key) {
      setForm({ ...form, [f.key]: value });
    } else if (f.rawKeys) {
      const current = form?.raw_data && typeof form.raw_data === "object" ? form.raw_data : {};
      const next: Record<string, unknown> = { ...current };
      const targetKey = f.rawKeys.find((k) => Object.prototype.hasOwnProperty.call(current, k)) || f.rawKeys[0];
      next[targetKey] = value;
      setForm({ ...form, raw_data: next });
    }
  };

  const renderField = (f: MainField) => {
    const value = draft[f.label] ?? "";

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
            onChange={(e) => {
              setDraft((prev) => ({ ...prev, [f.label]: e.target.value }));
            }}
            onBlur={() => commitField(f)}
          />
        ) : (
          <Input
            className={f.mono ? "font-mono text-xs" : ""}
            value={value}
            placeholder={f.key ? undefined : "-"}
            onChange={(e) => {
              setDraft((prev) => ({ ...prev, [f.label]: e.target.value }));
            }}
            onBlur={() => commitField(f)}
          />
        )}
      </div>
    );
  };

  const SectionCard = ({
    title,
    fields,
    action,
  }: {
    title: string;
    fields: MainField[];
    action?: ReactNode;
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-lg">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>
        <FieldGrid>{fields.map(renderField)}</FieldGrid>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="min-w-0 xl:sticky xl:top-16 xl:self-start">
        <TestesTab form={form} />
      </aside>

      <div className="min-w-0 space-y-6">
        <SectionCard title="Dados Principal" fields={PRINCIPAL_FIELDS} />
        <SectionCard title="Dados Backup" fields={BACKUP_FIELDS} />
        <SectionCard title="Dados da Lotérica" fields={LOTERICA_FIELDS} action={saveButton} />
      </div>
    </div>
  );
};

function FieldGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  );
}

export default ConsultaTab;
