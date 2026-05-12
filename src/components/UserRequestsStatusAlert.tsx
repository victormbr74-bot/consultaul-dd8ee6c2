import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BellRing, CheckCircle2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type ReviewedRequest = {
  id: string;
  cod_ul: string;
  status: "approved" | "rejected";
  reviewed_at: string | null;
  review_note: string | null;
};

const UserRequestsStatusAlert = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ReviewedRequest[]>([]);
  const [open, setOpen] = useState(false);

  const getAcknowledgedIds = () => {
    try {
      const stored = localStorage.getItem(`ack_requests_${user?.id}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const addAcknowledgedId = (ids: string[]) => {
    if (!user?.id) return;
    try {
      const existing = getAcknowledgedIds();
      const next = Array.from(new Set([...existing, ...ids]));
      localStorage.setItem(`ack_requests_${user.id}`, JSON.stringify(next));
    } catch {}
  };

  const fetchReviewed = useCallback(async () => {
    if (!user?.id || isAdmin) return;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // last 7 days
    const { data, error } = await (supabase as never as typeof supabase)
      .from("loterica_change_requests" as never)
      .select("id, cod_ul, status, reviewed_at, review_note")
      .eq("proposed_by", user.id)
      .in("status", ["approved", "rejected"])
      .gte("reviewed_at", since)
      .order("reviewed_at", { ascending: false });
      
    if (error) return;
    const list = ((data as unknown) as ReviewedRequest[]) || [];
    const ackIds = getAcknowledgedIds();
    const unacknowledged = list.filter((r) => !ackIds.includes(r.id));
    setRequests(unacknowledged);
  }, [user?.id, isAdmin]);

  useEffect(() => {
    if (!user?.id || isAdmin) return;
    void fetchReviewed();

    const channel = supabase
      .channel("user-change-requests-status")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "loterica_change_requests",
          filter: `proposed_by=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as ReviewedRequest;
          if (!row || (row.status !== "approved" && row.status !== "rejected")) return;
          const ackIds = getAcknowledgedIds();
          if (!ackIds.includes(row.id)) {
            // Auto open the popup when a new notification arrives
            setOpen(true);
            void fetchReviewed();
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, isAdmin, fetchReviewed]);

  if (isAdmin || requests.length === 0) return null;

  const total = requests.length;

  const handleDismissAll = () => {
    addAcknowledgedId(requests.map((r) => r.id));
    setRequests([]);
    setOpen(false);
  };

  const handleItemClick = (cod_ul: string) => {
    navigate(`/loterica/${cod_ul}`);
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn(
          "h-8 gap-2 border-sky-500/50 bg-sky-500/10 text-sky-700 hover:bg-sky-500/20 hover:text-sky-800",
          "dark:text-sky-300 dark:hover:text-sky-200 animate-pulse"
        )}
      >
        <BellRing className="w-4 h-4" />
        <span className="hidden sm:inline">Notificações</span>
        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-sky-500/20">
          {total}
        </Badge>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Notificações de Solicitações</DialogTitle>
            <DialogDescription>
              Acompanhe o status das suas alterações sugeridas.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] mt-4">
            <div className="flex flex-col gap-3 pr-4">
              {requests.map((r) => (
                <div 
                  key={r.id} 
                  className={cn(
                    "p-3 rounded-md border text-sm flex gap-3 items-start cursor-pointer transition-colors",
                    r.status === "approved" 
                      ? "bg-emerald-50/50 border-emerald-200 hover:bg-emerald-100/50 dark:bg-emerald-500/10 dark:border-emerald-500/20"
                      : "bg-destructive/10 border-destructive/20 hover:bg-destructive/20"
                  )}
                  onClick={() => handleItemClick(r.cod_ul)}
                >
                  {r.status === "approved" ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold mb-1">
                      UL {r.cod_ul}: {r.status === "approved" ? "Aprovada" : "Rejeitada"}
                    </p>
                    {r.review_note ? (
                      <p className="text-muted-foreground">{r.review_note}</p>
                    ) : (
                      <p className="text-muted-foreground">
                        {r.status === "approved" 
                          ? "Sua solicitação de alteração foi aprovada e aplicada." 
                          : "Sua solicitação não foi aprovada pelo administrador."}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="flex justify-end mt-4 pt-4 border-t">
            <Button onClick={handleDismissAll} variant="outline">
              Marcar como lidas
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UserRequestsStatusAlert;
