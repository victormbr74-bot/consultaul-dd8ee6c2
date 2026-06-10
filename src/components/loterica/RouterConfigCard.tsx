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
    <Card className="border border-emerald-400/30 bg-emerald-400/10 backdrop-blur-sm h-full">
      <CardHeader className="py-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Wrench className="h-4 w-4 text-emerald-500" />
          <span>Configurações no Roteador</span>
          <span className="text-xs font-medium text-foreground/70">
            {codUl}
            {nome ? ` - ${nome}` : ""}
          </span>
          {history.length > 0 && (
            <Badge
              variant="outline"
              className="ml-auto text-xs border-emerald-400/40 bg-emerald-400/15 text-emerald-700 dark:text-emerald-300"
            >
              {history.length} reg.
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pb-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="PRINCIPAL ou BACKUP" />
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
          <div className="space-y-1">
            <Label className="text-xs">Configuração feita</Label>
            <Select value={configType} onValueChange={setConfigType}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Selecione" />
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
        <div className="space-y-1">
          <Label className="text-xs">
            Observação <span className="text-destructive">*</span>
          </Label>
          <Textarea
            rows={2}
            placeholder="Descreva o que foi feito e o porquê (obrigatório)"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            className="min-h-[60px] resize-y bg-background/70 text-xs leading-5"
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
          <div className="space-y-1.5 border-t border-emerald-400/20 pt-2">
            <p className="text-[11px] font-medium text-muted-foreground">Histórico recente</p>
            <ul className="space-y-1.5 max-h-40 overflow-auto">
              {history.map((h) => {
                const ageMs = Date.now() - new Date(h.created_at).getTime();
                const overdue = !!user && h.created_by === user.id && ageMs > 3 * 24 * 60 * 60 * 1000;
                return (
                  <li
                    key={h.id}
                    className={cn(
                      "text-[11px] rounded border p-1.5",
                      overdue ? "border-destructive/40 bg-destructive/5" : "border-border/60 bg-background/40",
                    )}
                  >
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{h.tipo}</Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{h.config_type}</Badge>
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

