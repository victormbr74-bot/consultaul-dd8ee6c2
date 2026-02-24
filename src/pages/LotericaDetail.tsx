import { useState, useEffect, useLayoutEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebarActions } from "@/contexts/SidebarActionsContext";
import { isTemporaryConsultaPublicAccessEnabled } from "@/lib/temporaryAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, History } from "lucide-react";
import ConsultaTab from "@/components/loterica/ConsultaTab";
import MascaraTab from "@/components/loterica/MascaraTab";
import TestesTab from "@/components/loterica/TestesTab";
import Ping99Tab from "@/components/loterica/Ping99Tab";

const LotericaDetail = () => {
  const { codUl } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { lotericaTab, setShowLotericaTabs, setOnExport, setOnImportClick } = useSidebarActions();
  const [loterica, setLoterica] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useLayoutEffect(() => {
    setShowLotericaTabs(true);
    setOnExport(undefined);
    setOnImportClick(undefined);
    return () => {
      setShowLotericaTabs(false);
      setOnExport(undefined);
      setOnImportClick(undefined);
    };
  }, [setShowLotericaTabs, setOnExport, setOnImportClick]);

  useEffect(() => {
    const fetchLoterica = async () => {
      setLoading(true);
      try {
        if (!codUl) {
          setLoterica(null);
          setForm({});
          return;
        }

        const { data, error } = await supabase
          .from("lotericas")
          .select("*")
          .eq("cod_ul", codUl)
          .single();

        if (error) {
          console.error("Erro ao carregar loterica", error);
          setLoterica(null);
          setForm({});
          return;
        }

        const raw = (data as any)?.raw_data || {};
        const rawRedeLan = String(raw["REDE LAN"] || "").trim();
        const rawLoopbackSec = String(raw["LOOPBACK SECUNDARIO"] || raw["LOOPBACK SECUNDÃRIO"] || "").trim();
        const currentLoopbackLan = String((data as any)?.loopback_lan || "").trim();

        // Normaliza registros importados com bug: loopback_lan veio como "REDE LAN".
        const normalized =
          rawLoopbackSec &&
          (!currentLoopbackLan || currentLoopbackLan === rawRedeLan) &&
          rawLoopbackSec !== rawRedeLan
            ? { ...data, loopback_lan: rawLoopbackSec }
            : data;

        setLoterica(normalized);
        setForm(normalized);
      } catch (error) {
        console.error("Falha inesperada ao carregar loterica", error);
        setLoterica(null);
        setForm({});
      } finally {
        setLoading(false);
      }
    };

    void fetchLoterica();
  }, [codUl]);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("loterica_history")
        .select("*, profiles:changed_by(name)")
        .eq("cod_ul", codUl)
        .order("changed_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Erro ao carregar historico", error);
        alert("Erro ao carregar historico.");
        return;
      }

      setHistory(data || []);
      setShowHistory(true);
    } catch (error) {
      console.error("Falha inesperada ao carregar historico", error);
      alert("Falha inesperada ao carregar historico.");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const editableKeys = [
        "nome_loterica",
        "ccto_oi",
        "ccto_oemp",
        "designacao_nova",
        "operadora",
        "ip_nat",
        "ip_wan",
        "loopback_wan",
        "loopback_lan",
        "endereco",
        "contato",
        "status",
        "cidade",
        "uf",
      ] as const;

      const beforeData: Record<string, unknown> = {};
      const afterData: Record<string, unknown> = {};
      for (const key of editableKeys) {
        beforeData[key] = loterica?.[key] ?? null;
        afterData[key] = form?.[key] ?? null;
      }

      const changes: Record<string, unknown> = {};
      const beforeChanges: Record<string, unknown> = {};
      for (const key of editableKeys) {
        const b = beforeData[key];
        const a = afterData[key];
        if (JSON.stringify(b) !== JSON.stringify(a)) {
          changes[key] = a;
          beforeChanges[key] = b;
        }
      }
      // raw_data: permite edicao dos campos extras ("Dados Adicionais").
      const rawEditableKeys: string[][] = [
        ["REDE LAN"],
        ["IP SWITCH", "LOOPBACK SWITCH"],
        ["TFL", "TFLs"],
        ["CIRCUITO MERAKI", "CIRCUITOS MERAKI", "MERAKI"],
        ["EMPRESA OEMP"],
        ["TIPO LOTERICA", "TIPO UL"],
        ["PERIMETRO", "PER\u00CDMETRO"],
        ["TECNOLOGIA"],
        ["MODELO ROTEADOR"],
        ["SIM CARD 4G"],
        ["OWNER"],
        ["RESP BACKUP"],
        ["REGIAO", "REGI\u00C3O"],
        ["CEP"],
        ["MIGRACAO", "MIGRA\u00C7\u00C3O"],
        ["HOMOLOGADO"],
      ];

      const rawBefore = loterica?.raw_data && typeof loterica.raw_data === "object" ? loterica.raw_data : {};
      const rawAfter = form?.raw_data && typeof form.raw_data === "object" ? form.raw_data : {};

      const getRaw = (obj: any, keys: string[]) => {
        for (const k of keys) {
          if (obj && Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
        }
        return undefined;
      };

      const rawChanged = rawEditableKeys.some((keys) => {
        const b = getRaw(rawBefore, keys);
        const a = getRaw(rawAfter, keys);
        return JSON.stringify(b ?? null) !== JSON.stringify(a ?? null);
      });

      if (rawChanged) {
        changes.raw_data = rawAfter;
        beforeChanges.raw_data = rawBefore;
      }

      if (Object.keys(changes).length === 0) {
        alert("Nenhuma alteraÃ§Ã£o para salvar.");
        return;
      }

      if (!user?.id) {
        if (!isTemporaryConsultaPublicAccessEnabled()) {
          alert("SessÃ£o invÃ¡lida. FaÃ§a login novamente.");
          return;
        }

        const guestTimestamp = new Date().toISOString();
        const { error } = await supabase
          .from("lotericas")
          .update({ ...changes, updated_by: null, updated_at: guestTimestamp })
          .eq("cod_ul", codUl);

        if (error) {
          alert("Erro ao salvar (modo temporÃ¡rio): " + error.message);
          return;
        }

        alert("Salvo com sucesso (modo temporÃ¡rio)!");
        setLoterica({ ...loterica, ...changes, updated_by: null, updated_at: guestTimestamp });
        return;
      }

      if (isAdmin) {
        const { error } = await supabase
          .from("lotericas")
          .update({ ...changes, updated_by: user.id, updated_at: new Date().toISOString() })
          .eq("cod_ul", codUl);

        if (error) {
          alert("Erro ao salvar: " + error.message);
          return;
        }

        alert("Salvo com sucesso!");
        setLoterica({ ...loterica, ...changes, updated_by: user.id, updated_at: new Date().toISOString() });
        return;
      }

      // Usuario nao-admin: cria solicitacao de alteracao para aprovacao do ADM.
      const { error: reqError } = await (supabase as any).from("loterica_change_requests").insert({
        cod_ul: codUl,
        proposed_by: user.id,
        before_data: beforeChanges,
        after_data: changes,
        status: "pending",
      } as any);

      if (reqError) {
        const msg = String((reqError as any)?.message || "");
        if (msg.includes("loterica_change_requests") && msg.includes("Could not find the table")) {
          alert(
            "Banco desatualizado: falta a tabela loterica_change_requests.\n" +
              "Aplique a migracao Supabase '20260213173000_approval_workflow_and_loopback_fix.sql' e tente novamente.",
          );
        } else {
          alert("Erro ao enviar para aprovacao: " + msg);
        }
        return;
      }

      alert("Alteracao enviada para aprovacao do ADM.");
      // Como ainda nÃ£o foi aplicado no banco, volta o formulÃ¡rio ao estado atual salvo.
      setForm(loterica);
    } catch (error) {
      console.error("Falha inesperada ao salvar loterica", error);
      alert("Falha inesperada ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  if (!loterica) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        {"Lot\u00E9rica n\u00E3o encontrada"}
      </div>
    );
  }

  return (
    <div className="bg-background">
      <div className="container flex items-center justify-between h-12 px-4 border-b">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <span className="font-mono text-sm font-medium text-foreground">{codUl}</span>
          <span className="text-sm text-muted-foreground hidden sm:inline"> - {form.nome_loterica}</span>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <Button variant="outline" size="sm" onClick={fetchHistory}>
              <History className="w-4 h-4 mr-1" /> {"Histórico"}
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> {saving ? "Salvando..." : user ? (isAdmin ? "Salvar" : "Enviar p/ Aprovação") : "Salvar (temporário)"}
          </Button>
        </div>
      </div>

      <main className="container px-4 py-6 max-w-5xl">
        {lotericaTab === "consulta" && <ConsultaTab form={form} setForm={setForm} />}
        {lotericaTab === "mascara" && <MascaraTab form={form} />}
        {lotericaTab === "testes" && <TestesTab form={form} />}
        {lotericaTab === "ping99" && <Ping99Tab form={form} />}

        {showHistory && (
          <Card className="mt-6 animate-fade-in">
            <CardHeader>
              <CardTitle className="text-lg">{"Hist\u00F3rico de Altera\u00E7\u00F5es"}</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">{"Nenhuma altera\u00E7\u00E3o registrada."}</p>
              ) : (
                <div className="space-y-3">
                  {history.map((h) => (
                    <div key={h.id} className="border rounded-lg p-3 text-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{(h as any).profiles?.name || "Desconhecido"}</span>
                        <span className="text-xs text-muted-foreground">{new Date(h.changed_at).toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {h.before_data && h.after_data && (
                          <div className="space-y-1">
                            {Object.keys(h.after_data)
                              .filter((k) =>
                                k !== "raw_data" &&
                                k !== "updated_at" &&
                                k !== "updated_by" &&
                                JSON.stringify(h.before_data[k]) !== JSON.stringify(h.after_data[k]),
                              )
                              .map((k) => (
                                <div key={k}>
                                  <span className="font-medium text-foreground">{k}:</span>{" "}
                                  <span className="text-destructive line-through">{String(h.before_data[k] ?? "")}</span>{" -> "}
                                  <span className="text-green-600">{String(h.after_data[k] ?? "")}</span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default LotericaDetail;

