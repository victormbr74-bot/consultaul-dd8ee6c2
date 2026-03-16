import { useLayoutEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebarActions } from "@/contexts/SidebarActionsContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ConsultaTab from "@/components/loterica/ConsultaTab";

const EMPTY_FORM = {
  nome_loterica: "",
  ccto_oi: "",
  ccto_oemp: "",
  designacao_nova: "",
  operadora: "",
  ip_nat: "",
  ip_wan: "",
  loopback_wan: "",
  loopback_lan: "",
  endereco: "",
  contato: "",
  status: "",
  cidade: "",
  uf: "",
  raw_data: {} as Record<string, unknown>,
};

const toNullableText = (value: unknown) => {
  const text = String(value ?? "").trim();
  return text ? text : null;
};

const toRawDataInsert = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const result: Record<string, unknown> = {};
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    const rawKey = String(key || "").trim();
    if (!rawKey) continue;

    if (rawValue === null || rawValue === undefined) continue;
    if (typeof rawValue === "string") {
      const trimmed = rawValue.trim();
      if (!trimmed) continue;
      result[rawKey] = trimmed;
      continue;
    }

    result[rawKey] = rawValue;
  }

  return Object.keys(result).length ? result : null;
};

const LotericaCreate = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setShowLotericaTabs, setOnExport, setOnImportClick } = useSidebarActions();
  const [codUl, setCodUl] = useState("");
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    setShowLotericaTabs(false);
    setOnExport(undefined);
    setOnImportClick(undefined);
    return () => {
      setShowLotericaTabs(false);
      setOnExport(undefined);
      setOnImportClick(undefined);
    };
  }, [setShowLotericaTabs, setOnExport, setOnImportClick]);

  const handleSave = async () => {
    const normalizedCodUl = String(codUl || "").trim().toUpperCase();
    if (!normalizedCodUl) {
      alert("Informe o codigo UL.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        cod_ul: normalizedCodUl,
        nome_loterica: toNullableText(form?.nome_loterica),
        ccto_oi: toNullableText(form?.ccto_oi),
        ccto_oemp: toNullableText(form?.ccto_oemp),
        designacao_nova: toNullableText(form?.designacao_nova),
        operadora: toNullableText(form?.operadora),
        ip_nat: toNullableText(form?.ip_nat),
        ip_wan: toNullableText(form?.ip_wan),
        loopback_wan: toNullableText(form?.loopback_wan),
        loopback_lan: toNullableText(form?.loopback_lan),
        endereco: toNullableText(form?.endereco),
        contato: toNullableText(form?.contato),
        status: toNullableText(form?.status),
        cidade: toNullableText(form?.cidade),
        uf: toNullableText(form?.uf),
        raw_data: toRawDataInsert(form?.raw_data),
        updated_by: user?.id || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("lotericas").insert([payload]);
      if (error) {
        const msg = String(error.message || "");
        if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("already exists")) {
          alert("Ja existe uma loterica com este codigo UL.");
        } else if (msg.toLowerCase().includes("row-level security")) {
          alert("Seu usuario nao possui permissao para cadastrar lotericas.");
        } else {
          alert("Erro ao cadastrar loterica: " + msg);
        }
        return;
      }

      alert("Loterica cadastrada com sucesso!");
      navigate(`/loterica/${encodeURIComponent(normalizedCodUl)}`);
    } catch (error) {
      console.error("Falha inesperada ao cadastrar loterica", error);
      alert("Falha inesperada ao cadastrar loterica.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-background">
      <div className="container flex items-center justify-between h-12 px-4 border-b">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <span className="font-medium">Cadastrar Lotérica</span>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-1" /> {saving ? "Salvando..." : "Cadastrar"}
        </Button>
      </div>

      <main className="container px-4 py-6 max-w-5xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Identificacao</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Codigo UL *</Label>
                <Input
                  className="font-mono text-xs"
                  value={codUl}
                  onChange={(e) => setCodUl(e.target.value.toUpperCase())}
                  placeholder="Ex: UL12345"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <ConsultaTab form={form} setForm={setForm} />
      </main>
    </div>
  );
};

export default LotericaCreate;
