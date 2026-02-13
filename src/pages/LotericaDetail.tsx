import { useState, useEffect, useLayoutEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebarActions } from "@/contexts/SidebarActionsContext";
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
  const { user } = useAuth();
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

        setLoterica(data);
        setForm(data);
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
      const { raw_data, updated_at, ...updateData } = form;
      const { error } = await supabase
        .from("lotericas")
        .update({ ...updateData, updated_by: user?.id, updated_at: new Date().toISOString() })
        .eq("cod_ul", codUl);

      if (error) {
        alert("Erro ao salvar: " + error.message);
      } else {
        alert("Salvo com sucesso!");
        setLoterica(form);
      }
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
          <Button variant="outline" size="sm" onClick={fetchHistory}>
            <History className="w-4 h-4 mr-1" /> {"Hist\u00F3rico"}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> {saving ? "Salvando..." : "Salvar"}
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
