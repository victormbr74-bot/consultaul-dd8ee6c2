import { useAuth as useConsultaUlAuth } from "@/contexts/AuthContext";

export type AppRole = "ADMIN" | "OPERADOR";

export function useAuth() {
  const auth = useConsultaUlAuth();

  return {
    user: auth.user,
    session: auth.session,
    role: (auth.isAdmin ? "ADMIN" : "OPERADOR") as AppRole,
    loading: auth.loading,
    signOut: auth.signOut,
  };
}
