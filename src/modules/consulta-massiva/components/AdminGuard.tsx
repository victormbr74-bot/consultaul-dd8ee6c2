import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/modules/consulta-massiva/hooks/use-auth";

/**
 * Render-blocking guard for ADMIN-only pages.
 * Prevents the admin UI from flashing while role is loading or for non-admins.
 * RLS at the database layer is the source of truth — this only hides the UI.
 */
export function AdminGuard({ children }: { children: ReactNode }) {
  const { role, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && role !== null && role !== "ADMIN") {
      nav("/", { replace: true });
    }
  }, [loading, role, nav]);

  if (loading || role === null) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Validando permissões...
      </div>
    );
  }
  if (role !== "ADMIN") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-2 p-10 text-center">
        <ShieldAlert className="h-8 w-8 text-noc-red" />
        <div className="text-sm font-semibold">403 — Acesso restrito</div>
        <div className="text-xs text-muted-foreground">
          Esta área é exclusiva para administradores. Redirecionando...
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
