import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { BellRing } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PendingChangeRequestsAlert = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!isAdmin) return;
    const { count: c, error } = await supabase
      .from("loterica_change_requests" as never)
      .select("id", { head: true, count: "exact" })
      .eq("status", "pending");
    if (!error) setCount(c || 0);
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      setCount(0);
      return;
    }
    void fetchCount();
    const interval = window.setInterval(() => void fetchCount(), 30000);

    const channel = supabase
      .channel("header-change-requests-alert")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loterica_change_requests" },
        (payload) => {
          void fetchCount();
          if (
            payload.eventType === "INSERT" &&
            (payload.new as { status?: string })?.status === "pending"
          ) {
            const codUl = (payload.new as { cod_ul?: string })?.cod_ul ?? "";
            toast.info("🔔 Nova solicitação de alteração", {
              description: codUl
                ? `UL ${codUl} aguarda aprovação.`
                : "Há uma nova solicitação aguardando aprovação.",
              duration: 15000,
              action: {
                label: "Revisar",
                onClick: () => navigate("/admin/dados"),
              },
            });
          }
        },
      )
      .subscribe();

    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [isAdmin, fetchCount, navigate]);

  if (!isAdmin || count === 0) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => navigate("/admin/dados")}
      className={cn(
        "h-8 gap-2 border-amber-500/50 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 hover:text-amber-800",
        "dark:text-amber-300 dark:hover:text-amber-200 animate-pulse"
      )}
    >
      <BellRing className="w-4 h-4" />
      <span className="hidden sm:inline">Solicitações pendentes</span>
      <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
        {count}
      </Badge>
    </Button>
  );
};

export default PendingChangeRequestsAlert;
