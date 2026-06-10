import { useCallback, useEffect, useState } from "react";
import { Wrench, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const ROUTER_CONFIG_TIPOS = ["PRINCIPAL", "BACKUP"] as const;
export const ROUTER_CONFIG_TYPES = [
  "BYPASS",
  "RETIRADO DE ROTA",
  "NEGA TFL",
  "PORTA EM SHUT",
  "BAIXADO PRIORIDADE VRRP",
  "TROCA DE OWNER",
] as const;

type RouterConfigRow = {
  id: string;
  cod_ul: string;
  tipo: string;
  config_type: string;
  observacao: string;
  created_at: string;
  created_by: string;
};

interface RouterConfigCardProps {
  codUl: string;
  nome?: string;
}

const RouterConfigCard = ({ codUl, nome }: RouterConfigCardProps) => {
  const { user } = useAuth();
  const [tipo, setTipo] = useState<string>("");
  const [configType, setConfigType] = useState<string>("");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<RouterConfigRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!codUl) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("loterica_router_configs" as never)
      .select("*")
      .eq("cod_ul", codUl)
      .order("created_at", { ascending: false })
      .limit(20);
    setLoading(false);
    if (error) {
      console.error("Erro ao carregar configurações", error);
      return;
    }
    setHistory((data as unknown as RouterConfigRow[]) || []);
  }, [codUl]);

  useEffect(() => {
    void load();
  }, [load]);

  const disabled = saving || !tipo || !configType || !observacao.trim();

  const handleSave = async () => {
    if (!user) {
      toast.error("Sessão expirada.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("loterica_router_configs" as never).insert({
      cod_ul: codUl,
      tipo,
      config_type: configType,
      observacao: observacao.trim(),
      created_by: user.id,
    } as never);
    setSaving(false);
    if (error) {
      toast.error("Falha ao salvar configuração", { description: error.message });
      return;
    }
    toast.success("Configuração registrada");
    setObservacao("");
    setTipo("");
    setConfigType("");
    void load();
  };

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
          <Wrench className="h-5 w-5" />
          <span>Configurações no Roteador</span>
          <span className="text-sm font-medium text-foreground/70">
            {codUl}
            {nome ? ` - ${nome}` : ""}
          </span>
          {history.length > 0 && (
            <Badge variant="outline" className="ml-auto">
              {history.length} registro{history.length === 1 ? "" : "s"}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione PRINCIPAL ou BACKUP" />
              </SelectTrigger>
              <SelectContent>
                {ROUTER_CONFIG_TIPOS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Configuração feita</Label>
            <Select value={configType} onValueChange={setConfigType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a configuração" />
              </SelectTrigger>
              <SelectContent>
                {ROUTER_CONFIG_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>
            Observação <span className="text-destructive">*</span>
          </Label>
          <Textarea
            rows={3}
            placeholder="Descreva o que foi feito e o porquê (obrigatório)"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={disabled} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar configuração
          </Button>
        </div>

        {loading ? (
          <p className="text-xs text-muted-foreground">Carregando histórico...</p>
        ) : history.length > 0 ? (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">Histórico recente</p>
            <ul className="space-y-2 max-h-60 overflow-auto">
              {history.map((h) => {
                const ageMs = Date.now() - new Date(h.created_at).getTime();
                const overdue = !!user && h.created_by === user.id && ageMs > 3 * 24 * 60 * 60 * 1000;
                return (
                  <li
                    key={h.id}
                    className={cn(
                      "text-xs rounded border p-2",
                      overdue ? "border-destructive/40 bg-destructive/5" : "border-border",
                    )}
                  >
                    <div className="flex flex-wrap gap-2 items-center">
                      <Badge variant="secondary">{h.tipo}</Badge>
                      <Badge variant="outline">{h.config_type}</Badge>
                      <span className="text-muted-foreground">
                        {new Date(h.created_at).toLocaleString("pt-BR")}
                      </span>
                      {overdue && (
                        <span className="ml-auto flex items-center gap-1 text-destructive">
                          <AlertTriangle className="h-3 w-3" /> Verificar
                        </span>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap">{h.observacao}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default RouterConfigCard;
