import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RejectedRequest {
  id: string;
  cod_ul: string;
  review_note: string | null;
  reviewed_at: string | null;
  proposed_at: string;
}

export default function RejectedRequestsNotification() {
  const { user, isAdmin } = useAuth();
  const [requests, setRequests] = useState<RejectedRequest[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);

  const fetchRejected = useCallback(async () => {
    if (!user?.id || isAdmin) return;
    try {
      const { data, error } = await (supabase as any)
        .from("loterica_change_requests")
        .select("id, cod_ul, review_note, reviewed_at, proposed_at")
        .eq("proposed_by", user.id)
        .eq("status", "rejected")
        .order("reviewed_at", { ascending: false })
        .limit(50);

      if (error) return;
      setRequests((data || []) as RejectedRequest[]);
    } catch {
      // ignore
    }
  }, [user?.id, isAdmin]);

  useEffect(() => {
    void fetchRejected();

    const channel = supabase
      .channel("rejected-notifications")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "loterica_change_requests" },
        () => void fetchRejected(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchRejected]);

  const dismiss = async (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  };

  const dismissAll = () => {
    setDismissed(new Set(requests.map((r) => r.id)));
  };

  const visible = requests.filter((r) => !dismissed.has(r.id));
  if (visible.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full space-y-2">
      <div className="bg-destructive/10 border border-destructive/30 rounded-lg shadow-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-destructive font-medium text-sm">
            <AlertTriangle className="w-4 h-4" />
            {visible.length} alteração(ões) rejeitada(s)
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={dismissAll}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {visible.map((r) => (
              <div
                key={r.id}
                className="bg-background/80 rounded-md p-3 text-sm border border-border"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-medium text-xs">{r.cod_ul}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 text-muted-foreground"
                    onClick={() => void dismiss(r.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs mb-1">
                  Solicitado em {new Date(r.proposed_at).toLocaleDateString("pt-BR")}
                  {r.reviewed_at && <> · Rejeitado em {new Date(r.reviewed_at).toLocaleDateString("pt-BR")}</>}
                </p>
                <p className="text-foreground text-xs">
                  <strong>Motivo:</strong> {r.review_note || "Nenhum motivo informado."}
                </p>
              </div>
            ))}
          </div>
        )}

        {!expanded && visible.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Clique na seta para ver detalhes das rejeições.
          </p>
        )}
      </div>
    </div>
  );
}
