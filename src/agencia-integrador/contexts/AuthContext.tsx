import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { useAuth as useRootAuth } from "@/contexts/AuthContext";

type CompatProfile = {
  employee_id: string | null;
  full_name: string | null;
  username: string | null;
  email?: string | null;
  is_active?: boolean;
};

type AuthContextType = {
  user: User | null;
  role: string | null;
  profile: CompatProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const root = useRootAuth();

  const value = useMemo<AuthContextType>(() => {
    const role = root.isAdmin ? "admin" : root.user ? "leitura" : null;

    const profile: CompatProfile | null = root.profile
      ? {
          employee_id: root.profile.user_code ?? null,
          full_name: root.profile.name ?? null,
          username: root.profile.user_code ?? null,
          email: root.user?.email ?? null,
          is_active: true,
        }
      : root.user
        ? {
            employee_id: null,
            full_name: null,
            username: null,
            email: root.user.email ?? null,
            is_active: true,
          }
        : null;

    return {
      user: root.user,
      role,
      profile,
      loading: root.loading,
      signIn: root.signIn,
      signOut: root.signOut,
    };
  }, [root]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

