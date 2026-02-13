import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, History, Search, FileText, Terminal, Wifi } from "lucide-react";
import ConsultaTab from "@/components/loterica/ConsultaTab";
import MascaraTab from "@/components/loterica/MascaraTab";
import TestesTab from "@/components/loterica/TestesTab";
import Ping99Tab from "@/components/loterica/Ping99Tab";

const LotericaDetail = () => {
  const { codUl } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loterica, setLoterica] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("lotericas").select("*").eq("cod_ul", codUl).single();
      if (data) { setLoterica(data); setForm(data); }
      setLoading(false);
    };
    fetch();
  }, [codUl]);

  const fetchHistory = async () => {
    const { data } = await supabase
      .from("loterica_history")
      .select("*, profiles:changed_by(name)")
      .eq("cod_ul", codUl)
      .order("changed_at", { ascending: false })
      .limit(20);
    setHistory(data || []);
    setShowHistory(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const { raw_data, updated_at, ...updateData } = form;
    const { error } = await supabase.from("lotericas")
      .update({ ...updateData, updated_by: user?.id, updated_at: new Date().toISOString() })
      .eq("cod_ul", codUl);

    if (error) {
      alert("Erro ao salvar: " + error.message);
    } else {
      alert("Salvo com sucesso!");
      setLoterica(form);
    }
    setSaving(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  if (!loterica) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Lotérica não encontrada</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="container flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <span className="font-mono text-sm font-medium text-foreground">{codUl}</span>
            <span className="text-sm text-muted-foreground hidden sm:inline">— {form.nome_loterica}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchHistory}>
              <History className="w-4 h-4 mr-1" /> Histórico
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-1" /> {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6 max-w-5xl">
        <Tabs defaultValue="consulta" className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="consulta" className="gap-1.5">
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Consulta</span>
            </TabsTrigger>
            <TabsTrigger value="mascara" className="gap-1.5">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Máscara</span>
            </TabsTrigger>
            <TabsTrigger value="testes" className="gap-1.5">
              <Terminal className="w-4 h-4" />
              <span className="hidden sm:inline">Testes</span>
            </TabsTrigger>
            <TabsTrigger value="ping99" className="gap-1.5">
              <Wifi className="w-4 h-4" />
              <span className="hidden sm:inline">Ping 99</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="consulta">
            <ConsultaTab form={form} setForm={setForm} />
          </TabsContent>

          <TabsContent value="mascara">
            <MascaraTab form={form} />
          </TabsContent>

          <TabsContent value="testes">
            <TestesTab form={form} />
          </TabsContent>

          <TabsContent value="ping99">
            <Ping99Tab form={form} />
          </TabsContent>
        </Tabs>

        {showHistory && (
          <Card className="mt-6 animate-fade-in">
            <CardHeader>
              <CardTitle className="text-lg">Histórico de Alterações</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>
              ) : (
                <div className="space-y-3">
                  {history.map(h => (
                    <div key={h.id} className="border rounded-lg p-3 text-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{(h as any).profiles?.name || "Desconhecido"}</span>
                        <span className="text-xs text-muted-foreground">{new Date(h.changed_at).toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {h.before_data && h.after_data && (
                          <div className="space-y-1">
                            {Object.keys(h.after_data).filter(k =>
                              k !== "raw_data" && k !== "updated_at" && k !== "updated_by" &&
                              JSON.stringify(h.before_data[k]) !== JSON.stringify(h.after_data[k])
                            ).map(k => (
                              <div key={k}>
                                <span className="font-medium text-foreground">{k}:</span>{" "}
                                <span className="text-destructive line-through">{String(h.before_data[k] ?? "")}</span>{" → "}
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
