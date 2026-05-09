import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const AUTO_DISMISS_MS = 2 * 60 * 1000; // 2 minutes

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
  const [dismissed, setDismissed] = useState(false);
  const dismissTimerRef = useRef<number | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  const scheduleAutoDismiss = useCallback(() => {
    if (dismissTimerRef.current) window.clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = window.setTimeout(() => {
      setDismissed(true);
    }, AUTO_DISMISS_MS);
  }, []);

  const fetchReviewed = useCallback(async () => {
    if (!user?.id || isAdmin) return;
    const since = new Date(Date.now() - AUTO_DISMISS_MS).toISOString();
    const { data, error } = await (supabase as never as typeof supabase)
      .from("loterica_change_requests" as never)
      .select("id, cod_ul, status, reviewed_at, review_note")
      .eq("proposed_by", user.id)
      .in("status", ["approved", "rejected"])
      .gte("reviewed_at", since)
      .order("reviewed_at", { ascending: false })
      .limit(20);
    if (error) return;
    const list = ((data as unknown) as ReviewedRequest[]) || [];
    setRequests(list);
    if (list.length > 0) {
      setDismissed(false);
      scheduleAutoDismiss();
      list.forEach((r) => seenIdsRef.current.add(r.id));
    }
  }, [user?.id, isAdmin, scheduleAutoDismiss]);

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
          if (!seenIdsRef.current.has(row.id)) {
            seenIdsRef.current.add(row.id);
            if (row.status === "approved") {
              toast.success("✅ Solicitação aprovada", {
                description: `Sua alteração da UL ${row.cod_ul} foi aprovada.`,
                duration: 15000,
              });
            } else {
              toast.error("❌ Solicitação rejeitada", {
                description: row.review_note
                  ? `UL ${row.cod_ul}: ${row.review_note}`
                  : `Sua alteração da UL ${row.cod_ul} foi rejeitada.`,
                duration: 15000,
              });
            }
          }
          void fetchReviewed();
        },
      )
      .subscribe();

    return () => {
      if (dismissTimerRef.current) window.clearTimeout(dismissTimerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [user?.id, isAdmin, fetchReviewed]);

  if (isAdmin || dismissed || requests.length === 0) return null;

  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;
  const onlyApproved = approvedCount > 0 && rejectedCount === 0;
  const onlyRejected = rejectedCount > 0 && approvedCount === 0;

  const Icon = onlyRejected ? AlertTriangle : CheckCircle2;
  const label = onlyApproved
    ? approvedCount === 1
      ? "Solicitação aprovada"
      : `${approvedCount} solicitações aprovadas`
    : onlyRejected
      ? rejectedCount === 1
        ? "Solicitação rejeitada"
        : `${rejectedCount} solicitações rejeitadas`
      : `${approvedCount} aprovada(s) · ${rejectedCount} rejeitada(s)`;

  const total = requests.length;
  const lastCod = requests[0]?.cod_ul;

  const colorClasses = onlyRejected
    ? "border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20"
    : "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300 dark:hover:text-emerald-200";

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={() => lastCod && navigate(`/loterica/${lastCod}`)}
        className={cn("h-8 gap-2 animate-pulse", colorClasses)}
      >
        <Icon className="w-4 h-4" />
        <span className="hidden sm:inline">{label}</span>
        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
          {total}
        </Badge>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-muted-foreground"
        onClick={() => setDismissed(true)}
        aria-label="Fechar"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
};

export default UserRequestsStatusAlert;
