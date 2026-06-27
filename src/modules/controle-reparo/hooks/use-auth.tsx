import { useAuth as useConsultaUlAuth } from "@/contexts/AuthContext";

export type AppRole = "admin" | "user";

export function useAuth() {
  const auth = useConsultaUlAuth();
  const role: AppRole = auth.isAdmin ? "admin" : "user";

  return {
    user: auth.user,
    session: auth.session,
    role,
    nome: auth.profile?.name ?? auth.user?.email ?? null,
    loading: auth.loading,
    canWrite: auth.isAdmin,
    isAdmin: auth.isAdmin,
    isAdminMaster: auth.isAdmin,
    signOut: auth.signOut,
  };
}
