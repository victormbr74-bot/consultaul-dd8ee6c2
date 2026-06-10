import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type ConfigRow = {
  id: string;
  cod_ul: string;
  tipo: string;
  config_type: string;
  observacao: string;
  created_at: string;
  created_by: string;
  reminder_acknowledged_at: string | null;
};

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

const RouterConfigReminderAlert = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ConfigRow[]>([]);
  const [open, setOpen] = useState(false);
  const [popupShownIds, setPopupShownIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    const cutoff = new Date(Date.now() - THREE_DAYS_MS).toISOString();
    const { data, error } = await supabase
      .from("loterica_router_configs" as never)
      .select("*")
      .eq("created_by", user.id)
      .is("reminder_acknowledged_at", null)
      .lte("created_at", cutoff)
      .order("created_at", { ascending: false });
    if (error) {
      return;
    }
    setItems((data as unknown as ConfigRow[]) || []);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setItems([]);
      return;
    }
    void fetchData();
    const id = window.setInterval(() => void fetchData(), 60000);
    const channel = supabase
      .channel("router-configs-reminder")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loterica_router_configs" },
        () => void fetchData(),
      )
      .subscribe();
    return () => {
      window.clearInterval(id);
      void supabase.removeChannel(channel);
    };
  }, [fetchData, user?.id]);

  // Popup for newly-overdue items
  useEffect(() => {
    if (!items.length) return;
    for (const it of items) {
      if (popupShownIds.has(it.id)) continue;
      toast.warning("⚠️ Verificar configuração no roteador", {
        description: `UL ${it.cod_ul} - ${it.tipo} / ${it.config_type} (há mais de 3 dias).`,
        duration: 15000,
        action: {
          label: "Ver",
          onClick: () => navigate(`/loterica/${encodeURIComponent(it.cod_ul)}`),
        },
      });
    }
    setPopupShownIds((prev) => {
      const next = new Set(prev);
      items.forEach((i) => next.add(i.id));
      return next;
    });
  }, [items, popupShownIds, navigate]);

  const count = items.length;
  const sorted = useMemo(
    () => [...items].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [items],
  );

  const acknowledge = async (id: string) => {
    const { error } = await supabase
      .from("loterica_router_configs" as never)
      .update({ reminder_acknowledged_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) {
      toast.error("Falha ao confirmar verificação");
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  if (!user || count === 0) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn(
          "h-8 gap-2 border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive",
          "animate-pulse",
        )}
      >
        <AlertTriangle className="w-4 h-4" />
        <span className="hidden sm:inline">Verificar roteador</span>
        <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
          {count}
        </Badge>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Configurações pendentes de verificação
            </DialogTitle>
            <DialogDescription>
              Estas alterações foram feitas há mais de 3 dias. Verifique novamente o status no
              roteador.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            <ul className="space-y-2 pr-2">
              {sorted.map((it) => (
                <li
                  key={it.id}
                  className="rounded border border-destructive/30 bg-destructive/5 p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="font-mono text-xs text-primary hover:underline"
                      onClick={() => {
                        setOpen(false);
                        navigate(`/loterica/${encodeURIComponent(it.cod_ul)}`);
                      }}
                    >
                      {it.cod_ul}
                    </button>
                    <Badge variant="secondary">{it.tipo}</Badge>
                    <Badge variant="outline">{it.config_type}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(it.created_at).toLocaleString("pt-BR")}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto h-7"
                      onClick={() => void acknowledge(it.id)}
                    >
                      Já verifiquei
                    </Button>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-xs">{it.observacao}</p>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RouterConfigReminderAlert;
