import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, CheckCircle2, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChangeRequest {
  id: string;
  cod_ul: string;
  review_note: string | null;
  reviewed_at: string | null;
  proposed_at: string;
  status: string;
}

export default function RejectedRequestsNotification() {
  const { user, isAdmin } = useAuth();
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);

  const fetchReviewed = useCallback(async () => {
    if (!user?.id || isAdmin) return;
    try {
      const { data, error } = await (supabase as any)
        .from("loterica_change_requests")
        .select("id, cod_ul, review_note, reviewed_at, proposed_at, status")
        .eq("proposed_by", user.id)
        .in("status", ["rejected", "approved"])
        .order("reviewed_at", { ascending: false })
        .limit(50);

      if (error) return;
      setRequests((data || []) as ChangeRequest[]);
    } catch {
      // ignore
    }
  }, [user?.id, isAdmin]);

  useEffect(() => {
    void fetchReviewed();

    const channel = supabase
      .channel("change-request-notifications")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "loterica_change_requests" },
        () => void fetchReviewed(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchReviewed]);

  const dismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  };

  const dismissAll = () => {
    setDismissed(new Set(requests.map((r) => r.id)));
  };

  const visible = requests.filter((r) => !dismissed.has(r.id));
  const rejected = visible.filter((r) => r.status === "rejected");
  const approved = visible.filter((r) => r.status === "approved");

  if (visible.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full space-y-2">
      <div className="bg-muted/80 border border-border rounded-lg shadow-lg p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 font-medium text-sm text-foreground">
            {rejected.length > 0 && approved.length > 0 ? (
              <>{visible.length} solicitação(ões) revisada(s)</>
            ) : rejected.length > 0 ? (
              <>
                <AlertTriangle className="w-4 h-4 text-destructive" />
                {rejected.length} alteração(ões) rejeitada(s)
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                {approved.length} alteração(ões) aprovada(s)
              </>
            )}
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
            {visible.map((r) => {
              const isApproved = r.status === "approved";
              return (
                <div
                  key={r.id}
                  className={`rounded-md p-3 text-sm border ${
                    isApproved
                      ? "bg-green-500/10 border-green-500/30"
                      : "bg-destructive/10 border-destructive/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      {isApproved ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                      )}
                      <span className="font-mono font-medium text-xs">{r.cod_ul}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 text-muted-foreground"
                      onClick={() => dismiss(r.id)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-xs mb-1">
                    Solicitado em {new Date(r.proposed_at).toLocaleDateString("pt-BR")}
                    {r.reviewed_at && (
                      <>
                        {" · "}
                        {isApproved ? "Aprovado" : "Rejeitado"} em{" "}
                        {new Date(r.reviewed_at).toLocaleDateString("pt-BR")}
                      </>
                    )}
                  </p>
                  {isApproved ? (
                    <p className="text-green-700 dark:text-green-400 text-xs font-medium">
                      ✓ Alteração aplicada com sucesso.
                    </p>
                  ) : (
                    <p className="text-foreground text-xs">
                      <strong>Motivo:</strong> {r.review_note || "Nenhum motivo informado."}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!expanded && visible.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Clique na seta para ver detalhes.
          </p>
        )}
      </div>
    </div>
  );
}
