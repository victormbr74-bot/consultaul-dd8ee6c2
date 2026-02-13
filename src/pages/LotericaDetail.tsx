import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, History } from "lucide-react";

const FIELDS: Array<{ key: string; label: string; mono?: boolean }> = [
  { key: "nome_loterica", label: "Nome" },
  { key: "ccto_oi", label: "CCTO OI" },
  { key: "ccto_oemp", label: "CCTO OEMP" },
  { key: "designacao_nova", label: "Designação Nova" },
  { key: "operadora", label: "Operadora" },
  { key: "ip_nat", label: "IP NAT", mono: true },
  { key: "ip_wan", label: "IP WAN", mono: true },
  { key: "loopback_wan", label: "Loopback WAN", mono: true },
  { key: "loopback_lan", label: "Loopback LAN", mono: true },
  { key: "endereco", label: "Endereço" },
  { key: "contato", label: "Contato" },
  { key: "status", label: "Status" },
  { key: "cidade", label: "Cidade" },
  { key: "uf", label: "UF" },
];

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

      <main className="container px-4 py-6 max-w-4xl">
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="text-lg">{form.nome_loterica || "Sem nome"}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {form.cidade} - {form.uf} • Atualizado em {form.updated_at ? new Date(form.updated_at).toLocaleString("pt-BR") : "N/A"}
            </p>
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
                                <span className="text-success">{String(h.after_data[k] ?? "")}</span>
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
